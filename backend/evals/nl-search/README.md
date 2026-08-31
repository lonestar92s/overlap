# NL Search Eval Harness

This directory contains a lightweight eval harness for `/api/search/natural-language` (Ask Agent).

**PM charter:** `ai_agents/ASK_AGENT_EVAL_CHARTER.md`  
**Scenario index:** `SCENARIO_INDEX.md`

## Modes

- `parse` (default): calls `parseNaturalLanguage()` directly
- `api`: calls the full HTTP endpoint through `supertest`

## Run

From `backend/`:

```bash
npm run eval:nl-search:parse
npm run eval:nl-search:api
npm run eval:nl-search -- --mode parse --scenario S8
npm run eval:nl-search -- --mode parse --min-pass-rate 0.9
```

## Case format

Cases live in `cases/*.json`:

```json
{
  "id": "S5-001",
  "scenario": "S5",
  "input": { "query": "Premier league matches in London" },
  "expect": {
    "success": false,
    "missingFields": ["date"],
    "messageContainsAny": ["when", "date"]
  }
}
```

Supported expectation operators:

- `$exists`
- `$containsAny`
- `$includesAll`
- `$leagueIdsContain`
- `$teamNamesContain`
- `$oneOf` (value must match one of the listed options; useful for fuzzy LLM outputs like count defaults)

## Notes

- Parse mode and API mode both require `OPENAI_API_KEY`.
- API mode also requires MongoDB (`MONGODB_URI`/`MONGO_URL`) and auth (`JWT_SECRET`; creates/uses eval bot user, or set `EVAL_AUTH_TOKEN`).
- Model overrides are supported via `OPENAI_MODEL`.
- Cases with `modes: ["parse"]` or `modes: ["api"]` are skipped in the other mode — run both modes for full coverage.

## Recommended workflow

1. Read the charter and pick a failure mode from production or `MULTI_QUERY_TEST_CASES.md`.
2. Add a JSON case under `cases/`.
3. Run parse eval locally before opening a PR.
4. Run API eval before release.
5. Update `SCENARIO_INDEX.md`.
