# OverlapSearchScreen Integration Guide

## Overview

You now have two versions of the search screen component:

1. **`OverlapSearchScreen.js`** - Original Figma design (bold, black borders, high contrast)
2. **`OverlapSearchScreen.adapted.js`** - Adapted to match your existing app design (iOS-style, uses design tokens)

## Design Differences

### Original App Style
- iOS blue (`#007AFF`) primary
- Soft grays (`#f5f5f5`, `#F8F8F8`) 
- Light borders (`#e0e0e0`)
- Subtle shadows, rounded corners
- Standard iOS patterns

### New Overlap Design
- Black borders (`#000`)
- High contrast
- Light blue status bar (`#D9E8F2`)
- Bold, minimal aesthetic

## Integration Options

### Option 1: Use Adapted Version (Recommended)

The **adapted version** uses your existing design tokens and matches your app's style:

```javascript
import OverlapSearchScreenAdapted from './components/OverlapSearchScreen.adapted';

// In your SearchScreen or navigation
<OverlapSearchScreenAdapted
  onClose={() => setShowSearchModal(false)}
  onSearch={(params) => {
    handleSearch(params);
  }}
  recentSearches={recentSearches}
  suggestedTeams={[]}
/>
```

**Pros:**
- ✅ Matches existing app design
- ✅ Uses your design token system
- ✅ Consistent user experience
- ✅ Same functionality with familiar styling

**Cons:**
- Less bold/unique visual identity

---

### Option 2: Use Original Figma Design

Use the original bold design for a specific feature or A/B test:

```javascript
import OverlapSearchScreen from './components/OverlapSearchScreen';

<OverlapSearchScreen
  onClose={() => setShowSearchModal(false)}
  onSearch={handleSearch}
  recentSearches={recentSearches}
  suggestedTeams={suggestedTeams}
/>
```

**Pros:**
- ✅ Matches Figma exactly
- ✅ Bold, distinctive design
- ✅ Modern aesthetic

**Cons:**
- ⚠️ Different from rest of app
- ⚠️ May feel inconsistent to users

---

### Option 3: Hybrid Approach

Use the **original design** for a specific feature flow (e.g., "Overlap" mode or premium features) and the **adapted version** for the main search:

```javascript
const [searchMode, setSearchMode] = useState('standard'); // or 'overlap'

{searchMode === 'overlap' ? (
  <OverlapSearchScreen {...props} />
) : (
  <OverlapSearchScreenAdapted {...props} />
)}
```

---

### Option 4: Gradual Migration

1. Start with the adapted version in your main search flow
2. Keep the original as `OverlapSearchScreen.bold.js` for reference
3. Gradually evolve your design system to incorporate bold elements where appropriate
4. Update design tokens over time to support both styles

---

## Integration Steps

### Step 1: Choose Your Approach

Based on your needs:
- **Consistency first?** → Use adapted version
- **Design refresh?** → Consider hybrid approach
- **Specific feature?** → Use original for that feature only

### Step 2: Add to Navigation/Modal

Replace or add alongside your existing `SearchModal`:

```javascript
// In SearchScreen.js
const [showOverlapSearch, setShowOverlapSearch] = useState(false);

// In your modal section:
<Modal
  visible={showOverlapSearch}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={() => setShowOverlapSearch(false)}
>
  <OverlapSearchScreenAdapted
    onClose={() => setShowOverlapSearch(false)}
    onSearch={handleSearch}
    recentSearches={recentSearches}
    suggestedTeams={[]}
  />
</Modal>
```

### Step 3: Connect Recent Searches Data

The component expects recent searches in this format:

```javascript
const recentSearches = [
  {
    location: 'London',
    // Any additional data you want to store
  },
  // ... more searches
];
```

If you're using `AsyncStorage` (like in `SearchScreen.js`), you can reuse that logic:

```javascript
// Already implemented in SearchScreen.js around line 696
const loadRecentSearches = async () => {
  try {
    const stored = await AsyncStorage.getItem('recentSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  } catch (error) {
    console.error('Failed to load recent searches:', error);
  }
};
```

### Step 4: Handle Search Results

The `onSearch` callback receives:

```javascript
{
  location: { city, region, country, lat, lon },
  dateFrom: '2024-01-15',
  dateTo: '2024-01-20'
}
```

Handle it the same way as your existing search:

```javascript
const handleSearch = async (searchParams) => {
  // Your existing search logic from SearchScreen.js
  // Navigate to MapResults screen, etc.
};
```

---

## Migration Path Example

If you want to gradually adopt the new design:

1. **Week 1**: Keep current `SearchScreen` modal as-is
2. **Week 2**: Add adapted version as an optional "experimental search" toggle
3. **Week 3**: A/B test both versions with a small user group
4. **Week 4**: Based on feedback, either:
   - Keep current design
   - Switch to adapted version
   - Merge best features from both

---

## Customization

Both components support the same props and can be customized:

```javascript
// Change initial values
initialLocation={{ city: 'London', country: 'UK' }}
initialDateFrom="2024-01-15"
initialDateTo="2024-01-20"

// Add suggested teams from your data
suggestedTeams={[
  { name: 'Manchester United', country: 'England' },
  { name: 'LFC', country: 'Spain' },
]}
```

---

## Recommendations

**For immediate use:** Start with `OverlapSearchScreenAdapted.js` - it provides the new layout with familiar styling.

**For design exploration:** Keep both versions and test with users to see which feels better.

**For design system evolution:** Consider updating your `designTokens.js` to support both styles with theme variants.

---

## Questions to Consider

1. **Is this for a specific feature or general use?**
   - Specific feature → Original design might work
   - General use → Adapted version recommended

2. **Do you want visual consistency or design refresh?**
   - Consistency → Adapted version
   - Refresh → Hybrid or gradual migration

3. **Do you have resources for design system evolution?**
   - Yes → Consider gradual migration
   - No → Use adapted version now

---

## Need Help?

- Check `SearchScreen.js` for existing search logic patterns
- See `designTokens.js` for available styling options
- Refer to `SearchModal.js` for similar component structure

