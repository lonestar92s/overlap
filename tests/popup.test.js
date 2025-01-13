import { formatDate, formatTime } from '../js/popup.js';

describe('Popup Date Formatting', () => {
    test('formatDate should format dates correctly', () => {
        const testDate = '2025-02-15T15:00:00Z';
        const formatted = formatDate(testDate);
        expect(formatted).toMatch(/^[A-Za-z]{3}, [A-Za-z]{3} \d{1,2}, 2025$/);
    });
});

describe('Popup Time Formatting', () => {
    test('formatTime should format times in UK timezone', () => {
        const testDate = '2025-02-15T15:00:00Z';
        const venueInfo = {
            stadium: 'Test Stadium',
            location: 'London'
        };
        const formatted = formatTime(testDate, venueInfo);
        expect(formatted).toMatch(/^\d{1,2}:\d{2} [AP]M UK$/);
    });
});

describe('Match Display', () => {
    test('displayMatches should handle empty matches array', () => {
        document.body.innerHTML = `
            <div id="matches-container"></div>
            <div id="loading-message"></div>
        `;
        
        displayMatches([]);
        
        const container = document.getElementById('matches-container');
        expect(container.innerHTML).toContain('No matches found');
    });
    
    test('displayMatches should group matches by date', () => {
        const testMatches = [
            {
                utcDate: '2025-02-15T15:00:00Z',
                homeTeam: { name: 'Arsenal FC', shortName: 'ARS', crest: 'test.png' },
                awayTeam: { name: 'Chelsea FC', shortName: 'CHE', crest: 'test.png' }
            },
            {
                utcDate: '2025-02-15T17:30:00Z',
                homeTeam: { name: 'Liverpool FC', shortName: 'LIV', crest: 'test.png' },
                awayTeam: { name: 'Manchester City FC', shortName: 'MCI', crest: 'test.png' }
            }
        ];
        
        document.body.innerHTML = `
            <div id="matches-container"></div>
            <div id="loading-message"></div>
        `;
        
        displayMatches(testMatches);
        
        const container = document.getElementById('matches-container');
        expect(container.querySelectorAll('.match-item').length).toBe(2);
        expect(container.querySelectorAll('.date-header').length).toBe(1);
    });
}); 