# Design System Quick Fixes Guide

Quick reference for common design token replacements.

## 🎨 Color Replacements

| Hardcoded | Design Token | Usage |
|-----------|--------------|-------|
| `#fff`, `#FFFFFF` | `colors.card` | White backgrounds, cards |
| `#e0e0e0`, `#E0E0E0` | `colors.border` | Borders, dividers |
| `#f0f0f0`, `#F0F0F0` | `colors.borderLight` | Light borders |
| `#f5f5f5`, `#F5F5F5` | `colors.background` | Background colors |
| `#f8f8f8`, `#F8F8F8` | `colors.cardGrey` | Grey card backgrounds |
| `#007AFF` | `colors.primary` | Primary blue |
| `#1976d2` | `colors.primary` | Material Design blue (use primary) |
| `#FF385C` | `colors.secondary` | Secondary/accent color |
| `#333`, `#333333` | `colors.text.primary` | Primary text |
| `#666`, `#666666` | `colors.text.secondary` | Secondary text |
| `#999`, `#999999` | `colors.text.light` | Light/muted text |
| `#FF3B30` | `colors.error` | Error states |
| `#4CAF50` | `colors.success` | Success states |
| `#FF9800` | `colors.warning` | Warning states |
| `#CCCCCC` | `colors.interactive.disabled` | Disabled states |

## 📏 Spacing Replacements

| Hardcoded | Design Token | Notes |
|-----------|--------------|-------|
| `padding: 4` | `padding: spacing.xs` | Extra small |
| `padding: 8` | `padding: spacing.sm` | Small |
| `padding: 16` | `padding: spacing.md` | Medium |
| `padding: 24` | `padding: spacing.lg` | Large |
| `padding: 32` | `padding: spacing.xl` | Extra large |
| `padding: 48` | `padding: spacing.xxl` | Extra extra large |
| `padding: 20` | `padding: spacing.lg` | Use lg (24) or verify if 20 is needed |
| `padding: 12` | `padding: spacing.sm` (8) or `spacing.md` (16) | Verify intent |
| `padding: 10` | `padding: spacing.sm` (8) or `spacing.md` (16) | Verify intent |
| `padding: 5` | `padding: spacing.xs` (4) or `spacing.sm` (8) | Verify intent |
| `marginTop: 2` | `marginTop: spacing.xs` (4) | Verify if 2px is intentional |

## 📝 Typography Replacements

| Hardcoded | Design Token | Usage |
|-----------|--------------|-------|
| `fontSize: 32` | `...typography.h1XLarge` | Extra large headings |
| `fontSize: 28` | `...typography.h1Large` | Large headings |
| `fontSize: 24` | `...typography.h1` | Main headings |
| `fontSize: 20` | `...typography.h2` | Section headings |
| `fontSize: 18` | `...typography.h3` | Subsection headings |
| `fontSize: 16` | `...typography.body` | Body text |
| `fontSize: 14` | `...typography.bodySmall` | Small body text |
| `fontSize: 12` | `...typography.caption` | Captions, labels |
| `fontSize: 10` | `...typography.overline` | Overlines |
| `fontWeight: '400'` | Included in typography tokens | Use appropriate token |
| `fontWeight: '500'` | **Add variant** or use token | Medium weight |
| `fontWeight: '600'` | **Add variant** or use token | Semibold |
| `fontWeight: '700'` | Included in h1, h2 tokens | Bold |

**Note:** For fontWeight '500' and '600', consider adding variants to designTokens:
```javascript
bodyMedium: { ...typography.body, fontWeight: '500' },
bodySemibold: { ...typography.body, fontWeight: '600' },
```

## 🔲 Border Radius Replacements

| Hardcoded | Design Token | Usage |
|-----------|--------------|-------|
| `borderRadius: 4` | `borderRadius: borderRadius.xs` | Extra small |
| `borderRadius: 8` | `borderRadius: borderRadius.sm` | Small |
| `borderRadius: 12` | `borderRadius: borderRadius.md` | Medium |
| `borderRadius: 14` | `borderRadius: borderRadius.card` | Cards |
| `borderRadius: 16` | `borderRadius: borderRadius.lg` | Large |
| `borderRadius: 20` | `borderRadius: borderRadius.pill` | Pills, buttons |
| `borderRadius: 24` | `borderRadius: borderRadius.xl` | Extra large |
| `borderRadius: 10` | `borderRadius: borderRadius.sm` (8) or `borderRadius.md` (12) | Verify intent |
| `borderRadius: 5` | `borderRadius: borderRadius.xs` (4) or `borderRadius.sm` (8) | Verify intent |

## ♿ Accessibility Quick Fixes

### Add Missing Labels

**Before:**
```javascript
<TouchableOpacity onPress={handlePress}>
  <Text>Close</Text>
</TouchableOpacity>
```

**After:**
```javascript
<TouchableOpacity 
  onPress={handlePress}
  accessibilityLabel="Close modal"
  accessibilityRole="button"
>
  <Text>Close</Text>
</TouchableOpacity>
```

### Add State for Checkboxes

**Before:**
```javascript
<TouchableOpacity onPress={toggleCheckbox}>
  <Icon name={isChecked ? 'check-box' : 'check-box-outline-blank'} />
</TouchableOpacity>
```

**After:**
```javascript
<TouchableOpacity 
  onPress={toggleCheckbox}
  accessibilityLabel={isChecked ? 'Uncheck filter' : 'Check filter'}
  accessibilityRole="checkbox"
  accessibilityState={{ checked: isChecked }}
>
  <Icon name={isChecked ? 'check-box' : 'check-box-outline-blank'} />
</TouchableOpacity>
```

### Add Hints for Complex Actions

**Before:**
```javascript
<TouchableOpacity onPress={handleComplexAction}>
  <Text>More</Text>
</TouchableOpacity>
```

**After:**
```javascript
<TouchableOpacity 
  onPress={handleComplexAction}
  accessibilityLabel="More options"
  accessibilityRole="button"
  accessibilityHint="Double tap to open additional options menu"
>
  <Text>More</Text>
</TouchableOpacity>
```

## 🎯 Common Patterns

### Button Style
```javascript
// Good
const styles = StyleSheet.create({
  button: {
    ...components.button, // From designTokens
    // Add custom styles if needed
  },
});

// Or
const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 44, // Touch target
    minHeight: 44,
  },
});
```

### Card Style
```javascript
// Good
const styles = StyleSheet.create({
  card: {
    ...components.card, // From designTokens
  },
});

// Or
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.small,
  },
});
```

### Text Style
```javascript
// Good
const styles = StyleSheet.create({
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
  },
});
```

## 🔍 Finding Hardcoded Values

### Search for Hardcoded Colors
```bash
grep -r "#[0-9A-Fa-f]\{3,6\}" components/ screens/
```

### Search for Hardcoded Spacing
```bash
grep -r "padding:\s*\d\|margin:\s*\d" components/ screens/
```

### Search for Hardcoded Typography
```bash
grep -r "fontSize:\s*\d\|fontWeight:\s*" components/ screens/
```

## ✅ Checklist for Component Review

- [ ] All colors use `colors.*` tokens
- [ ] All spacing uses `spacing.*` tokens
- [ ] All typography uses `typography.*` tokens
- [ ] All border radius uses `borderRadius.*` tokens
- [ ] All interactive elements have `accessibilityLabel`
- [ ] All interactive elements have `accessibilityRole`
- [ ] Checkboxes/switches have `accessibilityState`
- [ ] Touch targets meet 44x44 minimum
- [ ] Color contrast verified (4.5:1 for normal text)
- [ ] Uses `StyleSheet.create()` not inline styles

---

*Use this guide when refactoring components to use design tokens consistently.*

