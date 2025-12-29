# Console Log Audit Report

**Date**: 2025-01-31  
**Scope**: All console logs in `flight-match-finder/mobile-app/`  
**Total Console Statements**: 559

---

## Categories

- **KEEP (Production)**: Critical errors, configuration warnings, rate limiting - should be sent to error tracking service
- **WRAP (__DEV__)**: Debug logs, verbose operations, performance tracking - only needed in development
- **REMOVE**: Redundant logs, verbose success messages, unnecessary debug output

---

## Summary by Category

| Category | Count | Action |
|----------|-------|--------|
| **KEEP (Production)** | ~25 | Keep but route to error tracking service |
| **WRAP (__DEV__)** | ~450 | Wrap in `__DEV__` checks |
| **REMOVE** | ~84 | Remove entirely |

---

## Detailed Audit by File

### `services/api.js` (146 console statements)

#### KEEP (Production) - Route to Error Tracking Service

| Line | Type | Statement | Reason |
|------|------|-----------|--------|
| 8-9 | `console.warn` | EXPO_PUBLIC_API_URL warnings (dev) | Configuration warning - already in `__DEV__` ✓ |
| 14-15 | `console.warn` | EXPO_PUBLIC_API_URL warnings (prod) | **KEEP** - Critical config warning for production |
| 177 | `console.error` | WorkOS callback error | **KEEP** - Auth failure, route to error service |
| 201 | `console.error` | Request password reset error | **KEEP** - Auth failure, route to error service |
| 226 | `console.error` | Reset password error | **KEEP** - Auth failure, route to error service |
| 1175 | `console.warn` | Rate limited and no cached travel times | **KEEP** - Production monitoring |
| 1202 | `console.warn` | Rate limited and no cached travel times | **KEEP** - Production monitoring |
| 1241 | `console.warn` | Rate limited and no cached travel times | **KEEP** - Production monitoring |

#### WRAP (__DEV__) - Already Wrapped ✓

| Line | Type | Statement | Status |
|------|------|-----------|--------|
| 52 | `console.error` | Error getting token from storage | ✓ Already wrapped |
| 94 | `console.error` | Login error | ✓ Already wrapped |
| 137 | `console.error` | Registration error | ✓ Already wrapped |
| 285 | `console.error` | Get current user error | ✓ Already wrapped |
| 446 | `console.error` | Error in searchAggregatedMatches | ✓ Already wrapped |
| 470 | `console.error` | Error searching matches | ✓ Already wrapped |
| 495 | `console.error` | Error searching teams | ✓ Already wrapped |
| 519 | `console.error` | Error in searchUnified | ✓ Already wrapped |
| 536 | `console.error` | getPreferences error | ✓ Already wrapped |
| 633 | `console.error` | Error fetching trips | ✓ Already wrapped |
| 680 | `console.error` | Error fetching trip | ✓ Already wrapped |
| 723 | `console.error` | Error creating trip | ✓ Already wrapped |
| 762 | `console.error` | Error updating trip | ✓ Already wrapped |
| 843 | `console.error` | Error deleting trip | ✓ Already wrapped |
| 870 | `console.error` | Error removing match from trip | ✓ Already wrapped |
| 910 | `console.error` | Error adding flight to trip | ✓ Already wrapped |
| 954-955 | `console.error` | Error deleting flight | ✓ Already wrapped |
| 1004-1005 | `console.error` | Error adding home base | ✓ Already wrapped |
| 1052-1053 | `console.error` | Error updating home base | ✓ Already wrapped |
| 1099-1100 | `console.error` | Error deleting home base | ✓ Already wrapped |
| 1280 | `console.error` | Error updating match planning | ✓ Already wrapped |
| 1303 | `console.error` | Error fetching team matches | ✓ Already wrapped |
| 1319 | `console.error` | Error fetching teams | ✓ Already wrapped |
| 1335 | `console.error` | Error fetching leagues | ✓ Already wrapped |

#### WRAP (__DEV__) - Needs Wrapping

| Line | Type | Statement | Action |
|------|------|-----------|--------|
| 653 | `console.error` | Non-JSON response when fetching trip | Wrap in `__DEV__` or route to error service |
| 665 | `console.error` | API Error fetching trip | Wrap in `__DEV__` or route to error service |
| 794 | `console.error` | Non-JSON response | Wrap in `__DEV__` or route to error service |
| 804 | `console.error` | API Error adding match to trip | Wrap in `__DEV__` or route to error service |
| 816 | `console.error` | Error adding match to trip | Wrap in `__DEV__` or route to error service |
| 944 | `console.error` | Delete flight API error | Wrap in `__DEV__` or route to error service |
| 991 | `console.error` | Add home base API error | Wrap in `__DEV__` or route to error service |
| 1039 | `console.error` | Update home base API error | Wrap in `__DEV__` or route to error service |
| 1086 | `console.error` | Delete home base API error | Wrap in `__DEV__` or route to error service |
| 1209 | `console.error` | Get travel times API error | Wrap in `__DEV__` or route to error service |
| 1247-1248 | `console.error` | Error fetching travel times | Wrap in `__DEV__` or route to error service |

#### REMOVE - Verbose Operation Logs

| Line | Type | Statement | Reason |
|------|------|-----------|--------|
| 823 | `console.log` | Deleting trip | Verbose operation log - not needed |
| 834 | `console.log` | Delete trip response | Verbose operation log - not needed |
| 850 | `console.log` | Removing match from trip | Verbose operation log - not needed |
| 861 | `console.log` | Remove match response | Verbose operation log - not needed |
| 1117 | `console.log` | Returning cached travel times | Cache hit - not needed in production |
| 1171 | `console.log` | Rate limited - returning cached travel times | Already handled by warning above |
| 1186 | `console.log` | Non-JSON response - returning cached travel times | Already handled by error above |
| 1198 | `console.log` | Rate limited - returning cached travel times | Already handled by warning above |
| 1237 | `console.log` | Rate limited (error) - returning cached travel times | Already handled by warning above |
| 1260 | `console.log` | Updating match planning | Verbose operation log - not needed |
| 1272 | `console.log` | Update planning response | Verbose operation log - not needed |

---

### `screens/MapResultsScreen.js` (69 console statements)

#### Status: Most are already wrapped in `__DEV__` ✓

All console logs in this file are already properly wrapped in `__DEV__` checks. **No action needed.**

**Examples:**
- Line 51: `if (__DEV__ && initialMatches...)` ✓
- Line 207: `if (__DEV__) { console.log('🔧 [FILTER]...')` ✓
- Line 726: `if (__DEV__) { console.error('❌ [SEARCH] API error:')` ✓

**Recommendation**: Keep as-is. These are all debug logs that should only appear in development.

---

### `screens/TripOverviewScreen.js` (41 console statements)

**Action Required**: Audit needed - check if wrapped in `__DEV__`

---

### `components/LocationSearchModal.js` (21 console statements)

**Action Required**: Audit needed - check if wrapped in `__DEV__`

---

### `components/MapView.js` (15 console statements)

**Action Required**: Audit needed - check if wrapped in `__DEV__`

---

### `components/FilterModal.js` (12 console statements)

**Action Required**: Audit needed - check if wrapped in `__DEV__`

---

### Other Files

| File | Count | Status |
|------|-------|--------|
| `screens/MemoriesScreen.js` | 7 | Needs audit |
| `screens/ItineraryMapScreen.js` | 13 | Needs audit |
| `screens/UnifiedSearchScreen.js` | 4 | Needs audit |
| `screens/MessagesScreen.js` | 9 | Needs audit |
| `components/PhotoViewerModal.js` | 10 | Needs audit |
| `components/LocationAutocomplete.js` | 8 | Needs audit |
| `components/PopularMatches.js` | 4 | Needs audit |
| `components/AddFlightModal.js` | 4 | Needs audit |
| All other files | <5 each | Needs audit |

---

## Recommendations

### Immediate Actions

1. **Wrap verbose operation logs in `api.js`** (lines 823, 834, 850, 861, 1117, 1260, 1272)
2. **Wrap remaining error logs in `api.js`** that aren't already wrapped
3. **Keep production warnings** (lines 14-15) but consider routing to monitoring service
4. **Audit remaining files** to ensure all debug logs are wrapped in `__DEV__`

### Long-term Actions

1. **Implement error tracking service** (Sentry, Bugsnag, etc.)
   - Route all `console.error` to error service in production
   - Keep `__DEV__` checks for local debugging
   
2. **Create logging utility**
   ```javascript
   // utils/logger.js
   export const logger = {
     error: (message, error) => {
       if (__DEV__) {
         console.error(message, error);
       }
       // Send to error tracking service in production
     },
     warn: (message) => {
       if (__DEV__) {
         console.warn(message);
       }
       // Send to monitoring in production if critical
     },
     log: (message, data) => {
       if (__DEV__) {
         console.log(message, data);
       }
       // Never log in production
     }
   };
   ```

3. **Remove all verbose operation logs** - they add no value in production

---

## Priority Fixes

### High Priority (Do First)

1. **api.js lines 823, 834, 850, 861, 1260, 1272** - Remove or wrap verbose operation logs
2. **api.js lines 653, 665, 794, 804, 816, 944, 991, 1039, 1086, 1209, 1247-1248** - Wrap error logs in `__DEV__`
3. **api.js line 1117** - Remove cache hit log (not needed)

### Medium Priority

1. Audit all screen files for unwrapped console logs
2. Audit all component files for unwrapped console logs
3. Create logging utility to standardize logging

### Low Priority

1. Implement error tracking service integration
2. Remove all remaining verbose logs
3. Standardize all logging across codebase

---

## Next Steps

1. Review this audit
2. Apply fixes starting with High Priority items
3. Run full codebase scan to verify all logs are properly categorized
4. Implement logging utility
5. Integrate error tracking service

