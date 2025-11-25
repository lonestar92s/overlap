# Keyboard Behavior & Content Visibility Audit

## Executive Summary

This audit identifies inconsistencies in keyboard handling across the application that can lead to:
- Content being hidden when the keyboard appears
- Inconsistent user experience across different screens
- Input fields becoming inaccessible
- Dropdowns and modals being obscured

## Issues Found

### 1. **Inconsistent KeyboardAvoidingView Usage**

#### Files WITH KeyboardAvoidingView:
- ✅ `MessagesScreen.js` - Uses `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
- ✅ `LoginScreen.js` - Uses `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`
- ✅ `TripOverviewScreen.js` - Uses `KeyboardAvoidingView` with `keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}`
- ✅ `TripsListScreen.js` - Uses `KeyboardAvoidingView` in rename modal
- ✅ `MapSearchScreen.js` - Uses `KeyboardAvoidingView` with `keyboardVerticalOffset={100}`
- ✅ `MatchSearchTab.js` - Uses `KeyboardAvoidingView` with `keyboardVerticalOffset={100}`
- ✅ `FlightSearchTab.js` - Uses `KeyboardAvoidingView` with `keyboardVerticalOffset={100}`
- ✅ `OverlapSearchScreen.js` - Uses `KeyboardAvoidingView` with `keyboardVerticalOffset={0}`
- ✅ `OverlapSearchScreen.adapted.js` - Uses `KeyboardAvoidingView` with `keyboardVerticalOffset={0}`

#### Files MISSING KeyboardAvoidingView (but have TextInput):
- ❌ `ItineraryModal.js` - Has `TextInput` for itinerary name, NO `KeyboardAvoidingView`
- ❌ `MatchPlanningModal.js` - Has `TextInput` for notes, NO `KeyboardAvoidingView`
- ❌ `UnifiedSearchScreen.js` - Has `TextInput` for search, NO `KeyboardAvoidingView`
- ❌ `LocationSearchModal.js` - Has `TextInput` for location search, NO `KeyboardAvoidingView`
- ❌ `AddFlightModal.js` - Has multiple `TextInput` fields, NO `KeyboardAvoidingView` (uses ScrollView only)

### 2. **Inconsistent keyboardVerticalOffset Values**

Different screens use different offset values, causing inconsistent behavior:

| File | Offset Value | Issue |
|------|-------------|-------|
| `MatchSearchTab.js` | `100` | Hardcoded, may not work for all screen sizes |
| `FlightSearchTab.js` | `100` | Hardcoded, may not work for all screen sizes |
| `MapSearchScreen.js` | `100` | Hardcoded, may not work for all screen sizes |
| `TripOverviewScreen.js` | `Platform.OS === 'ios' ? 0 : 20` | Platform-specific but inconsistent with others |
| `OverlapSearchScreen.js` | `0` | No offset, may cause content to be hidden |
| `OverlapSearchScreen.adapted.js` | `0` | No offset, may cause content to be hidden |
| `MessagesScreen.js` | None specified | Uses default, may not account for headers |
| `LoginScreen.js` | None specified | Uses default, may not account for headers |

**Recommendation**: Standardize on a consistent offset calculation or use a shared utility.

### 3. **Inconsistent keyboardShouldPersistTaps Usage**

Most ScrollViews use `keyboardShouldPersistTaps="handled"`, but some are missing it:

| File | Has keyboardShouldPersistTaps | Status |
|------|------------------------------|--------|
| `MatchSearchTab.js` | ✅ Yes | Correct |
| `FlightSearchTab.js` | ✅ Yes | Correct |
| `MapSearchScreen.js` | ✅ Yes | Correct |
| `TripOverviewScreen.js` | ✅ Yes | Correct |
| `AddFlightModal.js` | ✅ Yes | Correct |
| `ItineraryModal.js` | ❌ No | Missing - ScrollView without prop |
| `MatchPlanningModal.js` | ❌ No | Missing - ScrollView without prop |
| `LocationSearchModal.js` | ❌ No | Missing - ScrollView without prop |
| `UnifiedSearchScreen.js` | ❌ No | Missing - ScrollView without prop |

**Impact**: Without `keyboardShouldPersistTaps="handled"`, users may not be able to tap buttons/items in dropdowns when the keyboard is visible.

### 4. **Custom Keyboard Handling in LocationAutocomplete**

`LocationAutocomplete.js` implements custom keyboard listeners:
- Uses `Keyboard.addListener` for `keyboardWillShow`, `keyboardDidShow`, `keyboardWillHide`, `keyboardDidHide`
- Adjusts dropdown height based on keyboard height
- This is good, but it's the ONLY component doing this custom handling

**Issue**: Other components with dropdowns (like airport search in `AddFlightModal`) don't have similar handling, leading to inconsistent behavior.

### 5. **Modal-Specific Issues**

#### ItineraryModal
- ❌ No `KeyboardAvoidingView`
- ❌ No `keyboardShouldPersistTaps` on ScrollView
- Has `TextInput` for creating new itinerary name
- **Risk**: Input field may be hidden when keyboard appears

#### MatchPlanningModal
- ❌ No `KeyboardAvoidingView`
- ❌ No `keyboardShouldPersistTaps` on ScrollView
- Has multiline `TextInput` for notes
- **Risk**: Notes input may be hidden when keyboard appears

#### LocationSearchModal
- ❌ No `KeyboardAvoidingView`
- ❌ No `keyboardShouldPersistTaps` on ScrollView
- Has `TextInput` for location search
- **Risk**: Search input and results may be obscured

#### AddFlightModal
- ❌ No `KeyboardAvoidingView` (only ScrollView)
- ✅ Has `keyboardShouldPersistTaps="handled"`
- Has multiple `TextInput` fields (flight number, origin, destination)
- **Risk**: Input fields may be hidden, especially on smaller screens

### 6. **Screen-Specific Issues**

#### UnifiedSearchScreen
- ❌ No `KeyboardAvoidingView`
- ❌ No `keyboardShouldPersistTaps` on ScrollView
- Has `TextInput` for search
- **Risk**: Search results may be hidden when keyboard is visible

## Recommendations

### Priority 1: Add Missing KeyboardAvoidingView

1. **ItineraryModal.js**
   - Wrap ScrollView in `KeyboardAvoidingView`
   - Add `keyboardShouldPersistTaps="handled"` to ScrollView

2. **MatchPlanningModal.js**
   - Wrap ScrollView in `KeyboardAvoidingView`
   - Add `keyboardShouldPersistTaps="handled"` to ScrollView

3. **LocationSearchModal.js**
   - Wrap ScrollView in `KeyboardAvoidingView`
   - Add `keyboardShouldPersistTaps="handled"` to ScrollView

4. **AddFlightModal.js**
   - Wrap ScrollView in `KeyboardAvoidingView`
   - Already has `keyboardShouldPersistTaps="handled"` ✅

5. **UnifiedSearchScreen.js**
   - Wrap ScrollView in `KeyboardAvoidingView`
   - Add `keyboardShouldPersistTaps="handled"` to ScrollView

### Priority 2: Standardize keyboardVerticalOffset

**Recommended Approach:**
1. Create a utility function to calculate appropriate offset based on:
   - Platform (iOS vs Android)
   - Screen size
   - Header/navigation bar height
   - Safe area insets

2. Use consistent offset values:
   - For modals: `Platform.OS === 'ios' ? 0 : 20` (or use SafeAreaView)
   - For full screens: Calculate based on header height
   - For tabs within modals: `100` (but make it dynamic)

### Priority 3: Standardize keyboardShouldPersistTaps

**Recommendation**: Always use `keyboardShouldPersistTaps="handled"` on ScrollViews that contain:
- TextInput fields
- Dropdowns/autocomplete
- Buttons that need to be tappable when keyboard is visible

### Priority 4: Create Shared Keyboard Handling Utility

Consider creating a reusable component or hook:
- `KeyboardAwareScrollView` - Wraps ScrollView with KeyboardAvoidingView and proper props
- `useKeyboardHeight` - Hook to get keyboard height for custom calculations
- `getKeyboardOffset` - Utility function to calculate appropriate offset

## Standard Pattern to Follow

```javascript
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

// For full screens
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
>
  <ScrollView
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ flexGrow: 1 }}
  >
    {/* Content */}
  </ScrollView>
</KeyboardAvoidingView>

// For modals
<Modal>
  <SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg }}
      >
        {/* Content */}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
</Modal>
```

## Testing Checklist

After implementing fixes, test on:
- [ ] iOS devices (iPhone SE, iPhone 14, iPhone 14 Pro Max)
- [ ] Android devices (various screen sizes)
- [ ] Landscape orientation
- [ ] Modals with TextInput fields
- [ ] Screens with autocomplete/dropdowns
- [ ] Screens with multiple TextInput fields
- [ ] Verify content is never hidden behind keyboard
- [ ] Verify all interactive elements remain tappable when keyboard is visible

## Files Requiring Changes

1. `components/ItineraryModal.js` - Add KeyboardAvoidingView + keyboardShouldPersistTaps
2. `components/MatchPlanningModal.js` - Add KeyboardAvoidingView + keyboardShouldPersistTaps
3. `components/LocationSearchModal.js` - Add KeyboardAvoidingView + keyboardShouldPersistTaps
4. `components/AddFlightModal.js` - Add KeyboardAvoidingView (already has keyboardShouldPersistTaps)
5. `screens/UnifiedSearchScreen.js` - Add KeyboardAvoidingView + keyboardShouldPersistTaps
6. Consider creating `utils/keyboardUtils.js` for shared utilities
7. Consider creating `components/KeyboardAwareScrollView.js` for reusable component

