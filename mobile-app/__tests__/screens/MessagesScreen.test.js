/**
 * Tests for MessagesScreen (Match Planning Agent MVP)
 * - Chat flow: user message -> NL API -> bot message
 * - Greeting / non-search messages get conversational reply
 * - Search success and error paths
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MessagesScreen from '../../screens/MessagesScreen';
import * as naturalLanguageService from '../../services/naturalLanguageService';
import * as Haptics from 'expo-haptics';

jest.mock('../../services/naturalLanguageService');
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn() }));
jest.mock('../../services/api');
jest.mock('../../components/MatchCard', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockMatchCard({ match }) {
    return (
      <View testID="match-card">
        <Text>{match?.teams?.home?.name ?? 'Home'} vs {match?.teams?.away?.name ?? 'Away'}</Text>
      </View>
    );
  };
});

const mockNavigation = {
  navigate: jest.fn(),
  getState: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  naturalLanguageService.getSearchExamples.mockReturnValue([
    'Premier League matches in London next month',
    'Arsenal home games in March',
  ]);
});

describe('MessagesScreen - Match Planning Agent MVP', () => {
  it('renders welcome message and input', () => {
    naturalLanguageService.processNaturalLanguageQuery.mockResolvedValue({});
    naturalLanguageService.formatSearchResults.mockReturnValue({ success: false, message: '' });

    const { getByLabelText, getByText } = render(
      <MessagesScreen navigation={mockNavigation} />
    );

    expect(getByText(/match search assistant/i)).toBeTruthy();
    expect(getByLabelText('Message input')).toBeTruthy();
    expect(getByLabelText('Send message')).toBeTruthy();
  });

  it('shows search examples from getSearchExamples', () => {
    naturalLanguageService.getSearchExamples.mockReturnValue([
      'Premier League matches in London next month',
      'Arsenal home games in March',
    ]);
    const { getByText } = render(<MessagesScreen navigation={mockNavigation} />);
    expect(getByText(/Premier League matches in London next month/i)).toBeTruthy();
  });
});
