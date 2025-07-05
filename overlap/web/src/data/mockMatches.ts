import { CarouselMatch } from '../types/matches';

export const mockMatches: CarouselMatch[] = [
  {
    id: '1',
    homeTeam: {
      name: 'Manchester United',
      crest: '/crests/man-utd.png'
    },
    awayTeam: {
      name: 'Liverpool',
      crest: '/crests/liverpool.png'
    },
    stadium: {
      name: 'Old Trafford',
      city: 'Manchester',
      country: 'England'
    },
    kickoff: '2024-03-30T15:00:00Z',
    competition: {
      name: 'Premier League'
    }
  },
  {
    id: '2',
    homeTeam: {
      name: 'Arsenal',
      crest: '/crests/arsenal.png'
    },
    awayTeam: {
      name: 'Tottenham',
      crest: '/crests/tottenham.png'
    },
    stadium: {
      name: 'Emirates Stadium',
      city: 'London',
      country: 'England'
    },
    kickoff: '2024-04-02T19:45:00Z',
    competition: {
      name: 'Premier League'
    }
  },
  {
    id: '3',
    homeTeam: {
      name: 'Bayern Munich',
      crest: '/crests/bayern.png'
    },
    awayTeam: {
      name: 'Borussia Dortmund',
      crest: '/crests/dortmund.png'
    },
    stadium: {
      name: 'Allianz Arena',
      city: 'Munich',
      country: 'Germany'
    },
    kickoff: '2024-04-06T17:30:00Z',
    competition: {
      name: 'Bundesliga'
    }
  },
  {
    id: '4',
    homeTeam: {
      name: 'Real Madrid',
      crest: '/crests/real-madrid.png'
    },
    awayTeam: {
      name: 'Barcelona',
      crest: '/crests/barcelona.png'
    },
    stadium: {
      name: 'Santiago Bernabéu',
      city: 'Madrid',
      country: 'Spain'
    },
    kickoff: '2024-04-13T20:00:00Z',
    competition: {
      name: 'La Liga'
    }
  },
  {
    id: '5',
    homeTeam: {
      name: 'AC Milan',
      crest: '/crests/milan.png'
    },
    awayTeam: {
      name: 'Inter Milan',
      crest: '/crests/inter.png'
    },
    stadium: {
      name: 'San Siro',
      city: 'Milan',
      country: 'Italy'
    },
    kickoff: '2024-04-20T19:45:00Z',
    competition: {
      name: 'Serie A'
    }
  }
]; 