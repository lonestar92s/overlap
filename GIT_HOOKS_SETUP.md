# Git Hooks Setup Guide

## Overview

Pre-commit hooks have been set up to automatically run tests before each commit. This ensures that broken code doesn't get committed to the repository.

**✅ The pre-commit hook has been installed at `.git/hooks/pre-commit`**

## Setup Instructions

### 1. Install Dependencies

First, install dependencies (including test dependencies) in both projects:

```bash
# Backend
cd flight-match-finder/overlap/backend
npm install

# Mobile App
cd flight-match-finder/mobile-app
npm install
```

**Note**: The hook will automatically skip tests if `node_modules` is not installed, so make sure to run `npm install` in both directories.

### 2. Verify Hook is Executable

The hook should already be executable, but you can verify:

```bash
ls -la .git/hooks/pre-commit
# Should show: -rwxr-xr-x ... pre-commit
```

If it's not executable, run:
```bash
chmod +x .git/hooks/pre-commit
```

## How It Works

### Git Pre-Commit Hook

The pre-commit hook at `.git/hooks/pre-commit` checks which files have changed and runs tests accordingly:

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
chmod -x .git/hooks/pre-commit

# Or rename the hook
mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled
```

To re-enable:

```bash
chmod +x .git/hooks/pre-commit
# Or restore from disabled
mv .git/hooks/pre-commit.disabled .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Troubleshooting

### Hook Not Running

1. **Check if hook exists**:
   ```bash
   ls -la .git/hooks/pre-commit
   ```

2. **Check if it's executable**:
   ```bash
   chmod +x .git/hooks/pre-commit
   ```

3. **Verify git hooks directory**:
   ```bash
   ls -la .git/hooks/
   # Should see pre-commit file
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

