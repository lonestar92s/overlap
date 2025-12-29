# Console Log Audit - Categorized Report

**Date**: 2025-01-31  
**Total Console Statements**: 559  
**Files Audited**: 30+

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| ✅ Already wrapped in `__DEV__` | ~221 | **No action needed** |
| 🔴 KEEP (Production) - Route to error service | ~25 | Keep but send to error tracking |
| 🟡 WRAP in `__DEV__` | ~250 | Wrap in `__DEV__` checks |
| 🗑️ REMOVE entirely | ~63 | Delete these logs |

---

## File-by-File Audit

### `services/api.js` (146 console statements)

#### ✅ Already Wrapped in `__DEV__` (14 statements)
- Lines 8-9: EXPO_PUBLIC_API_URL dev warnings ✓
- Line 52: Error getting token from storage ✓
- Line 94: Login error ✓
- Line 137: Registration error ✓
- Lines 1527-2788: Various API debug logs ✓

#### 🔴 KEEP (Production) - Route to Error Service (8 statements)

| Line | Type | Statement | Action |
|------|------|-----------|--------|
| 14-15 | `console.warn` | EXPO_PUBLIC_API_URL production warnings | **KEEP** - Critical config warning |
| 177 | `console.error` | WorkOS callback error | **KEEP** - Auth failure, route to error service |
| 201 | `console.error` | Request password reset error | **KEEP** - Auth failure, route to error service |
| 226 | `console.error` | Reset password error | **KEEP** - Auth failure, route to error service |
| 1175 | `console.warn` | Rate limited and no cached travel times | **KEEP** - Production monitoring |
| 1202 | `console.warn` | Rate limited and no cached travel times | **KEEP** - Production monitoring |
| 1241 | `console.warn` | Rate limited and no cached travel times | **KEEP** - Production monitoring |

#### 🟡 WRAP in `__DEV__` (25 statements)

| Line | Type | Statement | Current Status |
|------|------|-----------|----------------|
| 285 | `console.error` | Get current user error | ❌ Not wrapped |
| 446 | `console.error` | Error in searchAggregatedMatches | ❌ Not wrapped |
| 470 | `console.error` | Error searching matches | ❌ Not wrapped |
| 495 | `console.error` | Error searching teams | ❌ Not wrapped |
| 519 | `console.error` | Error in searchUnified | ❌ Not wrapped |
| 536 | `console.error` | getPreferences error | ❌ Not wrapped |
| 633 | `console.error` | Error fetching trips | ❌ Not wrapped |
| 653 | `console.error` | Non-JSON response when fetching trip | ❌ Not wrapped |
| 665 | `console.error` | API Error fetching trip | ❌ Not wrapped |
| 680 | `console.error` | Error fetching trip | ❌ Not wrapped |
| 723 | `console.error` | Error creating trip | ❌ Not wrapped |
| 762 | `console.error` | Error updating trip | ❌ Not wrapped |
| 794 | `console.error` | Non-JSON response | ❌ Not wrapped |
| 804 | `console.error` | API Error adding match to trip | ❌ Not wrapped |
| 816 | `console.error` | Error adding match to trip | ❌ Not wrapped |
| 843 | `console.error` | Error deleting trip | ❌ Not wrapped |
| 870 | `console.error` | Error removing match from trip | ❌ Not wrapped |
| 910 | `console.error` | Error adding flight to trip | ❌ Not wrapped |
| 944 | `console.error` | Delete flight API error | ❌ Not wrapped |
| 954-955 | `console.error` | Error deleting flight | ❌ Not wrapped |
| 991 | `console.error` | Add home base API error | ❌ Not wrapped |
| 1004-1005 | `console.error` | Error adding home base | ❌ Not wrapped |
| 1039 | `console.error` | Update home base API error | ❌ Not wrapped |
| 1052-1053 | `console.error` | Error updating home base | ❌ Not wrapped |
| 1086 | `console.error` | Delete home base API error | ❌ Not wrapped |
| 1099-1100 | `console.error` | Error deleting home base | ❌ Not wrapped |
| 1209 | `console.error` | Get travel times API error | ❌ Not wrapped |
| 1247-1248 | `console.error` | Error fetching travel times | ❌ Not wrapped |
| 1280 | `console.error` | Error updating match planning | ❌ Not wrapped |
| 1303 | `console.error` | Error fetching team matches | ❌ Not wrapped |
| 1319 | `console.error` | Error fetching teams | ❌ Not wrapped |
| 1335 | `console.error` | Error fetching leagues | ❌ Not wrapped |

#### 🗑️ REMOVE (Verbose Operation Logs) (11 statements)

| Line | Type | Statement | Reason |
|------|------|-----------|--------|
| 823 | `console.log` | `'🗑️ API Service - Deleting trip:'` | Verbose operation - not needed |
| 834 | `console.log` | `'🗑️ API Service - Delete trip response:'` | Verbose operation - not needed |
| 850 | `console.log` | `'🗑️ API Service - Removing match from trip:'` | Verbose operation - not needed |
| 861 | `console.log` | `'🗑️ API Service - Remove match response:'` | Verbose operation - not needed |
| 1117 | `console.log` | `'⚡ API Service - Returning cached travel times'` | Cache hit - not needed |
| 1171 | `console.log` | `'⚠️ Rate limited - returning cached travel times'` | Redundant with warning above |
| 1186 | `console.log` | `'⚠️ Non-JSON response - returning cached travel times'` | Redundant with error above |
| 1198 | `console.log` | `'⚠️ Rate limited - returning cached travel times'` | Redundant with warning above |
| 1237 | `console.log` | `'⚠️ Rate limited (error) - returning cached travel times'` | Redundant with warning above |
| 1260 | `console.log` | `'📋 API Service - Updating match planning:'` | Verbose operation - not needed |
| 1272 | `console.log` | `'📋 API Service - Update planning response:'` | Verbose operation - not needed |

---

### `screens/MapResultsScreen.js` (69 console statements)

**Status**: ✅ **All already wrapped in `__DEV__`** - No action needed!

All console logs in this file are properly wrapped:
- Lines 51-86: Venue coordinate analysis (wrapped) ✓
- Lines 207-457: Filter processing logs (wrapped) ✓
- Lines 517-768: Search flow logs (wrapped) ✓
- Lines 1226-2268: Filter and search button logs (wrapped) ✓

---

### `screens/TripOverviewScreen.js` (7 console statements)

**Status**: ❌ **None wrapped in `__DEV__`** - Action required!

| Line | Type | Statement | Action |
|------|------|-----------|--------|
| 149 | `console.log` | `'⚡ Cached recommendations available:'` | 🟡 Wrap in `__DEV__` |
| 162 | `console.log` | `'Loaded itinerary on mount with flights:'` | 🟡 Wrap in `__DEV__` |
| 179 | `console.log` | `'📥 Itinerary was deleted, navigating back'` | 🟡 Wrap in `__DEV__` |
| 195 | `console.log` | `'📥 Itinerary not found in context or API, navigating back'` | 🟡 Wrap in `__DEV__` |
| 201 | `console.error` | `'Error loading itinerary:'` | 🟡 Wrap in `__DEV__` |
| 211 | `console.log` | `'📥 Itinerary not found in context after error, navigating back'` | 🟡 Wrap in `__DEV__` |
| 278 | `console.log` | `'📥 Itinerary not found in state or context, refreshing from API'` | 🟡 Wrap in `__DEV__` |

---

### `contexts/ItineraryContext.js` (27 console statements)

**Status**: ✅ **Most already wrapped in `__DEV__`** (27 `__DEV__` checks found)

Most logs are properly wrapped. Verify all are wrapped and audit any remaining unwrapped logs.

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

## Priority Action Plan

### 🔴 High Priority (Do First)

1. **`services/api.js`** - Wrap 25 error logs in `__DEV__` checks
2. **`services/api.js`** - Remove 11 verbose operation logs
3. **`services/api.js`** - Keep 7 production-critical warnings (route to error service)

### 🟡 Medium Priority

1. Audit `screens/TripOverviewScreen.js` (41 logs)
2. Audit `contexts/ItineraryContext.js` (27 logs)
3. Audit `components/LocationSearchModal.js` (21 logs)
4. Audit remaining screen/component files

### 🟢 Low Priority

1. Create logging utility for standardized logging
2. Integrate error tracking service (Sentry, etc.)
3. Remove all remaining verbose logs
4. Standardize all logging patterns

---

## Recommended Code Changes

### Pattern 1: Wrap Error Logs in `__DEV__`

**Before:**
```javascript
} catch (error) {
  console.error('Error deleting trip:', error);
  throw error;
}
```

**After:**
```javascript
} catch (error) {
  if (__DEV__) {
    console.error('Error deleting trip:', error);
  }
  // TODO: Send to error tracking service in production
  throw error;
}
```

### Pattern 2: Remove Verbose Operation Logs

**Before:**
```javascript
async deleteTrip(tripId) {
  try {
    console.log('🗑️ API Service - Deleting trip:', tripId);
    // ... rest of code
    console.log('🗑️ API Service - Delete trip response:', { status: response.status, data });
  }
}
```

**After:**
```javascript
async deleteTrip(tripId) {
  try {
    // Removed verbose logs - not needed in production
    // ... rest of code
  }
}
```

### Pattern 3: Keep Production Warnings (Route to Monitoring)

**Before:**
```javascript
} else {
  console.warn('⚠️ EXPO_PUBLIC_API_URL not set in production - using fallback URL');
  console.warn('⚠️ Please set EXPO_PUBLIC_API_URL in EAS secrets for proper configuration');
  return 'https://friendly-gratitude-production-3f31.up.railway.app/api';
}
```

**After:**
```javascript
} else {
  // Production config warning - send to monitoring service
  if (__DEV__) {
    console.warn('⚠️ EXPO_PUBLIC_API_URL not set in production - using fallback URL');
    console.warn('⚠️ Please set EXPO_PUBLIC_API_URL in EAS secrets for proper configuration');
  }
  // TODO: Send to monitoring service (e.g., Sentry)
  return 'https://friendly-gratitude-production-3f31.up.railway.app/api';
}
```

---

## Next Steps

1. ✅ Review this audit
2. 🔄 Apply High Priority fixes to `services/api.js`
3. 🔄 Audit remaining files (Medium Priority)
4. 🔄 Create logging utility
5. 🔄 Integrate error tracking service

---

## Notes

- Most logs in `MapResultsScreen.js` are already properly wrapped ✓
- Many error logs in `api.js` need `__DEV__` wrapping
- Verbose operation logs add no value and should be removed
- Production warnings should be routed to monitoring service
- Consider creating a centralized logging utility for consistency

