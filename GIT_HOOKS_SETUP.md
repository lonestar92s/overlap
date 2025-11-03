# Git Hooks Setup Guide

## Overview

Pre-commit hooks have been set up to automatically run tests before each commit. This ensures that broken code doesn't get committed to the repository.

## Setup Instructions

### 1. Install Dependencies

First, install Husky in both projects:

```bash
# Backend
cd flight-match-finder/overlap/backend
npm install

# Mobile App
cd flight-match-finder/mobile-app
npm install
```

### 2. Initialize Husky

Husky will automatically install when you run `npm install` (via the `prepare` script), but you can also manually initialize it:

```bash
# Backend
cd flight-match-finder/overlap/backend
npx husky install

# Mobile App
cd flight-match-finder/mobile-app
npx husky install
```

### 3. Make Hooks Executable

Make sure the pre-commit hooks are executable:

```bash
# Root level hook (recommended)
chmod +x flight-match-finder/.husky/pre-commit

# Or if using project-level hooks:
chmod +x flight-match-finder/overlap/backend/.husky/pre-commit
chmod +x flight-match-finder/mobile-app/.husky/pre-commit
```

## How It Works

### Root-Level Hook (Recommended)

The root-level hook at `.husky/pre-commit` checks which files have changed and runs tests accordingly:

- **Backend changes** (`overlap/backend/src` or `overlap/backend/tests`): Runs backend tests
- **Mobile app changes** (`mobile-app/` JS/JSX/TS/TSX files): Runs mobile app tests
- **No relevant changes**: Skips tests

### Behavior

- ✅ Tests run automatically before each commit
- ✅ Only tests for changed files are run (smart detection)
- ✅ Commit is blocked if tests fail
- ✅ You can bypass with `git commit --no-verify` (not recommended)

## Options

### Skip Tests for a Commit

If you need to commit without running tests (e.g., documentation changes, WIP commits):

```bash
git commit --no-verify -m "WIP: work in progress"
```

**Warning**: Only use this when absolutely necessary. Broken tests should be fixed, not bypassed.

### Run Tests Only for Your Project

If you're working on only one project, you can remove the other project's test execution from the hook, or use project-level hooks instead.

### Disable Pre-commit Hooks

To temporarily disable hooks:

```bash
# Remove executable permission
chmod -x flight-match-finder/.husky/pre-commit

# Or uninstall husky
cd overlap/backend && npx husky uninstall
cd mobile-app && npx husky uninstall
```

To re-enable:

```bash
chmod +x flight-match-finder/.husky/pre-commit
# Re-run npm install to restore husky
```

## Troubleshooting

### Hook Not Running

1. **Check if hook exists**:
   ```bash
   ls -la flight-match-finder/.husky/pre-commit
   ```

2. **Check if it's executable**:
   ```bash
   chmod +x flight-match-finder/.husky/pre-commit
   ```

3. **Reinstall husky**:
   ```bash
   cd overlap/backend && npx husky install
   cd mobile-app && npx husky install
   ```

### Tests Taking Too Long

If tests are slow and blocking commits, you can:

1. **Run only unit tests** (faster):
   ```bash
   # In the hook, change:
   npm test
   # to:
   npm run test:unit
   ```

2. **Run tests without coverage** (faster):
   ```bash
   # In package.json, change test script to remove --coverage
   ```

3. **Use lint-staged** (only test changed files):
   Install `lint-staged` for more granular test execution

### Permission Denied

If you get "Permission denied" errors:

```bash
chmod +x flight-match-finder/.husky/pre-commit
```

## Alternative: lint-staged

For more granular control, you can use `lint-staged` to only run tests for changed files:

```bash
npm install --save-dev lint-staged
```

Then configure it in `package.json`:

```json
{
  "lint-staged": {
    "overlap/backend/src/**/*.js": ["cd overlap/backend && npm test"],
    "mobile-app/**/*.{js,jsx}": ["cd mobile-app && npm test"]
  }
}
```

## Best Practices

1. ✅ **Keep tests fast** - Aim for < 30 seconds total
2. ✅ **Fix failing tests immediately** - Don't bypass with `--no-verify`
3. ✅ **Write meaningful tests** - Tests should catch real bugs
4. ✅ **Update hooks as needed** - Adjust test commands if they change

## CI/CD Integration

These hooks run locally. For CI/CD, ensure your pipeline also runs:

```yaml
# Example GitHub Actions
- name: Run Backend Tests
  run: |
    cd overlap/backend
    npm test

- name: Run Mobile App Tests
  run: |
    cd mobile-app
    npm test
```

