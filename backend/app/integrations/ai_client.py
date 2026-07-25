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
# cost regardless of how the model chooses to respond. See AIPLAN.md.
MAX_OUTPUT_TOKENS = 512

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
- Always provide actionable, concise answers.
- Reference specific station names and line codes where possible.

You MUST respond with valid JSON matching this exact schema:
{
  "reply": "<your natural language response>",
  "intent": "<one of: ROUTE, LAST_TRAIN, CROWD, TRANSFER, ACCESSIBILITY, FACILITY, INCIDENT, OUT_OF_SCOPE>",
  "stationIds": ["<station-id>", ...],
  "lineCodes": ["<line-code>", ...],
  "route": null,
  "warning": "<optional warning string or null>",
  "uiAction": "<one of: HIGHLIGHT_STATIONS, HIGHLIGHT_ROUTE, OPEN_STATION_PANEL, OPEN_ROUTE_RESULT, SHOW_WARNING, SHOW_CROWD_LAYER, or null>"
}

Do NOT include any text outside the JSON object.
"""


def _build_user_message(message: str, context: dict) -> str:
    """Build user message with station context included."""
    parts = [f"User question: {message}"]

    if context.get("currentStationId"):
        parts.append(f"Current station: {context['currentStationId']}")
    if context.get("selectedRoutePreference"):
        parts.append(f"Route preference: {context['selectedRoutePreference']}")

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


def _fallback_response(message: str, context: dict) -> dict:
    """Generate a response using the RuleBasedAssistant as fallback."""
    from app.services.ai_orchestrator import RuleBasedAssistant

    return RuleBasedAssistant().chat(message, context)


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
        """Process a user message via OpenAI and return structured response."""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": _build_user_message(message, context)},
                ],
                "temperature": 0.3,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "response_format": {"type": "json_object"},
            }

            resp = requests.post(
                self.API_URL, headers=headers, json=payload, timeout=self.TIMEOUT
            )
            resp.raise_for_status()

            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            return _parse_llm_response(raw_content)

        except Exception as exc:
            logger.warning("OpenAI provider failed, falling back to rule-based: %s", exc)
            return _fallback_response(message, context)


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
        """Process a user message via Groq and return structured response."""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.MODEL,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": _build_user_message(message, context)},
                ],
                "temperature": 0.3,
                "max_tokens": MAX_OUTPUT_TOKENS,
                "response_format": {"type": "json_object"},
            }

            resp = requests.post(
                self.API_URL, headers=headers, json=payload, timeout=self.TIMEOUT
            )
            resp.raise_for_status()

            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            return _parse_llm_response(raw_content)

        except Exception as exc:
            logger.warning("Groq provider failed, falling back to rule-based: %s", exc)
            return _fallback_response(message, context)


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
            logger.warning("Gemini provider failed, falling back to rule-based: %s", exc)
            return _fallback_response(message, context)


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
            logger.warning("Anthropic provider failed, falling back to rule-based: %s", exc)
            return _fallback_response(message, context)


# ---------------------------------------------------------------------------
# HybridProvider (cost control — see AIPLAN.md)
# ---------------------------------------------------------------------------


class HybridProvider:
    """Wraps a paid LLM provider with free-first routing, response caching,
    and a hard daily call cap.

    chat() classifies the message with the free rule-based engine first;
    only messages it can't classify (OUT_OF_SCOPE) are considered for the
    wrapped LLM provider. Of those, messages with no MRT-related signal at
    all (has_mrt_signal) are rejected outright for free — this blocks
    off-topic abuse (e.g. "code me a website") from ever reaching a paid
    call. Anything left is cached and subject to a daily call budget.
    See AIPLAN.md for the full rationale.

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
        """Route to the free rule-based engine when possible, else the
        wrapped LLM provider (via cache and daily budget)."""
        from app.services.ai_orchestrator import (
            classify_intent,
            has_mrt_signal,
            RuleBasedAssistant,
        )

        intent = classify_intent(message)
        if intent != "OUT_OF_SCOPE":
            return RuleBasedAssistant().chat(message, context)

        if not has_mrt_signal(message):
            logger.info("Message has no MRT signal, rejecting without LLM call")
            return RuleBasedAssistant().chat(message, context)

        cache_key = self._cache_key(message, context)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        if not self._consume_daily_budget():
            logger.info("AI daily call cap reached, serving rule-based fallback")
            return RuleBasedAssistant().chat(message, context)

        response = self.llm_provider.chat(message, context)
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
