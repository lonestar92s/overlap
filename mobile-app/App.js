import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import SearchScreen from './screens/SearchScreen';
import MapResultsScreen from './screens/MapResultsScreen';
import ResultsScreen from './screens/ResultsScreen';
import SavedScreen from './screens/SavedScreen';
import { SavedMatchesProvider } from './contexts/SavedMatchesContext';

// Placeholder screens for other tabs
const TripsScreen = () => <></>;
const MessagesScreen = () => <></>;
const AccountScreen = () => <></>;

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

export default function App() {
  return (
    <SavedMatchesProvider>
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
              case 'SavedTab':
                iconName = 'favorite-border';
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
        <Tab.Screen name="SavedTab" component={SavedScreen} options={{ tabBarLabel: 'Saved' }} />
        <Tab.Screen name="TripsTab" component={TripsScreen} options={{ tabBarLabel: 'Trips' }} />
        <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
        <Tab.Screen name="AccountTab" component={AccountScreen} options={{ tabBarLabel: 'Account' }} />
      </Tab.Navigator>
      </NavigationContainer>
    </SavedMatchesProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
