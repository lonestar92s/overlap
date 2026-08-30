# Ask Agent Eval Charter

This document defines **what “good” means** for Ask Agent (natural-language match search), **how we measure it**, and **how PM and engineering run evals together**. It applies the [Four Pillars](https://medium.com/@xzwwnx/evals-the-four-pillars-every-ai-product-manager-needs-66629f70ffad) framework to this product.

**Related docs:** `LLM_ORCHESTRATION.md` (scenario behavior), `MULTI_QUERY_TEST_CASES.md` (detailed spec), `backend/evals/nl-search/` (automated harness).

---

## Purpose — why we evaluate

Every eval answers one decision. Do not add cases without filling in the blank.

| Eval stream | We are running this to decide… |
|-------------|--------------------------------|
| **Ship gate** | Can we merge a prompt/model change without inventing fixtures, breaking clarifications, or ignoring home/away constraints? |
| **Regression** | Did a change silently break a scenario (S5 date ask, S8 multi-query, single-query backward compat)? |
| **Optimization** (later) | Is a cheaper/faster model acceptable, or do we keep the current one? |

**PM one-liner (default):** *We are running Ask Agent evals to decide whether a natural-language search change is safe to ship without embarrassing failures in parse, search, or user-facing copy.*

---

## Ground truth — what “good” means

**Charter statement:**

> Ask Agent is good when it turns messy fan language into a **usable set of real matches** that respect hard constraints, and **asks one clarifying question** when date or location is missing — as measured by gold parse cases, policy assertions on the API, fixture data grounded in Mongo/API-Sports, and weekly human spot-checks.

### Truth sources (use more than one)

| Source | What it proves | Where it lives |
|--------|----------------|----------------|
| **Gold parse cases** | Slots extracted correctly (team, home/away, leagues, counts, distance) | `backend/evals/nl-search/cases/*.json` |
| **Policy rules** | S5 asks for date/location; S6 does not search on greetings; no raw errors to users | API-mode eval cases |
| **DB / API grounding** | Returned fixture IDs exist; venues and kickoffs match data | API-mode + integration tests (future expansion) |
| **Human raters** | “Would I use this trip plan?” | Weekly 20-query review (PM) |
| **Proxy outcomes** (lagging) | Search → map view → trip saved | Product analytics (later) |

### Core product rule (non-negotiable)

From `LLM_ORCHESTRATION.md`: **fixtures come from your APIs and DB; the LLM summarizes, it does not invent matches.**

---

## Dimensions — pick three

Ask Agent cannot ship without these:

| Dimension | Definition | Threshold |
|-----------|------------|-----------|
| **Factuality** | No invented fixtures; results trace to real data | **Zero tolerance** on gold API set |
| **Constraint fidelity** | home/away, distance, date window, league, secondary count honored | **≥ 90%** on labeled gold set |
| **Task success** | User gets a usable plan **or** one clear clarification | **≥ 80%** “I’d use this” on weekly human sample (n=20) |

### Explicit trade-offs (PM owns these)

| Trade-off | Ask Agent policy |
|-----------|------------------|
| Ask vs guess | **Ask** (S5). Never invent “this weekend” when the user gave no date. |
| Clarity vs completeness | Prefer **3 well-constrained matches** over many weak ones. Default secondary count = 3 is intentional. |
| Speed vs accuracy | Wrong team/league is worse than +2s parse latency. |

---

## Operationalization — keep evals alive

### Cadence

| When | What | Command / action |
|------|------|------------------|
| Every NL prompt/model PR | Parse regression | `cd backend && npm run eval:nl-search:parse` |
| Before release | Full API regression | `cd backend && npm run eval:nl-search:api` |
| Weekly | Human spot-check | PM labels 20 live Ask Agent queries (see worksheet below) |
| After production miss | Add a case | New JSON in `cases/` from the failing query |

### Ownership

| Role | Owns |
|------|------|
| **PM** | Purpose, charter, thresholds, weekly labeling, prioritizing which failures block ship |
| **Engineering** | Harness, CI wiring, case JSON, fixing regressions |
| **Both** | Scenario matrix in `LLM_ORCHESTRATION.md`, promoting spec cases from markdown → JSON |

### Ship gates (recommended)

- Do **not** merge prompt/model changes if parse eval pass rate drops below **90%** on non-skipped cases.
- Do **not** release if **any** S5 policy case fails (must ask for date/location, not search blindly).
- Do **not** release if **any** backward-compat case fails (`isMultiQuery: false` for single queries).

### Refresh cycle

- Quarterly: review scenario coverage (S1–S9) vs `SCENARIO_INDEX.md`.
- Continuous: every user-reported Ask Agent miss → new eval case within one sprint.

---

## Scenario coverage

Behavior is defined in `LLM_ORCHESTRATION.md`. Automated cases are indexed in `backend/evals/nl-search/SCENARIO_INDEX.md`.

| Scenario | Situation | Eval priority |
|----------|-----------|---------------|
| S1 | Specific query + matches | High |
| S2 | Broad query + matches | Medium |
| S3 | Plausible filters, empty results | Medium |
| S4 | League/location mismatch | Low |
| S5 | Missing date or location | **Critical** |
| S6 | Greeting / no search intent | High |
| S7 | Internal error | Medium |
| S8 | Multi-query / mixed constraints | **Critical** |
| S9 | Discovery (country → leagues) | Medium |

---

## Weekly human eval worksheet (PM)

Label 20 live Ask Agent queries each week. Copy this table into your notes tool.

| # | User query | Outcome (search / clarify / greeting / fail) | Factuality (Y/N) | Constraints honored (Y/N) | Would use result? (Y/N) | Notes → new case? |
|---|------------|-----------------------------------------------|------------------|---------------------------|-------------------------|-------------------|
| 1 | | | | | | |
| … | | | | | | |

**When human score disagrees with automated pass:** the eval set is wrong — add or fix a case, do not dismiss the user.

---

## PM learning path (2 weeks)

1. **Days 1–2:** Read this charter; run `npm run eval:nl-search:parse` and `api`; read `SCENARIO_INDEX.md`.
2. **Days 3–5:** Label 30 queries yourself (10 happy, 10 messy, 10 from logs). Score today’s agent before changing anything.
3. **Days 6–8:** Turn each failure into a JSON case. One case per failure mode, not one giant rubric.
4. **Days 9–10:** Set ship gates with engineering; schedule weekly labeling.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-30 | Initial charter: four pillars, thresholds, cadence, scenario map |
