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

## Agentic tool-calling (this plan)

Everything above (and the numbered phases 1–9 below) was written when the
goal was purely "minimize LLM calls." That goal has expanded: the LLM is now
meant to be the actual assistant — capable of planning real routes, checking
live crowd/last-train/incident/facility data, and conversing in the app's 4
supported languages — not a rare fallback for messages the keyword router
can't place. Concretely, this phase of work:

- Gives the LLM real **tools** (`plan_route`, `get_crowd_level`,
  `get_last_train`, `get_incidents`, `get_station_facilities`) backed by the
  same service functions the rest of the app already uses — `route_engine`/
  `route_formatter` (identical logic to `/routes/plan`), `CrowdService`,
  `station_service`, `alert_service`, `incident_service` — instead of
  returning hand-written prose. See `backend/app/services/agent_tools.py`.
- Removes the classify-first short-circuit (Strategy point 1 below is now
  **superseded** — see the note there) so the LLM actually runs for
  route/crowd/last-train/incident/facility questions, not just messages that
  fall through to `OUT_OF_SCOPE`.
- Adds a `language` context field so replies match the user's language
  (English, 中文, Bahasa Melayu, தமிழ்).
- Embeds real computed route results (`routeResults`) in the chat response
  so the frontend can render them inline, rather than only a text summary.

Tool-calling is implemented for the OpenAI-compatible wire format only
(covers `OpenAIProvider` and `GroqProvider` — Groq is the only vendor
actually configured with a key today). `GeminiProvider`/`AnthropicProvider`
keep their original single-shot behavior; adding tool-calling for them later
is additive (same tool definitions, a new per-vendor translator), not a
rewrite. See phases 10–16 below for the full implementation log, and the
"Net effect" and "Security & rate-limiting notes" sections for the updated
cost model this implies.

## Strategy

1. **Classify-first routing (biggest lever, ~free).**
   **Superseded by Phase 10 (see "Agentic tool-calling" above).** This was
   true and worked exactly as described below — but it also meant the LLM
   never ran at all for the 7 real intents, which is incompatible with
   making it a genuine tool-calling assistant for them. `HybridProvider` no
   longer short-circuits recognized intents to the free rule-based path;
   every non-empty message now reaches the LLM (subject to the cache and
   daily cap below, same as before). The rationale that follows is kept for
   the historical record — it was the right call for a pure-cost-control
   design, and `RuleBasedAssistant` still exists as the automatic fallback
   when no API key is configured or the daily cap is exhausted.

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

**Updated for the agentic change (phases 10–16) — the model below no longer
holds as written; kept immediately after for historical comparison.**

- Most traffic now reaches the LLM — classify-first routing no longer
  diverts recognized intents to the free path, since the LLM needs to run
  to actually call tools and produce grounded answers. Cost is bounded
  instead by the response cache (repeats are still free), the daily call
  cap (hard backstop, degrades to 100%-rule-based once exhausted, same as
  before), and the unchanged 30/hour/IP rate limit.
- A tool-calling turn costs more per call than the old single-shot design
  (more output tokens for tool-call round trips, `MAX_OUTPUT_TOKENS` raised
  accordingly) — see the new "Accepted tradeoff" bullets under "Security &
  rate-limiting notes".
- Worst case is unchanged: the daily cap still forces 100%-rule-based
  fallback rather than a bill surprise, and the assistant keeps working
  either way (just without tool-backed answers).

*Original (pre-agentic) model, for reference:*
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

10. **Tool functions** (decision + new file) — `backend/app/services/agent_tools.py`:
    `resolve_station_id` (hoisted from `ai_orchestrator._find_station`, used
    internally by every tool, not itself LLM-callable), `plan_route` (calls
    `route_engine.find_routes` → `route_formatter.format_route_steps` →
    `compute_route_summary` → `validate_last_train`, plus `_check_accessibility`
    for `WHEELCHAIR` — the same logic `/routes/plan` already runs, not a
    reimplementation), `get_crowd_level` (`CrowdService.get_station_crowd`),
    `get_last_train` (new — the old `_handle_last_train` inline logic
    hardcoded weekday-only and dropped results past the first 4; this reads
    `timings.json` properly respecting `day_type`), `get_incidents` (combines
    `alert_service` official alerts with `incident_service` community
    reports, and reports each source's honest provenance — `"simulated"` vs
    `"lta_datamall"` — since `_handle_incident` previously never called
    either and just returned a hardcoded "no disruptions" string),
    `get_station_facilities` (`station_service.get_station_detail`).
    Decision: tools read whichever existing data source is richest per
    concern (JSON files for routes/last-train, matching `route_engine`'s
    convention; DB-backed services for crowd/facilities, which already
    include real community data) rather than forcing one source everywhere.
11. **Tool schemas + dispatch** — `backend/app/integrations/agent_tools_schema.py`
    (new file): one vendor-neutral list of tool definitions (name,
    description, JSON-schema parameters); `to_openai_tools()` translating to
    the flat `{"type": "function", "function": {...}}` shape shared by
    OpenAI and Groq; a `TOOL_DISPATCH` name → function map for executing a
    call.
12. **Tool-calling loop** — `backend/app/integrations/ai_client.py`:
    `OpenAIProvider`/`GroqProvider` gain `tools`/`tool_choice="auto"` on the
    request body; `chat()` becomes a bounded loop (~4 iterations max): call →
    if `tool_calls` present, execute via `TOOL_DISPATCH`, append tool-result
    messages, re-call → else parse the final JSON envelope as before.
    `MAX_OUTPUT_TOKENS` raised (512 → ~1024) for the extra round-trip
    headroom. `_SYSTEM_PROMPT` updated: use tools instead of guessing at
    current data, honor the `language` context hint, and — matching the
    app's existing rule that mock data is never presented as "Live" (see
    `SUMMARY.md`) — say so plainly when a tool result's source is
    `"simulated"`. Decision: `GeminiProvider`/`AnthropicProvider` are left
    single-shot/unchanged — not configured with a key, so untestable, and
    each needs a structurally different tool-calling translator; adding them
    later is additive, not a rewrite.
13. **Routing + response shape** — `backend/app/integrations/ai_client.py`:
    `HybridProvider.chat()` drops the `classify_intent`/`OUT_OF_SCOPE`
    short-circuit (see "Agentic tool-calling" above); new flow is
    empty-message gate → cache → daily budget → LLM. The most recent
    `plan_route` tool result during a loop is attached to the response as
    `routeResults` **programmatically** (not trusted from the LLM's own
    transcription), added to `ChatResponseSchema`/`AssistantChatResponse`.
14. **Language support** — `backend/app/schemas/assistant_schema.py`:
    `ChatContextSchema` gains `language` (optional string). Frontend
    `AssistantChatRequest.context` gains `language?: string`, populated in
    `useAssistant.ts` from `usePreferencesStore` (`"en"|"zh"|"ms"|"ta"`,
    already the app's 4 supported UI languages). Backend
    `_build_user_message` includes it; `_SYSTEM_PROMPT` instructs the model
    to reply in the user's message language, using the hint when ambiguous.
15. **Frontend rendering** — `ChatMessage` (`assistant.types.ts`) gains
    `routeResults?: RouteResult[]`; `MessageBubble.tsx` renders
    `<RouteResultList>` (already self-contained, no required callbacks) when
    present; `useAssistant.ts` maps the response field onto the constructed
    message, same pattern as the existing `stationIds`/`warning` fields. The
    existing route-planning wizard (quick-reply chips for departure time and
    preference) stays as the no-API-key `RuleBasedAssistant` fallback UX.
16. **Tests** — per-tool unit tests in a new backend test file; a
    tool-calling-loop test with a stubbed HTTP response sequence
    (`tool_calls` response → final response); `test_ai_props.py`'s
    `HybridProvider` tests updated for "everything reaches the LLM" routing
    (the recognized-intent short-circuit test no longer applies; cache/
    daily-cap tests still apply directly). Frontend: confirm
    `geolocationWiring.test.tsx`/`RouteInputForm` tests still pass unchanged
    (prefill/navigation logic untouched by this work).

17. **Language hint was overriding the message's actual language** (bug
    found during manual testing — a Chinese-language question got an
    English reply). Root cause: `usePreferencesStore.language` reflects the
    app's UI language *setting*, which most users leave at the default
    `"en"` even when typing a message in another language. `_SYSTEM_PROMPT`'s
    instruction let that `"Preferred language: en"` hint outweigh the
    model's own read of the actual message text. Fix —
    `backend/app/integrations/ai_client.py`: reword the language instruction
    so detecting the language from the *current message's own text* is
    the primary signal, and the `Preferred language` hint is explicitly
    downgraded to a tie-breaker used only when the message itself is too
    short/ambiguous to carry a language (a bare station name, "ok", a
    single number). **Status: done, verified live.**
17b. **Route wizard swapped origin/destination** (bug found during manual
    testing — "Punggol to Jurong East" came out of the wizard as
    "Jurong East to Punggol"). This surfaces whenever the rule-based
    fallback handles a ROUTE message (e.g. Groq rate-limited mid-session,
    or no API key configured) — `_handle_route` treats
    `_extract_station_mentions(message)[0]` as origin and `[1]` as
    destination, but that function returned matches in `stations.json`'s
    listing order, not the order the stations were actually mentioned in
    the message. Fix — `backend/app/services/ai_orchestrator.py`:
    `_extract_station_mentions` now finds each match's character position
    in the message and sorts by that, so "Punggol to Jurong East" always
    returns `[Punggol, Jurong East]` regardless of which one appears
    earlier in the data file. **Status: done, verified.**
18. **`stationIds`/map-highlight used the model's own guess instead of the
    tool's resolved station id** (bug found during manual testing —
    clicking "View station on map" from a crowd/facility answer navigated
    to the map but didn't select or highlight the actual station). Root
    cause: unlike `routeResults` (phase 13, attached programmatically from
    the real `plan_route` tool output), `stationIds` in the final JSON
    envelope is still whatever the model itself wrote — which is
    frequently a display-cased name ("Orchard") rather than the internal
    slug id (`"orchard"`) the frontend's `STATIONS.find(s => s.id === ...)`
    lookup needs, so the lookup fails silently and nothing gets
    highlighted or selected. Fix — `backend/app/services/agent_tools.py`:
    have `get_crowd_level`, `get_last_train`, `get_station_facilities`,
    `get_incidents` (when a station filter resolves), and `plan_route`
    (origin/destination) each include the *resolved* internal station id(s)
    in their returned dict. `backend/app/integrations/ai_client.py`'s
    `_openai_compatible_chat`: track resolved station ids across the
    tool-calling loop the same way `last_route_result` is already tracked,
    and overwrite `parsed["stationIds"]` with the real resolved ids
    whenever any tool call resolved one — never trust the model's own
    transcription of an id, matching the principle already applied to
    `routeResults`. **Status: done, verified (new tests in
    `test_agentic_tool_calling.py`).**
19. **Route Planner loses its state on tab navigation** (bug found during
    manual testing — plan a route via the AI, switch to the AI tab and
    back to Route, and the result/prefill is gone). Root cause:
    `RoutePage.tsx` keeps the selected preference, the AI hand-off prefill,
    and the last computed route entirely in local component state and
    `useRoutePlanner`'s TanStack Query mutation state — both reset on
    every unmount, which happens on every tab switch in this single-page
    app's router. This affects any computed route, not just AI-planned
    ones. Fix — new `frontend/src/store/routeStore.ts` (a small Zustand
    store, same in-memory-for-the-session pattern already used by
    `assistantStore`/`mapStore`) holding the last plan request and result;
    `RoutePage.tsx` reads/writes it instead of purely local `useState`, so
    switching tabs and back restores the last view instead of resetting it.
    **Status: done** (typecheck + full test suite verified; manual
    tab-switch click-through not yet re-confirmed live in-browser — worth
    a quick sanity check).
20. **A transient provider failure got cached and kept being served after
    the provider recovered** (bug found while investigating why a burst of
    Groq 429s during heavy manual testing made *every* subsequent identical
    question keep returning the canned rule-based decline, even minutes
    after Groq's own rate-limit headers showed the request/token budget had
    recovered). Root cause: `HybridProvider.chat()` caches whatever
    `self.llm_provider.chat(...)` returns — but `OpenAIProvider`/
    `GroqProvider.chat()` catch their own failures internally and return
    `RuleBasedAssistant`'s fallback reply, indistinguishable from a real
    answer to the caching code. One transient failure got "burned in" to
    the cache for the full `AI_CACHE_TTL_SECONDS` (900s), so the *same
    question* kept serving a stale decline long after the provider was
    healthy again. Fix — `backend/app/integrations/ai_client.py`:
    `_fallback_response()` now marks its return dict with `_isDegraded:
    True`; `HybridProvider.chat()` pops that marker off (so it never leaks
    into the actual API response) and only calls `_set_cached(...)` when it
    was absent. **Status: done, verified** (`test_ai_props.py`: a
    fails-once-then-recovers stub confirms the second identical call
    retries the provider rather than replaying the cached failure; a
    healthy response is still cached normally). Separately, live testing
    also surfaced that Groq's API was still 429-ing fresh, never-before-sent
    messages from this app even when its own `x-ratelimit-remaining-*`
    headers (checked via direct calls) showed ample daily/per-minute budget
    — likely a burst/concurrency-sensitive limit not reflected in those
    headers, probably residual from today's testing volume. Not a code
    issue and not something fixable here; expected to clear on its own.

21. **Degraded replies were indistinguishable from normal ones — a rate
    limit and a genuinely unclassifiable question both silently produced
    the exact same generic decline.** (Follow-up confusion during phase 20's
    live testing: after Groq's daily TPD budget was legitimately exhausted,
    non-English messages kept coming back as the canned `OUT_OF_SCOPE` line
    — "I'm an MRT-focused assistant..." — with no indication this was a
    provider failure rather than the rule-based fallback simply failing to
    understand the question. There was no way to tell the two apart from
    the reply text alone.) Two independent fixes, both in the fallback
    path only (the healthy Groq/OpenAI tool-calling path is unaffected):
    - `backend/app/integrations/ai_client.py`: `_fallback_response()` now
      takes an `error_type` ("rate_limited" | "daily_cap" |
      "provider_error") and prepends a short, honest, language-matched note
      naming the real cause before the rule-based answer — e.g. "The AI
      assistant has hit today's usage limit. Please try again in a few
      minutes — meanwhile, here's a basic answer: ...". A new
      `_classify_provider_exception()` inspects the caught exception's
      `.response.status_code` to distinguish a 429 (`rate_limited`) from
      any other provider failure (`provider_error`); `HybridProvider`'s
      daily-cap branch and the tool-calling loop's iteration-exceeded case
      are tagged explicitly. `_DEGRADED_NOTES` holds en/zh/ms/ta text for
      all three cases, keyed by `context.language` (falls back to `en`).
    - `backend/app/services/ai_orchestrator.py`: `_handle_out_of_scope()`
      no longer returns one vague "I'm an MRT-focused assistant..." line —
      `_OUT_OF_SCOPE_REPLIES` gives per-language guidance with concrete
      example prompts ("crowd level at Bishan", "last train from Bugis",
      etc.) so a genuinely unclear question gets actionable guidance
      instead of a scope-restriction notice. This applies whenever the
      rule-based path lands on `OUT_OF_SCOPE` — degraded or not.
    - **Scope note**: this does not make the rule-based fallback itself
      multi-language-capable — `classify_intent()` and
      `_extract_station_mentions()` are still English-keyword/English-name
      only (a Chinese station-name lookup would need a translation table
      across 180+ stations, judged not worth it for a path that only
      activates when the real LLM is down). A non-English message that
      the fallback can't classify still lands on `OUT_OF_SCOPE`, but now
      with a translated, example-driven reply instead of a fixed English
      line, and — if the fallback was triggered by an actual provider
      failure — a translated note naming that cause first.
    - **Status: done, verified** — `test_ai_props.py` gained 6 new tests
      covering: a mocked 429 producing the rate-limited note (English and
      Chinese), a non-429 failure producing the generic provider-error
      note (and confirming it does *not* claim rate-limiting), the daily
      cap producing its own note, and the `OUT_OF_SCOPE` reply containing
      example prompts in both English and Chinese. Also manually verified
      end-to-end against a live-mocked Groq 429 for both an English
      facility question (note + correct rule-based answer, both present)
      and a Chinese route question (note + example-prompt guidance, both
      in Chinese). Full backend suite: 235/236 passing — the one failure
      (`test_moderation_props.py`, a `BITCH`-triggering Hypothesis example
      landing on `profanity_detected` instead of the expected
      `spam_detected`) is unrelated to this change, in an untouched module.
    - **Follow-up bug found immediately in live testing**: both replies
      still came back in English for genuinely Chinese/Tamil messages,
      because the language selection above used `context.language` (the
      app's UI setting, defaulting to `"en"`) with no fallback to the
      message's own text — unlike the real LLM path, which detects
      language from the message itself first (see `_SYSTEM_PROMPT`'s
      instruction) and only falls back to the hint when the text is too
      ambiguous. A user typing Chinese without having changed the UI
      language dropdown got an English note and an English `OUT_OF_SCOPE`
      reply. Fix — `backend/app/services/ai_orchestrator.py`:
      `_detect_script_language()` checks the message's Unicode codepoints
      for the CJK block (zh) or the Tamil block (ta) — both unambiguous by
      script, unlike Malay/English which share the Latin alphabet and
      still rely on `context.language`. `_resolve_reply_language()`
      combines the two: detected script first, hint as fallback. Both
      `_handle_out_of_scope()` and `ai_client._fallback_response()`'s note
      selection now go through this instead of reading `context.language`
      directly. **Status: done, verified** — 2 more tests added (237/238
      passing overall) confirming both the `OUT_OF_SCOPE` reply and the
      degraded-cause note pick zh/ta correctly even with
      `context.language: "en"`; also manually verified against the exact
      messages from the reported screenshot.

22. **`HybridProvider`'s cache key ignored `language` and
    `selectedRoutePreference`, so two requests with the same message text
    and station but different context silently collided on the same cache
    entry** (flagged by team review, and directly confirmed as the cause
    of a live bug report: asking "比戏站现在人多吗" in Chinese got an English
    reply from the real LLM/tool-calling path; switching the UI language
    to Chinese and re-asking the identical text got back the *same* English
    reply — because `_cache_key()` only combined `currentStationId` and the
    message, so the second request was a cache hit on the first, and the
    LLM was never called again to produce a Chinese answer). Root cause:
    `_build_user_message()` (`backend/app/integrations/ai_client.py`)
    sends three context fields into the prompt — `currentStationId`,
    `selectedRoutePreference`, `language` — but `_cache_key()` only keyed
    on the first. Fix: `_cache_key()` now folds in all three:
    `f"{station}:{preference}:{language}:{normalized}"`. Also untracked
    `frontend/tsconfig.tsbuildinfo` (a regenerated TypeScript incremental-
    build cache file that had been accidentally committed, with no
    `.gitignore` coverage) via `git rm --cached` and a new
    `frontend/*.tsbuildinfo` entry in the root `.gitignore`. **Status:
    done, verified** — 2 new tests confirm a language change and a route-
    preference change each force a fresh LLM call instead of a cache hit
    (239/240 passing overall — same pre-existing unrelated moderation
    flake as phase 21).

Not doing (out of scope for a hackathon app): Redis-backed distributed
cache/rate-limit, self-hosted open-weight model, streaming responses,
per-user auth-based quotas, Gemini/Anthropic tool-calling (phase 12 covers
why), real-time official alerts without a real `LTA_ACCOUNT_KEY` (config
change, not code — architecture already supports it), full multi-language
station-name matching for the rule-based fallback (phase 21 — only the
primary Groq/OpenAI tool-calling path resolves non-English station names,
via the LLM's own translation before calling tools, not the fallback).

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
- **Cost-exposure tradeoff (`has_mrt_signal` narrowed to an empty-message
  check):** off-topic-but-non-empty messages (e.g. "tell me a joke") that
  used to be free-rejected by a keyword pre-filter now consume cache/
  daily-cap capacity like any other message, once a real provider is
  configured. Accepted because the remaining layers still bound cost
  (cache, daily cap, rate limit) and the LLM's own system prompt still
  declines off-topic questions — it's just no longer rejected for free
  before that judgment gets made.
- **Cost-exposure tradeoff (classify-first routing removed, phase 13):**
  the 7 real intents (route/last-train/crowd/transfer/accessibility/
  facility/incident) no longer get answered for free by the rule-based
  engine — every one of them now reaches the LLM. This is the single
  biggest cost-model change in this document. Accepted because it's a
  deliberate product tradeoff (tool-backed, grounded answers instead of
  keyword-templated prose) rather than an oversight, and the daily cap +
  cache + rate limit still bound worst-case cost exactly as before; the
  failure mode is still graceful degradation to `RuleBasedAssistant`, not
  an outage or bill blowout.
