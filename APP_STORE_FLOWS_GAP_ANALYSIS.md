# Overlap — App Store Flow Inventory & Gap Analysis

**Product:** Overlap (football/soccer match discovery + trip planning)  
**Platform:** Expo / React Native (iOS + Android)  
**Date:** 2026-08-07 (updated 2026-08-13)  
**Goal:** Define the complete set of mobile flows a product like this should ship with, and mark where Overlap is complete, partial, stubbed, or missing.

**Status legend**

| Status | Meaning |
|--------|---------|
| Done | Wired end-to-end and usable |
| Partial | Exists but incomplete UX, edge cases, or store polish |
| Stub | UI/route exists but no-ops or “Coming soon” |
| Orphaned | Built but not in navigation / feature-flagged off |
| Missing | Expected for this category of app; not present |

### P0 launch blockers (2026-08-13)

| # | Item | Status |
|---|------|--------|
| 1 | Rename display name → Overlap; align Android package with iOS | **Done** — `app.json`, iOS plist, Android `com.lonestar92s.overlap`, `strings.xml`, npm `overlap-mobile@1.0.1` |
| 2 | Remove/fix stubs (`TripMapView`, Settings, Help) | **Done** — `TripMapView` removed from nav + deleted; Settings/Help menus wired |
| 3 | Wire Terms, Privacy, Help/Feedback from Profile | **Done** — Profile legal row + Settings/Help alerts + Feedback shortcuts |
| 4 | Monetization: hide tier marketing until IAP | **Done** — subscription badge removed from Account |
| 5 | Align PrivacyInfo / permission usage strings | **Done** — collected-data types + branded permission copy |
| 6 | Production push entitlements | **Done** — `aps-environment: production` + background remote-notification |
| 7 | Password-reset deep linking | **Done** — `overlap://reset-password?token=…` linking config; backend email uses app scheme (or `FRONTEND_URL` / template override) |

**Remaining for submit (ops, not code):** set `EXPO_PUBLIC_WEB_APP_URL` in production builds; configure ASC App Privacy questionnaire to match `PrivacyInfo.xcprivacy`; store screenshots / ASO metadata.

---

## 1. Store & product identity (pre-flight)

These are not “user flows” but gate App Store review and first impression.

| Requirement | Status | Notes |
|-------------|--------|-------|
| Display name = brand (“Overlap”) | Done | `app.json` name + `CFBundleDisplayName` + Android `app_name` |
| Consistent bundle / package IDs | Done | iOS + Android `com.lonestar92s.overlap` |
| Version alignment | Done | Expo / npm / Android `1.0.1` |
| Icons / splash | Done | Present in Expo config |
| Privacy Nutrition Labels / PrivacyInfo collected data | Done | Email, name, user ID, location, photos, device ID, user content declared; tracking=false |
| Permission usage strings | Done | Branded Overlap copy for camera, photos, location, Face ID |
| Push entitlements for production | Done | `aps-environment` production in entitlements + `app.json` |
| Store metadata / screenshots / ASO | Missing | No Fastlane / ASC metadata in repo |
| EAS production submit path | Done | `eas.json` has production (+ submit) |

---

## 2. Lifecycle & first-run flows

### 2.1 Cold start / splash

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Splash → auth check → home or login | App shows branded splash, restores session, routes correctly | Done | Auth gate + loading spinner in `App.js` |
| Force-update / min version | Prompt when backend requires newer build | Missing | No version gate |
| Maintenance / backend down | Friendly blocking screen | Missing | Relies on generic errors |

### 2.2 Onboarding

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| First-launch product tour | Explain Search / Trips / Memories / Alerts | Missing | Splash only |
| Preference / league onboarding | Pick favorite leagues/teams before first search | Missing | Called out in REQUIREMENTS; no dedicated UI |
| Permission priming | Explain *why* before OS prompt (location, notifications, photos) | Partial | Permissions requested in-context; no priming screens |
| Guest / browse without account | Optional explore before signup | Missing | Auth-required wall |

---

## 3. Authentication & account security

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Email/password sign up | Register + validation + terms acceptance | Done | `RegisterScreen` |
| Login + session restore | JWT in secure storage | Done | `AuthContext` + SecureStore |
| Remember me | Persist preference | Done | Login screen |
| Logout | Clear session + unregister push | Done | Account |
| Forgot password | Request reset email | Done | `ForgotPasswordScreen` |
| Reset password | Open from email link, set new password | Done | Deep link + manual “Enter reset code” fallback |
| Email verification | Confirm email before sensitive actions | Missing | Not found |
| Social login (Apple required if other socials; Google optional) | Sign in with Apple / Google | Missing | WorkOS SSO only |
| Enterprise SSO | WorkOS WebView | Done | `WorkOSLoginScreen` |
| Session expiry / re-auth | Clear UX when token invalid | Partial | Network errors carefully handled; polish TBD |
| Biometric unlock (optional) | Face ID / fingerprint for returning users | Missing | Nice-to-have |

**App Store critical**

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Account deletion | In-app delete + confirmation + server scrub | Done | `AccountScreen` → `DELETE /api/auth/me` |
| Privacy Policy & Terms | Accessible in-app (not only at signup) | Done | Register + Profile legal row + Settings/Help; prod needs `EXPO_PUBLIC_WEB_APP_URL` |
| Support / contact | Reachable from Account | Done | Feedback icon + Help → Send feedback / Report a bug |

---

## 4. Core product flows

### 4.1 Match discovery & search

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Map home / nearby matches | Discover matches near me | Done | `SearchScreen` + `enableMapHomeScreen` |
| Location + date + “who” search | Structured search modal | Done | `LocationSearchModal` |
| Map results + filters + refine | Explore results on map | Done | `MapResultsScreen`, Filter system |
| List results | Browse as list | Done | `ResultsScreen` |
| Natural language / Ask Agent | Conversational trip search | Done | `AskAgentModal`, NL services |
| Multi-query search | Primary + nearby secondary matches | Done | Backend + AI agents test cases |
| Popular destinations | Curated city entry points | Partial | Hardcoded Unsplash cities (or removed in later UI work — verify) |
| Save / heart match | Persist favorites | Done | `HeartButton` → preferences API |
| Open club ticketing | External ticket deep link | Done | Match cards |
| Plan trip from results | One-tap into trip planning | Done | `ResultsScreen` → `ItineraryModal` |
| Unified search tab | Leagues/teams/venues one UI | Orphaned | `UnifiedSearchScreen`; flag `false` |
| Chat search tab | Messages-style NL | Orphaned | `MessagesScreen`; flag removed from `featureFlags.js` |
| Map bounds search screen | Dedicated map search | Orphaned | `MapSearchScreen` not in navigator |

### 4.2 Trip planning

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Create / edit / delete trip | CRUD itineraries | Done | Trips stack + `ItineraryContext` |
| Trip overview | Matches, notes, countdown, planning | Done | `TripOverviewScreen` |
| Match planning | Tickets, lodging, home base, notes | Done | `MatchPlanningModal` |
| Home bases | Multiple bases + travel times | Done | Home base components + API |
| Itinerary map | See matches on map | Done | `ItineraryMapScreen` |
| Alternate trip map route | Second map entry | Done (removed) | Stub `TripMapView` deleted; use ItineraryMap |
| Recommendations | Suggest matches for trip | Done | `useRecommendations` |
| Share trip | Image/link share | Orphaned | `ShareableTripView` unused |
| Collaborate / invite co-travelers | Multi-user trip | Missing | Not in product |
| Export calendar (ICS) | Add matches to device calendar | Missing | Nice-to-have / common for trip apps |

### 4.3 Flights & transportation

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Flight search | Origin/dest, dates, filters | Done | Amadeus via backend |
| Add flight to trip | Search or by flight number | Done | `AddFlightModal`, `FlightSearchTab` |
| External booking | Deep link to airline | Done | `Linking.openURL` |
| In-app booking / payment | Book & pay inside app | Missing | By design today (aggregator) — disclose clearly |
| Travel times (drive/transit) | Home base → venue | Done | Directions APIs + `TravelTimeDisplay` |
| Train / rail search | Inter-city trains for match weekends | Missing / Planned | Backend placeholder “not yet implemented” |
| Cost history / price intel | Show historical route prices | Partial | API only; no mobile UI |

### 4.4 Memories & attendance

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Mark attended | Attendance history | Done | `AttendanceModal`, `AttendedMatchesScreen` |
| Memory CRUD + photos | Post-match journal | Done | Memories screens + Cloudinary |
| Memories map | Geographic memory view | Done | `MemoriesMapScreen` |
| Share memory | Social / system share sheet | Partial / Missing | REQUIREMENTS mention share; verify UX completeness |

### 4.5 Alerts & notifications

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Request push permission | OS prompt after priming | Done | `expo-notifications` on login |
| Register / unregister device | Backend Expo push token | Done | Auth context |
| In-app notification inbox | List, unread badge, delete | Done | Alerts tab |
| Notification deep link | Tap → relevant screen (e.g. trip) | Partial | Trip ticket prompt wired; not universal for all types |
| Notification preferences | Per-category toggles in Settings | Partial | OS settings deep-link from Profile Settings; no in-app category toggles yet |
| Email digests (optional) | Match / trip reminders | Unknown / backend | Confirm product intent |

---

## 5. Profile, settings & support

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| View profile | Name, handle, avatar | Done | `AccountScreen` |
| Edit avatar | Upload / remove | Done | Cloudinary |
| Edit profile fields | Name, timezone, default location | Partial | API exists; Account mostly display |
| Favorites / past trips / memories tabs | Profile content hubs | Done | Account tabs |
| Settings screen | Units, notifs, privacy, legal | Partial | Nested Settings alert (OS notifs + legal); full settings screen still future |
| Help / FAQ / support | Help center or contact | Done | Help → Feedback / bug + legal |
| Feedback / bug report | In-app form | Done | `FeedbackScreen` |
| Subscription management | Upgrade, restore, cancel, manage | Missing | Intentionally hidden until IAP |
| Rate the app | Store review prompt (SKStoreReview) | Missing | Common polish |

---

## 6. Monetization flows

Backend has `freemium` / `pro` / `planner` with league gating. Mobile no longer shows a tier badge.

| Flow | Expected (if monetized) | Status | Gap |
|------|-------------------------|--------|-----|
| Paywall / upgrade | Clear benefits + purchase | Missing | Deferred until StoreKit / Play Billing |
| Restore purchases | Required for IAP | Missing | — |
| Manage subscription | Link to store subscription settings | Missing | — |
| Soft gates with explainers | “Pro unlocks X leagues” | Partial | Server gating only; weak client UX |

**Decision (P0):** strip client tier marketing until IAP ships. Revisit paywall before claiming Pro/Planner in App Store listing.

---

## 7. Resilience & quality flows

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Empty states | Trips, results, favorites, attended | Done | Multiple screens |
| Error boundaries | Crash isolation on key UI | Partial | MatchCard / filters / modals |
| Offline / poor network | Cached content or explicit offline UI | Missing | No NetInfo offline mode |
| Rate limiting / API errors | Human-readable messages | Partial | Auth handles some cases |
| Loading skeletons | Perceived performance | Partial | Spinners more than skeletons |
| Analytics / crash reporting (client) | Funnel + crash visibility | Missing | Sentry on backend only |
| Accessibility | Labels, Dynamic Type, VoiceOver | Partial | Some labels (e.g. avatar); not systematic |

---

## 8. Deep linking & cross-channel

| Flow | Expected | Status | Gap |
|------|----------|--------|-----|
| Custom URL scheme | `overlap://…` | Done | `app.json` scheme + iOS/Android intent filters |
| Universal Links / App Links | `https://…` opens app | Missing | No associated domains config |
| Password-reset link → app | Email opens Reset Password with token | Done | Linking config + backend email URL |
| Share trip / memory link | Open shared content in app | Missing | Share component unused |
| Push → screen | Navigate from notification | Partial | Limited types |

---

## 9. Legal, trust & App Review checklist

| Requirement | Status | Action |
|-------------|--------|--------|
| In-app Privacy Policy | Done | Profile + Settings/Help; ensure prod `EXPO_PUBLIC_WEB_APP_URL` |
| In-app Terms of Use | Done | Same |
| Account deletion | Done | Keep discoverable (Guideline 5.1.1) |
| Sign in with Apple | Missing | Required if you add Google/Facebook social login |
| Accurate permission purpose strings | Done | Branded copy in Info.plist / app.json |
| No broken “Coming soon” in production paths | Done | TripMapView removed; Settings/Help wired |
| No orphaned dead tabs that confuse QA | Partial | Messages / MapSearch / UnifiedSearch still in tree but not navigable |
| Data collection disclosure | Done (code) | Still fill ASC questionnaire to match PrivacyInfo |
| External purchases disclosure | N/A / clarify | Flights open external airline sites — OK if clear |

---

## 10. Priority gap list (recommended order)

### P0 — Blocks polished / safe submission — **COMPLETE (code)**

1. ~~Rename app to **Overlap**; align Android package with iOS.~~
2. ~~Remove or finish **stubs** (`TripMapView`, Settings, Help).~~
3. ~~Wire **legal + support** from Profile.~~
4. ~~Decide **monetization**: hide tier marketing until IAP.~~
5. ~~Complete **App Privacy / PrivacyInfo**.~~
6. ~~Confirm **production push** entitlements.~~
7. ~~Fix **password-reset deep linking**.~~

**Ops still required before submit:** production env for legal URLs; ASC privacy answers; screenshots.

### P1 — Incomplete core product flows

8. **Notification preferences** UI (in-app category toggles; OS settings link exists).
9. **Profile edit** (name, timezone, defaults).
10. Wire or delete **orphaned screens** (Messages, MapSearch, UnifiedSearch, ShareableTrip).
11. **Onboarding** + permission priming (esp. location for map home).

### P2 — Differentiation / roadmap

12. Train search, cost analytics UI, calendar export, share trip image.
13. Client analytics + crash reporting.
14. Offline mode, force-update gate, Sign in with Apple (if social).
15. Collaboration / multi-user trips.
16. IAP paywall when ready to monetize.

---

## 11. Flow map (happy path that should work at launch)

```
Install → Splash → Login/Register (Terms/Privacy)
  → Permission priming (Location, Notifications)
  → Optional: league/team onboarding
  → Search (map home) → Filters / Ask Agent → Results
  → Save match OR Create trip → Trip overview
  → Plan match (tickets/home base) → Search flights → Add to trip
  → Attend match → Add memory (+ photos)
  → Alerts inbox (reminders) → deep link back to trip
  → Profile → Settings / Help / Legal / Delete account / Logout
```

**Today’s reality:** auth → search/trips/memories/alerts core loop works; P0 store blockers addressed in code; onboarding, full settings, share, and IAP remain post-launch / P1–P2.

---

## 12. Evidence index (key paths)

| Area | Path |
|------|------|
| Navigation + deep links | `mobile-app/App.js` |
| Feature flags | `mobile-app/utils/featureFlags.js` |
| Account / legal / help | `mobile-app/screens/AccountScreen.js` |
| Plan trip from results | `mobile-app/screens/ResultsScreen.js` |
| Unused share | `mobile-app/components/ShareableTripView.js` |
| Legal URLs | `mobile-app/config/legalUrls.js` |
| Password reset email URL | `backend/src/routes/auth.js`, `backend/src/services/emailService.js` |
| Product status matrix | `REQUIREMENTS.md` |
| Store config | `mobile-app/app.json`, `eas.json`, `ios/.../PrivacyInfo.xcprivacy`, `ios/.../mobileapp.entitlements` |

---

## 13. Suggested definition of “App Store ready” for Overlap v1

A submitable v1 does **not** need every planned feature. It needs:

1. One coherent discovery → trip → flight → memory loop with no dead buttons. ✅
2. Complete account lifecycle (signup, reset, logout, **delete**, legal, support). ✅
3. Correct branding, privacy disclosures, and permission copy. ✅ (code; ASC questionnaire pending)
4. No monetization claims without IAP. ✅ (badge hidden)
5. Production notifications + deep links that don’t strand users. ✅ (verify on device)
6. Orphaned/stub screens removed from release paths. ✅ for stubs; orphans still unused

Everything in §10 P1–P2 can ship post-launch.
