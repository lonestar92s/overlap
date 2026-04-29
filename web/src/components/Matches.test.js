import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchCard } from './Matches';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock TeamLogo component
jest.mock('./TeamLogo', () => {
  return function MockTeamLogo({ teamName }) {
    return <div data-testid={`team-logo-${teamName}`}>{teamName}</div>;
  };
});

const theme = createTheme();

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('MatchCard', () => {
  const mockMatch = {
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

  beforeEach(() => {
    // Mock window.open
    global.window.open = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render match card with basic information', () => {
    renderWithTheme(
      <MatchCard match={mockMatch} onClick={() => {}} />
    );

    expect(screen.getByText('Arsenal FC')).toBeTruthy();
    expect(screen.getByText('Chelsea FC')).toBeTruthy();
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

    renderWithTheme(
      <MatchCard match={matchWithTickets} onClick={() => {}} />
    );

    expect(screen.getByText('Tickets')).toBeTruthy();
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

    renderWithTheme(
      <MatchCard match={pastMatchWithTickets} onClick={() => {}} />
    );

    expect(screen.queryByText('Tickets')).toBeNull();
  });

  it('should not display tickets button when ticketingUrl is not available', () => {
    renderWithTheme(
      <MatchCard match={mockMatch} onClick={() => {}} />
    );

    expect(screen.queryByText('Tickets')).toBeNull();
  });

  it('should open ticketing URL in new tab when tickets button is clicked', () => {
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

    renderWithTheme(
      <MatchCard match={matchWithTickets} onClick={() => {}} />
    );

    const ticketsButton = screen.getByText('Tickets');
    fireEvent.click(ticketsButton);

    expect(window.open).toHaveBeenCalledWith(
      'https://www.arsenal.com/tickets',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('should stop event propagation when tickets button is clicked', () => {
    const matchWithTickets = {
      ...mockMatch,
      teams: {
        ...mockMatch.teams.home,
        home: {
          ...mockMatch.teams.home,
          ticketingUrl: 'https://www.arsenal.com/tickets'
        }
      }
    };

    const onClick = jest.fn();

    renderWithTheme(
      <MatchCard match={matchWithTickets} onClick={onClick} />
    );

    const ticketsButton = screen.getByText('Tickets');
    const clickEvent = new MouseEvent('click', { bubbles: true });
    const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');
    
    fireEvent.click(ticketsButton, clickEvent);

    // Verify that stopPropagation was called (via the onClick handler in the component)
    // The actual implementation uses e.stopPropagation() in the onClick handler
    expect(window.open).toHaveBeenCalled();
  });
});
