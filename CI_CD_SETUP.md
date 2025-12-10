# CI/CD Setup Guide

This project uses **GitHub Actions** for Continuous Integration and Continuous Deployment.

## Overview

### Workflows

1. **Tests** (`.github/workflows/tests.yml`)
   - Runs on: Push and Pull Requests to `main`, `master`, `develop`
   - Tests both backend and mobile app
   - Runs on multiple Node.js versions (18.x, 20.x)
   - Uploads coverage reports to Codecov (optional)

2. **Lint** (`.github/workflows/lint.yml`)
   - Runs on: Push and Pull Requests
   - Lints backend and mobile app code
   - Non-blocking (won't fail the build)

3. **Deploy** (`.github/workflows/deploy.yml`)
   - Runs on: Push to `main`/`master` or version tags
   - Deploys backend (configure your deployment steps)

## Setup Instructions

### 1. Push to GitHub

If you haven't already, push your repository to GitHub:

```bash
cd flight-match-finder
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click **Settings** → **Actions** → **General**
3. Ensure "Allow all actions and reusable workflows" is enabled
4. Save changes

### 3. Configure Secrets (if needed)

If your tests require environment variables or API keys:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add secrets like:
   - `DATABASE_URL`
   - `API_KEY`
   - `NODE_ENV=test`

### 4. View Workflow Runs

- Go to the **Actions** tab in your GitHub repository
- You'll see all workflow runs and their status

## Workflow Details

### Test Workflow

**Triggers:**
- Push to `main`, `master`, or `develop`
- Pull requests to `main`, `master`, or `develop`

**What it does:**
1. Checks out code
2. Sets up Node.js (versions 18.x and 20.x)
3. Caches npm dependencies for faster builds
4. Installs dependencies with `npm ci`
5. Runs tests for both backend and mobile app
6. Uploads coverage reports (if Codecov is configured)

**Matrix Strategy:**
- Tests run on multiple Node.js versions to ensure compatibility
- Coverage is only uploaded once (from Node 20.x run)

### Lint Workflow

**Triggers:**
- Same as test workflow

**What it does:**
1. Checks for ESLint configuration
2. Runs linting if configured
3. Non-blocking (won't fail the build)

### Deploy Workflow

**Triggers:**
- Push to `main` or `master` branch
- Push of version tags (e.g., `v1.0.0`)

**What it does:**
1. Builds the backend
2. **You need to add your deployment steps**

## Customization

### Add Environment Variables

Edit `.github/workflows/tests.yml`:

```yaml
- name: Run backend tests
  run: npm test
  env:
    NODE_ENV: test
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
```

### Change Node.js Versions

Edit the `strategy.matrix.node-version` in the workflow files:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add more versions
```

### Add Code Coverage

1. Sign up at [codecov.io](https://codecov.io)
2. Connect your GitHub repository
3. The workflow will automatically upload coverage

### Configure Deployment

Edit `.github/workflows/deploy.yml` and add your deployment steps:

**Example: Railway**
```yaml
- name: Deploy to Railway
  run: |
    npm install -g @railway/cli
    railway up
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

**Example: Docker**
```yaml
- name: Build and push Docker image
  run: |
    docker build -t your-image:${{ github.sha }} .
    docker push your-image:${{ github.sha }}
```

**Example: Heroku**
```yaml
- name: Deploy to Heroku
  uses: akhileshns/heroku-deploy@v3.12.12
  with:
    heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
    heroku_app_name: "your-app-name"
    heroku_email: "your-email@example.com"
```

## Workflow Status Badges

Add these badges to your README.md:

```markdown
![Tests](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/Run%20Tests/badge.svg)
![Lint](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/Lint%20Code/badge.svg)
```

## Troubleshooting

### Tests Fail in CI but Pass Locally

1. **Check Node.js version**: CI uses specific versions
2. **Check environment variables**: CI might be missing secrets
3. **Check dependencies**: Run `npm ci` locally (not `npm install`)
4. **Check file paths**: CI runs from repository root

### Workflow Not Running

1. **Check branch name**: Workflows trigger on `main`, `master`, `develop`
2. **Check Actions tab**: Ensure workflows are enabled
3. **Check file location**: Workflows must be in `.github/workflows/`
4. **Check YAML syntax**: Validate YAML syntax

### Slow Workflows

1. **Enable caching**: Already configured for npm
2. **Reduce matrix versions**: Test fewer Node.js versions
3. **Run tests in parallel**: Already configured
4. **Skip unnecessary steps**: Use `if` conditions

## Best Practices

1. ✅ **Keep tests fast** - CI should complete in < 10 minutes
2. ✅ **Test before deploy** - Deploy workflow should depend on test workflow
3. ✅ **Use secrets** - Never commit API keys or passwords
4. ✅ **Cache dependencies** - Already configured
5. ✅ **Run on multiple Node versions** - Ensure compatibility
6. ✅ **Fail fast** - Stop on first test failure

## Alternative CI/CD Platforms

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - deploy

backend-tests:
  stage: test
  image: node:20
  script:
    - cd overlap/backend
    - npm ci
    - npm test

mobile-app-tests:
  stage: test
  image: node:20
  script:
    - cd mobile-app
    - npm ci
    - npm test
```

### CircleCI

Create `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: |
            cd overlap/backend && npm ci
            cd ../mobile-app && npm ci
      - run:
          name: Run tests
          command: |
            cd overlap/backend && npm test
            cd ../mobile-app && npm test
```

### Jenkins

Use Jenkinsfile (Pipeline as Code) for Jenkins setup.

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Enable GitHub Actions
3. ✅ Configure secrets (if needed)
4. ✅ Customize deployment steps
5. ✅ Add status badges to README
6. ✅ Monitor workflow runs

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [Codecov Documentation](https://docs.codecov.com/)


