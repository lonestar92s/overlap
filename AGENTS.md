# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Overlap (Flight Match Finder) is a sports-travel app that helps users find football/soccer matches during travel dates. It has three client surfaces backed by a Railway-hosted Express/MongoDB backend.

### Scope for Cloud Agent

The **primary development surface** is `mobile-app/` (React Native / Expo SDK 54). The backend is deployed to Railway at `https://friendly-gratitude-production-3f31.up.railway.app/api` — it does **not** run locally.

### Services

| Service | Location | How to run | Notes |
|---------|----------|-----------|-------|
| Mobile app (Expo) | `mobile-app/` | `cd mobile-app && npx expo start` | Main dev surface; uses `--tunnel` flag to expose to devices from cloud |
| Backend API | Railway (remote) | Already running | No local MongoDB or backend needed |
| Chrome extension | `overlap/` | Load as unpacked extension | Test-only; not a primary surface |
| Web frontend | `overlap/web/` | `cd overlap/web && npm start` | Out of scope per user preference |

### Running tests

- **Backend**: `cd overlap/backend && npm test` (Jest + Supertest; 170 passing, 64 pre-existing failures)
- **Mobile app**: `cd mobile-app && npm test` (jest-expo; 107 passing, 59 pre-existing failures)
- **Chrome extension**: `cd overlap && npm test` (Jest/jsdom; 77 passing, 15 pre-existing failures)

Pre-existing test failures are in the repo and are **not** caused by environment issues.

### Mobile app environment

- The `.env` file in `mobile-app/` must set `EXPO_PUBLIC_API_URL=https://friendly-gratitude-production-3f31.up.railway.app/api`.
- Expo web mode (`--web`) does not work because the app uses native-only packages (`react-native-maps`, `react-native-image-viewing`). Use standard Expo or `--tunnel` mode.
- Web dependencies (`react-native-web`, `react-dom`, `@expo/metro-runtime`) are installed but only for build tooling; the app targets native platforms.

### Gotchas

- The backend `express-rate-limit` throws a `ERR_ERL_PERMISSIVE_TRUST_PROXY` validation error locally because `trust proxy` is set to `true` (designed for Railway). This is harmless in development.
- All `package.json` files use `package-lock.json` (npm). Do not use pnpm/yarn.
- The `overlap/backend/.env.example` contains sample API keys. For local backend work (if ever needed), copy it to `.env` and start MongoDB on `localhost:27017`.
