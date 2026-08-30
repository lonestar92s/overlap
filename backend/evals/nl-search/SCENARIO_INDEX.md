# NL Search Eval — Scenario Index

Maps automated cases to orchestration scenarios (`ai_agents/LLM_ORCHESTRATION.md`).

## Cases by scenario

| Scenario | Case ID | Modes | Description |
|----------|---------|-------|-------------|
| S1 | S1-001 | api, parse | Premier League + London + explicit date |
| S5 | S5-001 | api | Missing date when league + location given |
| S5 | S5-002 | api | Missing location when league + date given |
| S5 | S5-003 | parse | Parse must not invent date (league + location only) |
| S6 | S6-001 | api | Greeting returns conversational response |
| S6 | S6-002 | parse | Greeting parse sets errorMessage, no search slots |
| S8 | S8-001 | api, parse | Multi-query: Bayern home + 2 secondary within 200mi |
| S8 | S8-002 | parse | Multi-query: “a few other matches” → count 3 |
| S8 | S8-003 | parse | Single query: Arsenal away |
| S8 | S8-004 | parse, api | Single query: not multi-query (backward compat) |
| S8 | S8-005 | parse | Multi-query: distance constraint 200 miles |

## Coverage gaps (add next from production)

| Scenario | Status |
|----------|--------|
| S2 Broad + matches | Not yet in harness |
| S3 Empty results copy | Not yet in harness |
| S4 League/location mismatch | Not yet in harness |
| S7 Error path | Not yet in harness |
| S9 Discovery queries | Not yet in harness |
| S8 teamConstraints (mixed home/away per team) | Spec in LLM_ORCHESTRATION; not implemented |

## Promoting from `MULTI_QUERY_TEST_CASES.md`

When adding cases from the markdown spec:

1. Pick one failure mode or assertion cluster (not the whole section).
2. Add `cases/<scenario>-<slug>.json` with `id`, `scenario`, `modes`, `input.query`, `expect`.
3. Update this index.
4. Run parse and api modes; fix assertions before expanding the set.
