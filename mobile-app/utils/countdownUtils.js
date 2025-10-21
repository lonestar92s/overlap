/**
 * Utility functions for countdown calculations
 */

export const calculateCountdown = (targetDate, currentDate = new Date()) => {
  const timeDiff = targetDate.getTime() - currentDate.getTime();

  if (timeDiff <= 0) {
    return {
      status: 'in-progress',
      message: 'Trip in Progress',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0
    };
  }

  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

  let timeString = '';
  if (days > 0) {
    timeString = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    timeString = `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    timeString = `${minutes}m ${seconds}s`;
  } else {
    timeString = `${seconds}s`;
  }

  return {
    status: 'countdown',
    message: `Next match is in ${timeString}`,
    timeString,
    days,
    hours,
    minutes,
    seconds
  };
};

export const findNextUpcomingTrip = (itineraries, currentTime = new Date()) => {
  if (!itineraries || itineraries.length === 0) {
    return null;
  }

  let closestTrip = null;
  let closestMatchDate = null;

  // Iterate through all trips to find the one with the closest upcoming match
  itineraries.forEach(trip => {
    if (!trip.matches || trip.matches.length === 0) {
      return;
    }

    // Find the closest upcoming match in this trip
    const upcomingMatches = trip.matches
      .filter(match => {
        const matchDate = new Date(match.date);
        return matchDate >= currentTime;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcomingMatches.length > 0) {
      const closestMatch = upcomingMatches[0];
      const matchDate = new Date(closestMatch.date);

      // If this is the first trip or this match is closer than the current closest
      if (!closestTrip || matchDate < closestMatchDate) {
        closestTrip = {
          ...trip,
          closestMatch: closestMatch,
          closestMatchDate: matchDate
        };
        closestMatchDate = matchDate;
      }
    }
  });

  return closestTrip;
};
