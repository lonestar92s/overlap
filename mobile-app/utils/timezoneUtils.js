/**
 * Timezone utilities for displaying match times in venue local time
 */

/**
 * Validate if a timezone string is valid
 * @param {string} timezone - Timezone string to validate
 * @returns {boolean} - True if timezone is valid
 */
export const isValidTimezone = (timezone) => {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }
  
  // List of known valid timezones
  const validTimezones = [
    'UTC',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Europe/Amsterdam',
    'Europe/Brussels',
    'Europe/Vienna',
    'Europe/Zurich',
    'Europe/Stockholm',
    'Europe/Oslo',
    'Europe/Copenhagen',
    'Europe/Helsinki',
    'Europe/Warsaw',
    'Europe/Prague',
    'Europe/Budapest',
    'Europe/Bucharest',
    'Europe/Sofia',
    'Europe/Athens',
    'Europe/Istanbul',
    'Europe/Moscow',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Buenos_Aires',
    'America/Lima',
    'America/Bogota',
    'America/Caracas',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Asia/Seoul',
    'Asia/Dubai',
    'Asia/Riyadh',
    'Asia/Kolkata',
    'Australia/Sydney',
    'Australia/Melbourne',
    'Pacific/Auckland'
  ];
  
  return validTimezones.includes(timezone);
};

/**
 * Get venue timezone from fixture data
 * @param {Object} fixture - Fixture object from API
 * @returns {string} - Timezone string (e.g., "UTC", "Europe/London")
 */
export const getVenueTimezone = (fixture) => {
  if (!fixture) return 'UTC';
  
  // Use timezone from API if available and valid
  if (fixture.timezone && fixture.timezone !== 'UTC' && isValidTimezone(fixture.timezone)) {
    return fixture.timezone;
  }
  
  // Try to determine timezone from venue coordinates
  if (fixture.venue?.coordinates) {
    const timezone = getTimezoneFromCoordinates(fixture.venue.coordinates);
    if (timezone && isValidTimezone(timezone)) {
      return timezone;
    }
  }
  
  // Try to determine timezone from venue city/country
  if (fixture.venue?.city || fixture.venue?.country) {
    const timezone = getTimezoneFromLocation(fixture.venue.city, fixture.venue.country);
    if (timezone && isValidTimezone(timezone)) {
      return timezone;
    }
  }
  
  // Fallback to UTC if no valid timezone can be determined
  return 'UTC';
};

/**
 * Get timezone from coordinates using reverse geocoding
 * @param {Array} coordinates - [longitude, latitude]
 * @returns {string|null} - Timezone string or null
 */
export const getTimezoneFromCoordinates = (coordinates) => {
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    return null;
  }
  
  const [lng, lat] = coordinates;
  
  // Timezone mapping based on coordinates for major football venues
  // This is a simplified approach - in production you'd use a timezone API
  const timezoneMap = {
    // England (Premier League venues)
    '51.5074,-0.1278': 'Europe/London',      // London (Emirates, Stamford Bridge, etc.)
    '53.4808,-2.2426': 'Europe/London',      // Manchester (Old Trafford, Etihad)
    '53.4084,-2.9916': 'Europe/London',      // Liverpool (Anfield, Goodison)
    '52.4862,-1.8904': 'Europe/London',      // Birmingham (Villa Park)
    '52.9548,-1.1581': 'Europe/London',      // Nottingham (City Ground)
    '53.8008,-1.5491': 'Europe/London',      // Leeds (Elland Road)
    '53.4308,-2.9608': 'Europe/London',      // Stoke (Bet365 Stadium)
    '52.2053,0.1218': 'Europe/London',       // Cambridge area
    '51.4545,-2.5879': 'Europe/London',      // Bristol (Ashton Gate)
    '50.9097,-1.4044': 'Europe/London',      // Southampton (St Mary's)
    '50.7184,-3.5339': 'Europe/London',      // Exeter (St James Park)
    '51.4816,-3.1791': 'Europe/London',      // Cardiff (Cardiff City Stadium)
    
    // Scotland
    '55.9533,-3.1883': 'Europe/London',      // Edinburgh (Tynecastle, Easter Road)
    '55.8642,-4.2518': 'Europe/London',      // Glasgow (Celtic Park, Ibrox)
    
    // Wales
    '51.4816,-3.1791': 'Europe/London',      // Cardiff (Cardiff City Stadium)
    
    // Northern Ireland
    '54.5973,-5.9301': 'Europe/London',      // Belfast (Windsor Park)
    
    // Republic of Ireland
    '53.3498,-6.2603': 'Europe/London',      // Dublin (Aviva Stadium)
    
    // Spain (La Liga)
    '40.4168,-3.7038': 'Europe/Madrid',      // Madrid (Santiago Bernabéu, Metropolitano)
    '41.3851,2.1734': 'Europe/Madrid',       // Barcelona (Camp Nou, RCDE Stadium)
    '37.3891,-5.9845': 'Europe/Madrid',      // Seville (Ramón Sánchez Pizjuán)
    '43.2627,-2.9253': 'Europe/Madrid',      // Bilbao (San Mamés)
    
    // Germany (Bundesliga)
    '52.5200,13.4050': 'Europe/Berlin',      // Berlin (Olympiastadion)
    '48.1351,11.5820': 'Europe/Berlin',      // Munich (Allianz Arena)
    '50.9375,6.9603': 'Europe/Berlin',       // Cologne (RheinEnergieStadion)
    '53.5511,9.9937': 'Europe/Berlin',       // Hamburg (Volksparkstadion)
    
    // Italy (Serie A)
    '41.9028,12.4964': 'Europe/Rome',        // Rome (Stadio Olimpico)
    '45.4642,9.1900': 'Europe/Rome',          // Milan (San Siro)
    '40.8518,14.2681': 'Europe/Rome',        // Naples (Diego Armando Maradona)
    '44.4056,8.9463': 'Europe/Rome',          // Genoa (Luigi Ferraris)
    
    // France (Ligue 1)
    '48.8566,2.3522': 'Europe/Paris',        // Paris (Parc des Princes, Stade de France)
    '43.2965,5.3698': 'Europe/Paris',        // Marseille (Orange Vélodrome)
    '45.7640,4.8357': 'Europe/Paris',        // Lyon (Groupama Stadium)
    
    // Netherlands (Eredivisie)
    '52.3676,4.9041': 'Europe/Amsterdam',    // Amsterdam (Johan Cruyff Arena)
    '51.9225,4.4792': 'Europe/Amsterdam',    // Rotterdam (De Kuip)
    
    // Portugal (Primeira Liga)
    '38.7223,-9.1393': 'Europe/Lisbon',      // Lisbon (Estádio da Luz)
    '41.1579,-8.6291': 'Europe/Porto',       // Porto (Estádio do Dragão)
    
    // Belgium (Jupiler Pro League)
    '50.8503,4.3517': 'Europe/Brussels',     // Brussels (King Power at Den Dreef)
    
    // Turkey (Süper Lig)
    '39.9334,32.8597': 'Europe/Istanbul',    // Istanbul (various stadiums)
    
    // USA (MLS)
    '40.7128,-74.0060': 'America/New_York',  // New York (Yankee Stadium, Red Bull Arena)
    '34.0522,-118.2437': 'America/Los_Angeles', // LA (Banc of California Stadium)
    '41.8781,-87.6298': 'America/Chicago',   // Chicago (Soldier Field)
    '39.7392,-104.9903': 'America/Denver',   // Denver (Dick's Sporting Goods Park)
    
    // Canada (MLS)
    '43.6532,-79.3832': 'America/Toronto',   // Toronto (BMO Field)
    '49.2827,-123.1207': 'America/Vancouver', // Vancouver (BC Place)
    
    // Mexico (Liga MX)
    '19.4326,-99.1332': 'America/Mexico_City', // Mexico City (Estadio Azteca)
    '32.0649,-115.0077': 'America/Tijuana',  // Tijuana (Estadio Caliente)
    
    // Brazil (Série A)
    '-23.5505,-46.6333': 'America/Sao_Paulo', // São Paulo (various stadiums)
    '-22.9068,-43.1729': 'America/Sao_Paulo', // Rio de Janeiro (Maracanã)
    
    // Argentina (Primera División)
    '-34.6118,-58.3960': 'America/Argentina/Buenos_Aires', // Buenos Aires (various stadiums)
    
    // Japan (J1 League)
    '35.6762,139.6503': 'Asia/Tokyo',        // Tokyo (various stadiums)
    '34.6937,135.5023': 'Asia/Tokyo',        // Osaka (various stadiums)
    
    // South Korea (K League)
    '37.5665,126.9780': 'Asia/Seoul',        // Seoul (various stadiums)
    
    // China (Chinese Super League)
    '39.9042,116.4074': 'Asia/Shanghai',     // Beijing (various stadiums)
    '31.2304,121.4737': 'Asia/Shanghai',     // Shanghai (various stadiums)
    
    // Australia (A-League)
    '-33.8688,151.2093': 'Australia/Sydney', // Sydney (various stadiums)
    '-37.8136,144.9631': 'Australia/Melbourne', // Melbourne (various stadiums)
    
    // South Africa (Premier Soccer League)
    '-26.2041,28.0473': 'Africa/Johannesburg', // Johannesburg (various stadiums)
    '-33.9249,18.4241': 'Africa/Johannesburg', // Cape Town (various stadiums)
  };
  
  // Round coordinates to 2 decimal places for approximate matching
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  const coordKey = `${roundedLat},${roundedLng}`;
  
  // Find closest match
  let closestTimezone = null;
  let minDistance = Infinity;
  
  for (const [key, timezone] of Object.entries(timezoneMap)) {
    const [mapLat, mapLng] = key.split(',').map(Number);
    const distance = Math.sqrt(
      Math.pow(roundedLat - mapLat, 2) + Math.pow(roundedLng - mapLng, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestTimezone = timezone;
    }
  }
  
  // Only return timezone if it's reasonably close (within ~1 degree)
  if (minDistance < 1.0) {
    return closestTimezone;
  }
  
  return null;
};

/**
 * Get timezone from city/country information
 * @param {string} city - City name
 * @param {string} country - Country name
 * @returns {string|null} - Timezone string or null
 */
export const getTimezoneFromLocation = (city, country) => {
  if (!city && !country) return null;
  
  // City-based timezone mapping
  const cityTimezoneMap = {
    // England
    'London': 'Europe/London',
    'Manchester': 'Europe/London',
    'Liverpool': 'Europe/London',
    'Birmingham': 'Europe/London',
    'Leeds': 'Europe/London',
    'Sheffield': 'Europe/London',
    'Newcastle': 'Europe/London',
    'Bristol': 'Europe/London',
    'Southampton': 'Europe/London',
    'Cardiff': 'Europe/London',
    
    // Scotland
    'Edinburgh': 'Europe/London',
    'Glasgow': 'Europe/London',
    'Aberdeen': 'Europe/London',
    
    // Spain
    'Madrid': 'Europe/Madrid',
    'Barcelona': 'Europe/Madrid',
    'Seville': 'Europe/Madrid',
    'Valencia': 'Europe/Madrid',
    'Bilbao': 'Europe/Madrid',
    
    // Germany
    'Berlin': 'Europe/Berlin',
    'Munich': 'Europe/Berlin',
    'Hamburg': 'Europe/Berlin',
    'Cologne': 'Europe/Berlin',
    'Frankfurt': 'Europe/Berlin',
    
    // Italy
    'Rome': 'Europe/Rome',
    'Milan': 'Europe/Rome',
    'Naples': 'Europe/Rome',
    'Turin': 'Europe/Rome',
    'Florence': 'Europe/Rome',
    
    // France
    'Paris': 'Europe/Paris',
    'Marseille': 'Europe/Paris',
    'Lyon': 'Europe/Paris',
    'Toulouse': 'Europe/Paris',
    
    // Netherlands
    'Amsterdam': 'Europe/Amsterdam',
    'Rotterdam': 'Europe/Amsterdam',
    'The Hague': 'Europe/Amsterdam',
    
    // Portugal
    'Lisbon': 'Europe/Lisbon',
    'Porto': 'Europe/Lisbon',
    
    // Croatia
    'Zagreb': 'Europe/Zagreb',
    'Split': 'Europe/Zagreb',
    'Rijeka': 'Europe/Zagreb',
    
    // Belgium
    'Brussels': 'Europe/Brussels',
    'Antwerp': 'Europe/Brussels',
    
    // Turkey
    'Istanbul': 'Europe/Istanbul',
    'Ankara': 'Europe/Istanbul',
    'Izmir': 'Europe/Istanbul',
    
    // USA
    'New York': 'America/New_York',
    'Los Angeles': 'America/Los_Angeles',
    'Chicago': 'America/Chicago',
    'Houston': 'America/Chicago',
    'Phoenix': 'America/Denver',
    'Denver': 'America/Denver',
    
    // Canada
    'Toronto': 'America/Toronto',
    'Vancouver': 'America/Vancouver',
    'Montreal': 'America/Toronto',
    
    // Mexico
    'Mexico City': 'America/Mexico_City',
    'Guadalajara': 'America/Mexico_City',
    'Monterrey': 'America/Mexico_City',
    
    // Brazil
    'São Paulo': 'America/Sao_Paulo',
    'Rio de Janeiro': 'America/Sao_Paulo',
    'Brasília': 'America/Sao_Paulo',
    
    // Argentina
    'Buenos Aires': 'America/Argentina/Buenos_Aires',
    'Córdoba': 'America/Argentina/Buenos_Aires',
    'Rosario': 'America/Argentina/Buenos_Aires',
    
    // Japan
    'Tokyo': 'Asia/Tokyo',
    'Osaka': 'Asia/Tokyo',
    'Yokohama': 'Asia/Tokyo',
    
    // South Korea
    'Seoul': 'Asia/Seoul',
    'Busan': 'Asia/Seoul',
    'Incheon': 'Asia/Seoul',
    
    // China
    'Beijing': 'Asia/Shanghai',
    'Shanghai': 'Asia/Shanghai',
    'Guangzhou': 'Asia/Shanghai',
    
    // Australia
    'Sydney': 'Australia/Sydney',
    'Melbourne': 'Australia/Melbourne',
    'Brisbane': 'Australia/Sydney',
    'Perth': 'Australia/Perth',
    
    // South Africa
    'Johannesburg': 'Africa/Johannesburg',
    'Cape Town': 'Africa/Johannesburg',
    'Durban': 'Africa/Johannesburg',
  };
  
  // Try city first, then country
  if (city && cityTimezoneMap[city]) {
    return cityTimezoneMap[city];
  }
  
  // Country-based fallback
  const countryTimezoneMap = {
    'England': 'Europe/London',
    'Scotland': 'Europe/London',
    'Wales': 'Europe/London',
    'Northern Ireland': 'Europe/London',
    'Spain': 'Europe/Madrid',
    'Germany': 'Europe/Berlin',
    'Italy': 'Europe/Rome',
    'France': 'Europe/Paris',
    'Netherlands': 'Europe/Amsterdam',
    'Portugal': 'Europe/Lisbon',
    'Croatia': 'Europe/Zagreb',
    'Belgium': 'Europe/Brussels',
    'Turkey': 'Europe/Istanbul',
    'USA': 'America/New_York',
    'Canada': 'America/Toronto',
    'Mexico': 'America/Mexico_City',
    'Brazil': 'America/Sao_Paulo',
    'Argentina': 'America/Argentina/Buenos_Aires',
    'Japan': 'Asia/Tokyo',
    'South Korea': 'Asia/Seoul',
    'China': 'Asia/Shanghai',
    'Australia': 'Australia/Sydney',
    'South Africa': 'Africa/Johannesburg',
  };
  
  if (country && countryTimezoneMap[country]) {
    return countryTimezoneMap[country];
  }
  
  return null;
};

/**
 * Parse match date and convert to venue local time
 * @param {string} dateString - ISO date string from API (e.g., "2025-08-16T14:00:00+00:00")
 * @param {string} timezone - Venue timezone (e.g., "UTC", "Europe/London")
 * @returns {Date} - Date object in venue local time
 */
export const parseMatchDateToVenueTime = (dateString, timezone) => {
  if (!dateString) return new Date();
  
  try {
    // Parse the ISO string (which includes timezone offset)
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date string:', dateString);
      return new Date();
    }
    
    // If timezone is UTC, return as-is since the date string already has offset
    if (timezone === 'UTC') {
      return date;
    }
    
    // For other timezones, we need to convert from UTC to venue local time
    return convertToVenueTimezone(date, timezone);
  } catch (error) {
    console.error('Error parsing match date:', error);
    return new Date();
  }
};

/**
 * Convert UTC date to venue timezone
 * @param {Date} utcDate - Date object in UTC
 * @param {string} timezone - Target timezone (e.g., "Europe/London")
 * @returns {Date} - Date object in venue timezone
 */
export const convertToVenueTimezone = (utcDate, timezone) => {
  if (!utcDate || !timezone || timezone === 'UTC') {
    return utcDate;
  }
  
  try {
    // Get the timezone offset in minutes
    const timezoneOffset = getTimezoneOffset(timezone);
    
    // Create new date with timezone offset
    const venueDate = new Date(utcDate.getTime() + (timezoneOffset * 60 * 1000));
    
    return venueDate;
  } catch (error) {
    console.error('Error converting to venue timezone:', error);
    return utcDate;
  }
};

/**
 * Get timezone offset in minutes for common timezones
 * @param {string} timezone - Timezone string
 * @returns {number} - Offset in minutes from UTC
 */
export const getTimezoneOffset = (timezone) => {
  const timezoneOffsets = {
    // Europe
    'Europe/London': 60,     // BST (UTC+1) in summer, GMT (UTC+0) in winter
    'Europe/Paris': 120,     // CEST (UTC+2) in summer, CET (UTC+1) in winter
    'Europe/Berlin': 120,    // CEST (UTC+2) in summer, CET (UTC+1) in winter
    'Europe/Madrid': 120,    // CEST (UTC+2) in summer, CET (UTC+1) in winter
    'Europe/Rome': 120,      // CEST (UTC+2) in summer, CET (UTC+1) in winter
    'Europe/Amsterdam': 120, // CEST (UTC+2) in summer, CET (UTC+1) in winter
    'Europe/Zagreb': 120,    // CEST (UTC+2) in summer, CET (UTC+1) in winter
    
    // Americas
    'America/New_York': -240,    // EDT (UTC-4) in summer, EST (UTC-5) in winter
    'America/Chicago': -300,     // CDT (UTC-5) in summer, CST (UTC-6) in winter
    'America/Denver': -360,      // MDT (UTC-6) in summer, MST (UTC-7) in winter
    'America/Los_Angeles': -420, // PDT (UTC-7) in summer, PST (UTC-8) in winter
    'America/Toronto': -240,     // EDT (UTC-4) in summer, EST (UTC-5) in winter
    'America/Mexico_City': -300, // CDT (UTC-5) in summer, CST (UTC-6) in winter
    
    // Asia
    'Asia/Tokyo': 540,       // JST (UTC+9)
    'Asia/Shanghai': 480,    // CST (UTC+8)
    'Asia/Seoul': 540,       // KST (UTC+9)
    'Asia/Singapore': 480,   // SGT (UTC+8)
    'Asia/Dubai': 240,       // GST (UTC+4)
    'Asia/Kolkata': 330,     // IST (UTC+5:30)
    
    // Australia/Oceania
    'Australia/Sydney': 600, // AEST (UTC+10) in winter, AEDT (UTC+11) in summer
    'Australia/Melbourne': 600, // AEST (UTC+10) in winter, AEDT (UTC+11) in summer
    'Australia/Perth': 480,  // AWST (UTC+8)
    'Pacific/Auckland': 720, // NZST (UTC+12) in winter, NZDT (UTC+13) in summer
    
    // Africa
    'Africa/Cairo': 120,     // EET (UTC+2) in winter, EEST (UTC+3) in summer
    'Africa/Johannesburg': 120, // SAST (UTC+2)
    'Africa/Lagos': 60,      // WAT (UTC+1)
    
    // Default to UTC
    'UTC': 0
  };
  
  return timezoneOffsets[timezone] || 0;
};

/**
 * Format match time for display in venue local time
 * @param {string} dateString - ISO date string from API
 * @param {Object} fixture - Fixture object from API
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted time string (e.g., "3:00 PM (London Time)")
 */
export const formatMatchTimeInVenueTimezone = (dateString, fixture, options = {}) => {
  const {
    showTimezone = true,
    showDate = true,
    showYear = false,
    timeFormat = '12hour'
  } = options;
  
  try {
    const timezone = getVenueTimezone(fixture);
    
    // Validate timezone before using it
    const validTimezone = isValidTimezone(timezone) ? timezone : 'UTC';
    
    const venueDate = parseMatchDateToVenueTime(dateString, validTimezone);
    
    // Format time with fallback
    let timeString;
    try {
      if (timeFormat === '24hour') {
        timeString = venueDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: validTimezone
        });
      } else {
        timeString = venueDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: validTimezone
        });
      }
    } catch (timeError) {
      console.warn('Timezone formatting failed, using UTC fallback:', timeError);
      // Fallback to UTC formatting
      timeString = venueDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: timeFormat !== '24hour'
      });
    }
    
    // Format date with fallback
    let formattedDate = '';
    if (showDate) {
      try {
        const dateOptions = {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: validTimezone
        };
        
        if (showYear) {
          dateOptions.year = 'numeric';
        }
        
        formattedDate = venueDate.toLocaleDateString('en-US', dateOptions);
      } catch (dateError) {
        console.warn('Date formatting failed, using UTC fallback:', dateError);
        // Fallback to UTC formatting
        const fallbackOptions = {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        };
        if (showYear) {
          fallbackOptions.year = 'numeric';
        }
        formattedDate = venueDate.toLocaleDateString('en-US', fallbackOptions);
      }
    }
    
    // Build final string
    let result = timeString;
    if (formattedDate) {
      result = `${formattedDate} at ${timeString}`;
    }
    
    // Add timezone indicator in hybrid format: "GMT (London)"
    if (showTimezone) {
      const venueCity = fixture?.venue?.city;
      const timezoneLabel = getTimezoneLabel(validTimezone, venueDate, venueCity);
      result += ` (${timezoneLabel})`;
    }
    
    return result;
  } catch (error) {
    console.error('Error formatting match time:', error);
    return 'Time unavailable';
  }
};

/**
 * Get timezone abbreviation (e.g., GMT, CET, EST)
 * @param {string} timezone - Timezone string (e.g., "Europe/London")
 * @param {Date} date - Date to get abbreviation for (accounts for DST)
 * @returns {string} - Timezone abbreviation
 */
export const getTimezoneAbbreviation = (timezone, date = new Date()) => {
  try {
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    return timeZonePart ? timeZonePart.value : 'UTC';
  } catch (error) {
    // Fallback abbreviations for common timezones
    const fallbackAbbreviations = {
      'Europe/London': 'GMT',
      'Europe/Paris': 'CET',
      'Europe/Berlin': 'CET',
      'Europe/Madrid': 'CET',
      'Europe/Rome': 'CET',
      'Europe/Zagreb': 'CET',
      'America/New_York': 'EST',
      'America/Chicago': 'CST',
      'America/Los_Angeles': 'PST',
      'America/Toronto': 'EST',
      'Asia/Tokyo': 'JST',
      'Asia/Shanghai': 'CST',
      'Asia/Seoul': 'KST',
      'Asia/Singapore': 'SGT',
      'Australia/Sydney': 'AEST',
      'Australia/Melbourne': 'AEST',
      'Pacific/Auckland': 'NZST',
      'UTC': 'UTC'
    };
    return fallbackAbbreviations[timezone] || 'UTC';
  }
};

/**
 * Get city name from timezone
 * @param {string} timezone - Timezone string (e.g., "Europe/London")
 * @returns {string} - City name
 */
export const getCityFromTimezone = (timezone) => {
  const cityMap = {
    'Europe/London': 'London',
    'Europe/Paris': 'Paris',
    'Europe/Berlin': 'Berlin',
    'Europe/Madrid': 'Madrid',
    'Europe/Rome': 'Rome',
    'Europe/Zagreb': 'Zagreb',
    'Europe/Amsterdam': 'Amsterdam',
    'Europe/Brussels': 'Brussels',
    'Europe/Lisbon': 'Lisbon',
    'Europe/Istanbul': 'Istanbul',
    'America/New_York': 'New York',
    'America/Chicago': 'Chicago',
    'America/Los_Angeles': 'Los Angeles',
    'America/Toronto': 'Toronto',
    'America/Mexico_City': 'Mexico City',
    'America/Sao_Paulo': 'São Paulo',
    'America/Argentina/Buenos_Aires': 'Buenos Aires',
    'Asia/Tokyo': 'Tokyo',
    'Asia/Shanghai': 'Shanghai',
    'Asia/Seoul': 'Seoul',
    'Asia/Singapore': 'Singapore',
    'Asia/Dubai': 'Dubai',
    'Asia/Kolkata': 'Mumbai',
    'Australia/Sydney': 'Sydney',
    'Australia/Melbourne': 'Melbourne',
    'Pacific/Auckland': 'Auckland',
    'Africa/Johannesburg': 'Johannesburg',
    'UTC': 'UTC'
  };
  
  return cityMap[timezone] || timezone.split('/').pop().replace(/_/g, ' ');
};

/**
 * Get user-friendly timezone label in hybrid format
 * @param {string} timezone - Timezone string
 * @param {Date} date - Date for abbreviation (accounts for DST)
 * @param {string} venueCity - Optional venue city to use instead of timezone city
 * @returns {string} - Hybrid label like "GMT (London)"
 */
export const getTimezoneLabel = (timezone, date = new Date(), venueCity = null) => {
  if (timezone === 'UTC') {
    return venueCity ? `UTC (${venueCity})` : 'UTC';
  }
  
  const abbreviation = getTimezoneAbbreviation(timezone, date);
  const city = venueCity || getCityFromTimezone(timezone);
  
  return `${abbreviation} (${city})`;
};

/**
 * Get relative time (e.g., "in 2 hours", "2 hours ago")
 * @param {string} dateString - ISO date string from API
 * @param {Object} fixture - Fixture object from API
 * @returns {string} - Relative time string
 */
export const getRelativeMatchTime = (dateString, fixture) => {
  try {
    const timezone = getVenueTimezone(fixture);
    const venueDate = parseMatchDateToVenueTime(dateString, timezone);
    const now = new Date();
    
    const diffMs = venueDate.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < 0) {
      // Past
      if (Math.abs(diffHours) < 24) {
        return `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ago`;
      } else {
        return `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
      }
    } else {
      // Future
      if (diffHours < 24) {
        return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
      } else {
        return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      }
    }
  } catch (error) {
    console.error('Error getting relative time:', error);
    return '';
  }
};

/**
 * Test function to verify timezone conversion works correctly
 * Use this to test with your API response data
 */
export const testTimezoneConversion = () => {
  // Test with your actual API response data
  const testFixture = {
    timezone: "UTC",
    date: "2025-08-16T14:00:00+00:00",
    venue: {
      city: "London",
      country: "England",
      coordinates: [-0.1278, 51.5074] // London coordinates
    }
  };
  
  console.log('🧪 Testing timezone conversion:');
  console.log('Fixture:', testFixture);
  
  const timezone = getVenueTimezone(testFixture);
  console.log('Venue timezone:', timezone);
  
  const venueDate = parseMatchDateToVenueTime(testFixture.date, timezone);
  console.log('Venue local time:', venueDate);
  
  const formattedTime = formatMatchTimeInVenueTimezone(testFixture.date, testFixture, {
    showTimezone: true,
    showDate: true,
    showYear: false,
    timeFormat: '12hour'
  });
  console.log('Formatted time:', formattedTime);
  
  const relativeTime = getRelativeMatchTime(testFixture.date, testFixture);
  console.log('Relative time:', relativeTime);
  
  // Test with a different timezone
  const testFixture2 = {
    timezone: "UTC",
    date: "2025-08-16T14:00:00+00:00",
    venue: {
      city: "Madrid",
      country: "Spain",
      coordinates: [-3.7038, 40.4168] // Madrid coordinates
    }
  };
  
  console.log('\n🧪 Testing Madrid timezone:');
  const timezone2 = getVenueTimezone(testFixture2);
  console.log('Madrid timezone:', timezone2);
  const formattedTime2 = formatMatchTimeInVenueTimezone(testFixture2.date, testFixture2, {
    showTimezone: true,
    showDate: true,
    showYear: false,
    timeFormat: '12hour'
  });
  console.log('Madrid formatted time:', formattedTime2);
  
  return {
    timezone,
    venueDate,
    formattedTime,
    relativeTime,
    madridTimezone: timezone2,
    madridFormattedTime: formattedTime2
  };
};

/**
 * Simple test function for your real API data
 * Use this to test timezone conversion with actual matches
 */
export const testWithRealData = (apiResponse) => {
  console.log('🔍 Testing timezone conversion with your real data:');
  
  if (!apiResponse || !apiResponse.response) {
    console.log('❌ No response data found');
    return;
  }
  
  const matches = apiResponse.response;
  console.log(`📊 Found ${matches.length} matches to test`);
  
  // Test first 3 matches to see what's happening
  matches.slice(0, 3).forEach((match, index) => {
    console.log(`\n--- Match ${index + 1} ---`);
    
    const fixture = match.fixture;
    const teams = match.teams;
    const venue = fixture?.venue;
    

    
    // Test timezone detection
    const detectedTimezone = getVenueTimezone(fixture);

    
    // Test time formatting
    if (fixture?.date) {
      const formattedTime = formatMatchTimeInVenueTimezone(fixture.date, fixture, {
        showTimezone: true,
        showDate: true,
        showYear: false,
        timeFormat: '12hour'
      });
      console.log('🕐 Formatted Time:', formattedTime);
      
      const relativeTime = getRelativeMatchTime(fixture.date, fixture);
      console.log('⏱️ Relative Time:', relativeTime);
    }
  });
  
  console.log('\n✅ Test complete! Check the console for timezone conversion results.');
};
