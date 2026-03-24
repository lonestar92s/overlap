# LLM orchestration (match search & chat)

This document is the **single place** for how we use OpenAI (and fallbacks) for **natural-language match search** and **user-facing messages**. Implementation lives in code; this file defines **intent, rules, and scenarios** so prompts and product behavior stay aligned.

**Primary code:** `overlap/backend/src/routes/search.js` (`parseNaturalLanguage`, `generateResponse`, `/api/search/natural-language`).

---

## Goals

1. **Correctness:** Fixtures and filters come from **your APIs and DB**, not from the model’s memory.
2. **Clarity:** Short, friendly copy; **no** internal errors, IDs, or stack traces to end users.
3. **Consistency:** Same rules for clarification, success, empty, and error paths.
4. **Efficiency:** Call the model when language adds value; use **deterministic** code when it does not.

---

## Core principles

| Principle | Meaning |
|-----------|---------|
| **Ground truth** | Kickoff times, teams, venues, and league names must match **API-Sports / Mongo** outputs. The LLM may **summarize**, not **invent** fixtures. |
| **Structured first** | Prefer **JSON** (or fixed fields) for parsing. Natural language is for **messages** and **optional** clarification. |
| **Explicit context** | If the user already gave team, league, place, or dates, the **prompt must include** that so the model does not ask for it again. |
| **Safe failures** | On errors, return **generic** copy server-side; log details only in server logs. |
| **Redundant copy** | Do not ask users to “add a team or league” when `parsed.teams` and `parsed.leagues` are already populated. |

---

## Pipeline (high level)

1. **Parse** user text → slots (teams, leagues, location, date range, home/away, etc.). OpenAI may be used; **regex + DB** path exists if the model is unavailable.
2. **Resolve** entities → league ids, team names, coordinates (Mongo, geocoding, etc.).
3. **Search** → `performSearch` (fixtures by league/season/date; filters for team, league, bounds, home/away).
4. **Respond** → `generateResponse` may produce a short message; must follow **scenario rules** below.

---

## Scenario matrix (living document)

Use this table to agree on behavior before changing prompts. Extend rows as new flows appear.

| ID | Situation | Expected user-facing behavior | LLM used? | Notes |
|----|------------|-------------------------------|------------|--------|
| S1 | Parse succeeds; **matches found**; user specified **team + league + location + dates** | Confirm count and **time range**; invite **optional** follow-up (e.g. away games, another month)—**do not** ask to add team/league | Optional | Align `generateResponse` context with this. |
| S2 | Parse succeeds; **matches found**; user specified **only** location + dates (broad) | Acknowledge count; suggest narrowing by **team or league** | Optional | |
| S3 | Parse succeeds; **no matches**; filters are plausible | Explain briefly; suggest **wider dates**, **nearby area**, or **other competitions** | Optional | |
| S4 | Parse succeeds; **no matches**; league/location **inconsistent** | Short explanation + **one** alternate | Optional | |
| S5 | Missing **date** or **location** (MVP guardrails) | Single clarification request + **example queries** | Optional / template | |
| S6 | Greeting / no search intent | Brief reply + **example** searches | Optional / template | |
| S7 | Upstream / internal error | Generic “try again”; **no** raw `error.message` | No | Fixed copy in server. |
| S8 | Mixed side constraints (e.g. **X at home** and **Y away**) | Return fixtures that satisfy the per-team side constraints; do not collapse to one global `matchType` | Optional (for wording), deterministic filtering | Requires team-scoped side constraints in parse output. |
| S9 | Discovery query (e.g. "what are all leagues in Germany?") | Return league list for the country (tier-aware if available), then suggest one next-step search | Optional (for wording), deterministic data lookup | No fixture search required unless user asks. |

---

## Prompt contract (what callers must pass)

When calling `generateResponse` (or any future summarizer), the **minimum context** should include:

- **Outcome:** `success` | `empty` | `error` (and match count if success).
- **Place & time:** Human-readable `location` and `dateRange` (for display only).
- **Optional intent (for copy):** Whether the user already specified `teams`, `leagues`, `matchType` (home/away), etc.
- **Team-scoped side constraints (when present):** `teamConstraints`, e.g. `[ {"team":"Manchester United","side":"home"}, {"team":"Arsenal","side":"away"} ]`.

If intent fields are omitted, the model **cannot** reliably avoid redundant questions.

### Parse contract addendum: mixed home/away queries

For prompts like **"I want to watch X play at home and Y play away"**, parser output should include team-scoped constraints:

```json
{
  "teamConstraints": [
    { "team": "X", "side": "home" },
    { "team": "Y", "side": "away" }
  ]
}
```

Filtering semantics:
- `side: "home"` means the team must equal `fixture.teams.home.name`
- `side: "away"` means the team must equal `fixture.teams.away.name`
- Do not treat this as a single global `matchType` for all teams
- Default aggregation for `teamConstraints` is **AND** (all constraints must be satisfied); optional browse override may use **OR**
- Default location scope for mixed constraints is **city-cluster first** when teams suggest the same metro area (for trip practicality); if constraints cannot be satisfied, automatically widen to league/country scope and state that widening in the response

---


## S8 examples (eval-ready)

Use these as acceptance examples for mixed side constraints.

1. **Query:** "I want to watch Arsenal at home and Chelsea away next month in London"
   - **Expected parse:** `teamConstraints` contains `{team: "Arsenal", side: "home"}` and `{team: "Chelsea", side: "away"}`
   - **Expected filter behavior:** first attempt city-cluster scope (e.g. London metro), satisfying both constraints (Arsenal home AND Chelsea away) in-window; if impossible, widen to league/country scope and disclose widening

2. **Query:** "Show me Liverpool away games and Manchester United home games in April"
   - **Expected parse:** `teamConstraints` has Liverpool/away and Manchester United/home
   - **Expected copy:** should not ask user to clarify "home or away"

3. **Query:** "I want to see Tottenham play at home and Arsenal play away, Premier League only"
   - **Expected parse:** side constraints + league id/name for Premier League
   - **Expected filter behavior:** league filter and side constraints both applied

4. **Query:** "Find Barcelona at home and Real Madrid away this weekend"
   - **Expected parse:** side constraints for both teams + weekend date range
   - **Expected copy:** if no matches, suggest broader dates, not generic team/league refinement

5. **Query:** "I want to see Chelsea and Arsenal"
   - **Expected parse:** teams present, no side constraints
   - **Expected behavior:** do not invent `teamConstraints`; normal team filtering applies

6. **Query:** "I want to watch X at home and Y away" (unknown team aliases)
   - **Expected behavior:** either resolve aliases or return a single concise clarification about unresolved team names

## S9 examples (discovery queries)

Use these for country/league discovery behavior.

1. **Query:** "What are all of the leagues in Germany?"
   - **Expected behavior:** return available Germany leagues (ordered by tier where possible), then suggest a follow-up search
   - **Expected copy:** concise list + one next action (e.g. "Want Bundesliga fixtures in Munich next month?")

2. **Query:** "What leagues are there in England?"
   - **Expected behavior:** same as above, include top competitions first
   - **Expected guardrail:** if dataset is partial, disclose: "Here are leagues currently available in our data"

3. **Query:** "Show me all leagues in Spain and their tiers"
   - **Expected behavior:** include tier labels when known; avoid fabricated tiers
   - **Expected fallback:** if tiers missing, return league names and say tier data is unavailable

---


## Implementation checklist (for PRs)

- [ ] New or changed prompt **references this doc** or updates the scenario table.
- [ ] Success / empty messages **do not** contradict populated `parsed` fields.
- [ ] No user-facing **API keys**, DB errors, or stack traces.
- [ ] Add or update a **test** or **eval case** when behavior is user-visible.

---

## Scenario → test case matrix

Use this table to map orchestration scenarios to concrete implementation and validation work.

| Scenario | Parse assertions | Search/filter assertions | Response assertions | Test type |
|----------|------------------|--------------------------|---------------------|-----------|
| **S1** Specific + matches | `teams`, `leagues`, `location`, `dateRange` all populated | Returned matches respect requested team/league/date/location | Message confirms result and **does not** ask to add team/league | unit + integration |
| **S2** Broad + matches | `location` + `dateRange` populated; teams/leagues optional | Results returned for broad scope with stable sort | Message suggests one narrowing axis (team **or** league) | unit + integration |
| **S3** Plausible + empty | Valid parse with no parser error | Search returns `count = 0` after filters | Message gives concise no-results guidance (wider dates/area) | integration |
| **S4** League/location mismatch | Parse captures explicit league + location | Mismatch detection path triggers deterministic alternatives | Message explains mismatch without technical jargon | integration |
| **S5** Missing required fields | Missing date/location identified with `missingFields` | No fixture search call required | Single clarification + examples | unit |
| **S6** Greeting/small talk | No search intent extracted | No fixture search call required | Brief greeting + one example query | unit |
| **S7** Internal/upstream error | Parse may succeed or fail | Error path returns safe payload | Generic retry message; no raw internals | integration |
| **S8** Mixed side constraints | `teamConstraints` array with team+side entries | **AND** semantics by default; city-cluster-first then widen policy | Message discloses widening when applied | unit + integration |
| **S9** Discovery (country→leagues) | Country intent captured | League list lookup only (no fixture search unless asked) | Tier-aware list + one next-step suggestion | unit + integration |

### Definition of done per scenario

- Parser output matches scenario contract.
- Search/filter behavior matches scenario policy.
- User-facing copy follows scenario response rules.
- At least one automated test and one eval/example query are recorded.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-23 | Initial doc: principles, scenario matrix, prompt contract. |
| 2026-03-23 | Added S8 and parse contract for mixed home/away per-team constraints. |
| 2026-03-23 | Added S8 location policy: city-cluster first, then widen to league/country with explicit disclosure. |
| 2026-03-23 | Added S9 discovery scenario and country→league examples. |
| 2026-03-23 | Added Scenario → test case matrix and definition of done checklist. |

---

## Next steps (discussion)

- Flesh out **S1–S9** with exact example strings and whether each uses **LLM vs template**.
- Decide **model** and **temperature** per step (parse vs. message).
- Add **trip planner** and **multi-turn** rows when those flows are implemented.
