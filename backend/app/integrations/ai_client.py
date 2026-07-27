"""LLM-based AI provider implementations using HTTP requests.

Provides OpenAI, Gemini, and Anthropic provider classes that implement
the AIProvider protocol. Each uses the `requests` library for direct
HTTP calls to keep dependencies minimal (no vendor SDKs required).

On any error (network, parsing, missing keys), all providers fall back
to the RuleBasedAssistant for a graceful degraded experience.

Validates: Requirements 24.1, 24.3
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from datetime import date
from typing import Any

import requests

from app.config import BaseConfig

logger = logging.getLogger(__name__)

# Hard cap on generated tokens for every paid LLM call — bounds per-request
# cost regardless of how the model chooses to respond. Raised from the
# original 512 to give tool-calling turns headroom beyond a single canned
# reply. See AIPLAN.md.
MAX_OUTPUT_TOKENS = 1024

# Bounds a tool-calling loop (call -> tool result -> re-call) so a
# misbehaving model can't spin forever racking up requests.
MAX_TOOL_ITERATIONS = 4

# ---------------------------------------------------------------------------
# System prompt shared across all LLM providers
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are SGRail Assistant, an AI helper focused exclusively on the Singapore MRT/LRT network.

Your capabilities:
- Route planning guidance between MRT stations
- Last train timing information
- Crowd level estimates
- Transfer and interchange guidance
- Station facility and accessibility information
- Service disruption and incident awareness

Rules:
- Only answer questions related to the Singapore MRT/LRT network.
- If a question is out of scope, politely decline and redirect to MRT topics.
- If a tool result's "source" (or "officialAlertsSource") field is "simulated" or "none", say so plainly rather than implying real-time official data — this app is currently running in demo mode for that data source, and mock data must never be presented as live.
- Reply in the same language as the CURRENT user message — detect this from the message's own text first, every time, even if it differs from previous messages in the conversation. The "Preferred language" hint (if given) reflects the app's UI setting, not necessarily what the user is typing right now — only fall back to it when the message itself is too short or ambiguous to carry a detectable language (e.g. a bare station name, "ok", a single number).
- Always provide actionable, concise answers.
- Reference specific station names and line codes where possible.

You MUST respond with valid JSON matching this exact schema:
{
  "reply": "<your natural language response, in the user's language>",
  "intent": "<one of: ROUTE, LAST_TRAIN, CROWD, TRANSFER, ACCESSIBILITY, FACILITY, INCIDENT, OUT_OF_SCOPE>",
  "stationIds": ["<station-id>", ...],
  "lineCodes": ["<line-code>", ...],
  "route": null,
  "warning": "<optional warning string or null>",
  "uiAction": "<one of: HIGHLIGHT_STATIONS, HIGHLIGHT_ROUTE, OPEN_STATION_PANEL, OPEN_ROUTE_RESULT, SHOW_WARNING, SHOW_CROWD_LAYER, or null>"
}

Do NOT include any text outside the JSON object.
"""

# Appended only for providers that actually receive a `tools` payload
# (OpenAI-compatible ones today — see _openai_compatible_chat). Keeping this
# separate from _SYSTEM_PROMPT means Gemini/Anthropic, which don't get tool
# definitions yet, are never told to use tools they don't have.
_TOOL_USAGE_ADDENDUM = """

You have tools for real-time data: plan_route, get_crowd_level, get_last_train, get_incidents, get_station_facilities. Use them whenever a question needs current data instead of guessing or making up numbers. When plan_route returns routes, summarise them in "reply" but do not invent numbers beyond what the tool returned.

Station names in the underlying data are English only (e.g. "Bishan", "Jurong East"). If the user's message is in another language, translate station names to their English form before passing them as tool arguments — the tools cannot resolve station names in other languages, even though your final "reply" should still be in the user's language.
"""


def _build_user_message(message: str, context: dict) -> str:
    """Build user message with station, preference, and language context included."""
    parts = [f"User question: {message}"]

    if context.get("currentStationId"):
        parts.append(f"Current station: {context['currentStationId']}")
    if context.get("selectedRoutePreference"):
        parts.append(f"Route preference: {context['selectedRoutePreference']}")
    if context.get("language"):
        parts.append(f"Preferred language: {context['language']}")

    return "\n".join(parts)


def _parse_llm_response(raw_text: str) -> dict:
    """Parse LLM JSON response into the expected ChatResponseSchema dict.

    Raises ValueError if the response cannot be parsed or is missing
    required keys.
    """
    # Strip markdown code fences if present
    text = raw_text.strip()
    if text.startswith("```"):
        # Remove opening fence (possibly ```json)
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    data = json.loads(text)

    # Validate required keys
    required_keys = {"reply", "intent"}
    if not required_keys.issubset(data.keys()):
        missing = required_keys - data.keys()
        raise ValueError(f"Missing required keys in LLM response: {missing}")

    # Normalise optional fields
    from datetime import datetime, timezone

    return {
        "reply": str(data["reply"]),
        "intent": str(data.get("intent", "OUT_OF_SCOPE")),
        "stationIds": data.get("stationIds") or [],
        "lineCodes": data.get("lineCodes") or [],
        "route": data.get("route"),
        "warning": data.get("warning"),
        "uiAction": data.get("uiAction"),
        "dataFreshness": datetime.now(timezone.utc).isoformat(),
    }


# Short, honest notes prepended to the rule-based reply when it's standing
# in for a failed LLM call, so the degraded state and its cause are visible
# to the user instead of looking like a normal (possibly wrong-topic) answer.
# Keyed by error_type -> language -> note text.
_DEGRADED_NOTES: dict[str, dict[str, str]] = {
    "rate_limited": {
        "en": "The AI assistant has hit today's usage limit. Please try again in a few minutes — meanwhile, here's a basic answer:",
        "zh": "AI助手今日的使用额度已用完。请几分钟后再试——以下是基础回答：",
        "ms": "Pembantu AI telah mencapai had penggunaan harian. Sila cuba lagi beberapa minit lagi — sementara itu, ini jawapan asas:",
        "ta": "AI உதவியாளர் இன்றைய பயன்பாட்டு வரம்பை எட்டிவிட்டது. சில நிமிடங்களில் மீண்டும் முயற்சிக்கவும் — இதற்கிடையில், இது ஒரு அடிப்படை பதில்:",
    },
    "daily_cap": {
        "en": "The AI assistant has reached its daily call limit. Please try again tomorrow — meanwhile, here's a basic answer:",
        "zh": "AI助手已达到今日调用上限。请明天再试——以下是基础回答：",
        "ms": "Pembantu AI telah mencapai had panggilan harian. Sila cuba lagi esok — sementara itu, ini jawapan asas:",
        "ta": "AI உதவியாளர் இன்றைய அழைப்பு வரம்பை எட்டிவிட்டது. நாளை மீண்டும் முயற்சிக்கவும் — இதற்கிடையில், இது ஒரு அடிப்படை பதில்:",
    },
    "provider_error": {
        "en": "The AI assistant is temporarily unavailable. Please try again shortly — meanwhile, here's a basic answer:",
        "zh": "AI助手暂时无法使用。请稍后再试——以下是基础回答：",
        "ms": "Pembantu AI tidak tersedia buat sementara waktu. Sila cuba lagi sebentar lagi — sementara itu, ini jawapan asas:",
        "ta": "AI உதவியாளர் தற்காலிகமாகக் கிடைக்கவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும் — இதற்கிடையில், இது ஒரு அடிப்படை பதில்:",
    },
}


def _classify_provider_exception(exc: Exception) -> str:
    """Map a provider call failure to a _DEGRADED_NOTES key."""
    response = getattr(exc, "response", None)
    if response is not None and getattr(response, "status_code", None) == 429:
        return "rate_limited"
    return "provider_error"


def _fallback_response(
    message: str, context: dict, error_type: str | None = None
) -> dict:
    """Generate a response using the RuleBasedAssistant as fallback.

    Marked with _isDegraded so HybridProvider never caches it — a transient
    failure (network blip, provider 429, malformed response) shouldn't get
    "burned in" to the cache and keep serving a canned decline for the rest
    of the TTL after the underlying provider has already recovered.

    When error_type is given, a short honest note about the failure (rate
    limit, daily cap, generic provider error) is prepended to the reply in
    the request's language, so a degraded answer never looks like a normal
    one — see AIPLAN.md.
    """
    from app.services.ai_orchestrator import RuleBasedAssistant, _resolve_reply_language

    response = RuleBasedAssistant().chat(message, context)
    response["_isDegraded"] = True

    if error_type is not None:
        notes = _DEGRADED_NOTES.get(error_type, _DEGRADED_NOTES["provider_error"])
        language = _resolve_reply_language(message, context or {})
        note = notes.get(language, notes["en"])
        response["reply"] = f"{note}\n\n{response['reply']}"

    return response


# ---------------------------------------------------------------------------
# Tool-calling loop (OpenAI-compatible shape — OpenAI, Groq)
# ---------------------------------------------------------------------------


def _execute_tool_call(tool_call: dict) -> dict:
    """Execute one OpenAI-shape tool call and return its JSON-serialisable result.

    Never raises — a bad tool name or a failing tool must degrade to an
    error dict the model can see and explain, not crash the chat turn.
    """
    from app.integrations.agent_tools_schema import TOOL_DISPATCH

    name = tool_call.get("function", {}).get("name", "")
    raw_args = tool_call.get("function", {}).get("arguments") or "{}"
    try:
        args = json.loads(raw_args)
    except (json.JSONDecodeError, TypeError):
        args = {}

    func = TOOL_DISPATCH.get(name)
    if func is None:
        return {"error": f"Unknown tool '{name}'"}

    try:
        return func(**args)
    except Exception as exc:  # noqa: BLE001 - a bad tool call must not crash the chat turn
        logger.warning("Tool '%s' failed: %s", name, exc)
        return {"error": f"Tool '{name}' failed: {exc}"}


def _openai_compatible_chat(
    api_url: str,
    model: str,
    api_key: str,
    message: str,
    context: dict,
    timeout: int = 30,
) -> dict:
    """Shared tool-calling chat loop for OpenAI-shape providers (OpenAI, Groq).

    Calls the model with the available tools; if it requests tool calls,
    executes them via TOOL_DISPATCH and feeds the results back as `tool`
    messages, repeating up to MAX_TOOL_ITERATIONS times. Once the model
    returns a final (non-tool-call) message, parses it as the usual JSON
    envelope. The most recent successful plan_route result is attached to
    the final response as routeResults, and every tool call's resolved
    station id(s) overwrite stationIds — both programmatically, never
    trusted from the model's own transcription (it tends to write display
    names like "Orchard" instead of the internal id "orchard", which
    silently breaks the frontend's station lookups). See AIPLAN.md phase 18.
    """
    from app.integrations.agent_tools_schema import to_openai_tools

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    messages: list[dict] = [
        {"role": "system", "content": _SYSTEM_PROMPT + _TOOL_USAGE_ADDENDUM},
        {"role": "user", "content": _build_user_message(message, context)},
    ]
    last_route_result: dict | None = None
    resolved_station_ids: list[str] = []

    for _ in range(MAX_TOOL_ITERATIONS):
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "tools": to_openai_tools(),
            "tool_choice": "auto",
        }

        resp = requests.post(api_url, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        choice_message = data["choices"][0]["message"]
        tool_calls = choice_message.get("tool_calls")

        if not tool_calls:
            parsed = _parse_llm_response(choice_message.get("content") or "")
            if last_route_result is not None:
                parsed["routeResults"] = last_route_result.get("routes")
            if resolved_station_ids:
                parsed["stationIds"] = resolved_station_ids
            return parsed

        # Model wants to call tool(s) — execute each and feed results back.
        messages.append(choice_message)
        for tool_call in tool_calls:
            result = _execute_tool_call(tool_call)
            if tool_call.get("function", {}).get("name") == "plan_route" and not result.get(
                "error"
            ):
                last_route_result = result
            for key in ("stationId", "originStationId", "destinationStationId"):
                station_id = result.get(key)
                if station_id and station_id not in resolved_station_ids:
                    resolved_station_ids.append(station_id)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.get("id", ""),
                    "content": json.dumps(result),
                }
            )

    logger.warning(
        "Tool-calling loop exceeded %d iterations without a final answer, falling back",
        MAX_TOOL_ITERATIONS,
    )
    return _fallback_response(message, context, error_type="provider_error")


# ---------------------------------------------------------------------------
# OpenAI Provider (gpt-4o-mini)
# ---------------------------------------------------------------------------


class OpenAIProvider:
    """AI provider using OpenAI's Chat Completions API (gpt-4o-mini).

    Uses direct HTTP requests rather than the openai SDK to keep
    dependencies minimal.
    """

    API_URL = "https://api.openai.com/v1/chat/completions"
    MODEL = "gpt-4o-mini"
    TIMEOUT = 30

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or BaseConfig.AI_API_KEY

    def chat(self, message: str, context: dict) -> dict:
        """Process a user message via OpenAI, using tools for real data, and
        return the structured response."""
        try:
            return _openai_compatible_chat(
                self.API_URL, self.MODEL, self.api_key, message, context, self.TIMEOUT
            )
        except Exception as exc:
            error_type = _classify_provider_exception(exc)
            logger.warning(
                "OpenAI provider failed (%s), falling back to rule-based: %s", error_type, exc
            )
            return _fallback_response(message, context, error_type=error_type)


# ---------------------------------------------------------------------------
# Groq Provider (free tier — Llama 3.3 70B via OpenAI-compatible API)
# ---------------------------------------------------------------------------


class GroqProvider:
    """AI provider using Groq's OpenAI-compatible Chat Completions API.

    Groq offers a genuinely free tier for open-weight models, with the
    same request/response shape as OpenAI. See AIPLAN.md.
    """

    API_URL = "https://api.groq.com/openai/v1/chat/completions"
    MODEL = "llama-3.3-70b-versatile"
    TIMEOUT = 30

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or BaseConfig.AI_API_KEY

    def chat(self, message: str, context: dict) -> dict:
        """Process a user message via Groq, using tools for real data, and
        return the structured response."""
        try:
            return _openai_compatible_chat(
                self.API_URL, self.MODEL, self.api_key, message, context, self.TIMEOUT
            )
        except Exception as exc:
            error_type = _classify_provider_exception(exc)
            logger.warning(
                "Groq provider failed (%s), falling back to rule-based: %s", error_type, exc
            )
            return _fallback_response(message, context, error_type=error_type)


# ---------------------------------------------------------------------------
# Gemini Provider (Google Generative AI)
# ---------------------------------------------------------------------------


class GeminiProvider:
    """AI provider using Google's Gemini API.

    Uses direct HTTP requests rather than the google-generativeai SDK.
    """

    API_URL_TEMPLATE = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "{model}:generateContent?key={api_key}"
    )
    MODEL = "gemini-2.0-flash"
    TIMEOUT = 30

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or BaseConfig.AI_API_KEY

    def chat(self, message: str, context: dict) -> dict:
        """Process a user message via Gemini and return structured response."""
        try:
            url = self.API_URL_TEMPLATE.format(
                model=self.MODEL, api_key=self.api_key
            )
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": _SYSTEM_PROMPT + "\n\n" + _build_user_message(message, context)}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": MAX_OUTPUT_TOKENS,
                    "responseMimeType": "application/json",
                },
            }

            resp = requests.post(url, headers=headers, json=payload, timeout=self.TIMEOUT)
            resp.raise_for_status()

            data = resp.json()
            raw_content = data["candidates"][0]["content"]["parts"][0]["text"]
            return _parse_llm_response(raw_content)

        except Exception as exc:
            error_type = _classify_provider_exception(exc)
            logger.warning(
                "Gemini provider failed (%s), falling back to rule-based: %s", error_type, exc
            )
            return _fallback_response(message, context, error_type=error_type)


# ---------------------------------------------------------------------------
# Anthropic Provider (Claude)
# ---------------------------------------------------------------------------


class AnthropicProvider:
    """AI provider using Anthropic's Messages API (Claude).

    Uses direct HTTP requests rather than the anthropic SDK.
    """

    API_URL = "https://api.anthropic.com/v1/messages"
    MODEL = "claude-sonnet-4-20250514"
    TIMEOUT = 30

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or BaseConfig.AI_API_KEY

    def chat(self, message: str, context: dict) -> dict:
        """Process a user message via Anthropic and return structured response."""
        try:
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.MODEL,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "system": _SYSTEM_PROMPT,
                "messages": [
                    {"role": "user", "content": _build_user_message(message, context)},
                ],
                "temperature": 0.3,
            }

            resp = requests.post(
                self.API_URL, headers=headers, json=payload, timeout=self.TIMEOUT
            )
            resp.raise_for_status()

            data = resp.json()
            raw_content = data["content"][0]["text"]
            return _parse_llm_response(raw_content)

        except Exception as exc:
            error_type = _classify_provider_exception(exc)
            logger.warning(
                "Anthropic provider failed (%s), falling back to rule-based: %s", error_type, exc
            )
            return _fallback_response(message, context, error_type=error_type)


# ---------------------------------------------------------------------------
# HybridProvider (cost control — see AIPLAN.md)
# ---------------------------------------------------------------------------


class HybridProvider:
    """Wraps a paid LLM provider with response caching and a hard daily
    call cap — the LLM is now the primary responder for every non-empty
    message, not a rare fallback for what a keyword classifier misses.

    chat() rejects only empty/whitespace-only messages for free (the one
    case the request schema doesn't already prevent). Everything else is
    cached and subject to a daily call budget before reaching the wrapped
    LLM provider, whose tools and system prompt handle both scope
    restriction and grounded, current-data answers — no keyword net in
    front of it. This intentionally reverses the original "classify-first"
    routing that skipped the LLM entirely for recognised intents; see
    AIPLAN.md, "Agentic tool-calling", for the full rationale and the
    accepted cost-exposure tradeoff.

    NOTE: cache and daily-counter state are in-process/in-memory (matches
    flask_limiter's own memory:// storage). Under multiple worker processes
    or instances, the effective daily budget multiplies by worker count —
    fine for a single-process deployment, would need Redis-backed storage
    to hold under a multi-worker one.
    """

    def __init__(
        self,
        llm_provider: Any,
        cache_ttl: int | None = None,
        daily_cap: int | None = None,
    ):
        self.llm_provider = llm_provider
        self.cache_ttl = (
            cache_ttl if cache_ttl is not None else BaseConfig.AI_CACHE_TTL_SECONDS
        )
        self.daily_cap = (
            daily_cap if daily_cap is not None else BaseConfig.AI_DAILY_CALL_CAP
        )
        self._cache: dict[str, tuple[float, dict]] = {}
        self._lock = threading.Lock()
        self._call_day: date | None = None
        self._call_count = 0

    def chat(self, message: str, context: dict) -> dict:
        """Reject only empty messages for free; otherwise route through the
        cache and daily budget to the wrapped LLM provider."""
        from app.services.ai_orchestrator import RuleBasedAssistant

        if not message or not message.strip():
            logger.info("Empty message, rejecting without LLM call")
            return RuleBasedAssistant().chat(message, context)

        cache_key = self._cache_key(message, context)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        if not self._consume_daily_budget():
            logger.info("AI daily call cap reached, serving rule-based fallback")
            return _fallback_response(message, context, error_type="daily_cap")

        response = self.llm_provider.chat(message, context)
        # A degraded (rule-based fallback) response means the provider call
        # itself failed — cache only real answers, so a transient failure
        # doesn't get served back for the rest of the TTL once the provider
        # has recovered. See AIPLAN.md phase 20.
        is_degraded = response.pop("_isDegraded", False)
        if not is_degraded:
            self._set_cached(cache_key, response)
        return response

    @staticmethod
    def _cache_key(message: str, context: dict) -> str:
        normalized = re.sub(r"\s+", " ", message.strip().lower())
        station = (context or {}).get("currentStationId") or ""
        return f"{station}:{normalized}"

    def _get_cached(self, key: str) -> dict | None:
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            expires_at, response = entry
            if time.monotonic() >= expires_at:
                del self._cache[key]
                return None
            return response

    def _set_cached(self, key: str, response: dict) -> None:
        with self._lock:
            self._cache[key] = (time.monotonic() + self.cache_ttl, response)

    def _consume_daily_budget(self) -> bool:
        today = date.today()
        with self._lock:
            if self._call_day != today:
                self._call_day = today
                self._call_count = 0
            if self._call_count >= self.daily_cap:
                return False
            self._call_count += 1
            return True
