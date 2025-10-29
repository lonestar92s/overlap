import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Alert, Text } from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';
import { Button } from 'react-native-elements';

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
import { ItineraryProvider } from './contexts/ItineraryContext';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Account screen with logout functionality
const AccountScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleViewAttendedMatches = () => {
    navigation.navigate('MemoriesTab');
  };

  return (
    <View style={styles.accountContainer}>
      <View style={styles.accountHeader}>
        <MaterialIcons name="account-circle" size={80} color="#1976d2" />
        <Text style={styles.accountTitle}>Profile</Text>
        <Text style={styles.accountEmail}>{user?.email}</Text>
      </View>
      
      <View style={styles.accountActions}>
        <Button
          title="View Match Memories"
          onPress={handleViewAttendedMatches}
          buttonStyle={styles.attendedMatchesButton}
          titleStyle={styles.attendedMatchesButtonTitle}
          icon={<MaterialIcons name="memory" size={20} color="#fff" />}
        />
        <Button
          title="Logout"
          onPress={handleLogout}
          buttonStyle={styles.logoutButton}
          titleStyle={styles.logoutButtonTitle}
        />
      </View>
    </View>
  );
};

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
  accountContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  accountHeader: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  accountTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  accountEmail: {
    fontSize: 16,
    color: '#666',
  },
  accountActions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendedMatchesButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginBottom: 16,
  },
  attendedMatchesButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  logoutButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


