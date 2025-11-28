import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import UnifiedSearchScreen from './screens/UnifiedSearchScreen';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
import WorkOSLoginScreen from './screens/WorkOSLoginScreen';
import MessagesScreen from './screens/MessagesScreen';
import AttendedMatchesScreen from './screens/AttendedMatchesScreen';
import AccountScreen from './screens/AccountScreen';
import { ItineraryProvider } from './contexts/ItineraryContext';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { validateEnvironmentVariables } from './utils/envValidation';

// Validate environment variables on app startup
// This now uses fallbacks instead of crashing
try {
  validateEnvironmentVariables();
} catch (error) {
  // Log error but don't crash - validation should handle fallbacks
  console.error('⚠️ Environment validation error:', error.message);
  // Don't throw - let the app continue with fallback values
}

// Loading screen component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#1976d2" />
  </View>
);

// Authentication stack navigator
function AuthStack() {
  const Stack = createStackNavigator();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#f5f5f5' }
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
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
            backgroundColor: '#1976d2',
          },
          headerTintColor: '#fff',
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

// Main app component with authentication
function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1976d2" />
      {isAuthenticated() ? (
        <FilterProvider>
          <ItineraryProvider>
            <Tab.Navigator
              initialRouteName="SearchTab"
              screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: '#1976d2',
                tabBarInactiveTintColor: '#888',
                tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#eee' },
                tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
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
                      iconName = 'memory';
                      break;
                    case 'TripsTab':
                      iconName = 'work-outline';
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
              <Tab.Screen name="UnifiedSearchTab" component={UnifiedSearchScreen} options={{ tabBarLabel: 'Unified' }} />
              <Tab.Screen name="MemoriesTab" component={MemoriesStack} options={{ tabBarLabel: 'Memories' }} />
              <Tab.Screen name="TripsTab" component={TripsStack} options={{ tabBarLabel: 'Trips' }} />
              <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
              <Tab.Screen name="AccountTab" component={AccountScreen} options={{ tabBarLabel: 'Profile' }} />
            </Tab.Navigator>
          </ItineraryProvider>
        </FilterProvider>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


