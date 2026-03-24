# Notifications Service Implementation Plan

**Recommendation**: Build push notifications first, then add email.

## Push vs In-App Notifications: Same Trigger, Different Delivery

### Key Distinction

**Same Trigger**: Both are triggered by the same event (match change detected)

**Different Delivery**:
- **Push Notification**: Sent from server when app is **closed/backgrounded**
  - Appears in device notification center
  - User taps to open app
  - Works even when app is not running

- **In-App Notification**: Shown when app is **open/foregrounded**
  - Appears as banner/toast at top of screen
  - User sees it immediately while using app
  - Can show custom UI (modal, toast, etc.)

### How Expo Notifications Handles Both

With `expo-notifications`, **one notification handles both scenarios**:

```javascript
// When app is CLOSED → Push notification appears in notification center
// When app is OPEN → Notification appears as banner (configurable)

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,    // Show banner when app is open
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

**So you get both behaviors automatically** - no need for separate "push" vs "in-app" implementations!

### Optional: Custom In-App UI

If you want a **custom in-app notification UI** (e.g., toast, modal) instead of the system banner:

```javascript
// Listen for notification when app is foregrounded
Notifications.addNotificationReceivedListener(notification => {
  // Show custom toast/modal instead of system banner
  showCustomNotificationToast(notification);
});
```

**Recommendation**: Start with Expo's default behavior (handles both automatically), add custom UI later if needed.

## Why Push Notifications First?

### ✅ Advantages
1. **Faster feedback loop** - Test end-to-end flow immediately
2. **Simpler setup** - Expo Notifications handles iOS/Android automatically
3. **No external service dependencies** - No email provider setup needed initially
4. **Better UX validation** - See notifications in real-time on device
5. **Incremental delivery** - Get working feature faster, add email as enhancement

### 📊 Comparison

| Aspect | Push First | Everything Together |
|--------|-----------|---------------------|
| Time to working feature | 2-3 days | 5-7 days |
| Complexity | Lower | Higher |
| Debugging | Easier | Harder (more moving parts) |
| User testing | Can start immediately | Wait for everything |
| Risk | Lower | Higher (more can fail) |

---

## Implementation Order

### Phase 1: Push Notifications (Recommended Start)

**Goal**: Get push notifications working end-to-end

**Timeline**: 2-3 days

#### Step 1: Foundation (Backend)
1. Create `MatchChangeHistory` model
2. Update User model (add device tokens, notification preferences)
3. Update Trip match schema (add `originalDate`, `originalTime`)

#### Step 2: Detection Service
1. Build `matchChangeDetector.js`
2. Implement API-Sports comparison logic
3. Test detection with sample data

#### Step 3: Push Notification Service
1. Set up Expo Push Notification service
2. Build `pushNotificationService.js`
3. Add device token registration endpoint

#### Step 4: Mobile App Integration
1. Install `expo-notifications` package
2. Request notification permissions
3. Register device token on login/app start
4. Handle incoming notifications
5. Display notification UI

#### Step 5: Orchestration
1. Build `notificationService.js` (orchestrator)
2. Wire detection → notification service → push service
3. Add error handling and logging

#### Step 6: Automation
1. Create cron job script
2. Set up node-cron scheduler
3. Test automated detection

**Deliverable**: Working push notifications for match changes

---

### Phase 2: Email Service (After Push Works)

**Goal**: Add email notifications as backup/offline channel

**Timeline**: 1-2 days

1. Set up Mailtrap (dev) and SendGrid (prod)
2. Build `emailService.js`
3. Create email templates
4. Integrate with notification service
5. Test email delivery

**Deliverable**: Both push and email working

---

## Technical Stack for Push Notifications

### Expo Notifications (Recommended)

**Why Expo Notifications?**
- ✅ Already using Expo (~53.0.17)
- ✅ Handles iOS (APNs) and Android (FCM) automatically
- ✅ No manual Firebase/APNs setup needed
- ✅ Free push notification service
- ✅ Simple API

**Setup Required**:
1. Install: `expo install expo-notifications`
2. Configure in `app.json` (add notification permissions)
3. Request permissions in app
4. Register device token with backend
5. Backend sends to Expo Push API

**Alternative**: Direct FCM/APNs (more complex, not recommended for Expo apps)

---

## Implementation Details

### 1. Backend: MatchChangeHistory Model

```javascript
// backend/src/models/MatchChangeHistory.js
const mongoose = require('mongoose');

const matchChangeHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  matchId: {
    type: String,
    required: true,
    index: true
  },
  changeType: {
    type: String,
    enum: ['date', 'time', 'both'],
    required: true
  },
  oldDate: Date,
  newDate: Date,
  oldTime: String,  // ISO time string
  newTime: String,
  detectedAt: {
    type: Date,
    default: Date.now
  },
  notifiedAt: Date,
  notificationStatus: {
    push: {
      status: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'pending'
      },
      sentAt: Date,
      error: String
    },
    email: {
      status: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'pending'
      },
      sentAt: Date,
      error: String
    }
  }
}, {
  timestamps: true
});

// Prevent duplicate notifications for same change
matchChangeHistorySchema.index({ userId: 1, matchId: 1, detectedAt: 1 }, { unique: true });

module.exports = mongoose.model('MatchChangeHistory', matchChangeHistorySchema);
```

### 2. Backend: Update User Model

```javascript
// Add to User schema in backend/src/models/User.js

// Device tokens for push notifications
deviceTokens: [{
  token: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android', 'web'],
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}],

// Update notifications preferences
preferences: {
  notifications: {
    email: Boolean,
    matchReminders: Boolean,
    priceAlerts: Boolean,
    matchChanges: {           // NEW
      push: Boolean,          // Default: true
      email: Boolean,         // Default: true
      dateChanges: Boolean,   // Default: true
      timeChanges: Boolean    // Default: true
    }
  }
}
```

### 3. Backend: Update Trip Match Schema

```javascript
// When adding match to trip, store original values
const matchToSave = {
  matchId,
  homeTeam,
  awayTeam,
  league,
  venue,
  venueData,
  date: new Date(date),
  originalDate: new Date(date),        // NEW: Store original
  originalTime: date.split('T')[1] || null,  // NEW: Extract time
  lastCheckedAt: new Date(),          // NEW: Track last check
  addedAt: new Date(),
  planning: { ... }
};
```

### 4. Backend: Push Notification Service

```javascript
// backend/src/services/pushNotificationService.js
const axios = require('axios');

class PushNotificationService {
  constructor() {
    this.expoPushApiUrl = 'https://exp.host/--/api/v2/push/send';
  }

  async sendMatchChangeNotification(userId, deviceTokens, changeEvent) {
    const { matchId, changeType, oldDate, newDate, oldTime, newTime, matchInfo } = changeEvent;
    
    // Build notification message
    let title = 'Match Update';
    let body = '';
    
    if (changeType === 'date') {
      body = `${matchInfo.homeTeam} vs ${matchInfo.awayTeam} date changed`;
    } else if (changeType === 'time') {
      body = `${matchInfo.homeTeam} vs ${matchInfo.awayTeam} time changed`;
    } else {
      body = `${matchInfo.homeTeam} vs ${matchInfo.awayTeam} date & time changed`;
    }

    // Prepare notifications for all device tokens
    const notifications = deviceTokens.map(token => ({
      to: token.token,
      sound: 'default',
      title,
      body,
      data: {
        type: 'match_change',
        matchId,
        changeType,
        oldDate: oldDate?.toISOString(),
        newDate: newDate?.toISOString(),
        oldTime,
        newTime,
        tripId: changeEvent.tripId
      },
      priority: 'high',
      channelId: 'match-updates' // Android notification channel
    }));

    try {
      // Send to Expo Push API
      const response = await axios.post(this.expoPushApiUrl, notifications, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Check for errors in response
      const results = response.data.data || [];
      const failures = results.filter(r => r.status === 'error');
      
      if (failures.length > 0) {
        console.error('Some push notifications failed:', failures);
        // Remove invalid tokens
        await this.handleFailedTokens(userId, failures);
      }

      return {
        success: true,
        sent: results.filter(r => r.status === 'ok').length,
        failed: failures.length
      };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      throw error;
    }
  }

  async handleFailedTokens(userId, failures) {
    // Remove invalid/expired tokens from user's deviceTokens array
    const invalidTokens = failures
      .filter(f => f.details?.error === 'DeviceNotRegistered')
      .map(f => f.to);

    if (invalidTokens.length > 0) {
      const User = require('../models/User');
      await User.updateOne(
        { _id: userId },
        { $pull: { deviceTokens: { token: { $in: invalidTokens } } } }
      );
    }
  }
}

module.exports = new PushNotificationService();
```

### 5. Backend: Device Token Registration Endpoint

```javascript
// backend/src/routes/notifications.js (new file)
const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// Register device token for push notifications
router.post('/register-token', auth, async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ 
        error: 'Token and platform are required' 
      });
    }

    if (!['ios', 'android', 'web'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Platform must be ios, android, or web' 
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check if token already exists
    const existingToken = user.deviceTokens.find(
      dt => dt.token === token && dt.platform === platform
    );

    if (existingToken) {
      // Update last used time
      existingToken.lastUsedAt = new Date();
    } else {
      // Add new token
      user.deviceTokens.push({
        token,
        platform,
        registeredAt: new Date(),
        lastUsedAt: new Date()
      });
    }

    await user.save();

    res.json({ 
      success: true, 
      message: 'Device token registered successfully' 
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

// Unregister device token
router.delete('/unregister-token/:token', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.deviceTokens = user.deviceTokens.filter(
      dt => dt.token !== req.params.token
    );
    await user.save();

    res.json({ 
      success: true, 
      message: 'Device token unregistered successfully' 
    });
  } catch (error) {
    console.error('Error unregistering device token:', error);
    res.status(500).json({ error: 'Failed to unregister device token' });
  }
});

module.exports = router;
```

### 6. Mobile App: Install and Setup

```bash
# Install expo-notifications
cd mobile-app
npx expo install expo-notifications
```

### 7. Mobile App: Notification Service

```javascript
// mobile-app/services/notificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import ApiService from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.apiService = new ApiService();
  }

  async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    // Get Expo push token
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'a3678060-654a-4163-ae5e-85c04a80efd9' // From app.json
    })).data;

    // Determine platform
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    // Register token with backend
    try {
      await this.apiService.registerDeviceToken(token, platform);
      console.log('Device token registered:', token);
    } catch (error) {
      console.error('Error registering device token:', error);
    }

    return token;
  }

  setupNotificationListeners() {
    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      // You can show custom UI here if needed
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      
      // Navigate to relevant screen based on notification type
      if (data.type === 'match_change') {
        // Navigate to trip or match details
        // navigation.navigate('TripDetails', { tripId: data.tripId });
      }
    });
  }
}

export default new NotificationService();
```

### 8. Mobile App: API Service Method

```javascript
// Add to mobile-app/services/api.js

async registerDeviceToken(token, platform) {
  try {
    const response = await axios.post(
      `${this.baseURL}/notifications/register-token`,
      { token, platform },
      { headers: this.getHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error('Error registering device token:', error);
    throw error;
  }
}
```

### 9. Mobile App: Initialize on App Start

```javascript
// In App.js or main entry point
import NotificationService from './services/notificationService';

// On app mount
useEffect(() => {
  // Register for push notifications
  NotificationService.registerForPushNotifications();
  
  // Setup notification listeners
  NotificationService.setupNotificationListeners();
}, []);
```

---

## Testing Strategy

### Manual Testing
1. **Device Token Registration**:
   - Open app → Check console for token
   - Verify token saved in database
   - Check backend logs

2. **Notification Delivery**:
   - Manually trigger match change detection
   - Verify notification received on device
   - Test with app open and closed

3. **Notification Interaction**:
   - Tap notification → Verify navigation
   - Test notification while app foregrounded

### Automated Testing
- Unit tests for detection logic
- Integration tests for notification service
- Mock Expo Push API responses

---

## Next Steps

1. **Start with Phase 1** (Push Notifications)
2. **Test thoroughly** before adding email
3. **Add email service** once push is stable
4. **Iterate based on user feedback**

---

## Questions to Resolve

1. **Notification frequency**: How often should we check for changes? (Recommended: 6 hours)
2. **Notification batching**: Group multiple changes or send individually?
3. **Notification content**: What level of detail? (Match name, old vs new date/time)
4. **Error handling**: Retry strategy for failed notifications?

---

## Estimated Timeline

- **Phase 1 (Push)**: 2-3 days
- **Phase 2 (Email)**: 1-2 days
- **Total**: 3-5 days for complete implementation

**Recommendation**: Start Phase 1 now, add email once push is working and tested.

