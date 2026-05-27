# NL Search Eval Harness

This directory contains a lightweight eval harness for `/api/search/natural-language`.

## Modes

- `parse` (default): calls `parseNaturalLanguage()` directly
- `api`: calls the full HTTP endpoint through `supertest`

## Run

From `backend/`:

```bash
npm run eval:nl-search:parse
npm run eval:nl-search:api
npm run eval:nl-search -- --mode parse --scenario S5
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

## Notes

- Parse mode and API mode both require `OPENAI_API_KEY`.
- API mode also requires MongoDB (`MONGODB_URI`/`MONGO_URL`).
- Model overrides are supported via `OPENAI_MODEL`.
