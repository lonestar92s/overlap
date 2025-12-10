# Coding Conventions

This document defines coding standards, folder structure, naming conventions, and style guidelines for the Flight Match Finder project.

## Folder Structure

### Mobile App (`mobile-app/`)

```
mobile-app/
├── components/          # Reusable UI components
├── screens/            # Screen components (full pages)
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── services/           # API and external service integrations
├── utils/              # Utility functions
├── styles/             # Design tokens and theme
├── types/              # TypeScript types (if using TS) or prop types
├── data/               # Static data files
├── __tests__/          # Test files
└── assets/             # Images, fonts, etc.
```

### Backend (`overlap/backend/`)

```
overlap/backend/src/
├── routes/             # Express route handlers
├── services/          # Business logic services
├── models/             # Mongoose models
├── middleware/         # Express middleware
├── utils/              # Utility functions
├── config/             # Configuration files
├── providers/          # External API providers
└── scripts/            # Utility scripts
```

### Web App (`overlap/web/`)

```
overlap/web/src/
├── components/         # React components
├── pages/              # Page components
├── services/           # API services
├── utils/              # Utility functions
└── styles/             # CSS/styling
```

## Naming Conventions

### Files and Directories
- **Components**: PascalCase (e.g., `MatchCard.js`, `SearchScreen.js`)
- **Utilities/Hooks**: camelCase (e.g., `timezoneUtils.js`, `useDateRange.js`)
- **Services**: camelCase with descriptive names (e.g., `api.js`, `naturalLanguageService.js`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `MAX_RESULTS`)
- **Directories**: lowercase with hyphens if needed (e.g., `mobile-app/`, `overlap/backend/`)

### Variables and Functions
- **Variables**: camelCase (e.g., `matchData`, `selectedDate`)
- **Functions**: camelCase, verb-based (e.g., `getMatches()`, `handleSearch()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RESULTS`, `API_TIMEOUT`)
- **Boolean variables**: prefix with `is`, `has`, `should` (e.g., `isLoading`, `hasError`, `shouldUpdate`)

### React Components
- **Component names**: PascalCase (e.g., `MatchCard`, `SearchScreen`)
- **Props**: camelCase (e.g., `matchData`, `onSelect`)
- **Event handlers**: prefix with `handle` (e.g., `handleSubmit`, `handleChange`)
- **State setters**: prefix with `set` (e.g., `setLoading`, `setMatches`)

### CSS/Styles
- **StyleSheet keys**: camelCase (e.g., `container`, `matchCard`, `headerText`)
- **Design tokens**: Use from `styles/designTokens.js` (e.g., `colors.primary`, `spacing.md`)

## Code Style

### JavaScript/React

**Imports:**
```javascript
// External libraries first
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Internal imports - components
import MatchCard from '../components/MatchCard';
import SearchModal from '../components/SearchModal';

// Internal imports - hooks/contexts
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../hooks/useDateRange';

// Internal imports - utils/services
import { formatDate } from '../utils/dateUtils';
import api from '../services/api';

// Internal imports - styles
import { colors, spacing } from '../styles/designTokens';
```

**Component Structure:**
```javascript
// 1. Imports
import React, { useState } from 'react';
// ... other imports

// 2. Component definition
const ComponentName = ({ prop1, prop2, onAction }) => {
  // 3. Hooks (useState, useEffect, custom hooks)
  const [state, setState] = useState(null);
  
  // 4. Event handlers
  const handleAction = () => {
    // Handler logic
  };
  
  // 5. Render
  return (
    <View>
      {/* JSX */}
    </View>
  );
};

// 6. Styles
const styles = StyleSheet.create({
  container: {
    // styles
  }
});

// 7. Export
export default ComponentName;
```

**Design Tokens:**
- Always use design tokens from `styles/designTokens.js`
- Never use hardcoded colors, spacing, or typography values
- Example:
```javascript
import { colors, spacing, typography } from '../styles/designTokens';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  text: {
    fontSize: typography.body.fontSize,
    color: colors.text.primary,
  }
});
```

### Backend (Node.js/Express)

**Route Structure:**
```javascript
// routes/matches.js
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const { authenticate } = require('../middleware/auth');

// GET /api/matches
router.get('/', authenticate, async (req, res) => {
  try {
    // Route logic
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

**Service Layer:**
```javascript
// services/matchService.js
const Match = require('../models/Match');

const getMatches = async (filters) => {
  // Service logic
  return await Match.find(filters);
};

module.exports = {
  getMatches
};
```

## Version Pinning Policy

**All package versions must be pinned (no `^` or `~`).**

- ✅ **Correct**: `"react": "19.1.0"`
- ❌ **Incorrect**: `"react": "^19.1.0"` or `"react": "~19.1.0"`

**Rationale:**
- Prevents unexpected breaking changes
- Ensures consistent builds across environments
- Makes dependency updates explicit and intentional

**When updating dependencies:**
1. Test thoroughly after updating
2. Update all related packages if needed
3. Document breaking changes in commit message
4. Consider updating in separate PR for visibility

## Git Conventions

### Commit Messages
- Use present tense, imperative mood: "Add feature" not "Added feature"
- Start with capital letter
- Keep first line under 72 characters
- Add detailed description if needed

**Format:**
```
Type: Short description (50 chars max)

Longer description if needed, explaining what and why.
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat: Add flight search functionality

Implements flight search using Amadeus API with date range
selection and price comparison.

fix: Resolve map marker rendering issue on Android

The issue was caused by incorrect coordinate format. Now
using proper lat/lng format for Mapbox markers.
```

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Refactoring
- `docs/description` - Documentation updates

## Testing Conventions

### Test File Naming
- Test files: `*.test.js` or `*.spec.js`
- Co-located with source or in `__tests__/` directory

### Test Structure
```javascript
describe('ComponentName', () => {
  describe('when prop is provided', () => {
    it('should render correctly', () => {
      // Test implementation
    });
  });
  
  describe('when action is triggered', () => {
    it('should call handler', () => {
      // Test implementation
    });
  });
});
```

## Documentation Conventions

### Code Comments
- Use JSDoc for functions:
```javascript
/**
 * Formats a date for display
 * @param {Date} date - The date to format
 * @param {string} format - The format string
 * @returns {string} Formatted date string
 */
const formatDate = (date, format) => {
  // Implementation
};
```

### README Files
- Each major directory should have a README.md
- Include setup instructions, purpose, and key files
- Keep READMEs up to date

## Error Handling

### Frontend
```javascript
try {
  const data = await api.getMatches();
  setMatches(data);
} catch (error) {
  console.error('Error fetching matches:', error);
  setError(error.message);
  // Show user-friendly error message
}
```

### Backend
```javascript
try {
  const matches = await Match.find(filters);
  res.json({ success: true, data: matches });
} catch (error) {
  logger.error('Error fetching matches:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Failed to fetch matches' 
  });
}
```

## Performance Guidelines

1. **Use React.memo** for expensive components
2. **Use useMemo/useCallback** for expensive computations
3. **Lazy load** heavy components
4. **Optimize images** before adding to assets
5. **Cache API responses** when appropriate
6. **Debounce search inputs** to reduce API calls

## Security Guidelines

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Both frontend and backend
3. **Sanitize user input** - Prevent XSS attacks
4. **Use HTTPS** - Always in production
5. **Rate limit APIs** - Prevent abuse
6. **Authenticate requests** - Protect sensitive endpoints

## References

- Requirements: `REQUIREMENTS.md`
- Architecture: `ARCHITECTURE.md`
- Design Tokens: `mobile-app/styles/designTokens.js`


