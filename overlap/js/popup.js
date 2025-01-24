'use strict';

import { getVenueForTeam } from './venues.js';

console.log('popup.js is running');
// Function to format date for display
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Function to format time for display in local venue time
function formatTime(dateStr, venueInfo) {
    const date = new Date(dateStr);
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleTimeString([], options);
}

// Helper function to display no matches message
function displayNoMatchesMessage(container, message) {
    container.innerHTML = `<p class="no-matches">${message}</p>`;
}

// Function to display matches
function displayMatches(matches) {
    console.log('[Overlap - Popup] Displaying matches:', matches);
    
    const container = document.getElementById('matches-container');
    const loadingElement = document.getElementById('loading-message');

    if (!matches || matches.length === 0) {
        console.log('[Overlap - Popup] No matches to display');
        displayNoMatchesMessage(container, 'No matches found during your travel dates.');
        loadingElement.style.display = 'none';
        return;
    }

    const travelDates = JSON.parse(localStorage.getItem('flightDates'));
    const departureDate = new Date(travelDates.departure);
    const returnDate = new Date(travelDates.return);

    // Filter matches within the travel dates
    const filteredMatches = matches.filter(match => {
        const matchDate = new Date(match.utcDate.split('T')[0]);
        return matchDate >= departureDate && matchDate <= returnDate;
    });

    if (filteredMatches.length === 0) {
        console.log('[Overlap - Popup] No matches within the selected date range');
        displayNoMatchesMessage(container, 'No matches found within your travel dates.');
        loadingElement.style.display = 'none';
        return;
    }

    // Group matches by date
    const matchesByDate = {};
    filteredMatches.forEach(match => {
        const date = match.utcDate.split('T')[0];
        if (!matchesByDate[date]) {
            matchesByDate[date] = [];
        }
        matchesByDate[date].push(match);
    });
    
    console.log('[Overlap - Popup] Matches grouped by date:', matchesByDate);
    
    // Clear container and hide loading message
    container.innerHTML = '';
    loadingElement.style.display = 'none';
    
    // Display matches grouped by date
    Object.keys(matchesByDate).sort().forEach(date => {
        const dateMatches = matchesByDate[date];
        
        // Create date header
        const dateHeader = document.createElement('h2');
        dateHeader.className = 'date-header';
        dateHeader.textContent = formatDate(date);
        container.appendChild(dateHeader);
        
        // Create matches list for this date
        const matchesList = document.createElement('div');
        matchesList.className = 'matches-list';
        
        dateMatches.forEach(match => {
            const venueInfo = getVenueForTeam(match.homeTeam.name);
            const matchElement = document.createElement('div');
            matchElement.className = 'match-item';
            matchElement.innerHTML = `
                <div class="match-time">${formatTime(match.utcDate, venueInfo)}</div>
                <div class="match-teams">
                    <div class="team">
                        <img src="${match.homeTeam.crest}" alt="${match.homeTeam.shortName}" class="team-crest">
                        <span>${match.homeTeam.shortName}</span>
                    </div>
                    <div class="vs">vs</div>
                    <div class="team">
                        <img src="${match.awayTeam.crest}" alt="${match.awayTeam.shortName}" class="team-crest">
                        <span>${match.awayTeam.shortName}</span>
                    </div>
                </div>
                ${venueInfo ? `<div class="venue">🏟️ ${venueInfo.stadium} (${venueInfo.location})</div>` : ''}
            `;
            matchesList.appendChild(matchElement);
        });
        
        container.appendChild(matchesList);
    });
}

// Function to update travel dates display
function updateDatesDisplay(dates) {
    console.log('[Overlap - Popup] Updating dates display:', dates);
    
    const datesContainer = document.getElementById('travel-dates');
    if (dates && dates.departure && dates.return) {
        datesContainer.innerHTML = `
            <div class="date-item">
                <span class="date-label">Departure:</span>
                <span class="date-value">${formatDate(dates.departure)}</span>
            </div>
            <div class="date-item">
                <span class="date-label">Return:</span>
                <span class="date-value">${formatDate(dates.return)}</span>
            </div>
        `;
    } else {
        datesContainer.innerHTML = '<p>No travel dates selected</p>';
    }
}

// Load and display matches when popup opens
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Overlap - Popup] Popup opened, loading matches...');
    
    // Check if the script is running
    console.log('[Overlap - Popup] Script is running');
    
    chrome.storage.local.get(['matches', 'flightDates'], (result) => {
        console.log('[Overlap - Popup] Retrieved from storage:', result);
        console.log('[Overlap - Popup] Matches:', result.matches);
        console.log('[Overlap - Popup] Flight Dates:', result.flightDates);
        
        if (result.flightDates) {
            updateDatesDisplay(result.flightDates);
            localStorage.setItem('flightDates', JSON.stringify(result.flightDates));
        }

        if (result.matches) {
            console.log('[Overlap - Popup] Calling displayMatches with:', result.matches);
            displayMatches(result.matches);
        } else {
            console.log('[Overlap - Popup] No matches found in storage');
            const container = document.getElementById('matches-container');
            container.innerHTML = '<p class="no-matches">No matches found. Try selecting travel dates in Google Flights.</p>';
            document.getElementById('loading-message').style.display = 'none';
        }
    });
}); 