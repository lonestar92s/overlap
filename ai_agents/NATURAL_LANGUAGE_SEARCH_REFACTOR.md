# Natural Language Search – De-hardcode and Use Backend

**Goal:** The Match Planning Agent should return matches and understand all possibilities by using the **deployed backend** (League model, leagueService, geocodingService, match search) instead of hardcoding league/country/city mappings in `search.js`.

---

## Phase 1 (done)

In the natural-language route we now use the backend for:

| Area | Before | After |
|------|--------|--------|
| **League ID → name** | Hardcoded `leagueMap` in NL error path and in `mapLeagueIdsToNames` | `leagueService.getLeagueNameById(apiId)` via `mapLeagueIdsToNamesAsync` |
| **League ID → country** | Hardcoded `leagueCountries` | `leagueService.getCountryByLeagueId(apiId)` |
| **“Does league match location?”** | `country === 'france' && leagues.includes('61')` etc. | `leagueService.getCountryCodeMapping(location.country)` → `getLeaguesForCountry(countryCode)` → check requested league IDs in that set |
| **Default leagues by location** | Hardcoded per-country lists (e.g. France → `['61','62','10']`) | `getCountryCodeMapping` + `getLeaguesForCountry(countryCode)`; fallback `getAllLeagues().slice(0, 15)` when no location |
| **Suggestions (“try in league’s country”)** | Hardcoded city per country (London, Paris, Munich, …) | “Try: [league name] matches in [country]” using `getCountryByLeagueId` (no city) |

---

## Remaining hardcoding (Phase 2 / 3)

| Location | What | Replacement |
|----------|------|--------------|
| **606–621** | `leagueMapping` (premier league→'PL', la liga→'PD') in legacy parser | Use leagueService search by name or retire path |
| **858–876** | `leagueMapping` fallback in `extractLeaguesFromQuery` | Rely on leagueService.searchLeagues only |
| **391–402, 884–945** | `getLocationWithCountry` / `extractLocation` city/country maps | geocodingService or location API |
| **972–1067** | `teamLeagueMapping` in `extractLeaguesFromTeams` | teamService / Team model (team by name → league) |
| **1082–1153** | `countryToCityMapping`, `inferLocationFromTeamsAndLeagues` (team/league → city/country/coords) | geocodingService or venue/team APIs |
| **Prompt text** | Example queries (“London”, “Premier League”) | Optional: move to config or generate from backend |

---

## References

- `overlap/backend/src/services/leagueService.js` – getLeagueNameById, getCountryByLeagueId, getLeaguesForCountry, getCountryCodeMapping
- `overlap/backend/src/routes/leagues.js` – GET /api/leagues, GET /api/leagues/country/:countryCode
- `overlap/backend/src/services/geocodingService.js`, `teamService.js`
