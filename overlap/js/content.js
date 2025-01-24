'use strict';

// Function to convert date string to YYYY-MM-DD format
function formatDateForAPI(dateStr) {
    console.log('[Overlap] Formatting date:', dateStr);
    
    // Parse "Mon, Feb 3" format
    const parts = dateStr.split(', ');
    if (parts.length !== 2) {
        console.error('[Overlap] Unexpected date format:', dateStr);
        return null;
    }
    
    const [month, day] = parts[1].split(' ');
    
    // Map month names to numbers
    const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    // Get current year
    const currentYear = new Date().getFullYear();
    // If the month is earlier than current month, assume next year
    const currentMonth = new Date().getMonth(); // 0-11
    const targetMonth = Object.keys(monthMap).indexOf(month);
    const year = targetMonth < currentMonth ? currentYear + 1 : currentYear;
    
    // Pad day with leading zero if needed
    const paddedDay = day.padStart(2, '0');
    
    // Create a date object in the local timezone
    const date = new Date(`${year}-${monthMap[month]}-${paddedDay}T00:00:00`);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        console.error('[Overlap] Invalid date:', dateStr);
        return null;
    }
    
    // Format the date to YYYY-MM-DD
    const formattedDate = date.toISOString().split('T')[0];
    console.log('[Overlap] Formatted date:', formattedDate);
    return formattedDate;
}

// Function to send dates to background script
function sendDatesToBackground(dates) {
    // Format the dates before sending
    const formattedDates = {
        departure: formatDateForAPI(dates.departure),
        return: formatDateForAPI(dates.return)
    };
    
    console.log('[Overlap] Sending formatted dates to background script:', formattedDates);

    if (formattedDates.departure && formattedDates.return) {
        chrome.runtime.sendMessage({
            type: 'DATES_SELECTED',
            data: formattedDates
        }, response => {
            if (chrome.runtime.lastError) {
                console.error('[Overlap] Error sending dates to background:', chrome.runtime.lastError);
            } else {
                console.log('[Overlap] Successfully sent dates to background, response:', response);
            }
        });
    } else {
        console.error('[Overlap] Could not format dates properly:', dates);
    }
}

function findFlightDates() {
    console.log('[Overlap] Looking for date elements on page');
    
    // Find the departure and return input elements
    const departureInput = document.querySelector('input[aria-label="Departure"]');
    const returnInput = document.querySelector('input[aria-label="Return"]');
    
    if (departureInput && returnInput) {
        // Get the values directly from the input elements
        const dates = {
            departure: departureInput.value,
            return: returnInput.value
        };
        
        // Only proceed if both dates are selected
        if (dates.departure && dates.return) {
            console.log('[Overlap] Found dates:', dates);
            sendDatesToBackground(dates);
        } else {
            console.log('[Overlap] Waiting for both dates to be selected');
        }
    }
}

// Function to check if we're on Google Flights
function isGoogleFlights(url) {
    return url.includes('google.com/travel/flights');
}

// Initialize
console.log('[Overlap] Content script starting...');

// Set up click event listeners for date inputs
document.addEventListener('click', (event) => {
    // Check if the clicked element is a date input and NOT a location input
    const ariaLabel = event.target.getAttribute('aria-label');
    if (ariaLabel === 'Departure' || ariaLabel === 'Return') {
        console.log('[Overlap] Date input clicked:', ariaLabel);
        setTimeout(findFlightDates, 500); // Small delay to allow date selection to complete
    }
});

// Set up URL change detection
let lastUrl = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        if (isGoogleFlights(currentUrl)) {
            console.log('[Overlap] URL changed, checking for dates');
            setTimeout(findFlightDates, 1000);
        }
    }
}).observe(document, { subtree: true, childList: true });

// Initial check
if (isGoogleFlights(location.href)) {
    setTimeout(findFlightDates, 1000);
}