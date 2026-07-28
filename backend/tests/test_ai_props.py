"""Property-based tests for AI assistant intent handling and response format.

**Validates: Requirements 22.2, 23.1, 23.2, 23.3, 23.4, 24.1**

Property 21: AI Intent Handling
- OUT_OF_SCOPE messages get scope-restriction response
- Each of 8 intents produces valid non-error AIResponse

Property 22: AI Structured Response Format
- Every response has non-empty reply, valid intent enum, valid ISO8601 dataFreshness
- Any stationIds in response exist in Station_Coordinate_Dataset
"""

import json
import os
import sys
from datetime import datetime

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from marshmallow import ValidationError

# Add backend to path
sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
)

from app.services.ai_orchestrator import (
    RuleBasedAssistant,
    classify_intent,
    has_mrt_signal,
    VALID_INTENTS,
    INTENT_PATTERNS,
    _load_stations,
)
from app.integrations.ai_client import HybridProvider
from app.schemas.assistant_schema import ChatRequestSchema


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_valid_station_ids() -> set[str]:
    """Load all valid station IDs from stations.json."""
    stations = _load_stations()
    return {s["id"] for s in stations}


# Build intent keyword map for strategies
_INTENT_KEYWORDS: dict[str, list[str]] = {
    intent: keywords for intent, keywords in INTENT_PATTERNS.items()
}

# Strategy: generate a message containing a keyword for a specific intent
_all_intent_keywords = [
    (intent, kw)
    for intent, keywords in _INTENT_KEYWORDS.items()
    for kw in keywords
]


# Strategy: generate out-of-scope messages (no intent keywords)
_out_of_scope_messages = st.sampled_from([
    "What's the weather today?",
    "Tell me a joke",
    "How do I cook pasta?",
    "What is the meaning of life?",
    "Who won the football match?",
    "Can you help me with my homework?",
    "What's the stock price of Apple?",
    "Translate hello to Chinese",
    "What's 2 + 2?",
    "Play some music for me",
])

# Strategy: messages with intent keywords
_intent_keyword_strategy = st.sampled_from(_all_intent_keywords)

# Construct assistant instance once
_assistant = RuleBasedAssistant()


# ---------------------------------------------------------------------------
# Test 1: For each intent keyword, classify_intent returns the expected intent
# **Validates: Requirements 23.1**
# ---------------------------------------------------------------------------

@given(data=_intent_keyword_strategy)
@settings(max_examples=30)
def test_classify_intent_returns_expected_intent(data):
    """For each intent keyword, classify_intent correctly identifies the intent."""
    expected_intent, keyword = data
    # Build a simple message containing the keyword
    message = f"Can you help me {keyword} please?"

    result = classify_intent(message)

    assert result == expected_intent, (
        f"Expected intent '{expected_intent}' for keyword '{keyword}', "
        f"but got '{result}'"
    )


# ---------------------------------------------------------------------------
# Test 2: OUT_OF_SCOPE response contains scope-restriction message
# **Validates: Requirements 23.4**
# ---------------------------------------------------------------------------

@given(message=_out_of_scope_messages)
@settings(max_examples=30)
def test_out_of_scope_response_contains_scope_restriction(message):
    """OUT_OF_SCOPE messages produce a response mentioning MRT focus."""
    response = _assistant.chat(message, {})

    assert response["intent"] == "OUT_OF_SCOPE", (
        f"Expected OUT_OF_SCOPE intent for '{message}', got '{response['intent']}'"
    )
    # The reply should indicate the assistant is MRT-focused
    reply_lower = response["reply"].lower()
    assert "mrt" in reply_lower, (
        f"OUT_OF_SCOPE reply should mention MRT scope restriction, got: "
        f"'{response['reply']}'"
    )


# ---------------------------------------------------------------------------
# Test 3: All 8 intents produce a response with non-empty "reply" field
# **Validates: Requirements 23.2**
# ---------------------------------------------------------------------------

# Strategy: pick an intent and generate a message triggering it
def _message_for_intent(intent: str) -> str:
    """Generate a sample message that triggers the given intent."""
    if intent == "OUT_OF_SCOPE":
        return "What's the weather like today?"
    keywords = INTENT_PATTERNS[intent]
    return f"Can you help me with {keywords[0]}?"


@given(intent=st.sampled_from(VALID_INTENTS))
@settings(max_examples=30)
def test_all_intents_produce_nonempty_reply(intent):
    """Every valid intent produces a response with a non-empty reply field."""
    message = _message_for_intent(intent)
    response = _assistant.chat(message, {})

    assert "reply" in response, f"Response missing 'reply' field for intent {intent}"
    assert isinstance(response["reply"], str), (
        f"reply should be a string, got {type(response['reply'])}"
    )
    assert len(response["reply"].strip()) > 0, (
        f"reply should be non-empty for intent {intent}, got: '{response['reply']}'"
    )


# ---------------------------------------------------------------------------
# Test 4: All responses have "intent" in VALID_INTENTS
# **Validates: Requirements 23.1**
# ---------------------------------------------------------------------------

@given(intent=st.sampled_from(VALID_INTENTS))
@settings(max_examples=30)
def test_all_responses_have_valid_intent_enum(intent):
    """Every response's intent field is one of the 8 VALID_INTENTS."""
    message = _message_for_intent(intent)
    response = _assistant.chat(message, {})

    assert "intent" in response, f"Response missing 'intent' field"
    assert response["intent"] in VALID_INTENTS, (
        f"Response intent '{response['intent']}' not in VALID_INTENTS: "
        f"{VALID_INTENTS}"
    )


# ---------------------------------------------------------------------------
# Test 5: All responses have "dataFreshness" as valid ISO8601
# **Validates: Requirements 23.3**
# ---------------------------------------------------------------------------

@given(intent=st.sampled_from(VALID_INTENTS))
@settings(max_examples=30)
def test_all_responses_have_valid_iso8601_data_freshness(intent):
    """Every response's dataFreshness field is a valid ISO8601 datetime string."""
    message = _message_for_intent(intent)
    response = _assistant.chat(message, {})

    assert "dataFreshness" in response, (
        f"Response missing 'dataFreshness' field for intent {intent}"
    )
    freshness = response["dataFreshness"]
    assert isinstance(freshness, str), (
        f"dataFreshness should be a string, got {type(freshness)}"
    )

    # Validate ISO8601 format by parsing
    try:
        parsed = datetime.fromisoformat(freshness)
    except (ValueError, TypeError) as e:
        pytest.fail(
            f"dataFreshness '{freshness}' is not valid ISO8601: {e}"
        )

    assert parsed is not None


# ---------------------------------------------------------------------------
# Test 6: Any stationIds in responses exist in stations.json
# **Validates: Requirements 23.2, 24.1**
# ---------------------------------------------------------------------------

# Messages that mention real station names to trigger stationId population
_messages_with_stations = st.sampled_from([
    "How do I get to Jurong East?",
    "Is Orchard station crowded?",
    "Last train from City Hall",
    "Transfer at Buona Vista",
    "Is Bishan accessible?",
    "Facilities at Dhoby Ghaut",
    "Any delay at Raffles Place?",
    "Route from Jurong East to City Hall",
])


@given(message=_messages_with_stations)
@settings(max_examples=30)
def test_station_ids_in_response_exist_in_dataset(message):
    """Any stationIds returned in a response must exist in Station_Coordinate_Dataset."""
    valid_ids = _get_valid_station_ids()
    response = _assistant.chat(message, {})

    station_ids = response.get("stationIds", [])
    for sid in station_ids:
        assert sid in valid_ids, (
            f"stationId '{sid}' from response not found in stations.json. "
            f"Message was: '{message}'"
        )


# ---------------------------------------------------------------------------
# HybridProvider — cost-control routing (see AIPLAN.md)
# ---------------------------------------------------------------------------


class _StubLLMProvider:
    """Records call count instead of making real network calls."""

    def __init__(self):
        self.call_count = 0

    def chat(self, message: str, context: dict) -> dict:
        self.call_count += 1
        return {
            "reply": "stub reply",
            "intent": "OUT_OF_SCOPE",
            "stationIds": [],
            "lineCodes": [],
            "route": None,
            "warning": None,
            "uiAction": None,
            "dataFreshness": datetime.now().isoformat(),
        }


class _FlakyThenHealthyLLMProvider:
    """Simulates a provider that fails once (e.g. a 429) then recovers —
    its own internal fallback marks itself _isDegraded, same as the real
    OpenAI/Groq providers' except-block fallback."""

    def __init__(self):
        self.call_count = 0

    def chat(self, message: str, context: dict) -> dict:
        self.call_count += 1
        if self.call_count == 1:
            return {
                "reply": "degraded fallback reply",
                "intent": "OUT_OF_SCOPE",
                "_isDegraded": True,
            }
        return {"reply": "real llm reply", "intent": "OUT_OF_SCOPE"}


def test_hybrid_provider_does_not_cache_degraded_fallback_response():
    """A transient provider failure must not get 'burned in' to the cache —
    the next identical request should retry the provider, not keep serving
    the stale fallback for the rest of the TTL. See AIPLAN.md phase 20."""
    provider = _FlakyThenHealthyLLMProvider()
    hybrid = HybridProvider(provider)

    first = hybrid.chat("a message with no mrt signal at all", {})
    second = hybrid.chat("a message with no mrt signal at all", {})

    assert provider.call_count == 2  # second call retried, wasn't a cache hit
    assert first["reply"] == "degraded fallback reply"
    assert second["reply"] == "real llm reply"
    assert "_isDegraded" not in first  # marker stripped, never leaks to the API
    assert "_isDegraded" not in second


def test_hybrid_provider_caches_a_real_response_normally():
    """Sanity check: the fix doesn't disable caching entirely — a normal
    (non-degraded) response is still cached as before."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    first = hybrid.chat("How much does an MRT ticket cost today", {})
    second = hybrid.chat("How much does an MRT ticket cost today", {})

    assert stub.call_count == 1
    assert first == second


def test_hybrid_provider_forwards_classifiable_intent_to_llm():
    """Since the agentic redesign (AIPLAN.md, "Agentic tool-calling"), a
    message the rule-based engine could classify no longer short-circuits
    to the free path — it reaches the LLM too, so tool-backed answers are
    possible for every intent, not just OUT_OF_SCOPE leftovers."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    response = hybrid.chat("Last train from Bugis", {})

    assert stub.call_count == 1
    assert response["reply"] == "stub reply"


def test_hybrid_provider_forwards_out_of_scope_to_llm():
    """A message with MRT signal but no matching intent still reaches the
    wrapped LLM provider (e.g. a generic question about SMRT)."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    response = hybrid.chat("What's SMRT's contact number?", {})

    assert stub.call_count == 1
    assert response["reply"] == "stub reply"


def test_hybrid_provider_cache_hit_avoids_second_llm_call():
    """Sending the identical out-of-scope message twice only calls the LLM once."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    first = hybrid.chat("How much does an MRT ticket cost?", {})
    second = hybrid.chat("How much does an MRT ticket cost?", {})

    assert stub.call_count == 1
    assert first == second


def test_hybrid_provider_cache_key_varies_by_language():
    """Identical message + station but a different context.language must
    not collide on the same cache entry — otherwise switching the UI
    language and re-asking the same question silently replays the first
    (wrong-language) answer instead of getting a fresh one."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    hybrid.chat("crowd level at Bishan", {"currentStationId": "bishan", "language": "en"})
    hybrid.chat("crowd level at Bishan", {"currentStationId": "bishan", "language": "zh"})

    assert stub.call_count == 2


def test_hybrid_provider_cache_key_varies_by_route_preference():
    """Identical message + station but a different selectedRoutePreference
    must not collide on the same cache entry, for the same reason."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    hybrid.chat(
        "plan a route", {"currentStationId": "bishan", "selectedRoutePreference": "FASTEST"}
    )
    hybrid.chat(
        "plan a route",
        {"currentStationId": "bishan", "selectedRoutePreference": "LEAST_CROWDED"},
    )

    assert stub.call_count == 2


def test_hybrid_provider_daily_cap_forces_rule_based_fallback():
    """Once the daily call budget is exhausted, further OUT_OF_SCOPE
    messages fall back to the free rule-based assistant instead of the LLM."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub, daily_cap=1)

    first = hybrid.chat("What's SMRT's contact number?", {})
    second = hybrid.chat("How much does an MRT ticket cost?", {})

    assert stub.call_count == 1
    assert first["reply"] == "stub reply"
    assert second["intent"] == "OUT_OF_SCOPE"
    assert "mrt" in second["reply"].lower()


def test_hybrid_provider_forwards_off_topic_message_to_llm():
    """A message with no MRT-related signal at all (e.g. 'Code me a
    website') is no longer rejected by a keyword gate — it reaches the
    wrapped LLM, whose own system prompt performs the real semantic
    scope-restriction judgment. See AIPLAN.md."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    response = hybrid.chat("Code me a website", {})

    assert stub.call_count == 1
    assert response["reply"] == "stub reply"


@pytest.mark.parametrize("message", ["", "   ", "\n\t "])
def test_hybrid_provider_rejects_empty_message_without_llm_call(message):
    """Empty or whitespace-only messages are rejected for free — the one
    case ChatRequestSchema doesn't already prevent (no min length)."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub)

    response = hybrid.chat(message, {})

    assert stub.call_count == 0
    assert response["intent"] == "OUT_OF_SCOPE"
    assert "mrt" in response["reply"].lower()


# ---------------------------------------------------------------------------
# has_mrt_signal — free pre-filter gate (see AIPLAN.md)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message",
    [
        "Code me a website",
        "Tell me a joke",
        "What's the weather like today?",
        "What's 2 + 2?",
    ],
)
def test_has_mrt_signal_false_for_unrelated_messages(message):
    """Messages with no MRT-related vocabulary, station name, or line
    code have no signal."""
    assert has_mrt_signal(message) is False


@pytest.mark.parametrize(
    "message",
    [
        "What's SMRT's contact number?",
        "Is NS1 open today?",
        "Tell me something about Bishan",
        "Last train from Bugis",
    ],
)
def test_has_mrt_signal_true_for_related_messages(message):
    """Messages with transit vocabulary, a line code, a station name, or
    an intent keyword all have signal."""
    assert has_mrt_signal(message) is True


# ---------------------------------------------------------------------------
# ChatRequestSchema — input length cap (see AIPLAN.md)
# ---------------------------------------------------------------------------


def test_chat_request_schema_rejects_oversized_message():
    """Messages over 500 characters fail schema validation."""
    schema = ChatRequestSchema()
    with pytest.raises(ValidationError):
        schema.load({"message": "a" * 501})


def test_chat_request_schema_accepts_message_at_limit():
    """Messages at exactly 500 characters are accepted."""
    schema = ChatRequestSchema()
    data = schema.load({"message": "a" * 500})
    assert data["message"] == "a" * 500


# ---------------------------------------------------------------------------
# Provider-failure classification — degraded replies name their cause
# instead of looking like a normal (possibly wrong-topic) answer.
# ---------------------------------------------------------------------------


def test_groq_provider_429_prepends_rate_limited_note():
    """A 429 from Groq is classified as rate_limited and the fallback reply
    leads with an honest note naming that cause, in the request's language."""
    import requests
    from unittest.mock import MagicMock, patch

    from app.integrations.ai_client import GroqProvider

    resp = MagicMock()
    resp.status_code = 429
    err = requests.exceptions.HTTPError("429 rate limited")
    err.response = resp

    provider = GroqProvider(api_key="fake")
    with patch("app.integrations.ai_client.requests.post") as mock_post:
        mock_post.return_value.raise_for_status.side_effect = err
        result = provider.chat("does Bukit Panjang have a lift", {"language": "en"})

    assert result["reply"].startswith("The AI assistant has hit today's usage limit")
    assert "Bukit Panjang" in result["reply"]  # real rule-based answer still included


def test_groq_provider_429_note_respects_language_context():
    """The rate-limit note is translated per context.language, not just English."""
    import requests
    from unittest.mock import MagicMock, patch

    from app.integrations.ai_client import GroqProvider

    resp = MagicMock()
    resp.status_code = 429
    err = requests.exceptions.HTTPError("429 rate limited")
    err.response = resp

    provider = GroqProvider(api_key="fake")
    with patch("app.integrations.ai_client.requests.post") as mock_post:
        mock_post.return_value.raise_for_status.side_effect = err
        result = provider.chat("from Bishan to Jurong East", {"language": "zh"})

    assert result["reply"].startswith("AI助手今日的使用额度已用完")


def test_groq_provider_non_429_failure_uses_generic_provider_error_note():
    """A non-rate-limit failure (network error, timeout, etc.) gets the
    generic 'temporarily unavailable' note, not the rate-limit-specific one."""
    import requests
    from unittest.mock import patch

    from app.integrations.ai_client import GroqProvider

    provider = GroqProvider(api_key="fake")
    with patch("app.integrations.ai_client.requests.post") as mock_post:
        mock_post.side_effect = requests.exceptions.ConnectionError("boom")
        result = provider.chat("does Bukit Panjang have a lift", {"language": "en"})

    assert result["reply"].startswith("The AI assistant is temporarily unavailable")
    assert "hit today's usage limit" not in result["reply"]


def test_hybrid_provider_daily_cap_note_names_the_cause():
    """Once the daily call budget is exhausted, the fallback reply says so
    explicitly rather than silently returning a plain rule-based answer."""
    stub = _StubLLMProvider()
    hybrid = HybridProvider(stub, daily_cap=1)

    hybrid.chat("What's SMRT's contact number?", {})
    second = hybrid.chat("does Bukit Panjang have a lift", {"language": "en"})

    assert second["reply"].startswith("The AI assistant has reached its daily call limit")


def test_out_of_scope_reply_gives_example_prompts_not_vague_decline():
    """The OUT_OF_SCOPE reply should guide the user toward a better question
    with concrete examples, not just a vague 'I'm MRT-focused' catch-all."""
    response = _assistant.chat("asdkfjaslkdfj random gibberish", {})

    assert response["intent"] == "OUT_OF_SCOPE"
    assert "for example" in response["reply"].lower()
    assert "bishan" in response["reply"].lower()


def test_out_of_scope_reply_respects_language_context():
    """The OUT_OF_SCOPE example-prompt reply is translated per
    context.language, matching the app's 4 supported UI languages."""
    response = _assistant.chat("asdkfjaslkdfj random gibberish", {"language": "zh"})

    assert response["intent"] == "OUT_OF_SCOPE"
    assert "我不太明白您的问题" in response["reply"]


def test_out_of_scope_reply_detects_script_over_stale_language_hint():
    """A Chinese/Tamil-script message should reply in that language even
    when context.language still says 'en' (the app's UI setting, which the
    user may not have changed just because they typed in another script —
    this was the actual bug the language-note feature shipped with)."""
    zh_response = _assistant.chat("从比夏到裕廊东怎么走？", {"language": "en"})
    assert "我不太明白您的问题" in zh_response["reply"]

    ta_response = _assistant.chat(
        "பிஷானில் இருந்து ஜூரோங் ஈஸ்ட் எப்படி செல்வது?", {"language": "en"}
    )
    assert "நீங்கள் கேட்பது என்னவென்று" in ta_response["reply"]


def test_groq_provider_429_note_detects_script_over_stale_language_hint():
    """Same script-detection override applies to the degraded-cause note
    prepended on a provider failure, not just the OUT_OF_SCOPE reply."""
    import requests
    from unittest.mock import MagicMock, patch

    from app.integrations.ai_client import GroqProvider

    resp = MagicMock()
    resp.status_code = 429
    err = requests.exceptions.HTTPError("429 rate limited")
    err.response = resp

    provider = GroqProvider(api_key="fake")
    with patch("app.integrations.ai_client.requests.post") as mock_post:
        mock_post.return_value.raise_for_status.side_effect = err
        result = provider.chat("从比夏到裕廊东怎么走？", {"language": "en"})

    assert result["reply"].startswith("AI助手今日的使用额度已用完")
