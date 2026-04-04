# Notification center — category definitions

**Purpose**: Single source of truth for each notification **category**: trigger, frequency, channels, copy rules, and data dependencies. Add new categories as new sections below.

**Related docs**: `NOTIFICATIONS_SERVICE_ARCHITECTURE.md`, `NOTIFICATIONS_IMPLEMENTATION_PLAN.md`, `README.md` (code paths, foreground vs background presentation).

---

## Conventions

| Field | Meaning |
|--------|--------|
| **Category ID** | Stable snake_case identifier for code, analytics, and payloads (`type` in push `data`). |
| **Display name** | User-facing label in settings and optional in-app notification center. |
| **Channels** | `push`, `email`, etc. MVP categories may be push-only. |
| **Eligibility** | Who/when a user or entity qualifies for this category. |
| **Frequency** | Caps per time window (not the same as “urgency”). |
| **Batching** | How multiple eligible entities collapse into one notification. |

**Data path for trips** (Overlap backend): `User.trips[]` → `matches[]` → `planning.ticketsAcquired` (see `overlap/backend/src/models/User.js`).

---

## Category 1 — Trip ticket status (`trip_ticket_status_prompt`)

### Summary

Nudge users to confirm or finish ticket planning for matches on a trip that are not fully marked **Tickets acquired: yes**.

### Display name

**Trip ticket check-in** (settings) · short label: **Ticket reminders**

### Category ID

`trip_ticket_status_prompt`

### Purpose

- Prompt users who have **not** set `planning.ticketsAcquired` to **`yes`** for one or more matches on a trip.
- Differentiate copy when the user has **not started** (`no`) vs **in progress** (`in-progress`).

### Channels (MVP)

- **Push** only.

### Eligibility

- Trip exists with **≥ 1 match**.
- At least one match has `planning.ticketsAcquired` ∈ **`no`** or **`in-progress`** (not `yes`).
- Match is still relevant for planning (e.g. upcoming — define cutoff if needed later).

**Schema reference**:

```text
user.trips[].matches[].planning.ticketsAcquired  // enum: 'yes' | 'no' | 'in-progress'
```

### Trigger

1. **First send**: **30 minutes** after the trip is created (itinerary with ≥ 1 match persisted), **if** at least one match still satisfies eligibility above.
2. **Ongoing**: Re-evaluate on each scheduler run while eligibility holds. Stop this category for that trip when every match has `ticketsAcquired === 'yes'`.

*(Product decision to lock: behavior when new matches are added later — e.g. new 30-minute delayed job vs fold into next daily tick only.)*

### Frequency

Apply **per trip** while the trip has at least one eligible match:

| Nearest upcoming match kickoff | Max push sends |
|--------------------------------|----------------|
| **> 14 days** away | **1** per calendar day (in user’s timezone — see open questions) |
| **≤ 14 days** away | **2** per calendar day |

The **first** notification still follows the **T+30 minutes** rule; afterward, these caps apply.

*(If matches span both sides of the 14-day boundary, use **nearest kickoff** to choose the band, or **any match ≤ 14 days** upgrades the whole trip to 2/day — pick one and document here once decided.)*

### Batching

- **One push per schedule tick per trip** (not one push per match).
- **Copy priority** when mixing states:
  - If **any** eligible match has `ticketsAcquired === 'no'` → use the **“not started”** headline family for the notification title (see Copy).
  - If **all** eligible matches are `in-progress` (no remaining `no`) → use the **“finish”** headline family only.
- Body may summarize counts, e.g. “2 matches still need tickets, 1 in progress.”

### Copy (push)

| State | Intent | Example title · body (tune for brand) |
|-------|--------|----------------------------------------|
| **`no`** | Not started | **Still need tickets?** · “You haven’t marked tickets for [Trip] yet.” |
| **`in-progress`** | Nudge to complete | **Finish your tickets** · “Wrap up tickets for [Match] on [Trip].” |
| **Mixed** | Prefer stronger lane | Title from **`no`** lane if any `no` exists; body can list both counts. |

Keep tone supportive; avoid shaming. Final strings go through product/copy review.

### Payload (`data` for deep link / in-app)

Include at minimum:

- `type`: `trip_ticket_status_prompt`
- `tripId`
- Optional: `matchIds[]`, `hasNotStarted` (boolean), `hasInProgress` (boolean)

### Open questions (resolve before implementation)

1. **Timezone** for “per calendar day”: user profile TZ, device TZ, or first match venue TZ?
2. **New matches** added after trip creation: separate T+30 job or next scheduled tick only?
3. **Past matches**: exclude from eligibility explicitly?
4. **Android channel ID** and **iOS interruption** level for this category (single “trip planning” channel is fine for MVP).

### Urgency

No separate urgency field for MVP: **frequency caps + one default priority** on the push channel suffice. Revisit when multiple categories compete for the same user in the same minute.

---

## Category 2 — Match schedule change (`match_schedule_change`)

### Summary

Alert users when a match on one of their trips has a **material schedule update**: date, time, **cancelled**, **TBD** → **scheduled** (kickoff confirmed), or **scheduled** → **TBD**. Send **as soon as** the backend detects a qualifying change (subject to deduplication).

### Display name

**Match schedule updates** (settings) · short label: **Schedule changes**

### Category ID

`match_schedule_change`

### Purpose

- Users with saved itinerary matches need **immediate** awareness when fixtures move, firm up, or cancel — this can invalidate travel, hotels, or sequencing.
- Include **before/after** in the **in-app** experience (and structured payload); push/email use **short copy** + deep link.

### Channels

- **Push**: yes (MVP).
- **In-app notification center**: yes — store full structured diff for display on open (inline on match row, bottom sheet, or detail sub-screen — no separate permanent trip “card” required if trip/match detail can render the diff when opened from this notification).
- **Email**: when email is enabled; same triggers, optionally **digest** only if product caps instant email volume (default: **immediate** for cancellation; optional policy to batch minor time tweaks).

### Eligibility

- User has a **trip** with **≥ 1 match** referencing the affected `matchId` (Overlap: `User.trips[].matches[]`).
- The match is **not** past / irrelevant for updates (define cutoff: e.g. after final whistle, suppress further schedule notifications).
- Change is **material** per **Material changes** below.

### Material changes (notify)

| Change | Notes |
|--------|--------|
| **Kickoff date** (calendar day in user/trip TZ) | Any shift across local day boundary counts. |
| **Kickoff time** | Notify if time changes (define minimum delta if needed, e.g. ≥ 1 minute, to ignore noise). |
| **Status: cancelled** | Always notify. |
| **TBD / unconfirmed → scheduled** (date and/or time now known) | User should know immediately. |
| **Scheduled → TBD** (time or date removed / marked unknown) | User should know; may affect bookings. |

Do **not** notify on unrelated field-only updates (e.g. TV listing) unless product expands this category later.

### Trigger

1. On **ingestion/sync** when canonical match data for a `matchId` differs from **last notified snapshot** (or last persisted snapshot on the user’s trip match) for any **material** field.
2. **Idempotency**: same provider revision / same normalized tuple `(matchId, field, newValue)` must not emit duplicate notifications.
3. **Immediate**: no “once per day” cap for this category by default; optional **short debounce** (e.g. 1–5 minutes) if the provider flips values rapidly during data refresh.

### Frequency

- **Default**: **unlimited** per match per event chain, bounded by actual material state transitions (still dedupe per revision).
- **Optional product cap**: max N notifications per match per 24h for **time-only** micro-adjustments (document here if enabled); **cancellation** and **TBD ↔ scheduled** exempt from caps.

### Batching

- **Single match changed**: one notification; payload lists one `matchId` and `changes[]`.
- **Multiple matches on same trip** updated in same sync window (e.g. same competition round): **one** push/in-app item summarizing count — e.g. “3 matches on [Trip] updated” — with `matchIds[]` and optional **expand in-app** to per-match diffs.
- **Copy priority**: cancellation > TBD introduced > date change > time-only change.

### Copy (high level)

| Situation | Title intent · body intent |
|-----------|----------------------------|
| **Cancelled** | Clear urgency · name competition + opponent + trip. |
| **TBD → scheduled** | “Kickoff confirmed” · show new date/time. |
| **Scheduled → TBD** | “Time to confirm later” · explain fixture no longer has firm kickoff. |
| **Date/time move** | “Kickoff moved” · one line new schedule; details in app. |

Final strings via product/copy review.

### Payload (`data` / stored notification record)

Include at minimum:

- `type`: `match_schedule_change`
- `tripId`
- `matchIds[]`
- `changes`: array of `{ matchId, field, from, to }` where `field` ∈ `date`, `time`, `status`, `tbd` (or equivalent enum aligned with backend)
- Optional: `competitionId`, `home`, `away`, `venueId` for rich copy
- Optional: `impactSummary` when itinerary analysis exists (string or structured later)

**In-app**: use `changes` to render **before/after** on navigation.

### Open questions

1. **Timezone** for “date changed”: user profile, device, trip anchor, or venue?
2. **Minimum time delta** to suppress noise (if any).
3. **Postponed with no new date** — map to **TBD** vs distinct **postponed** state for copy.
4. **Android channel ID** / **iOS interruption level**: recommend **high** for cancellation, **default/time-sensitive** for confirmations.

### Urgency

**High** relative to planning nudges: schedule changes should win in **conflict resolution** when multiple notifications are pending; prefer **immediate** delivery for this category.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-03-24 | Initial doc: category `trip_ticket_status_prompt`. |
| 2025-03-25 | Add category `match_schedule_change` (date, time, cancel, TBD ↔ scheduled); immediate delivery; before/after in-app via payload. |
