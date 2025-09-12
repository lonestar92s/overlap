import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Button, StyleSheet } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';


import SearchScreen from './screens/SearchScreen';
import MapResultsScreen from './screens/MapResultsScreen';
import ResultsScreen from './screens/ResultsScreen';
import MemoriesScreen from './screens/MemoriesScreen';
import AddMemoryScreen from './screens/AddMemoryScreen';
import MemoriesMapScreen from './screens/MemoriesMapScreen';
import TripsListScreen from './screens/TripsListScreen';
import TripOverviewScreen from './screens/TripOverviewScreen';
import ItineraryMapScreen from './screens/ItineraryMapScreen';
import TripMapView from './screens/TripMapView';
import { ItineraryProvider } from './contexts/ItineraryContext';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';

// Placeholder / basic screens for other tabs
const MessagesScreen = () => <></>;
const AccountScreen = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.accountContainer}>
      <Text style={styles.accountTitle}>Account</Text>
      {!!user?.email && <Text style={styles.accountSubtitle}>{user.email}</Text>}
      <View style={styles.logoutButtonWrapper}>
        <Button title="Logout" color="#d32f2f" onPress={handleLogout} />
      </View>
    </View>
  );
};

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
        name="MemoriesMap"
        component={MemoriesMapScreen}
      />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated()) {
    return (
      <NavigationContainer>
        <StatusBar style="light" backgroundColor="#1976d2" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1976d2" />
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
            return <Icon name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="SearchTab" component={SearchStack} options={{ tabBarLabel: 'Search' }} />
        <Tab.Screen name="MemoriesTab" component={MemoriesStack} options={{ tabBarLabel: 'Memories' }} />
        <Tab.Screen name="TripsTab" component={TripsStack} options={{ tabBarLabel: 'Trips' }} />
        <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
        <Tab.Screen name="AccountTab" component={AccountScreen} options={{ tabBarLabel: 'Account' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <FilterProvider>
      <ItineraryProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </ItineraryProvider>
    </FilterProvider>
  );
}

const styles = StyleSheet.create({
  accountContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  accountTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  accountSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  logoutButtonWrapper: {
    marginTop: 8,
    width: 160,
  },
});


