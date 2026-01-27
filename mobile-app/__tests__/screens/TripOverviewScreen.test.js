import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import TripOverviewScreen from '../../screens/TripOverviewScreen';
import { ItineraryProvider } from '../../contexts/ItineraryContext';
import ApiService from '../../services/api';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn((callback) => callback()),
}));

// Mock components that might not be available in test environment
jest.mock('../../components/MatchCard', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return (props) => <View><Text>MatchCard Mock</Text></View>;
});

jest.mock('../../components/HeartButton', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View testID="heart-button" />;
});

jest.mock('../../components/MatchPlanningModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View testID="match-planning-modal" />;
});

jest.mock('../../components/AddFlightModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View testID="add-flight-modal" />;
});

jest.mock('../../components/HomeBaseSection', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View testID="home-base-section" />;
});

// Mock the useItineraries hook
const mockUseItineraries = jest.fn();
jest.mock('../../contexts/ItineraryContext', () => ({
  ...jest.requireActual('../../contexts/ItineraryContext'),
  useItineraries: mockUseItineraries,
}));

jest.mock('../../hooks/useRecommendations', () => ({
  useRecommendations: () => ({
    recommendations: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    dismiss: jest.fn(),
    addToTrip: jest.fn(),
  }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()), // Return cleanup function
};

const mockRoute = {
  params: {
    itineraryId: 'test-trip-id',
  },
};

const renderTripOverviewScreen = (navigation = mockNavigation, route = mockRoute) => {
  return render(
    <NavigationContainer>
      <ItineraryProvider>
        <TripOverviewScreen navigation={navigation} route={route} />
      </ItineraryProvider>
    </NavigationContainer>
  );
};

describe('TripOverviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Trip Loading Logic', () => {
    it('should load trip from context without API call when trip exists in context', async () => {
      // Mock trip data
      const mockTrip = {
        id: 'test-trip-id',
        _id: 'test-trip-id',
        name: 'Test Trip',
        description: 'Test Description',
        matches: [],
      };

      // Configure the mock to return trip from context
      mockUseItineraries.mockReturnValue({
        getItineraryById: jest.fn(() => mockTrip),
        updateMatchPlanning: jest.fn(),
        addMatchToItinerary: jest.fn(),
        deleteItinerary: jest.fn(),
        refreshItinerary: jest.fn(),
        updateItinerary: jest.fn(),
        itineraries: [mockTrip],
        loading: false,
      });

      // Mock API service to track calls
      const mockGetTripById = jest.fn();
      ApiService.getTripById = mockGetTripById;

      renderTripOverviewScreen();

      // Wait for component to render and verify no API calls
      await waitFor(() => {
        expect(mockGetTripById).not.toHaveBeenCalled();
      });
    });

    it('should fetch trip from API when trip is not in context', async () => {
      // Configure mock to return null (trip not found in context)
      mockUseItineraries.mockReturnValue({
        getItineraryById: jest.fn(() => null),
        updateMatchPlanning: jest.fn(),
        addMatchToItinerary: jest.fn(),
        deleteItinerary: jest.fn(),
        refreshItinerary: jest.fn(),
        updateItinerary: jest.fn(),
        itineraries: [],
        loading: false,
      });

      // Mock successful API response
      const mockApiResponse = {
        success: true,
        data: {
          id: 'test-trip-id',
          _id: 'test-trip-id',
          name: 'API Trip',
          description: 'From API',
          matches: [],
        },
      };
      const mockGetTripById = jest.fn().mockResolvedValue(mockApiResponse);
      ApiService.getTripById = mockGetTripById;

      renderTripOverviewScreen();

      // Wait for API call
      await waitFor(() => {
        expect(mockGetTripById).toHaveBeenCalledWith('test-trip-id');
      });
    });

    it('should navigate back when trip is deleted (404) and not in context', async () => {
      // Configure mock to return null (trip not found in context)
      mockUseItineraries.mockReturnValue({
        getItineraryById: jest.fn(() => null),
        updateMatchPlanning: jest.fn(),
        addMatchToItinerary: jest.fn(),
        deleteItinerary: jest.fn(),
        refreshItinerary: jest.fn(),
        updateItinerary: jest.fn(),
        itineraries: [],
        loading: false,
      });

      // Mock API response for deleted trip
      const mockApiResponse = {
        success: false,
        error: 'Trip not found',
        status: 404,
      };
      const mockGetTripById = jest.fn().mockResolvedValue(mockApiResponse);
      ApiService.getTripById = mockGetTripById;

      renderTripOverviewScreen();

      // Wait for navigation to be called
      await waitFor(() => {
        expect(mockNavigation.goBack).toHaveBeenCalled();
      });
    });

    it('should not attempt API call when trip exists in context (preventing deleted trip errors)', async () => {
      // This test specifically verifies the fix for the reported issue:
      // When a user deletes their only trip, the screen should not try to fetch it from API

      const mockTrip = {
        id: 'deleted-trip-id',
        _id: 'deleted-trip-id',
        name: 'Deleted Trip',
        description: 'This trip was deleted',
        matches: [],
      };

      // Configure mock to return the trip (simulating it exists in context)
      mockUseItineraries.mockReturnValue({
        getItineraryById: jest.fn(() => mockTrip),
        updateMatchPlanning: jest.fn(),
        addMatchToItinerary: jest.fn(),
        deleteItinerary: jest.fn(),
        refreshItinerary: jest.fn(),
        updateItinerary: jest.fn(),
        itineraries: [mockTrip], // Trip still in context
        loading: false,
      });

      // Mock API service - if called, it would return 404, but it shouldn't be called
      const mockGetTripById = jest.fn().mockResolvedValue({
        success: false,
        error: 'Trip not found',
        status: 404,
      });
      ApiService.getTripById = mockGetTripById;

      const routeWithDeletedTrip = {
        params: { itineraryId: 'deleted-trip-id' },
      };

      renderTripOverviewScreen(mockNavigation, routeWithDeletedTrip);

      // Verify that API is not called when trip exists in context
      await waitFor(() => {
        expect(mockGetTripById).not.toHaveBeenCalled();
      });

      // Verify navigation back is not called (since trip exists in context)
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });
  });
});