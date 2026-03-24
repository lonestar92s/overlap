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

## Changelog

| Date | Change |
|------|--------|
| 2025-03-24 | Initial doc: category `trip_ticket_status_prompt`. |
