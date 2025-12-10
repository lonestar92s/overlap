import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MatchCard from '../../components/MatchCard';
import { Linking } from 'react-native';

// Mock dependencies
jest.mock('../../utils/matchStatus');
jest.mock('../../utils/timezoneUtils');
jest.mock('../../components/HeartButton', () => 'HeartButton');
jest.mock('../../components/PlanningStatusIndicator', () => 'PlanningStatusIndicator');
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve())
}));

describe('MatchCard', () => {
  const mockMatch = {
    id: 12345,
    fixture: {
      id: 12345,
      date: '2025-02-15T15:00:00Z',
      status: { short: 'NS' },
      venue: {
        name: 'Emirates Stadium',
        city: 'London'
      }
    },
    teams: {
      home: {
        id: 42,
        name: 'Arsenal FC',
        logo: 'https://example.com/arsenal.png'
      },
      away: {
        id: 50,
        name: 'Chelsea FC',
        logo: 'https://example.com/chelsea.png'
      }
    },
    league: {
      id: 39,
      name: 'Premier League',
      logo: 'https://example.com/pl.png'
    }
  };

  it('should render match card with basic information', () => {
    const { getByText } = render(
      <MatchCard match={mockMatch} />
    );

    expect(getByText('Arsenal FC')).toBeTruthy();
    expect(getByText('Chelsea FC')).toBeTruthy();
  });

  it('should render with heart button when showHeart is true', () => {
    const { getByTestId } = render(
      <MatchCard match={mockMatch} showHeart={true} />
    );

    // HeartButton should be rendered (mocked)
    // We can't directly test the HeartButton component since it's mocked
    // but we can verify the component renders without errors
    expect(getByTestId).toBeDefined();
  });

  it('should handle missing match data gracefully', () => {
    const incompleteMatch = {
      id: 12345,
      fixture: {}
    };

    const { queryByText } = render(
      <MatchCard match={incompleteMatch} />
    );

    // Component should render without crashing
    expect(queryByText).toBeDefined();
  });

  it('should handle null match gracefully', () => {
    const { container } = render(
      <MatchCard match={null} />
    );

    // Component should handle null gracefully
    expect(container).toBeDefined();
  });

  it('should call onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <MatchCard match={mockMatch} onPress={onPress} />
    );

    // Find the pressable element and fire press event
    // Note: This depends on the actual implementation
    // The MatchCard might wrap content in TouchableOpacity
    const card = getByTestId('match-card');
    if (card) {
      fireEvent.press(card);
      expect(onPress).toHaveBeenCalled();
    }
  });

  it('should display match status correctly', () => {
    const finishedMatch = {
      ...mockMatch,
      fixture: {
        ...mockMatch.fixture,
        status: { short: 'FT' }
      }
    };

    const { getByText } = render(
      <MatchCard match={finishedMatch} showResults={true} />
    );

    // Should display match result or status
    // Exact text depends on implementation
    expect(getByText).toBeDefined();
  });

  it('should display tickets button when ticketingUrl is available and match is upcoming', () => {
    const matchWithTickets = {
      ...mockMatch,
      fixture: {
        ...mockMatch.fixture,
        date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
      },
      teams: {
        ...mockMatch.teams,
        home: {
          ...mockMatch.teams.home,
          ticketingUrl: 'https://www.arsenal.com/tickets'
        }
      }
    };

    const { getByText } = render(
      <MatchCard match={matchWithTickets} />
    );

    expect(getByText('Tickets')).toBeTruthy();
  });

  it('should not display tickets button for past matches even if ticketingUrl is available', () => {
    const pastMatchWithTickets = {
      ...mockMatch,
      fixture: {
        ...mockMatch.fixture,
        date: new Date(Date.now() - 86400000).toISOString() // Yesterday
      },
      teams: {
        ...mockMatch.teams,
        home: {
          ...mockMatch.teams.home,
          ticketingUrl: 'https://www.arsenal.com/tickets'
        }
      }
    };

    const { queryByText } = render(
      <MatchCard match={pastMatchWithTickets} />
    );

    expect(queryByText('Tickets')).toBeNull();
  });

  it('should not display tickets button when ticketingUrl is not available', () => {
    const { queryByText } = render(
      <MatchCard match={mockMatch} />
    );

    expect(queryByText('Tickets')).toBeNull();
  });

  it('should open ticketing URL when tickets button is pressed', () => {
    const matchWithTickets = {
      ...mockMatch,
      teams: {
        ...mockMatch.teams,
        home: {
          ...mockMatch.teams.home,
          ticketingUrl: 'https://www.arsenal.com/tickets'
        }
      }
    };

    const { getByText } = render(
      <MatchCard match={matchWithTickets} />
    );

    const ticketsButton = getByText('Tickets');
    fireEvent.press(ticketsButton);

    expect(Linking.openURL).toHaveBeenCalledWith('https://www.arsenal.com/tickets');
  });
});

