# AI Assistant Cost-Control Plan

Goal: keep the `/api/v1/assistant/chat` endpoint usable at ~10,000 concurrent
users without a runaway LLM bill, while keeping the existing "works with zero
API keys" demo mode intact.

## Why cost is a concern today

`get_ai_provider()` ([backend/app/integrations/__init__.py](backend/app/integrations/__init__.py))
currently returns **either** `RuleBasedAssistant` (free, `AI_PROVIDER=rule_based`)
**or** a paid LLM provider (`OpenAIProvider` / `GeminiProvider` / `AnthropicProvider`
in [backend/app/integrations/ai_client.py](backend/app/integrations/ai_client.py)).
It's all-or-nothing: once a paid provider is configured, **every** chat message
— including ones the rule-based engine already answers perfectly for free,
like "last train from Bugis" — pays for an LLM call. The only existing cost
guard is a flat 30 req/hour/IP limit ([assistant.py](backend/app/routes/assistant.py#L21)).

## Strategy

1. **Classify-first routing (biggest lever, ~free).**
   The rule-based engine already classifies into 8 intents with keyword
   matching (`classify_intent` in [ai_orchestrator.py](backend/app/services/ai_orchestrator.py#L150))
   and gives structured, grounded answers for all of them. Most real MRT
   questions ("last train from X", "is Y crowded", "how to get from A to B")
   match one of these. Plan: introduce a `HybridProvider` that runs the
   rule-based classifier first; if it lands on a real intent (not
   `OUT_OF_SCOPE`), return that answer directly — **no LLM call, no cost**.
   Only messages that fall through to `OUT_OF_SCOPE` (genuinely free-form
   phrasing) get forwarded to the configured paid LLM.

2. **Response caching for the LLM path.**
   MRT questions repeat heavily across users ("wheelchair access at Dhoby
   Ghaut?" gets asked by many people). Add a short-TTL in-memory cache
   (normalized message text → response, ~10–15 min TTL) in front of the LLM
   call. A cache hit costs nothing. Implementation: a small dict-based
   TTL cache (mirrors the existing `flask_limiter` in-memory approach —
   single-process, zero new infra); documented as swap-to-Redis if the app
   ever runs multi-instance.

3. **Hard per-call and per-day cost caps.**
   - Cap `max_tokens`/output length on every provider call (Anthropic already
     sets 1024; add equivalent caps to OpenAI/Gemini payloads).
   - Truncate/reject oversized input messages before they reach a paid API.
   - Add an optional `AI_DAILY_CALL_CAP` config. Once the in-process counter
     hits the cap for the day, `HybridProvider` forces every request to the
     free rule-based path instead of erroring — the assistant keeps working,
     it just stops spending. Set to `900` (below Groq's own free-tier quota
     of 1,000 requests / 12,000 tokens per rolling window, confirmed via its
     `x-ratelimit-*` response headers) so our cap binds before Groq starts
     returning 429s.

4. **Keep the existing rate limit, but only meter what costs money.**
   The current 30/hour/IP limit ([config.py](backend/app/config.py#L38),
   applied in [assistant.py](backend/app/routes/assistant.py#L21)) stays as
   the outer request-volume guard (also protects against abuse, not just
   LLM cost). No change needed there — it's already free-tier-friendly.

5. **Log usage for visibility.**
   OpenAI/Anthropic responses include token usage; log it (call count,
   tokens, provider) whenever the LLM path is actually hit, so it's easy to
   see how much of real traffic is falling through to the paid path.

## Net effect at 10,000 concurrent users

- The 8 defined intents (majority of realistic MRT questions) are answered
  by the free rule-based engine — zero marginal cost regardless of scale.
- Only genuinely open-ended questions reach the LLM, and repeats among those
  are absorbed by the cache.
- The daily call cap is a hard backstop: worst case, the app degrades to
  100%-rule-based (still fully functional) rather than generating a bill
  surprise.
- This comfortably fits inside Gemini 2.0 Flash's free tier, or a few
  dollars/month of `gpt-4o-mini`, even under heavy load.

## Implementation phases

Executed one phase at a time, in order. Each is scoped to one file/concern.

1. **Free model choice** (decision only, no code). Primary choice: **Gemini's
   free tier** as the paid-path provider (~1,500 req/day, 15 RPM on
   `gemini-2.0-flash`, no billing) — `AI_PROVIDER=gemini` in `backend/.env`.
   In practice, some Google Cloud projects report a `0` free-tier quota for
   `gemini-2.0-flash` even when AI Studio's UI shows "Free tier" (an
   account/project-side restriction, not a code issue — `HybridProvider`
   still degrades gracefully to the rule-based path when this happens).
   **`GroqProvider` was added as a working fallback/alternative** — genuinely
   free tier, OpenAI-compatible API, `llama-3.3-70b-versatile` model
   (`AI_PROVIDER=groq`, key from console.groq.com/keys). Self-hosted Ollama
   was considered and stays deferred (fully free per-request but needs
   dedicated GPU hosting to serve real concurrent load).
2. **Config additions** — `backend/app/config.py`: add `AI_DAILY_CALL_CAP`
   (default `900`, kept under Groq's own free-tier quota) and
   `AI_CACHE_TTL_SECONDS` (default `900`s TTL).
3. **Cap output tokens** — `backend/app/integrations/ai_client.py`: add
   `MAX_OUTPUT_TOKENS = 512`; wire into `OpenAIProvider` (`max_tokens`,
   currently missing), `GeminiProvider` (`maxOutputTokens`, currently
   missing), `AnthropicProvider` (replace hardcoded `1024`).
4. **Input length cap** — `backend/app/schemas/assistant_schema.py`: add
   `validate=marshmallow.validate.Length(max=500)` to
   `ChatRequestSchema.message` (currently unbounded — oversized messages
   inflate token cost and are a cheap abuse vector against the daily cap).
5. **`HybridProvider`** — `backend/app/integrations/ai_client.py`: new
   class wrapping a paid provider. `chat()` runs `classify_intent` first;
   if intent != `OUT_OF_SCOPE`, return `RuleBasedAssistant`'s answer
   (free, no LLM call). Otherwise check an in-memory TTL cache (key:
   normalized message + `currentStationId`), then check/consume the daily
   call budget — if exhausted, fall back to `RuleBasedAssistant` instead of
   calling the LLM; otherwise call the wrapped provider and cache the
   result.
6. **Wire into `get_ai_provider()`** — `backend/app/integrations/__init__.py`:
   `get_ai_provider()` currently builds a fresh provider per request; change
   it to lazily construct a **module-level singleton** `HybridProvider`
   (wrapping whichever LLM provider `AI_PROVIDER` selects) so the cache and
   daily counter persist across requests instead of resetting each call.
   `AI_PROVIDER=rule_based` (no key) path is untouched.
7. **Tests** — extend `backend/tests/test_ai_props.py` with a stub LLM
   provider (records call count, no real network calls) covering: rule-based
   short-circuit (stub never called), `OUT_OF_SCOPE` reaches the stub, cache
   hit avoids a second stub call, daily cap forces rule-based fallback, and
   oversized `message` is rejected by the schema.
8. **Verification** — run `cd backend && pytest`; confirm
   `AI_PROVIDER=rule_based` behavior is unchanged (zero regression to the
   no-API-key demo mode); grep the frontend chat component to confirm
   `reply` is rendered as plain text, not `dangerouslySetInnerHTML` (guards
   against LLM-output injection).

9. **Groq provider** (added after Gemini's free tier turned out to be
   quota-restricted for this project) — `backend/app/integrations/ai_client.py`:
   `GroqProvider`, OpenAI-compatible request/response shape pointed at
   `api.groq.com/openai/v1/chat/completions`, `llama-3.3-70b-versatile`.
   Wired into `_build_llm_provider()` in `integrations/__init__.py` alongside
   the other providers; select it with `AI_PROVIDER=groq`.

Not doing (out of scope for a hackathon app): Redis-backed distributed
cache/rate-limit, self-hosted open-weight model, streaming responses,
per-user auth-based quotas.

## API key storage

Already correct, no change needed: `AI_API_KEY` is read from `backend/.env`
via `os.getenv("AI_API_KEY", "")` in `config.py`. `.env` is git-ignored,
`.env.example` only ships an empty placeholder, and no `.env` file is
tracked in the repo. The key is only ever used server-side — the frontend
never sees it, it only talks to the Flask backend.

## Security & rate-limiting notes

- The existing 30/hour/IP limit (`assistant.py`, via `flask_limiter`) stays
  as the outer request-volume guard, applied before any routing decision.
- **Known limitation:** both `flask_limiter`'s `storage_uri="memory://"`
  and `HybridProvider`'s cache/daily-counter are per-process, in-memory
  state. Under multiple worker processes/instances (e.g. `gunicorn -w 4`),
  the effective rate limit *and* daily cost cap both multiply by worker
  count. Fine for a single-process dev/demo deployment; would need
  Redis-backed storage before scaling to multiple workers.
- The daily cap is global, not per-IP, so a handful of clients sending many
  *unique* out-of-scope messages (bypassing the cache) could exhaust the
  shared daily LLM budget for everyone else. Accepted tradeoff: the failure
  mode is graceful degradation to the free rule-based assistant, not an
  outage or cost blowout. The per-IP 30/hour cap already limits how fast
  any single client can contribute to that.
- LLM output is already structurally constrained (`_parse_llm_response`
  requires strict JSON; system prompt restricts scope to MRT topics),
  limiting prompt-injection blast radius. No sensitive data or code
  execution is reachable from the chat response.
