# Design System & Accessibility Audit Report
**Date:** January 2025  
**Auditor:** UI/UX Design Engineer  
**Scope:** Mobile App - Components & Screens

---

## 📊 Executive Summary

### Overall Assessment: ⚠️ **Needs Improvement**

**Strengths:**
- ✅ Design tokens system is well-defined in `designTokens.js`
- ✅ Some components (MatchCard, HeartButton, FlightSearchTab) demonstrate good practices
- ✅ 240 accessibility labels found across 34 files (good coverage)
- ✅ Touch target sizes are generally compliant (44x44 minimum)

**Critical Issues:**
- ❌ **38+ components** still use hardcoded colors, spacing, and typography
- ❌ **Inconsistent design token usage** across the codebase
- ⚠️ **Color contrast** needs verification for WCAG AA compliance
- ❌ **Missing accessibility labels** on many interactive elements
- ❌ **Hardcoded fontWeight** values instead of using typography tokens

---

## 🎨 Design Token Compliance

### Color Consistency: ⚠️ **Inconsistent**

**Issues Found:**
1. **Hardcoded hex colors** in 21 component files and 17 screen files
2. **Common violations:**
   - `#fff`, `#FFFFFF` → Should use `colors.card`
   - `#e0e0e0`, `#E0E0E0` → Should use `colors.border`
   - `#007AFF` → Should use `colors.primary`
   - `#FF385C` → Should use `colors.secondary`
   - `#1976d2` → Should use `colors.primary` (Material Design blue)
   - `#f5f5f5`, `#F5F5F5` → Should use `colors.background`
   - `#333`, `#333333` → Should use `colors.text.primary`
   - `#666`, `#666666` → Should use `colors.text.secondary`
   - `#999`, `#999999` → Should use `colors.text.light`

**Files with Most Violations:**
- `FilterModal.js` - Multiple hardcoded colors
- `SearchModal.js` - Hardcoded colors in styles
- `ItineraryModal.js` - Material Design colors instead of tokens
- `MapResultsScreen.js` - Some hardcoded values
- `MemoriesScreen.js` - Hardcoded colors

**Recommendations:**
1. **Priority 1:** Replace all hardcoded colors in frequently used components (FilterModal, SearchModal, MatchCard)
2. **Priority 2:** Create a linting rule to catch hardcoded hex colors
3. **Priority 3:** Add missing color tokens if needed (e.g., if `#1976d2` is used frequently, consider adding it to tokens)

---

### Spacing Consistency: ⚠️ **Inconsistent**

**Issues Found:**
1. **Hardcoded spacing values** throughout components
2. **Common violations:**
   - `padding: 20` → Should use `spacing.lg` (24) or `spacing.xl` (32)
   - `padding: 16` → Should use `spacing.md` (16) ✅ (correct value, but should use token)
   - `padding: 12` → Should use `spacing.sm` (8) or `spacing.md` (16) - verify intent
   - `padding: 10` → Should use `spacing.sm` (8) or `spacing.md` (16) - verify intent
   - `padding: 8` → Should use `spacing.sm` (8) ✅ (correct value, but should use token)
   - `padding: 5` → Should use `spacing.xs` (4) or `spacing.sm` (8) - verify intent
   - `marginTop: 2` → Should use `spacing.xs` (4) - verify if 2px is intentional

**Files with Most Violations:**
- `FilterModal.js` - Hardcoded padding/margin values
- `SearchModal.js` - `padding: 5` used multiple times
- `MatchCard.js` - `marginTop: 2` (should verify if intentional)

**Recommendations:**
1. **Replace all hardcoded spacing** with design tokens
2. **Review non-standard values** (5px, 2px) - determine if they should be:
   - Changed to nearest token value
   - Added as new token if pattern is common
   - Documented as exception if necessary

---

### Typography Consistency: ⚠️ **Needs Improvement**

**Issues Found:**
1. **Hardcoded fontSize values:**
   - `fontSize: 20` → Should use `typography.h2` (20) ✅ (correct, but should use token)
   - `fontSize: 18` → Should use `typography.h3` (18) ✅ (correct, but should use token)
   - `fontSize: 16` → Should use `typography.body` (16) ✅ (correct, but should use token)
   - `fontSize: 14` → Should use `typography.bodySmall` (14) ✅ (correct, but should use token)
   - `fontSize: 12` → Should use `typography.caption` (12) ✅ (correct, but should use token)

2. **Hardcoded fontWeight values:**
   - `fontWeight: '500'` → Should use typography token (medium weight)
   - `fontWeight: '600'` → Should use typography token (semibold)
   - **Problem:** Typography tokens include fontWeight, but components override it

**Files with Most Violations:**
- `FilterModal.js` - Multiple `fontWeight: '500'` and `fontWeight: '600'` overrides
- `SearchModal.js` - Hardcoded fontSize and fontWeight
- `PhotoViewerModal.js` - Hardcoded fontWeight

**Recommendations:**
1. **Use typography tokens** instead of hardcoded fontSize/fontWeight
2. **Add fontWeight variants** to designTokens if needed:
   ```javascript
   typography: {
     bodyMedium: { ...typography.body, fontWeight: '500' },
     bodySemibold: { ...typography.body, fontWeight: '600' },
     // etc.
   }
   ```
3. **Avoid overriding** typography token fontWeight - use appropriate token variant

---

### Border Radius Consistency: ✅ **Mostly Good**

**Status:** Most components use `borderRadius` tokens correctly.

**Minor Issues:**
- Some components use hardcoded values like `12`, `10`, `8` instead of tokens
- `borderRadius: 14` in `UnifiedSearchScreen.js` - uses `borderRadius.card` token ✅

**Recommendations:**
1. Replace remaining hardcoded border radius values
2. Continue using `borderRadius.card` for card-specific radius

---

## ♿ Accessibility Compliance

### Accessibility Labels: ⚠️ **Good Coverage, But Inconsistent**

**Status:**
- ✅ **240 accessibility labels** found across 34 files
- ✅ **Good examples:** MatchCard, HeartButton, FlightSearchTab have proper labels
- ❌ **Missing labels** on many interactive elements

**Components Needing Accessibility Labels:**
1. **FilterModal.js:**
   - Checkbox components need `accessibilityLabel` and `accessibilityState`
   - Filter section toggles need labels
   - Clear all button has label ✅

2. **SearchModal.js:**
   - Tab buttons need `accessibilityLabel`
   - Close button needs label

3. **ItineraryModal.js:**
   - Navigation buttons need labels
   - Action buttons need labels

4. **LocationAutocomplete.js:**
   - Location item buttons need `accessibilityLabel`

5. **LeaguePicker.js:**
   - League selection buttons need labels

**Recommendations:**
1. **Add accessibility labels** to all interactive elements
2. **Use semantic roles:** `accessibilityRole="button"`, `accessibilityRole="checkbox"`, etc.
3. **Add accessibilityState** for checkboxes, switches, toggles
4. **Add accessibilityHint** when label needs additional context

---

### Touch Target Sizes: ✅ **Compliant**

**Status:** Good compliance with minimum touch target sizes.

**Examples Found:**
- `FilterModal.js`: `minWidth: spacing.xl + spacing.xs` (40px) ✅
- `PhotoViewerModal.js`: `minWidth: 44, minHeight: 44` ✅
- `SearchModal.js`: `minHeight: 48` ✅

**Recommendations:**
1. Continue ensuring all interactive elements meet 44x44 minimum
2. Use design tokens for touch target sizes (e.g., `minWidth: spacing.xl + spacing.xs`)

---

### Color Contrast: ⚠️ **Needs Verification**

**Potential Issues:**
1. **`#666666` on `#f5f5f5`** (AttendanceModal) - May not meet 4.5:1
   - `colors.text.secondary` (#666666) on `colors.background` (#F5F5F5)
   - **Action:** Verify contrast ratio

2. **`#999999` on white** - May not meet 4.5:1
   - `colors.text.light` (#999999) on `colors.card` (#FFFFFF)
   - **Action:** Verify contrast ratio

3. **Status background colors:**
   - Verify text contrast on status backgrounds (completedBg, liveBg, etc.)

**Recommendations:**
1. **Run contrast checker** on all text/background combinations
2. **Update color tokens** if contrast fails:
   - Darken `colors.text.secondary` if needed
   - Darken `colors.text.light` if needed
3. **Document contrast ratios** in designTokens.js comments

---

## 🎯 Priority Recommendations

### 🔴 Critical (Fix Immediately)

1. **Replace Hardcoded Colors in High-Traffic Components**
   - `FilterModal.js` - Used frequently, has many hardcoded colors
   - `SearchModal.js` - Primary search interface
   - `MatchCard.js` - Rendered many times in lists

2. **Fix Color Contrast Issues**
   - Verify and fix `#666666` on `#f5f5f5` contrast
   - Verify and fix `#999999` on white contrast

3. **Add Missing Accessibility Labels**
   - FilterModal checkboxes
   - SearchModal tabs
   - LocationAutocomplete items

### 🟠 High Priority (Fix Soon)

1. **Standardize Typography Usage**
   - Replace hardcoded fontSize with typography tokens
   - Add fontWeight variants to designTokens if needed
   - Remove fontWeight overrides

2. **Replace Hardcoded Spacing**
   - Replace all hardcoded padding/margin values
   - Review non-standard values (5px, 2px)

3. **Complete Accessibility Labels**
   - Add labels to all remaining interactive elements
   - Add accessibilityState for stateful elements

### 🟡 Medium Priority (Fix When Convenient)

1. **Create Linting Rules**
   - ESLint rule to catch hardcoded hex colors
   - ESLint rule to catch hardcoded spacing values
   - ESLint rule to catch hardcoded typography

2. **Document Exceptions**
   - Document any necessary hardcoded values
   - Add comments explaining exceptions

3. **Component Pattern Consolidation**
   - Identify repeated style patterns
   - Add to `components` token in designTokens.js

---

## 📝 Specific Component Fixes

### FilterModal.js

**Issues:**
- Hardcoded `fontWeight: '500'` and `fontWeight: '600'` (lines 569, 579, 630, 645, 654, 677, 693)
- Missing accessibility labels on checkboxes
- Some hardcoded spacing values

**Fixes:**
```javascript
// Instead of:
fontWeight: '500',

// Use:
...typography.bodyMedium, // Add to designTokens

// Or create variant:
bodyMedium: { ...typography.body, fontWeight: '500' }
```

### SearchModal.js

**Issues:**
- `fontSize: 20` (line 282) → Use `typography.h2`
- `padding: 5` (lines 279, 290) → Use `spacing.xs` or `spacing.sm`
- `fontWeight: '600'` (line 287) → Use typography token
- Missing accessibility labels on tabs

**Fixes:**
```javascript
// Instead of:
fontSize: 20,
fontWeight: '600',

// Use:
...typography.h2,

// Instead of:
padding: 5,

// Use:
padding: spacing.xs, // or spacing.sm if 8px is acceptable
```

### MatchCard.js

**Issues:**
- `marginTop: 2` (lines 457, 465) → Verify if intentional or use `spacing.xs`
- Some hardcoded colors (if any remain)

**Fixes:**
```javascript
// Instead of:
marginTop: 2,

// Use:
marginTop: spacing.xs, // 4px - verify if 2px was intentional
```

---

## 🛠️ Implementation Plan

### Phase 1: Critical Fixes (Week 1)
1. Fix color contrast issues
2. Replace hardcoded colors in FilterModal, SearchModal, MatchCard
3. Add missing accessibility labels to high-traffic components

### Phase 2: High Priority (Week 2)
1. Standardize typography usage
2. Replace hardcoded spacing values
3. Complete accessibility labels

### Phase 3: Medium Priority (Week 3-4)
1. Set up linting rules
2. Document exceptions
3. Consolidate component patterns

---

## 📚 Resources

### Design Tokens Reference
- `flight-match-finder/mobile-app/styles/designTokens.js`

### Accessibility Guidelines
- WCAG AA: https://www.w3.org/WAI/WCAG21/quickref/?levels=aaa
- React Native Accessibility: https://reactnative.dev/docs/accessibility

### Contrast Checker
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Colour Contrast Analyser: https://www.tpgi.com/color-contrast-checker/

---

## ✅ Success Criteria

**Design System Compliance:**
- ✅ 100% of colors use design tokens
- ✅ 100% of spacing uses design tokens
- ✅ 100% of typography uses design tokens
- ✅ All exceptions documented

**Accessibility Compliance:**
- ✅ All interactive elements have accessibility labels
- ✅ All color combinations meet WCAG AA contrast (4.5:1)
- ✅ All touch targets meet minimum size (44x44)
- ✅ Screen reader tested on iOS and Android

---

## 📊 Metrics

**Current State:**
- Design Token Usage: ~60% (estimated)
- Accessibility Label Coverage: ~70% (240 labels / ~340 interactive elements estimated)
- Color Contrast Compliance: Unknown (needs verification)

**Target State:**
- Design Token Usage: 100%
- Accessibility Label Coverage: 100%
- Color Contrast Compliance: 100%

---

*This audit is based on automated analysis and manual review of key components. For complete coverage, run full codebase analysis.*

