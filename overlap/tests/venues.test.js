import { getVenueForTeam, TEAM_VENUES } from '../js/venues.js';

describe('Venue Data', () => {
    test('all teams should have stadium and location data', () => {
        Object.entries(TEAM_VENUES).forEach(([team, data]) => {
            expect(data.stadium).toBeTruthy();
            expect(data.location).toBeTruthy();
        });
    });
});

describe('Venue Lookup', () => {
    test('getVenueForTeam should return correct venue for valid team', () => {
        const venue = getVenueForTeam('Arsenal FC');
        expect(venue).toEqual({
            stadium: 'Emirates Stadium',
            location: 'London'
        });
    });

    test('getVenueForTeam should return null for invalid team', () => {
        const venue = getVenueForTeam('Invalid Team FC');
        expect(venue).toBeNull();
    });

    test('all Premier League teams should have venue data', () => {
        const teams = [
            'Arsenal FC',
            'Aston Villa FC',
            'AFC Bournemouth',
            'Brighton & Hove Albion FC',
            'Chelsea FC',
            'Crystal Palace FC',
            'Everton FC',
            'Liverpool FC',
            'Manchester City FC',
            'Manchester United FC',
            'Newcastle United FC',
            'Nottingham Forest FC',
            'Tottenham Hotspur FC',
            'West Ham United FC',
            'Wolverhampton Wanderers FC'
        ];

        teams.forEach(team => {
            const venue = getVenueForTeam(team);
            expect(venue).not.toBeNull();
            expect(venue.stadium).toBeTruthy();
            expect(venue.location).toBeTruthy();
        });
    });
}); 