import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';

/**
 * ShareableTripView - Component for rendering trip data as a shareable image
 * 
 * This component is designed to be captured as an image using react-native-view-shot.
 * It displays trip information in a clean, formatted card suitable for sharing.
 */
const ShareableTripView = ({ trip, width = 800, height = 1200 }) => {
  // Group matches by date
  const groupedMatches = useMemo(() => {
    if (!trip?.matches || trip.matches.length === 0) {
      return [];
    }

    const sortedMatches = [...trip.matches].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    });

    const grouped = sortedMatches.reduce((acc, match) => {
      const matchDate = new Date(match.date);
      const dateKey = matchDate.toDateString();
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: matchDate,
          matches: []
        };
      }
      
      acc[dateKey].matches.push(match);
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => a.date - b.date);
  }, [trip?.matches]);

  // Format date range
  const formatDateRange = () => {
    if (trip?.startDate && trip?.endDate) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      
      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    
    if (trip?.matches && trip.matches.length > 0) {
      const dates = trip.matches
        .map(m => new Date(m.date))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => a - b);
      
      if (dates.length === 0) return null;
      
      const start = dates[0];
      const end = dates[dates.length - 1];
      
      if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    
    return null;
  };

  // Format date header
  const formatDateHeader = (date) => {
    if (!date) return 'Unknown Date';
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const matchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (matchDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (matchDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Format match time
  const formatMatchTime = (dateString) => {
    if (!dateString) return 'TBD';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'TBD';
    }
  };

  // Format flight duration
  const formatDuration = (minutes) => {
    if (!minutes) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Format flight date
  const formatFlightDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Format home base date range
  const formatHomeBaseDateRange = (from, to) => {
    if (!from || !to) return '';
    try {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${fromStr} - ${toStr}`;
    } catch {
      return '';
    }
  };

  const dateRange = formatDateRange();
  const hasMatches = trip?.matches && trip.matches.length > 0;
  const hasFlights = trip?.flights && trip.flights.length > 0;
  const hasHomeBases = trip?.homeBases && trip.homeBases.length > 0;

  return (
    <View style={[styles.container, { width, height }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.tripName}>{trip?.name || 'My Trip'}</Text>
          {dateRange && (
            <Text style={styles.dateRange}>{dateRange}</Text>
          )}
        </View>

        {/* Description */}
        {trip?.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.description}>{trip.description}</Text>
          </View>
        )}

        {/* Matches Section */}
        {hasMatches && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Matches ({trip.matches.length})
            </Text>
            {groupedMatches.map((group, groupIndex) => (
              <View key={groupIndex} style={styles.matchGroup}>
                <Text style={styles.dateHeader}>
                  {formatDateHeader(group.date)}
                </Text>
                {group.matches.map((match, matchIndex) => {
                  const homeTeam = match.homeTeam || {};
                  const awayTeam = match.awayTeam || {};
                  const league = typeof match.league === 'string' ? match.league : match.league?.name || 'Unknown League';
                  const venue = match.venueData?.name || match.venue || 'Unknown Venue';
                  const venueCity = match.venueData?.city || '';
                  
                  return (
                    <View key={matchIndex} style={styles.matchItem}>
                      <View style={styles.matchTeams}>
                        <View style={styles.teamContainer}>
                          {homeTeam.logo ? (
                            <Image 
                              source={{ uri: homeTeam.logo }} 
                              style={styles.teamLogo}
                              resizeMode="contain"
                            />
                          ) : (
                            <View style={styles.teamLogoPlaceholder}>
                              <Text style={styles.teamInitials}>
                                {homeTeam.name?.charAt(0) || 'H'}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.teamName} numberOfLines={1}>
                            {homeTeam.name || 'Home Team'}
                          </Text>
                        </View>
                        
                        <Text style={styles.vsText}>vs</Text>
                        
                        <View style={styles.teamContainer}>
                          {awayTeam.logo ? (
                            <Image 
                              source={{ uri: awayTeam.logo }} 
                              style={styles.teamLogo}
                              resizeMode="contain"
                            />
                          ) : (
                            <View style={styles.teamLogoPlaceholder}>
                              <Text style={styles.teamInitials}>
                                {awayTeam.name?.charAt(0) || 'A'}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.teamName} numberOfLines={1}>
                            {awayTeam.name || 'Away Team'}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.matchDetails}>
                        <Text style={styles.matchTime}>
                          {formatMatchTime(match.date)}
                        </Text>
                        <Text style={styles.matchLeague}>{league}</Text>
                        <Text style={styles.matchVenue}>
                          {venue}{venueCity ? `, ${venueCity}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* Flights Section */}
        {hasFlights && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Flights ({trip.flights.length})
            </Text>
            {trip.flights.map((flight, index) => {
              const airlineName = flight.airline?.name || flight.airline?.code || 'Unknown Airline';
              const flightNumber = flight.flightNumber || 'N/A';
              const departureAirport = flight.departure?.airport?.code || 'N/A';
              const arrivalAirport = flight.arrival?.airport?.code || 'N/A';
              const departureTime = flight.departure?.time || '--:--';
              const arrivalTime = flight.arrival?.time || '--:--';
              const departureDate = formatFlightDate(flight.departure?.date);
              const arrivalDate = formatFlightDate(flight.arrival?.date);
              const duration = formatDuration(flight.duration);
              const stops = flight.stops || 0;
              
              return (
                <View key={index} style={styles.flightItem}>
                  <View style={styles.flightHeader}>
                    <Text style={styles.flightNumber}>{flightNumber}</Text>
                    <Text style={styles.flightAirline}>{airlineName}</Text>
                  </View>
                  <View style={styles.flightRoute}>
                    <View style={styles.flightSegment}>
                      <Text style={styles.flightAirport}>{departureAirport}</Text>
                      <Text style={styles.flightTime}>{departureTime}</Text>
                      {departureDate && (
                        <Text style={styles.flightDate}>{departureDate}</Text>
                      )}
                    </View>
                    <View style={styles.flightArrow}>
                      <Text style={styles.flightArrowText}>→</Text>
                    </View>
                    <View style={styles.flightSegment}>
                      <Text style={styles.flightAirport}>{arrivalAirport}</Text>
                      <Text style={styles.flightTime}>{arrivalTime}</Text>
                      {arrivalDate && (
                        <Text style={styles.flightDate}>{arrivalDate}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.flightFooter}>
                    <Text style={styles.flightDuration}>Duration: {duration}</Text>
                    {stops > 0 && (
                      <Text style={styles.flightStops}>
                        {stops} {stops === 1 ? 'stop' : 'stops'}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Home Bases Section */}
        {hasHomeBases && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Home Bases ({trip.homeBases.length})
            </Text>
            {trip.homeBases.map((homeBase, index) => {
              const location = homeBase.address?.city && homeBase.address?.country
                ? `${homeBase.address.city}, ${homeBase.address.country}`
                : homeBase.name;
              
              return (
                <View key={index} style={styles.homeBaseItem}>
                  <View style={styles.homeBaseHeader}>
                    <Text style={styles.homeBaseName}>{homeBase.name}</Text>
                    {homeBase.type && (
                      <Text style={styles.homeBaseType}>
                        {homeBase.type === 'hotel' ? '🏨' : homeBase.type === 'airbnb' ? '🏠' : '📍'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.homeBaseLocation}>{location}</Text>
                  {homeBase.dateRange && (
                    <Text style={styles.homeBaseDateRange}>
                      {formatHomeBaseDateRange(homeBase.dateRange.from, homeBase.dateRange.to)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Empty State */}
        {!hasMatches && !hasFlights && !hasHomeBases && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No trip details available</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Created with Overlap</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.md,
  },
  tripName: {
    ...typography.h1XLarge, // Use h1XLarge token which is 32px
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  dateRange: {
    ...typography.h3, // h3 is 18px, matches our need
    fontWeight: '400', // Override to normal weight (h3 is 600 by default)
    color: colors.text.secondary,
  },
  descriptionContainer: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  description: {
    ...typography.body, // body is already 16px
    color: colors.text.primary,
    lineHeight: 24, // Custom lineHeight for better readability in shareable image
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h1, // h1 is 24px, matches our need
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  matchGroup: {
    marginBottom: spacing.lg,
  },
  dateHeader: {
    ...typography.h3, // h3 is 18px, matches our need
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  matchItem: {
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogo: {
    width: 48,
    height: 48,
    marginBottom: spacing.xs,
  },
  teamLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  teamInitials: {
    ...typography.h3, // h3 is 18px, matches our need
    fontWeight: '600',
    color: colors.text.secondary,
  },
  teamName: {
    ...typography.bodySmall, // bodySmall is 14px, matches our need
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  vsText: {
    ...typography.bodySmall, // bodySmall is 14px, matches our need
    fontWeight: '600',
    color: colors.text.secondary,
    marginHorizontal: spacing.sm,
  },
  matchDetails: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  matchTime: {
    ...typography.body, // body is 16px, matches our need
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  matchLeague: {
    ...typography.bodySmall, // bodySmall is 14px, matches our need
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  matchVenue: {
    ...typography.caption, // caption is 12px, matches our need
    color: colors.text.light,
  },
  flightItem: {
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  flightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  flightNumber: {
    ...typography.h3, // h3 is 18px, matches our need
    fontWeight: '600',
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  flightAirline: {
    ...typography.bodySmall, // bodySmall is 14px, matches our need
    color: colors.text.secondary,
  },
  flightRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  flightSegment: {
    flex: 1,
    alignItems: 'center',
  },
  flightAirport: {
    ...typography.h2, // h2 is 20px, close to our 20px need
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  flightTime: {
    ...typography.body, // body is 16px, matches our need
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  flightDate: {
    ...typography.caption, // caption is 12px, matches our need
    color: colors.text.secondary,
  },
  flightArrow: {
    marginHorizontal: spacing.md,
  },
  flightArrowText: {
    ...typography.h1, // h1 is 24px, matches our need
    color: colors.primary,
  },
  flightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flightDuration: {
    ...typography.caption, // caption is 12px, matches our need
    color: colors.text.secondary,
  },
  flightStops: {
    ...typography.caption, // caption is 12px, matches our need
    color: colors.text.secondary,
  },
  homeBaseItem: {
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  homeBaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  homeBaseName: {
    ...typography.body, // body is 16px, matches our need
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  homeBaseType: {
    fontSize: 20,
    fontFamily: typography.fontFamily, // Ensure fontFamily for emoji container
  },
  homeBaseLocation: {
    ...typography.bodySmall, // bodySmall is 14px, matches our need
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  homeBaseDateRange: {
    ...typography.caption, // caption is 12px, matches our need
    color: colors.text.light,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    ...typography.body, // body is 16px, matches our need
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption, // caption is 12px, matches our need
    color: colors.text.light,
  },
});

export default ShareableTripView;

