import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, CircularProgress, Typography } from '@mui/material';
// getVenueForTeam import removed - using coordinates from API response
import { format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { getVenueCoordinates } from '../utils/venues';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Set the access token
mapboxgl.accessToken = MAPBOX_TOKEN;

// Transportation colors
const TRANSPORT_COLORS = {
    driving: '#4CAF50',  // Green
    transit: '#2196F3',  // Blue
    flight: '#FF9800'    // Orange
};

const Map = ({ 
    location, 
    showLocation, 
    matches, 
    setActiveMarker,
    selectedMatches = [],
    selectedTransportation = {},
    onHeartClick = () => {},
    favoritedMatches = []
}) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [mapError, setMapError] = useState(null);
    const [loading, setLoading] = useState(true);
    const timeoutRef = useRef(null);
    const markerRefs = useRef({});
    const markers = useRef([]);

    // Initialize map
    useEffect(() => {
        console.log('Map initialization started');
        
        if (mapInstance.current) {
            console.log('Map already initialized, skipping');
            return;
        }

        if (!MAPBOX_TOKEN) {
            setMapError('Mapbox token is not configured');
            setLoading(false);
            return;
        }

        if (!mapContainer.current) {
            setMapError('Map container not found');
            setLoading(false);
            return;
        }

        let map = null;

        try {
            console.log('Creating new map instance...');
            map = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [-0.118092, 51.509865], // London coordinates
                zoom: 3,
                interactive: true,
                attributionControl: true,
            });

            map.addControl(new mapboxgl.NavigationControl());

            map.on('load', () => {
                console.log('Map loaded successfully');
                setLoading(false);
                mapInstance.current = map;
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            map.on('error', (e) => {
                console.error('Mapbox error:', e);
                setMapError(`Error loading map: ${e.error?.message || 'Unknown error'}`);
                setLoading(false);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            map.on('style.load', () => {
                console.log('Map style loaded');
            });

            // Set timeout for map load
            timeoutRef.current = setTimeout(() => {
                if (loading && !mapInstance.current) {
                    console.error('Map load timeout');
                    setMapError('Map took too long to load');
                    setLoading(false);
                    if (map && !map._removed) {
                        map.remove();
                    }
                }
            }, 10000);

        } catch (error) {
            console.error('Error initializing map:', error);
            setMapError(`Error initializing map: ${error.message}`);
            setLoading(false);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }

        // Cleanup function
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            
            if (map && !map._removed) {
                try {
                    // Remove event listeners
                    map.off('load');
                    map.off('error');
                    map.off('style.load');
                    
                    // Remove markers first
                    markers.current.forEach(marker => marker.remove());
                    markers.current = [];
                    
                    // Remove the map instance
                    map.remove();
                } catch (error) {
                    console.error('Error cleaning up map:', error);
                }
            }
            
            mapInstance.current = null;
        };
    }, []); // Empty dependency array since we only want this to run once

    // Helper function to get timezone from coordinates
    const getTimezoneFromCoordinates = (coordinates) => {
        // This is a simplified version. In a real-world application, 
        // you would want to use a timezone lookup service or library
        // like Google Time Zone API or moment-timezone with a complete timezone database
        
        const [longitude, latitude] = coordinates;
        
        // Europe
        if (latitude >= 35 && latitude <= 60) {
            if (longitude >= -10 && longitude <= 2) return 'Europe/London';      // UK, Ireland, Portugal
            if (longitude > 2 && longitude <= 7.5) return 'Europe/Paris';        // France, Belgium, Netherlands
            if (longitude > 7.5 && longitude <= 15) return 'Europe/Berlin';      // Germany, Switzerland, Italy
            if (longitude > 15 && longitude <= 20) return 'Europe/Rome';         // Italy, Austria
            if (longitude <= -10) return 'Atlantic/Azores';                      // Azores
            if (longitude > 20 && longitude <= 30) return 'Europe/Istanbul';     // Turkey, Eastern Europe
        }
        
        // Americas
        if (longitude >= -180 && longitude <= -30) {
            if (latitude >= 25 && latitude <= 50) {  // North America
                if (longitude >= -125 && longitude <= -115) return 'America/Los_Angeles';
                if (longitude > -115 && longitude <= -100) return 'America/Denver';
                if (longitude > -100 && longitude <= -85) return 'America/Chicago';
                if (longitude > -85 && longitude <= -65) return 'America/New_York';
            }
            if (latitude >= -60 && latitude < 25) {  // South & Central America
                if (longitude >= -85 && longitude <= -75) return 'America/Bogota';
                if (longitude > -75 && longitude <= -65) return 'America/Lima';
                if (longitude > -65 && longitude <= -55) return 'America/Sao_Paulo';
                if (longitude > -55 && longitude <= -30) return 'America/Buenos_Aires';
            }
        }
        
        // Asia
        if (latitude >= 20 && latitude <= 55 && longitude >= 30 && longitude <= 180) {
            if (longitude >= 30 && longitude <= 45) return 'Asia/Dubai';         // UAE
            if (longitude > 45 && longitude <= 60) return 'Asia/Karachi';        // Pakistan
            if (longitude > 60 && longitude <= 75) return 'Asia/Kolkata';        // India
            if (longitude > 75 && longitude <= 90) return 'Asia/Bangkok';        // Thailand
            if (longitude > 90 && longitude <= 105) return 'Asia/Shanghai';      // China
            if (longitude > 105 && longitude <= 120) return 'Asia/Tokyo';        // Japan
        }
        
        // Africa
        if (latitude >= -35 && latitude <= 35 && longitude >= -20 && longitude <= 50) {
            if (longitude >= -20 && longitude <= 0) return 'Africa/Casablanca';  // Morocco
            if (longitude > 0 && longitude <= 20) return 'Africa/Lagos';         // Nigeria
            if (longitude > 20 && longitude <= 35) return 'Africa/Cairo';        // Egypt
            if (longitude > 35 && longitude <= 50) return 'Africa/Nairobi';      // Kenya
        }
        
        // Australia & Oceania
        if (latitude >= -50 && latitude <= -10 && longitude >= 110 && longitude <= 180) {
            if (longitude >= 110 && longitude <= 130) return 'Australia/Perth';
            if (longitude > 130 && longitude <= 150) return 'Australia/Sydney';
            if (longitude > 150) return 'Pacific/Auckland';
        }
        
        return 'UTC'; // Default to UTC if no specific timezone is found
    };

    // Format match date and time
    const formatMatchDateTime = (utcDate, venue) => {
        // Create date object from UTC string
        const date = new Date(utcDate);
        
        // Get venue timezone, default to UTC
        let timeZone = 'UTC';
        if (venue?.coordinates) {
            timeZone = getTimezoneFromCoordinates(venue.coordinates);
        }
        
        // Convert UTC date to venue's timezone
        const zonedDate = utcToZonedTime(date, timeZone);
        
        // Format the date and time in the venue's timezone
        return {
            date: format(zonedDate, 'EEE, MMM d'),
            time: format(zonedDate, 'h:mm a')
        };
    };

    // Create styled popup HTML for multiple matches at the same venue
    const createVenuePopupHTML = (venue, matches) => {
        const matchList = matches.map(match => {
            const homeTeam = match.teams.home;
            const awayTeam = match.teams.away;
            
            // Get stadium local time using venue coordinates
            const matchDateTime = formatMatchDateTime(match.fixture.date, match.fixture.venue);

            return `
                <div class="match-item" style="margin-bottom: 12px; padding: 8px; border-radius: 6px; background: #f8f9fa; position: relative;">
                    <button 
                        class="heart-btn" 
                        data-match-id="${match.fixture.id}"
                        style="
                            position: absolute; 
                            top: 6px; 
                            right: 6px; 
                            background: transparent; 
                            border: none; 
                            cursor: pointer; 
                            padding: 4px; 
                            border-radius: 50%; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center;
                            transition: all 0.2s ease;
                        "
                        onmouseover="this.style.backgroundColor='rgba(255, 56, 92, 0.1)'"
                        onmouseout="this.style.backgroundColor='transparent'"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                    <div class="match-teams" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-right: 24px;">
                        <div style="display: flex; align-items: center; flex: 1;">
                            <img src="${homeTeam.logo}" alt="${homeTeam.name}" style="width: 20px; height: 20px; margin-right: 6px; object-fit: contain;" onerror="this.style.display='none'">
                            <span class="team home" style="font-size: 13px; font-weight: 500;">${homeTeam.name}</span>
                        </div>
                        <span class="vs" style="margin: 0 8px; color: #666; font-size: 12px;">vs</span>
                        <div style="display: flex; align-items: center; flex: 1; justify-content: flex-end;">
                            <span class="team away" style="font-size: 13px; font-weight: 500;">${awayTeam.name}</span>
                            <img src="${awayTeam.logo}" alt="${awayTeam.name}" style="width: 20px; height: 20px; margin-left: 6px; object-fit: contain;" onerror="this.style.display='none'">
                        </div>
                    </div>
                    <div class="match-time" style="font-size: 12px; color: #666; text-align: center;">${matchDateTime.date} at ${matchDateTime.time}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="venue-popup" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; max-width: 280px;">
                <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #333;">${venue.name}</h3>
                <p style="margin: 0 0 12px 0; font-size: 13px; color: #666;">${venue.city}, ${venue.country}</p>
                <div class="matches-list">
                    ${matchList}
                </div>
            </div>
        `;
    };

    // Expose method to trigger popup for a specific match
    useEffect(() => {
        if (setActiveMarker) {
            setActiveMarker((match) => {
                const venue = match.fixture.venue;
                if (!venue || !venue.id) return;

                const venueKey = `${venue.name}-${venue.id}`;
                const marker = markerRefs.current[venueKey];
                
                if (marker) {
                    marker.togglePopup();
                    
                    // Center the map on the marker
                    mapInstance.current?.flyTo({
                        center: marker.getLngLat(),
                        zoom: 12,
                        essential: true
                    });
                }
            });
        }
    }, [setActiveMarker]);

    // Handle location and matches changes
    useEffect(() => {
        if (!mapInstance.current || loading) {
            console.log('Skipping marker update - map not ready');
            return;
        }

        console.log('🗺️  MAP EFFECT TRIGGERED:', { 
            hasMap: true, 
            showLocation, 
            hasLocation: !!location,
            matchCount: matches?.length || 0,
            matchTeams: matches?.map(m => `${m.teams?.home?.name} vs ${m.teams?.away?.name}`) || []
        });

        // Remove all existing markers first
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // COMMENTED OUT TEST MARKER FOR NOW
        // // ADD HARDCODED TEST MARKER - REMOVE THIS AFTER TESTING
        // console.log('Adding hardcoded test marker at London coordinates');
        // console.log('mapInstance.current:', mapInstance.current);
        // console.log('mapInstance.current type:', typeof mapInstance.current);
        // 
        // const testMarker = new mapboxgl.Marker({
        //     color: '#00FF00'  // Bright green to make it obvious
        // })
        //     .setLngLat([-0.1278, 51.5074]);  // London coordinates
        //     
        // console.log('Test marker created:', testMarker);
        // console.log('About to add test marker to map...');
        // 
        // const addedTestMarker = testMarker.addTo(mapInstance.current);
        // console.log('Test marker addTo result:', addedTestMarker);
        // console.log('Test marker after addTo:', testMarker);
        // 
        // markers.current.push(testMarker);
        // console.log('Test marker added successfully');
        // console.log('Test marker element:', testMarker.getElement());
        // console.log('Test marker LngLat:', testMarker.getLngLat());

        const bounds = new mapboxgl.LngLatBounds();
        let hasMarkers = false;

        // First, center on user location if available
        if (location) {
            console.log('Centering map on user location:', {
                city: location.city,
                region: location.region,
                country: location.country,
                coordinates: [location.lon, location.lat]
            });

            // Create popup for user location
            const popup = new mapboxgl.Popup({
                offset: 25,
                closeButton: false
            }).setHTML(`
                <div style="
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
                    padding: 8px;
                ">
                    <div style="
                        font-weight: 600;
                        font-size: 14px;
                        color: #444;
                        margin-bottom: 4px;
                    ">${location.city}${location.region ? `, ${location.region}` : ''}</div>
                    <div style="
                        font-size: 12px;
                        color: #666;
                    ">${location.country}</div>
                </div>
            `);

            // Add user location marker with delay to ensure map is fully rendered
            console.log('Creating user location marker with coordinates:', [location.lon, location.lat]);
            console.log('mapInstance.current for user marker:', mapInstance.current);
            
            setTimeout(() => {
                const userMarker = new mapboxgl.Marker({
                    color: '#FF385C'
                })
                    .setLngLat([location.lon, location.lat])
                    .setPopup(popup);
                
                console.log('User marker created (delayed):', userMarker);
                console.log('About to add user marker to map...');
                
                const addedUserMarker = userMarker.addTo(mapInstance.current);
                console.log('User marker addTo result:', addedUserMarker);

                markers.current.push(userMarker);
                
            }, 200); // 200ms delay to let map fully render

            bounds.extend([location.lon, location.lat]);
            hasMarkers = true;

            // Center map on user location with appropriate zoom
            mapInstance.current.flyTo({
                center: [location.lon, location.lat],
                zoom: matches && matches.length > 0 ? 8 : 10,
                essential: true
            });
        } else if (!showLocation) {
            // Reset view if not showing location
            mapInstance.current.flyTo({
                center: [-0.118092, 51.509865],
                zoom: 3,
                essential: true
            });
            return;
        }

        // Group matches by venue
        if (matches && matches.length > 0) {
            console.log('🔍 VENUE GROUPING: Starting with', matches.length, 'matches');
            const venueMatches = matches.reduce((acc, match) => {
                const venue = match.fixture.venue;
                console.log('🔍 VENUE CHECK:', {
                    team: match.teams?.home?.name,
                    venue: venue?.name,
                    venueId: venue?.id,
                    hasCoordinates: !!venue?.coordinates
                });
                
                if (!venue || !venue.id) {
                    console.log('❌ SKIPPING VENUE: No venue or venue ID for', match.teams?.home?.name);
                    return acc;
                }

                const venueKey = `${venue.name}-${venue.id}`;
                if (!acc[venueKey]) {
                    acc[venueKey] = {
                        venue,
                        matches: []
                    };
                }
                acc[venueKey].matches.push(match);
                return acc;
            }, {});

            console.log('🔍 VENUE GROUPS:', Object.keys(venueMatches));

            // Create markers for each venue
            Object.entries(venueMatches).forEach(([venueKey, { venue, matches: venueMatches }]) => {
                // Create popup with all matches at this venue
                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: '300px'
                }).setHTML(createVenuePopupHTML(venue, venueMatches))
                .on('open', () => {
                    // Add event listeners for heart buttons after popup opens
                    setTimeout(() => {
                        const heartButtons = document.querySelectorAll('.heart-btn');
                        heartButtons.forEach(btn => {
                            const matchId = btn.getAttribute('data-match-id');
                            const match = matches.find(m => m.fixture.id === parseInt(matchId));
                            if (match) {
                                // Update heart appearance based on favorited state
                                const svg = btn.querySelector('svg');
                                const isFavorited = favoritedMatches.includes(parseInt(matchId));
                                
                                if (isFavorited) {
                                    svg.setAttribute('fill', '#FF385C');
                                    svg.setAttribute('stroke', '#FF385C');
                                } else {
                                    svg.setAttribute('fill', 'none');
                                    svg.setAttribute('stroke', '#666');
                                }
                                
                                // Add click handler
                                btn.onclick = (e) => {
                                    e.stopPropagation();
                                    onHeartClick(match);
                                };
                            }
                        });
                    }, 50); // Small delay to ensure DOM is ready
                });

                // Get coordinates from API response (backend provides them now)
                const venueData = venueMatches[0].fixture.venue;
                if (!venueData?.coordinates) {
                    console.log(`❌ NO COORDINATES: ${venueData?.name || 'Unknown venue'} - skipping marker`);
                    return;
                }

                const coordinates = venueData.coordinates;
                console.log(`🏟️  CREATING MARKER: ${venueData.name} at [${coordinates}]`);

                // Create and add venue marker with popup
                const venueMarker = new mapboxgl.Marker({
                    color: '#4CAF50'
                })
                    .setLngLat(coordinates)
                    .setPopup(popup)
                    .addTo(mapInstance.current);

                // Store marker reference with venue key
                markerRefs.current[venueKey] = venueMarker;
                bounds.extend(coordinates);
                hasMarkers = true;
            });

            // If we have both user location and matches, fit bounds to show all markers
            if (location && hasMarkers) {
                mapInstance.current.fitBounds(bounds, {
                    padding: 50,
                    maxZoom: 12
                });
            }
        }

        console.log('🗺️ MAP COMPONENT received matches:', {
            matchesLength: matches.length,
            matchIds: matches.map(m => m.fixture.id),
            firstMatch: matches[0] ? {
                id: matches[0].fixture.id,
                homeTeam: matches[0].teams.home.name,
                awayTeam: matches[0].teams.away.name
            } : null
        });

    }, [location, showLocation, matches, loading]);

    // Add route lines between selected matches
    useEffect(() => {
        if (!mapInstance.current || loading || selectedMatches.length < 2) {
            console.log('Skipping route creation:', {
                hasMap: !!mapInstance.current,
                loading,
                selectedMatchesCount: selectedMatches.length
            });
            return;
        }

        console.log('Creating routes for matches:', {
            selectedMatches: selectedMatches.map(m => m.id),
            transportation: selectedTransportation
        });

        // Remove existing route layers and sources
        const map = mapInstance.current;
        const existingLayers = map.getStyle().layers;
        existingLayers.forEach(layer => {
            if (layer.id.startsWith('route-')) {
                console.log('Removing layer:', layer.id);
                map.removeLayer(layer.id);
            }
        });
        Object.keys(map.getStyle().sources).forEach(source => {
            if (source.startsWith('route-')) {
                console.log('Removing source:', source);
                map.removeSource(source);
            }
        });

        // Add routes between consecutive matches
        for (let i = 0; i < selectedMatches.length - 1; i++) {
            const currentMatch = selectedMatches[i];
            const nextMatch = selectedMatches[i + 1];
            const currentVenue = currentMatch.fixture.venue;
            const nextVenue = nextMatch.fixture.venue;

            if (!currentVenue?.id || !nextVenue?.id) {
                console.warn('Missing venue information:', {
                    currentVenue: currentVenue?.name,
                    nextVenue: nextVenue?.name
                });
                continue;
            }

            const currentCoordinates = currentMatch.fixture.venue?.coordinates;
            const nextCoordinates = nextMatch.fixture.venue?.coordinates;

            if (!currentCoordinates || !nextCoordinates) {
                console.warn('Missing venue coordinates:', {
                    currentTeam: currentMatch.teams.home.name,
                    nextTeam: nextMatch.teams.home.name,
                    currentVenue: currentVenue.name,
                    nextVenue: nextVenue.name
                });
                continue;
            }

            const transportKey = `${currentMatch.fixture.id}-${nextMatch.fixture.id}`;
            const transport = selectedTransportation[transportKey];
            
            if (!transport) {
                console.warn('No transportation selected for route:', transportKey);
                continue;
            }

            console.log('Adding route:', {
                from: currentVenue.name,
                to: nextVenue.name,
                transport: transport.type
            });

            // Create a line between the venues
            const coordinates = [
                currentCoordinates,
                nextCoordinates
            ];

            // For flights, create an arc
            let routeCoordinates = coordinates;
            if (transport.type === 'flight') {
                routeCoordinates = createArcCoordinates(
                    currentCoordinates,
                    nextCoordinates
                );
            }

            const sourceId = `route-${transportKey}`;
            const layerId = `route-line-${transportKey}`;

            try {
                // Add the route source
                map.addSource(sourceId, {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'properties': {},
                        'geometry': {
                            'type': 'LineString',
                            'coordinates': routeCoordinates
                        }
                    }
                });

                // Add the route layer
                map.addLayer({
                    'id': layerId,
                    'type': 'line',
                    'source': sourceId,
                    'layout': {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    'paint': {
                        'line-color': TRANSPORT_COLORS[transport.type] || '#888',
                        'line-width': 3,
                        'line-dasharray': transport.type === 'flight' ? [2, 1] : [1],
                        'line-opacity': 0.8
                    }
                });

                console.log('Successfully added route:', {
                    sourceId,
                    layerId,
                    coordinates: routeCoordinates
                });
            } catch (error) {
                console.error('Error adding route:', {
                    sourceId,
                    layerId,
                    error: error.message
                });
            }
        }

        // Fit bounds to include all matches and routes
        if (selectedMatches.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();
            selectedMatches.forEach(match => {
                const venue = match.fixture.venue;
                if (venue?.coordinates) {
                    bounds.extend(venue.coordinates);
                }
            });
            
            map.fitBounds(bounds, {
                padding: {
                    top: 100,
                    bottom: 100,
                    left: 100,
                    right: 100
                },
                maxZoom: 8,
                duration: 1000
            });
        }
    }, [selectedMatches, selectedTransportation, loading]);

    // Helper function to create an arc for flight routes
    const createArcCoordinates = (start, end) => {
        const points = 50; // Number of points in the arc
        const coordinates = [];
        
        for (let i = 0; i <= points; i++) {
            const t = i / points;
            
            // Create an arc by interpolating between the points
            const lat = start[1] + (end[1] - start[1]) * t;
            const lon = start[0] + (end[0] - start[0]) * t;
            
            // Add altitude variation
            const altitude = Math.sin(t * Math.PI) * 0.5; // Max altitude offset
            
            coordinates.push([
                lon,
                lat + altitude // Add altitude to create the arc effect
            ]);
        }
        
        return coordinates;
    };

    // Individual match markers removed - using venue markers only for cleaner map display

    if (mapError) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '500px',
                    borderRadius: 2,
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    mt: 4,
                    p: 2
                }}
            >
                <Typography variant="body1" sx={{ mb: 1 }}>
                    {mapError}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Check console for detailed error information
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                position: 'relative'
            }}
        >
            <Box
                ref={mapContainer}
                sx={{
                    width: '100%',
                    height: '100%'
                }}
            />
            {loading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        zIndex: 2
                    }}
                >
                    <CircularProgress size={40} />
                    <Typography variant="caption" color="text.secondary">
                        Loading map...
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default Map; 