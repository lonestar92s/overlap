import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

/**
 * SINGLE SOURCE OF TRUTH FOR MATCH TIME DISPLAY
 * ==============================================
 * 
 * CORE PRINCIPLE: Always show match times in the STADIUM'S LOCAL TIME
 * 
 * Use Case: User in Chicago planning to travel to London for a 7pm match
 * - API returns: 2025-03-15T19:00:00Z (7pm UTC)  
 * - We show: "7:00 PM GMT" (London local time)
 * - NOT: "1:00 PM CST" (Chicago time) ❌
 * 
 * This helps users:
 * - Plan dinner reservations around match times
 * - Book transportation to/from stadium
 * - Understand local kickoff time for their trip
 */

// Helper function to get timezone from coordinates
export const getTimezoneFromCoordinates = (coordinates) => {
    if (!coordinates || coordinates.length !== 2) {
        return 'UTC';
    }
    
    const [longitude, latitude] = coordinates;
    
    // Europe
    if (latitude >= 35 && latitude <= 71) {
        if (longitude >= -10 && longitude <= 2) return 'Europe/London';      // UK, Ireland, Portugal
        if (longitude > 2 && longitude <= 7.5) return 'Europe/Paris';        // France, Belgium, Netherlands
        if (longitude > 7.5 && longitude <= 15) return 'Europe/Berlin';      // Germany, Switzerland, Austria
        if (longitude > 15 && longitude <= 20) return 'Europe/Rome';         // Italy
        if (longitude > 20 && longitude <= 30) return 'Europe/Warsaw';       // Poland, Czech Republic
        if (longitude > 30 && longitude <= 40) return 'Europe/Istanbul';     // Turkey, Eastern Europe
        if (longitude > 40) return 'Europe/Moscow';                          // Russia
    }
    
    // Americas
    if (longitude >= -180 && longitude <= -30) {
        if (latitude >= 25 && latitude <= 70) {  // North America
            if (longitude >= -125 && longitude <= -115) return 'America/Los_Angeles';  // Pacific
            if (longitude > -115 && longitude <= -105) return 'America/Denver';        // Mountain
            if (longitude > -105 && longitude <= -85) return 'America/Chicago';        // Central
            if (longitude > -85 && longitude <= -65) return 'America/New_York';        // Eastern
        }
        if (latitude >= -60 && latitude < 25) {  // South & Central America
            if (longitude >= -85 && longitude <= -75) return 'America/Bogota';         // Colombia
            if (longitude > -75 && longitude <= -65) return 'America/Lima';            // Peru
            if (longitude > -65 && longitude <= -55) return 'America/Sao_Paulo';       // Brazil East
            if (longitude > -55 && longitude <= -45) return 'America/Argentina/Buenos_Aires'; // Argentina
            if (longitude > -45 && longitude <= -30) return 'America/Sao_Paulo';       // Brazil Coast
        }
    }
    
    // Asia
    if (latitude >= -10 && latitude <= 70 && longitude >= 30 && longitude <= 180) {
        if (longitude >= 30 && longitude <= 45) return 'Asia/Dubai';         // UAE, Saudi Arabia
        if (longitude > 45 && longitude <= 60) return 'Asia/Karachi';        // Pakistan
        if (longitude > 60 && longitude <= 75) return 'Asia/Kolkata';        // India
        if (longitude > 75 && longitude <= 90) return 'Asia/Bangkok';        // Thailand, Myanmar
        if (longitude > 90 && longitude <= 105) return 'Asia/Shanghai';      // China
        if (longitude > 105 && longitude <= 125) return 'Asia/Tokyo';        // Japan, Korea
        if (longitude > 125 && longitude <= 140) return 'Asia/Tokyo';        // Japan
        if (longitude > 140) return 'Asia/Tokyo';                            // Far East
    }
    
    // Africa
    if (latitude >= -35 && latitude <= 35 && longitude >= -20 && longitude <= 50) {
        if (longitude >= -20 && longitude <= 0) return 'Africa/Casablanca';  // Morocco, West Africa
        if (longitude > 0 && longitude <= 20) return 'Africa/Lagos';         // Nigeria, Central Africa
        if (longitude > 20 && longitude <= 35) return 'Africa/Cairo';        // Egypt, Sudan
        if (longitude > 35 && longitude <= 50) return 'Africa/Nairobi';      // Kenya, East Africa
    }
    
    // Australia & Oceania
    if (latitude >= -50 && latitude <= -10 && longitude >= 110 && longitude <= 180) {
        if (longitude >= 110 && longitude <= 130) return 'Australia/Perth';   // Western Australia
        if (longitude > 130 && longitude <= 150) return 'Australia/Sydney';   // Eastern Australia
        if (longitude > 150 && longitude <= 180) return 'Pacific/Auckland';   // New Zealand
    }
    
    return 'UTC'; // Default to UTC if no specific timezone is found
};

// Get timezone abbreviation for display (e.g., "JST", "GMT", "EST")
export const getTimezoneAbbreviation = (timeZone, date) => {
    try {
        const formatter = new Intl.DateTimeFormat('en', {
            timeZone,
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(date);
        const timeZonePart = parts.find(part => part.type === 'timeZoneName');
        return timeZonePart ? timeZonePart.value : timeZone.split('/')[1] || 'UTC';
    } catch (error) {
        // Fallback for unsupported timezones
        return timeZone.split('/')[1] || 'UTC';
    }
};

/**
 * PRIMARY FUNCTION: Format match date/time in stadium's local timezone
 * 
 * @param {string} utcDate - ISO date string from API (e.g., "2025-03-15T19:00:00Z")
 * @param {object} venue - Venue object with coordinates array [longitude, latitude]
 * @returns {object} Formatted date/time components in stadium's local time
 * 
 * Usage Examples:
 * - Match cards: `const { time, timeZone } = formatMatchDateTime(fixture.date, venue)`
 * - Trip planning: `const { fullDateTime } = formatMatchDateTime(match.date, venue)`
 * - Map popups: `const { date, time } = formatMatchDateTime(match.fixture.date, venue)`
 */
export const formatMatchDateTime = (utcDate, venue) => {
    if (!utcDate) {
        return {
            date: 'TBD',
            time: 'TBD',
            fullDate: 'Date TBD',
            fullDateTime: 'Date & Time TBD',
            timeZone: 'UTC',
            timeZoneId: 'UTC',
            groupDate: null
        };
    }
    
    // Create date object from UTC string
    const date = new Date(utcDate);
    
    // Get venue timezone, default to UTC if no coordinates
    let timeZone = 'UTC';
    if (venue?.coordinates) {
        timeZone = getTimezoneFromCoordinates(venue.coordinates);
    }
    
    // Convert UTC date to venue's timezone
    const zonedDate = utcToZonedTime(date, timeZone);
    
    // Get timezone abbreviation for display
    const tzAbbr = getTimezoneAbbreviation(timeZone, zonedDate);
    
    // Format the date and time in the venue's timezone
    return {
        date: format(zonedDate, 'EEE, MMM d'),              // "Sat, Mar 15"
        time: format(zonedDate, 'h:mm a'),                  // "7:00 PM"
        fullDate: format(zonedDate, 'EEE, MMM d, yyyy'),    // "Sat, Mar 15, 2025"
        fullDateTime: format(zonedDate, 'EEE, MMM d, yyyy h:mm a'), // "Sat, Mar 15, 2025 7:00 PM"
        timeZone: tzAbbr,                                   // "GMT"
        timeZoneId: timeZone,                               // "Europe/London"
        // Keep groupDate in UTC to ensure consistent grouping across timezones
        groupDate: format(date, 'yyyy-MM-dd')              // "2025-03-15"
    };
};

/**
 * SIMPLIFIED FUNCTION: For attended matches (date only, no time)
 */
export const formatAttendedMatchDate = (date, venue) => {
    if (!date) return 'Date not set';
    
    const matchDate = new Date(date);
    if (isNaN(matchDate.getTime())) return 'Invalid date';
    
    // Get venue timezone, default to UTC
    let timeZone = 'UTC';
    if (venue?.coordinates) {
        timeZone = getTimezoneFromCoordinates(venue.coordinates);
    }
    
    // Convert to venue's timezone
    const zonedDate = utcToZonedTime(matchDate, timeZone);
    
    // Return just the date (no time for attended matches)
    return format(zonedDate, 'MMM d, yyyy');
};

/**
 * UTILITY FUNCTION: For admin/debug purposes (shows user's local time)
 * Use sparingly - only for non-match-related timestamps
 */
export const formatUserLocalTime = (utcDate) => {
    if (!utcDate) return 'N/A';
    
    const date = new Date(utcDate);
    return date.toLocaleString();
}; 