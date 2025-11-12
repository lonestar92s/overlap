# Notifications Service Architecture Analysis

**Date**: 2025-01-31  
**Architect**: Senior React Native Architect  
**Scope**: Scalable notifications service for match change alerts

---

## Executive Summary

This document outlines the architectural design for a notifications service that can trigger both in-app notifications and email notifications when saved matches in trips change their date, time, or both. The service must be scalable, automated, and respect user preferences.

**Key Decision**: **In-app notifications should be sent first**, followed by email notifications. This provides immediate feedback to active users while email serves as a backup/offline notification mechanism.

---

## Current State Analysis

### Existing Infrastructure

1. **User Model** (`User.js`):
   - `preferences.notifications.email` (Boolean, default: true)
   - `preferences.notifications.matchReminders` (Boolean, default: false)
   - `preferences.notifications.priceAlerts` (Boolean, default: false)
   - `trips[]` array containing matches with `matchId`, `date`, `homeTeam`, `awayTeam`, `league`, `venue`
   - `savedMatches[]` array (separate from trip matches)

2. **Trip Structure**:
   - Matches stored in `user.trips[].matches[]`
   - Each match has: `matchId`, `date`, `homeTeam`, `awayTeam`, `league`, `venue`, `venueData`
   - No current tracking of original date/time for change detection

3. **No Existing Services**:
   - ❌ No email service (nodemailer, SendGrid, SES, etc.)
   - ❌ No push notification service (FCM, APNs)
   - ❌ No job scheduler (node-cron, Bull, etc.)
   - ❌ No change tracking mechanism

---

## Architecture Design

### 1. Service Layer Structure

```
backend/src/services/
├── notificationService.js      # Main orchestration service
├── emailService.js            # Email delivery (nodemailer/SendGrid)
├── pushNotificationService.js  # In-app push notifications (FCM/APNs)
└── matchChangeDetector.js      # Detects match date/time changes
```

### 2. Data Model Extensions

#### User Model Updates
```javascript
// Add to User schema
preferences: {
  notifications: {
    email: Boolean,
    matchReminders: Boolean,
    priceAlerts: Boolean,
    matchChanges: {           // NEW
      email: Boolean,          // Default: true
      inApp: Boolean,          // Default: true
      dateChanges: Boolean,    // Default: true
      timeChanges: Boolean    // Default: true
    }
  }
}
```

#### Match Change History Model (NEW)
```javascript
// New model: MatchChangeHistory.js
{
  userId: ObjectId,
  tripId: ObjectId,
  matchId: String,
  changeType: 'date' | 'time' | 'both',
  oldDate: Date,
  newDate: Date,
  oldTime: String,  // ISO time string
  newTime: String,
  detectedAt: Date,
  notifiedAt: Date,
  notificationStatus: {
    inApp: 'pending' | 'sent' | 'failed',
    email: 'pending' | 'sent' | 'failed'
  }
}
```

#### Trip Match Schema Updates
```javascript
// Add to trip.matches[] schema
{
  matchId: String,
  date: Date,
  originalDate: Date,        // NEW: Track original date for comparison
  originalTime: String,       // NEW: Track original time
  lastCheckedAt: Date,       // NEW: Last time we checked for changes
  // ... existing fields
}
```

### 3. Detection Mechanism

#### Option A: Polling-Based (Recommended for MVP)
- **Cron Job**: Run every 6-12 hours
- **Process**: 
  1. Query all active trips (trips with future matches)
  2. For each match, fetch latest data from API-Sports
  3. Compare `date` and `time` fields
  4. If changed, trigger notification service

#### Option B: Webhook-Based (Future Enhancement)
- **Requires**: API-Sports webhook support (may not be available)
- **Process**: Receive webhook when match data changes
- **Benefit**: Real-time detection, no polling overhead

#### Option C: Hybrid Approach
- **Primary**: Polling for reliability
- **Secondary**: Webhook if available (fallback to polling)

**Recommendation**: Start with **Option A (Polling)** for MVP, plan for **Option C** in Phase 2.

---

## Notification Delivery Order

### Recommended Flow: **In-App First, Email Second**

**Rationale**:
1. **Immediate Feedback**: Active users get instant notification
2. **Lower Latency**: In-app notifications are faster (no SMTP delays)
3. **Better UX**: Users see notification when app is open
4. **Email as Backup**: Email serves users who aren't actively using the app
5. **Redundancy**: If in-app fails, email still delivers

### Delivery Sequence

```
1. Detect Match Change
   ↓
2. Check User Preferences
   ├─ If inApp enabled → Send in-app notification (async, non-blocking)
   └─ If email enabled → Queue email notification
   ↓
3. Update MatchChangeHistory record
   ↓
4. Log notification status
```

**Implementation Note**: Both notifications can be sent in parallel, but in-app should be attempted first due to lower latency.

---

## Service Implementation Design

### 1. Match Change Detector Service

**Responsibilities**:
- Fetch latest match data from API-Sports
- Compare with stored match data
- Identify changes (date, time, or both)
- Return change events

**Key Functions**:
```javascript
class MatchChangeDetector {
  async detectChangesForUser(userId)
  async detectChangesForTrip(tripId)
  async detectChangesForMatch(matchId, storedMatch)
  compareMatchData(storedMatch, apiMatch)
}
```

### 2. Notification Service (Orchestrator)

**Responsibilities**:
- Coordinate detection and delivery
- Respect user preferences
- Handle retries and failures
- Log notification history

**Key Functions**:
```javascript
class NotificationService {
  async checkAndNotifyMatchChanges(userId)
  async notifyMatchChange(userId, changeEvent)
  async shouldNotifyUser(userId, changeType)
  async recordNotification(changeEvent, status)
}
```

### 3. Email Service

**Responsibilities**:
- Send HTML/text emails
- Handle email provider (SendGrid, SES, nodemailer)
- Template rendering
- Retry logic

**Key Functions**:
```javascript
class EmailService {
  async sendMatchChangeEmail(user, changeEvent)
  async renderEmailTemplate(changeEvent)
  async handleEmailFailure(error, retryCount)
}
```

### 4. Push Notification Service

**Responsibilities**:
- Send in-app push notifications
- Handle FCM (Android) and APNs (iOS)
- Device token management
- Retry logic

**Key Functions**:
```javascript
class PushNotificationService {
  async sendMatchChangeNotification(userId, changeEvent)
  async getDeviceTokens(userId)
  async handleNotificationFailure(error, retryCount)
}
```

---

## Scalability Considerations

### 1. Job Scheduling

**Option A: node-cron (Simple, Good for MVP)**
- Pros: Easy setup, no external dependencies
- Cons: Single instance, no distributed locking
- Use Case: MVP, small scale (< 10K users)

**Option B: Bull Queue + Redis (Recommended for Scale)**
- Pros: Distributed, retry logic, job prioritization
- Cons: Requires Redis infrastructure
- Use Case: Production scale (> 10K users)

**Option C: External Scheduler (Railway Cron, GitHub Actions)**
- Pros: No infrastructure management
- Cons: Less control, external dependency
- Use Case: Serverless/containerized deployments

**Recommendation**: Start with **node-cron** for MVP, migrate to **Bull Queue** when scaling.

### 2. Rate Limiting

**API-Sports Rate Limits**:
- Free tier: 100 requests/day
- Pro tier: 300 requests/day
- Need to batch requests efficiently

**Strategy**:
- Batch match lookups (up to 10 matches per API call if supported)
- Cache match data for 6-12 hours
- Prioritize matches happening soon (within 7 days)
- Defer matches far in future (30+ days)

### 3. Database Optimization

**Indexes Required**:
```javascript
// User model
user.trips.matches.matchId: index
user.trips.matches.date: index (for active trip queries)

// MatchChangeHistory model
userId: index
tripId: index
matchId: index
detectedAt: index (for cleanup queries)
```

**Query Optimization**:
- Only check active trips (future matches)
- Only check matches within 90 days
- Batch updates to reduce database writes

### 4. Notification Batching

**Strategy**: Group multiple match changes for same user/trip
- If 3 matches in same trip change → 1 notification with all changes
- Reduces notification spam
- Better user experience

---

## Automation Strategy

### Cron Job Implementation

**Schedule**: Every 6 hours (4 times/day)
- 2 AM, 8 AM, 2 PM, 8 PM (UTC)

**Process**:
1. Find all users with active trips
2. For each user:
   - Get all matches in active trips
   - Filter matches happening within 90 days
   - Batch fetch latest match data from API
   - Compare and detect changes
   - Send notifications if changes found
3. Log execution metrics

**Error Handling**:
- Continue processing other users if one fails
- Log errors for monitoring
- Retry failed notifications (exponential backoff)

### Job Script Structure

```
backend/src/scripts/
└── checkMatchChanges.js
    ├── Main execution function
    ├── User batch processing
    ├── Match change detection
    └── Notification triggering
```

---

## User Preferences & Unsubscribe

### UI Settings Structure

**Mobile App Settings Screen**:
```
Notification Settings
├── Email Notifications
│   ├── Match Changes (date/time)
│   ├── Match Reminders
│   └── Price Alerts
└── In-App Notifications
    ├── Match Changes (date/time)
    ├── Match Reminders
    └── Price Alerts
```

**Backend API Endpoint**:
```
PUT /api/preferences/notifications
Body: {
  email: {
    matchChanges: Boolean,
    matchReminders: Boolean,
    priceAlerts: Boolean
  },
  inApp: {
    matchChanges: Boolean,
    matchReminders: Boolean,
    priceAlerts: Boolean
  }
}
```

### Unsubscribe Flow

1. **In-App**: User toggles setting → Immediate effect
2. **Email**: Include unsubscribe link in emails
   - Link format: `https://api.example.com/unsubscribe?token=xxx`
   - Token-based (JWT with user ID)
   - Updates user preferences automatically

---

## Gaps & Recommendations

### Critical Gaps

1. **❌ No Email Service Infrastructure**
   - **Gap**: No email provider configured (nodemailer, SendGrid, SES)
   - **Impact**: Cannot send emails
   - **Recommendation**: 
     - Choose provider (SendGrid recommended for ease)
     - Add to `package.json`
     - Configure environment variables
     - Implement email templates

2. **❌ No Push Notification Infrastructure**
   - **Gap**: No FCM/APNs setup for mobile app
   - **Impact**: Cannot send in-app notifications
   - **Recommendation**:
     - Set up Firebase Cloud Messaging (FCM)
     - Configure APNs for iOS
     - Store device tokens in User model
     - Implement token refresh logic

3. **❌ No Job Scheduler**
   - **Gap**: No automated way to run periodic checks
   - **Impact**: Manual triggering required
   - **Recommendation**:
     - Add `node-cron` for MVP
     - Plan migration to Bull Queue for scale
     - Set up monitoring/alerting

4. **❌ No Change Tracking**
   - **Gap**: No way to detect if match changed
   - **Impact**: Cannot know when to notify
   - **Recommendation**:
     - Store `originalDate` and `originalTime` when match added
     - Create `MatchChangeHistory` model
     - Implement comparison logic

5. **❌ No Notification History**
   - **Gap**: Cannot track what was sent, when
   - **Impact**: No audit trail, potential duplicate notifications
   - **Recommendation**:
     - Create `MatchChangeHistory` model
     - Log all notification attempts
     - Implement deduplication logic

### Medium Priority Gaps

6. **⚠️ No Batch Processing for API Calls**
   - **Gap**: May hit API rate limits with many users
   - **Recommendation**: Implement batching and caching

7. **⚠️ No Notification Templates**
   - **Gap**: Need email and in-app message templates
   - **Recommendation**: Create template system with variables

8. **⚠️ No Retry Logic**
   - **Gap**: Failed notifications are lost
   - **Recommendation**: Implement exponential backoff retry

9. **⚠️ No Monitoring/Alerting**
   - **Gap**: Won't know if service fails
   - **Recommendation**: Add logging, metrics, alerts

### Low Priority Gaps (Future Enhancements)

10. **📋 No Notification Preferences Granularity**
    - Could allow users to set notification times (e.g., "only notify between 9 AM - 9 PM")
    - Could allow frequency limits (e.g., "max 1 notification per day")

11. **📋 No Notification Digest**
    - Could batch multiple changes into daily/weekly digest
    - Reduces notification fatigue

12. **📋 No Webhook Support**
    - If API-Sports adds webhooks, could enable real-time detection
    - Currently not available, so polling is required

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Basic infrastructure setup

1. **Backend**:
   - Add `node-cron` dependency
   - Create `MatchChangeHistory` model
   - Update User model with notification preferences
   - Update Trip match schema (add `originalDate`, `originalTime`)

2. **Services**:
   - Create `matchChangeDetector.js` (skeleton)
   - Create `notificationService.js` (orchestrator)
   - Create `emailService.js` (skeleton, no sending yet)
   - Create `pushNotificationService.js` (skeleton, no sending yet)

**Deliverable**: Infrastructure ready, no notifications sent yet

---

### Phase 2: Detection & Email (Week 3-4)
**Goal**: Detect changes and send emails

1. **Detection**:
   - Implement `matchChangeDetector.js` (API-Sports integration)
   - Implement comparison logic
   - Create cron job script

2. **Email**:
   - Set up email provider (SendGrid/nodemailer)
   - Create email templates
   - Implement `emailService.js`
   - Test email delivery

3. **Integration**:
   - Wire detection → notification service → email service
   - Add error handling and logging

**Deliverable**: Email notifications working

---

### Phase 3: In-App Notifications (Week 5-6)
**Goal**: Add push notifications

1. **Mobile App**:
   - Set up FCM/APNs
   - Implement device token registration
   - Add notification handling

2. **Backend**:
   - Implement `pushNotificationService.js`
   - Add device token storage to User model
   - Integrate with notification service

**Deliverable**: Both email and in-app notifications working

---

### Phase 4: UI & Preferences (Week 7)
**Goal**: User controls

1. **Mobile App**:
   - Add notification settings screen
   - Implement preference updates
   - Add unsubscribe flows

2. **Backend**:
   - Update preferences API
   - Add unsubscribe endpoint
   - Respect preferences in notification service

**Deliverable**: Full user control over notifications

---

### Phase 5: Scale & Optimize (Week 8+)
**Goal**: Production readiness

1. **Optimization**:
   - Add caching for match data
   - Implement batching
   - Add rate limiting

2. **Monitoring**:
   - Add logging and metrics
   - Set up alerts
   - Create dashboard

3. **Migration** (if needed):
   - Migrate from node-cron to Bull Queue
   - Add Redis for job queue

**Deliverable**: Production-ready, scalable service

---

## Technical Decisions

### Email Provider: **Environment-Based** (Recommended)

**Development: Mailtrap**
- **Purpose**: Catch all emails, view in web UI, no real sends
- **Setup**: Free account at mailtrap.io
- **Benefits**: 
  - No risk of sending test emails to real users
  - View HTML/text versions of emails
  - Test email templates easily
  - Free tier: 500 emails/month
- **Configuration**: Use nodemailer with Mailtrap SMTP credentials

**Production: SendGrid**
- **Purpose**: Real email delivery to users
- **Setup**: SendGrid account, API key
- **Benefits**: 
  - Reliable delivery
  - Good free tier (100 emails/day)
  - Easy API integration
  - Analytics and tracking
- **Configuration**: Use SendGrid API or nodemailer with SendGrid SMTP

**Implementation Pattern**:
```javascript
// emailService.js
const getEmailConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      from: process.env.SENDGRID_FROM_EMAIL
    };
  } else {
    // Development: Use Mailtrap
    return {
      provider: 'mailtrap',
      host: 'smtp.mailtrap.io',
      port: 2525,
      user: process.env.MAILTRAP_USER,
      password: process.env.MAILTRAP_PASSWORD,
      from: 'dev@flightmatchfinder.com'
    };
  }
};
```

**Alternative Options**:
- **AWS SES**: If already using AWS infrastructure
- **Nodemailer with Gmail**: For very simple setups (not recommended for production)

### Push Notifications: **Firebase Cloud Messaging (FCM)**
- **Pros**: Works for both Android and iOS, free
- **Cons**: Requires Firebase setup
- **Alternative**: OneSignal (easier, but paid at scale)

### Job Scheduler: **node-cron** → **Bull Queue**
- **MVP**: node-cron (simple, no infrastructure)
- **Scale**: Bull Queue + Redis (distributed, reliable)

### Change Detection: **Polling** (6-hour intervals)
- **Frequency**: 4 times/day (2 AM, 8 AM, 2 PM, 8 PM UTC)
- **Optimization**: Only check matches within 90 days
- **Future**: Webhooks if API-Sports adds support

---

## Security Considerations

1. **Email Unsubscribe Tokens**:
   - Use JWT with short expiration (7 days)
   - Include user ID, not email (prevents enumeration)
   - Validate token before updating preferences

2. **API Rate Limiting**:
   - Implement per-user rate limits
   - Prevent abuse of notification endpoints

3. **Data Privacy**:
   - Don't log sensitive user data
   - Encrypt device tokens if stored
   - Comply with email unsubscribe regulations (CAN-SPAM, GDPR)

---

## Testing Strategy

### Unit Tests
- `matchChangeDetector.js`: Change detection logic
- `notificationService.js`: Preference checking, orchestration
- `emailService.js`: Template rendering, error handling

### Integration Tests
- End-to-end: Detection → Notification → Delivery
- API-Sports integration: Mock responses
- Email delivery: Use test email service (Mailtrap)

### Manual Testing
- Test with real API-Sports data
- Verify email delivery
- Test push notifications on devices
- Test unsubscribe flows

---

## Monitoring & Metrics

### Key Metrics to Track
1. **Detection**:
   - Matches checked per run
   - Changes detected per run
   - Detection execution time

2. **Notifications**:
   - In-app notifications sent
   - Emails sent
   - Notification failures
   - Delivery success rate

3. **User Engagement**:
   - Users with notifications enabled
   - Unsubscribe rate
   - Notification open/click rate (email)

### Logging
- Log all detection runs
- Log all notification attempts (success/failure)
- Log errors with context
- Use structured logging (JSON)

---

## Conclusion

This architecture provides a scalable, automated notifications service that can grow with your user base. The phased approach allows for incremental delivery while building toward a production-ready system.

**Next Steps**:
1. Review and approve architecture
2. Set up email provider (SendGrid)
3. Create MatchChangeHistory model
4. Implement Phase 1 (Foundation)

**Questions to Resolve**:
- Email provider preference? (SendGrid vs SES vs nodemailer)
- Push notification provider? (FCM vs OneSignal)
- Cron job frequency? (6 hours recommended, but adjustable)
- Notification batching strategy? (per trip vs per user)

