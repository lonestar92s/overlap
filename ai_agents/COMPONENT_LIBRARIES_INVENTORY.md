# Component Libraries Inventory

## Currently Installed & Active

### 1. **react-native-elements** (v3.4.3) ✅ ACTIVE

**Status**: Installed and actively used across multiple files

**Used In:**
- `screens/AccountScreen.js` - Button
- `screens/EditMemoryScreen.js` - Button, Card, Input
- `screens/ForgotPasswordScreen.js` - Input, Button
- `screens/LoginScreen.js` - Input, Button, CheckBox
- `screens/MessagesScreen.js` - Card, Input, Button, Avatar, ListItem
- `screens/MemoriesMapScreen.js` - Card, Button
- `screens/RegisterScreen.js` - Input, Button
- `screens/ResultsScreen.js` - Card, Avatar, Divider, Button, ButtonGroup
- `components/MatchModal.js` - Avatar, Card, Overlay
- `components/MatchSearchTab.js` - Button
- `components/SearchModal.js` - Button, Overlay

**Components Used:**
- Button
- Input
- CheckBox
- Card
- Avatar
- Overlay
- ListItem
- Divider
- ButtonGroup

**Note**: This is the **primary component library** currently in use. However, there's a migration plan to move away from it.

---

### 2. **gluestack-ui** ⚠️ PLANNED (Not Fully Installed)

**Status**: Theme configuration exists, but library may not be installed

**Evidence:**
- ✅ `styles/gluestackTheme.js` exists with full theme config
- ❌ **NOT in `package.json` dependencies** (as of current check)
- ❌ `GluestackUIProvider` **NOT in `App.js`** (migration summary says it should be)
- ✅ Migration summary indicates it was "installed" but may have been removed or not committed

**Migration Status:**
- Only `LoginScreen.js` has been migrated (per `MIGRATION_SUMMARY.md`)
- All other screens still use `react-native-elements`

**Components Available (if installed):**
- Checkbox, CheckboxIndicator, CheckboxIcon, CheckboxLabel
- Button, ButtonText, ButtonSpinner
- Input, InputField, InputIcon, InputSlot
- Text (with variants)
- Box, VStack, HStack
- Badge, BadgeText
- Accordion, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent
- Modal
- SafeAreaView

---

## Specialized Libraries (Not Full Component Libraries)

### 3. **@gorhom/bottom-sheet** (v5.1.8) ✅ ACTIVE

**Purpose**: Bottom sheet/modal component
**Used In**: `MapResultsScreen.js` for the bottom drawer

**Not a full component library** - single-purpose component

---

### 4. **react-native-calendars** (v1.1313.0) ✅ ACTIVE

**Purpose**: Calendar/date picker component
**Used In**: Multiple screens for date selection

**Not a full component library** - single-purpose component

---

### 5. **react-native-autocomplete-input** (v5.5.6) ✅ ACTIVE

**Purpose**: Autocomplete input component
**Used In**: Location search functionality

**Not a full component library** - single-purpose component

---

### 6. **react-native-super-grid** (v6.0.1) ✅ ACTIVE

**Purpose**: Grid layout component
**Used In**: Grid-based layouts

**Not a full component library** - single-purpose component

---

## Summary

### Full Component Libraries:
1. **react-native-elements** ✅ **PRIMARY** - Installed and actively used
2. **gluestack-ui** ⚠️ **PLANNED** - Theme exists but library may not be installed

### Specialized Component Libraries:
- @gorhom/bottom-sheet (bottom sheets)
- react-native-calendars (calendars)
- react-native-autocomplete-input (autocomplete)
- react-native-super-grid (grids)

---

## Recommendations

### For Filtering Component:

**Option 1: Use react-native-elements (Current)**
- ✅ Already installed and working
- ✅ Has Checkbox, Card, Button components
- ❌ Older library (v3.4.3, last updated 2021)
- ❌ Being migrated away from

**Option 2: Use gluestack-ui (If Installed)**
- ✅ Modern, actively maintained
- ✅ Better TypeScript support
- ✅ Better accessibility
- ❌ Need to verify it's actually installed
- ❌ Migration effort required

**Option 3: Install gluestack-ui (Recommended)**
- ✅ Aligns with migration plan
- ✅ Modern component library
- ✅ Better than react-native-elements
- ⚠️ Requires installation and migration

---

## Action Items

1. **Verify gluestack-ui installation:**
   ```bash
   npm list @gluestack-ui/themed
   ```
   If not installed, install it:
   ```bash
   npm install @gluestack-ui/themed @gluestack-style/react --legacy-peer-deps
   ```

2. **For FilterModal migration:**
   - If gluestack-ui is installed → Use gluestack-ui components (Checkbox, Badge, Accordion)
   - If gluestack-ui is NOT installed → Either:
     a) Install it and migrate (recommended)
     b) Use react-native-elements (current, but older)

3. **Check App.js for GluestackUIProvider:**
   - Migration summary says it should be there
   - Current App.js doesn't have it
   - May need to add it if gluestack-ui is installed

---

## Current State Conclusion

**You have ONE full component library actively installed:**
- **react-native-elements** (v3.4.3) - Used across 11+ files

**You have ONE component library in migration:**
- **gluestack-ui** - Theme configured but library may not be installed

**For filtering, you can:**
1. Use **react-native-elements** components (current, but older)
2. Install and use **gluestack-ui** (recommended, aligns with migration)
3. Use **custom components** (current FilterModal approach)

**Recommendation**: Verify gluestack-ui installation status, then proceed with hybrid approach using whichever library is actually available.


