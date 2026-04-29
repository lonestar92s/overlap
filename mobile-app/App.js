import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import UnifiedSearchScreen from './screens/UnifiedSearchScreen';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography } from './styles/designTokens';
import NotificationService from './services/notifications';
import { executeNotificationPayload } from './utils/notificationDeepLink';

import SearchScreen from './screens/SearchScreen';
import MapResultsScreen from './screens/MapResultsScreen';
import ResultsScreen from './screens/ResultsScreen';
import MemoriesScreen from './screens/MemoriesScreen';
import AddMemoryScreen from './screens/AddMemoryScreen';
import EditMemoryScreen from './screens/EditMemoryScreen';
import MemoriesMapScreen from './screens/MemoriesMapScreen';
import TripsListScreen from './screens/TripsListScreen';
import TripOverviewScreen from './screens/TripOverviewScreen';
import ItineraryMapScreen from './screens/ItineraryMapScreen';
import TripMapView from './screens/TripMapView';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import WorkOSLoginScreen from './screens/WorkOSLoginScreen';
import MessagesScreen from './screens/MessagesScreen';
import AttendedMatchesScreen from './screens/AttendedMatchesScreen';
import AccountScreen from './screens/AccountScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import { NotificationInboxProvider, useNotificationInbox } from './contexts/NotificationInboxContext';
import { ItineraryProvider } from './contexts/ItineraryContext';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { validateEnvironmentVariables } from './utils/envValidation';
import { FEATURE_FLAGS } from './utils/featureFlags';

const rootNavigationRef = createNavigationContainerRef();

// Validate environment variables on app startup
// In production, this will fail fast if required variables are missing
// In development, warnings are logged but app continues with fallbacks
try {
  validateEnvironmentVariables();
} catch (error) {
  // In production, fail fast - required environment variables must be set
  if (!__DEV__) {
    console.error('❌ Environment validation failed:', error.message);
    throw error; // Crash the app in production if required vars are missing
  }
  // In development, log warning but allow app to continue with fallbacks
  console.error('⚠️ Environment validation error:', error.message);
}

// Loading screen component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
);

// Authentication stack navigator
function AuthStack() {
  const Stack = createStackNavigator();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen 
        name="WorkOSLogin" 
        component={WorkOSLoginScreen}
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function SearchStack() {
  return (
      <Stack.Navigator
        initialRouteName="Search"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MapResults"
        component={MapResultsScreen}
        options={{
          headerShown: false,
          }}
        />
        <Stack.Screen
          name="Results"
          component={ResultsScreen}
          options={{
            title: 'Match Results',
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="AttendedMatches"
          component={AttendedMatchesScreen}
          options={{
            title: 'Attended Matches',
            headerTitleAlign: 'center',
          }}
        />
      </Stack.Navigator>
  );
}

function TripsStack() {
  return (
    <Stack.Navigator
      initialRouteName="TripsList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="TripsList"
        component={TripsListScreen}
      />
      <Stack.Screen
        name="TripOverview"
        component={TripOverviewScreen}
      />
      <Stack.Screen
        name="ItineraryMap"
        component={ItineraryMapScreen}
      />
      <Stack.Screen
        name="TripMapView"
        component={TripMapView}
      />
    </Stack.Navigator>
  );
}

function MemoriesStack() {
  return (
    <Stack.Navigator
      initialRouteName="Memories"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Memories"
        component={MemoriesScreen}
      />
      <Stack.Screen
        name="AddMemory"
        component={AddMemoryScreen}
      />
      <Stack.Screen
        name="EditMemory"
        component={EditMemoryScreen}
      />
      <Stack.Screen
        name="MemoriesMap"
        component={MemoriesMapScreen}
      />
    </Stack.Navigator>
  );
}

function AccountStack() {
  return (
    <Stack.Navigator
      initialRouteName="Account"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Account"
        component={AccountScreen}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
      />
    </Stack.Navigator>
  );
}

function NotificationsStack() {
  return (
    <Stack.Navigator
      initialRouteName="NotificationsList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="NotificationsList"
        component={NotificationsScreen}
      />
    </Stack.Navigator>
  );
}

function AuthenticatedTabs() {
  const { unreadCount, refreshUnreadCount } = useNotificationInbox();

  useEffect(() => {
    const sub = NotificationService.addNotificationReceivedListener(() => {
      refreshUnreadCount();
    });
    return () => sub.remove();
  }, [refreshUnreadCount]);

  const notificationsBadge =
    unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined;

  return (
    <FilterProvider>
      <ItineraryProvider>
        <Tab.Navigator
          initialRouteName="SearchTab"
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.text.secondary,
            tabBarStyle: { backgroundColor: colors.card, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
            tabBarLabelStyle: { fontSize: typography.caption.fontSize, fontWeight: '500' },
            tabBarIcon: ({ color, size }) => {
              let iconName;
              switch (route.name) {
                case 'SearchTab':
                  iconName = 'search';
                  break;
                case 'UnifiedSearchTab':
                  iconName = 'manage-search';
                  break;
                case 'MemoriesTab':
                  iconName = 'photo-camera';
                  break;
                case 'TripsTab':
                  iconName = 'work-outline';
                  break;
                case 'NotificationsTab':
                  iconName = 'notifications';
                  break;
                case 'MessagesTab':
                  iconName = 'chat-bubble-outline';
                  break;
                case 'AccountTab':
                  iconName = 'person-outline';
                  break;
                default:
                  iconName = 'circle';
              }
              return <MaterialIcons name={iconName} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="SearchTab" component={SearchStack} options={{ tabBarLabel: 'Search' }} />
          {FEATURE_FLAGS.enableUnifiedSearchTab && (
            <Tab.Screen name="UnifiedSearchTab" component={UnifiedSearchScreen} options={{ tabBarLabel: 'Unified' }} />
          )}
          <Tab.Screen name="MemoriesTab" component={MemoriesStack} options={{ tabBarLabel: 'Memories' }} />
          <Tab.Screen
            name="TripsTab"
            component={TripsStack}
            options={{ tabBarLabel: 'Trips' }}
            listeners={({ navigation }) => ({
              tabPress: (e) => {
                const state = navigation.getState();
                const tripsTabState = state?.routes?.find((r) => r.name === 'TripsTab')?.state;
                const currentScreen = tripsTabState?.routes?.[tripsTabState.index]?.name;
                const currentParams = tripsTabState?.routes?.[tripsTabState.index]?.params;

                if (currentScreen === 'TripOverview' && currentParams?.fromAccountTab === true) {
                  e.preventDefault();
                  navigation.navigate('TripsTab', {
                    screen: 'TripsList',
                  });
                }
              },
            })}
          />
          <Tab.Screen
            name="NotificationsTab"
            component={NotificationsStack}
            options={{
              tabBarLabel: 'Alerts',
              tabBarBadge: notificationsBadge,
            }}
          />
          {FEATURE_FLAGS.enableMessagesTab && (
            <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
          )}
          <Tab.Screen name="AccountTab" component={AccountStack} options={{ tabBarLabel: 'Profile' }} />
        </Tab.Navigator>
      </ItineraryProvider>
    </FilterProvider>
  );
}

// Main app component with authentication
function AppContent() {
  const { isAuthenticated, loading, user } = useAuth();
  const coldStartNotificationHandledRef = useRef(false);
  const notificationActionInFlightRef = useRef(new Set());
  const pendingNotificationOpenRef = useRef(null);

  const handleNotificationOpen = async (response) => {
    if (!rootNavigationRef.isReady()) {
      pendingNotificationOpenRef.current = response;
      return;
    }
    pendingNotificationOpenRef.current = null;

    const data = response?.notification?.request?.content?.data;
    const logId = data?.notificationLogId != null && data.notificationLogId !== '' ? String(data.notificationLogId) : null;
    if (logId && notificationActionInFlightRef.current.has(logId)) {
      return;
    }
    if (logId) {
      notificationActionInFlightRef.current.add(logId);
    }
    try {
      await executeNotificationPayload(data, rootNavigationRef, { skipRecordOpened: false });
    } finally {
      if (logId) {
        notificationActionInFlightRef.current.delete(logId);
      }
    }
  };

  const onNavigationReady = () => {
    const pending = pendingNotificationOpenRef.current;
    if (pending) {
      pendingNotificationOpenRef.current = null;
      handleNotificationOpen(pending);
    }
  };

  useEffect(() => {
    const subscription = NotificationService.addNotificationResponseListener((response) => {
      handleNotificationOpen(response);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      coldStartNotificationHandledRef.current = false;
      return;
    }
    if (loading) return;

    let cancelled = false;
    (async () => {
      if (coldStartNotificationHandledRef.current) return;
      coldStartNotificationHandledRef.current = true;
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!cancelled && response) {
          await handleNotificationOpen(response);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('getLastNotificationResponseAsync:', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (loading) {
    return <LoadingScreen />;
  }

  const inboxEnabled = isAuthenticated() && !loading;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <NotificationInboxProvider enabled={inboxEnabled}>
          <NavigationContainer ref={rootNavigationRef} onReady={onNavigationReady}>
            <StatusBar style="light" backgroundColor={colors.primary} />
            {isAuthenticated() ? <AuthenticatedTabs /> : <AuthStack />}
          </NavigationContainer>
        </NotificationInboxProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


