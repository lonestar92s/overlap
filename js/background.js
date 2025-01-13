'use strict';

// Function to fetch matches from the API
async function fetchMatches(startDate, endDate) {
    console.log('[Overlap - API] Fetching matches:', { startDate, endDate });
    
    const API_KEY = '2a9e46d07879477e9e4b1506101a299f';
    const COMPETITION_ID = 'PL'; // Premier League
    
    // Format dates for API (YYYY-MM-DD)
    const formatDateForApi = (dateStr) => {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formattedStartDate = formatDateForApi(startDate);
    const formattedEndDate = formatDateForApi(endDate);
    
    try {
        const url = `https://api.football-data.org/v4/competitions/${COMPETITION_ID}/matches`;
        const params = new URLSearchParams({
            dateFrom: formattedStartDate,
            dateTo: formattedEndDate
        });

        console.log('[Overlap - API] Making request to:', url);
        console.log('[Overlap - API] Request parameters:', {
            dateFrom: formattedStartDate,
            dateTo: formattedEndDate,
            competitions: COMPETITION_ID,
            apiKey: API_KEY.substring(0, 8) + '...' // Log only part of the API key for security
        });

        const response = await fetch(`${url}?${params.toString()}`, {
            headers: {
                'X-Auth-Token': API_KEY
            }
        });

        console.log('[Overlap - API] Response status:', response.status);
        console.log('[Overlap - API] Response headers:', {
            'X-Requests-Available-Minute': response.headers.get('X-Requests-Available-Minute'),
            'X-RequestCounter-Reset': response.headers.get('X-RequestCounter-Reset')
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Overlap - API] Error response:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
                url: response.url,
                dates: {
                    original: { startDate, endDate },
                    formatted: { formattedStartDate, formattedEndDate }
                }
            });
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // Log detailed API response
        console.log('[Overlap - API] Full API Response:', JSON.stringify(data, null, 2));
        
        // Log specific match details
        if (data.matches && data.matches.length > 0) {
            console.log('[Overlap - API] First match details:', {
                homeTeam: data.matches[0].homeTeam,
                awayTeam: data.matches[0].awayTeam,
                venue: data.matches[0].venue,
                area: data.matches[0].area,
                competition: data.matches[0].competition,
                fullMatch: data.matches[0]
            });
            
            // Log all venues
            console.log('[Overlap - API] All match venues:', data.matches.map(match => ({
                homeTeam: match.homeTeam.name,
                awayTeam: match.awayTeam.name,
                venue: match.venue,
                stadium: match.homeTeam.venue // Check if venue info is in homeTeam
            })));
        }
        
        if (!data.matches) {
            console.warn('[Overlap - API] No matches array in response:', data);
            return [];
        }
        
        return data.matches;
    } catch (error) {
        console.error('[Overlap - API] Error fetching matches:', error);
        throw error;
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Overlap - Background] Received message:', message);
    
    if (message.type === 'DATES_SELECTED') {
        console.log('[Overlap - Background] Processing dates:', message.data);
        
        // Fetch matches and store them
        fetchMatches(message.data.departure, message.data.return)
            .then(matches => {
                console.log('[Overlap - Background] Storing matches:', matches);
                
                // Store both the matches and flight dates
                chrome.storage.local.set({
                    matches: matches,
                    flightDates: message.data
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.error('[Overlap - Background] Error storing data:', chrome.runtime.lastError);
                        sendResponse({ status: 'error', error: chrome.runtime.lastError });
                    } else {
                        console.log('[Overlap - Background] Data stored successfully');
                        sendResponse({ status: 'success' });
                    }
                });
            })
            .catch(error => {
                console.error('[Overlap - Background] Error processing matches:', error);
                sendResponse({ status: 'error', error: error.message });
            });
            
        return true; // Keep the message channel open for async response
    }
}); 