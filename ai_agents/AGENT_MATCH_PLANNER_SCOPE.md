# Match Planning Agent – Scope

**Status:** Draft  
**Last updated:** 2026-03

---

## 1. Purpose

An **in-product AI agent** that helps users plan around matches by understanding natural language, calling existing APIs as tools, and (when needed) asking for clarification. The agent is exposed via a **chat UI** (Messages tab). We start with **match search from natural language** (MVP), then expand toward trip planning, home base, date flexibility, and travel feasibility.

**Not in scope:** The “agents” in this repo used for *development* (UI/UX, Architect, QA, DevOps) are separate; this document describes the **product** Match Planning Agent only.

---

## 2. Out of scope (all phases)

- **Cost context / route cost history** – No surfacing of “typically £X” or price trends; route cost history is not a tool for this agent.
- **Dev agents** – UI/UX, Architect, QA, DevOps personas in `ai_agents/` are for code review and production readiness, not end-user planning.
- **Fully automated booking** – Agent suggests and plans; user (or other flows) books. No direct booking by the agent.
- **Real-time match data** – Agent uses existing match search / trip APIs, not live score or lineup feeds.

---

## 3. MVP (Phase 1)

**Goal:** Return the correct matches from natural language, and ask for clarification when information is missing or ambiguous.

### 3.1 Interface

- **Chat UI:** Re-enable the **Messages** tab as the agent surface.
  - **Current state:** Tab exists (`MessagesScreen.js`), uses `naturalLanguageService` (`processNaturalLanguageQuery`, `formatSearchResults`). Tab is **off** via `FEATURE_FLAGS.enableMessagesTab` in `mobile-app/utils/featureFlags.js`.
  - **MVP:** Ensure matches are returned correctly from natural language; agent can ask for clarification when needed.

### 3.2 Flow

1. User types in natural language (e.g. “Premier League matches in London next month”, “Arsenal home games in March”).
2. Agent infers intent (dates, location, league, team, etc.) and calls **match search** (and any existing search APIs) with structured parameters.
3. Agent returns the matching matches (or a short summary) in the chat.
4. If required information is missing or ambiguous (e.g. no dates, “London” vs “London, ON”), the agent **asks for clarification** instead of guessing; after the user responds, the agent re-queries and returns results.

### 3.3 Conversational behavior (greetings and small talk)

- **Greetings** (e.g. “hello”, “hi”, “hey”) and **small talk** (e.g. “thanks”, “what can you do?”) get a **friendly, conversational reply** and a nudge to search for matches—no search is run.
- **Defined in:** Backend OpenAI system prompt for `parseNaturalLanguage` (see `overlap/backend/src/routes/search.js`). When the user message has no search intent, the model returns a short `errorMessage` that is shown in the chat; the same pipeline is used, so no separate intent gate is required for MVP.

### 3.4 In scope for MVP

- Natural language → match search only.
- Clarification loop (ask for dates, location, league, team, etc. when needed).
- Correct mapping from user utterance to search API parameters and correct display of results.
- Conversational replies for greetings/small talk (via prompt).

### 3.5 Out of scope for MVP

- Trip creation or editing.
- Home base suggestion.
- Date flexibility (“what if I shift by a week?”).
- Travel feasibility (directions, travel time).
- Cost or price context.

### 3.6 Tools (MVP)

| Tool | Description |
|------|-------------|
| Match search | Existing match search API (by date range, location, league, team, etc.). |

Other backend capabilities (trip CRUD, home base, flights, directions, date flexibility) are **not** used by the agent in MVP.

---

## 4. Future phases (build toward full scope)

After MVP is stable, add in stages:

- **Trip-from-matches** – “I want to attend these N matches” → suggest trip dates, order, optional home base(s).
- **Trip recommendations** – Leverage the existing recommendations model: for a given trip, surface “more matches that fit your trip” (date range, proximity to existing match venues, subscription tier). API: `GET /api/trips/:tripId/recommendations`; backend: `recommendationService`.
- **Home base suggestion** – Given a trip’s matches, suggest where to stay (e.g. centroid, date clusters).
- **Date flexibility** – “What if I shift by ±1/±7/±14 days?” → impact on matches (no cost context).
- **Travel feasibility** – For a given trip + home base(s), summarize “can I get from A to B in time?” (directions/travel-time APIs).

Same pattern: chat + clarification; no cost/route history.

---

## 5. Full scope (post-MVP reference)

### 5.1 User-facing capabilities (post-MVP)

| Capability | Description |
|------------|-------------|
| Trip-from-matches | Suggest trip dates, order, optional home base(s) from “I want these N matches”. |
| Trip recommendations | Surface recommendations for a trip (matches that fit trip dates and proximity; uses existing recommendations model). |
| Home base suggestion | Suggest where to stay given trip matches. |
| Date flexibility | Show impact of shifting dates (±1/±7/±14 days) on matches. |
| Travel feasibility | Summarize travel time / feasibility between match venues and home base(s). |

*(Cost context and route cost history remain out of scope.)*

### 5.2 Tools (post-MVP)

- Match search
- Trip CRUD + add/remove matches
- **Trip recommendations** – Get recommendations for a trip (`GET /api/trips/:tripId/recommendations`; `recommendationService` – date range, proximity, subscription tier).
- Home base CRUD + suggest home base (when available)
- Flight search
- Train/rail search (when implemented)
- Directions / travel time (driving, transit, rail)
- Date flexibility endpoint (if exposed)

### 5.3 Inputs (all phases)

- User intent (natural language or structured).
- Current trip state when relevant (trip id, matches, home bases, dates).
- Optional: preferences (e.g. “prefer train”, “must be back by X”) in later phases.

### 5.4 Outputs and success criteria

- **Structured suggestions** (matches, trip ideas, home base options, date-shift impact, travel summary).
- **No direct writes without confirmation** – e.g. “Create this trip?” / “Add this home base?” with user approval.
- **Clear attribution** – User sees that suggestions come from the match planning agent and can ignore or edit.

### 5.5 Boundaries

- Agent does not book flights/trains/hotels; it suggests and may link to existing booking flows.
- Agent uses only approved tools (no arbitrary external APIs beyond those listed).
- Scope is trip/match planning only (no general chat or off-topic).
- Prefer reusing existing features (e.g. date flexibility card) over duplicating logic in the agent.

---

## 6. Decisions and open questions

### 6.1 Resolved decisions

1. **Feature flag:** Ship behind `enableMessagesTab`; enable for all users at launch. Rollout can be refined later (no external users yet).
2. **Tier gating:** No tier gating at launch; agent (Messages tab) is for everyone. Tier gating (e.g. by subscription plan) can be added later.
3. **Natural language service:** Use the existing backend **`POST /search/natural-language`** as the single source of truth for NL → search params in MVP. It already uses **OpenAI** (`OPENAI_API_KEY` on backend) for parsing; mobile calls this endpoint via `naturalLanguageService`. No separate LLM agent layer in MVP.
4. **Clarification UX:** Max **2 clarification rounds** before suggesting a fallback (e.g. “Here are some popular leagues; pick one”).
5. **Errors and fallbacks:** When match search fails or returns empty, the agent should give a **natural-language recommendation based on the error** (e.g. suggest loosening filters, different dates, or explain what went wrong), not a generic message.
6. **Analytics and safety:** **Yes, log** (anonymized) query patterns and failure rates for improving intent parsing and clarification. Maintain a **possible PII list** (see below) and decide what to redact or exclude from logs.
7. **Localization:** MVP in **English only**. App-wide localization is planned separately.
8. **Accessibility:** Chat UI must meet the **same accessibility standards as the rest of the app**. **Scope app-wide accessibility** (including chat) as a separate task (screen reader order, focus management, error announcements, contrast, touch targets).
9. **Trip recommendations (when to surface):** **Configurable**, e.g. in **user settings**. Options: always show / only when user asks / off.

### 6.2 Possible PII (for logging)

When logging agent queries and analytics, consider redacting or excluding:

- **Free-text query** – May contain names, locations, or other identifying details (e.g. “my trip to London with John”).
- **Conversation history** – Same as above; keep only structural info (e.g. “had 2 clarification turns”) or anonymized summaries if needed.
- **IP / user agent** – If logged at all; treat as PII per privacy policy.
- **Identifiers in error payloads** – e.g. user IDs, trip IDs; redact or hash if logs are retained.

*(Decide retention and redaction policy and document in privacy/runbook.)*

### 6.3 Open questions

- **PII and retention:** Final list of what is logged vs redacted; retention period; where it’s stored.
- **Accessibility scoping:** Define app-wide accessibility standards and a scoping doc/task (chat + rest of app).

---

## 7. References

- **Chat UI:** `mobile-app/screens/MessagesScreen.js`, `mobile-app/services/naturalLanguageService.js`
- **Feature flag:** `mobile-app/utils/featureFlags.js` → `enableMessagesTab`
- **App tab registration:** `mobile-app/App.js` → MessagesTab (gated by `FEATURE_FLAGS.enableMessagesTab`)
- **Flight/train and planning context:** `ai_agents/FLIGHT_TRAIN_SEARCH_ARCHITECTURE.md`, `ai_agents/ARCHITECTURE_REVIEW.md`
- **Recommendations model:** `overlap/backend/src/services/recommendationService.js`, `overlap/backend/src/routes/recommendations.js` (GET `/api/trips/:tripId/recommendations`)
