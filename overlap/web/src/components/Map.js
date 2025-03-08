import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getVenueForTeam } from '../data/venues';
import { format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

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
    selectedTransportation = {}
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
        
        // Get timezone display name
        const timeZoneDisplay = timeZone.split('/')[1] || 'UTC';
        
        // Convert UTC date to venue's timezone
        const zonedDate = utcToZonedTime(date, timeZone);
        
        // Format the date and time in the venue's timezone
        return {
            date: format(zonedDate, 'EEE, MMM d'),
            time: format(zonedDate, 'h:mm a') + ' ' + timeZoneDisplay
        };
    };

    // Create styled popup HTML for multiple matches at the same venue
    const createVenuePopupHTML = (venue, matches) => {
        return `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
                padding: 8px;
                min-width: 250px;
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee;
                ">
                    <div style="
                        font-weight: 600;
                        font-size: 14px;
                        color: #444;
                    ">
                        ${venue.stadium}
                    </div>
                    ${venue.ticketUrl ? `
                        <a 
                            href="${venue.ticketUrl}" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style="
                                font-size: 12px;
                                color: #FF385C;
                                text-decoration: none;
                                padding: 4px 8px;
                                border: 1px solid #FF385C;
                                border-radius: 4px;
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.backgroundColor='#FF385C';this.style.color='white';"
                            onmouseout="this.style.backgroundColor='transparent';this.style.color='#FF385C';"
                        >
                            Tickets
                        </a>
                    ` : ''}
                </div>
                ${matches.map(match => {
                    const { date, time } = formatMatchDateTime(match.utcDate, getVenueForTeam(match.homeTeam.name));
                    return `
                        <div style="
                            padding: 8px 0;
                            ${matches.length > 1 ? 'border-bottom: 1px solid #f5f5f5;' : ''}
                        ">
                            <div style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                margin-bottom: 8px;
                            ">
                                <div style="
                                    font-size: 13px;
                                    color: #666;
                                ">
                                    ${date} at ${time}
                                </div>
                                <div style="
                                    font-size: 11px;
                                    color: #666;
                                    background-color: #f5f5f5;
                                    padding: 4px 8px;
                                    border-radius: 4px;
                                    font-weight: 500;
                                ">
                                    ${match.competition.leagueName}
                                </div>
                            </div>
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                            ">
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                ">
                                    <img 
                                        src="${match.homeTeam.crest}" 
                                        alt="${match.homeTeam.name}"
                                        style="width: 20px; height: 20px; object-fit: contain;"
                                    />
                                    <span style="font-size: 13px; color: #333;">${match.homeTeam.name}</span>
                                </div>
                                <div style="
                                    font-size: 12px;
                                    color: #666;
                                    margin: 0 8px;
                                ">vs</div>
                                <div style="
                                    display: flex;
                                    align-items: center;
                                    gap: 8px;
                                ">
                                    <span style="font-size: 13px; color: #333;">${match.awayTeam.name}</span>
                                    <img 
                                        src="${match.awayTeam.crest}" 
                                        alt="${match.awayTeam.name}"
                                        style="width: 20px; height: 20px; object-fit: contain;"
                                    />
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    // Expose method to trigger popup for a specific match
    useEffect(() => {
        if (setActiveMarker) {
            setActiveMarker((match) => {
                const venue = getVenueForTeam(match.homeTeam.name);
                if (!venue || !venue.coordinates) return;

                const venueKey = `${venue.stadium}-${venue.coordinates.join(',')}`;
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

        console.log('Map effect triggered:', { 
            hasMap: true, 
            showLocation, 
            hasLocation: !!location,
            matchCount: matches?.length || 0 
        });

        // Remove all existing markers first
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        // Reset view if not showing location
        if (!showLocation) {
            mapInstance.current.flyTo({
                center: [-0.118092, 51.509865],
                zoom: 8,
                essential: true
            });
            return;
        }

        const bounds = new mapboxgl.LngLatBounds();
        let hasMarkers = false;

        // Group matches by venue
        if (matches && matches.length > 0) {
            const venueMatches = matches.reduce((acc, match) => {
                const venue = getVenueForTeam(match.homeTeam.name);
                if (!venue || !venue.coordinates) return acc;

                const venueKey = `${venue.stadium}-${venue.coordinates.join(',')}`;
                if (!acc[venueKey]) {
                    acc[venueKey] = {
                        venue,
                        matches: []
                    };
                }
                acc[venueKey].matches.push(match);
                return acc;
            }, {});

            // Create markers for each venue
            Object.entries(venueMatches).forEach(([venueKey, { venue, matches: venueMatches }]) => {
                // Create popup with all matches at this venue
                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: '300px'
                }).setHTML(createVenuePopupHTML(venue, venueMatches));

                // Create and add venue marker with popup
                const venueMarker = new mapboxgl.Marker({
                    color: '#4CAF50'
                })
                    .setLngLat(venue.coordinates)
                    .setPopup(popup)
                    .addTo(mapInstance.current);

                // Store marker reference with venue key
                markerRefs.current[venueKey] = venueMarker;
                bounds.extend(venue.coordinates);
                hasMarkers = true;
            });
        }

        // Add user location marker if available
        if (location) {
            console.log('Adding user location to map:', {
                city: location.city,
                region: location.region,
                country: location.country,
                coordinates: [location.lon, location.lat]
            });

            // Create popup but don't add it to map yet
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
                    ">
                        Your Location
                    </div>
                    <div style="font-size: 13px; color: #666;">
                        ${location.city}${location.region ? `, ${location.region}` : ''}<br>
                        ${location.country}
                    </div>
                </div>
            `);

            // Create and add user location marker with popup
            const userMarker = new mapboxgl.Marker({
                color: '#FF385C'
            })
                .setLngLat([location.lon, location.lat])
                .setPopup(popup) // Attach popup to marker
                .addTo(mapInstance.current);

            // Store marker reference with location ID
            markerRefs.current['user-location'] = userMarker;
            bounds.extend([location.lon, location.lat]);
            hasMarkers = true;
        }

        // Fit map to show all markers if we have any
        if (hasMarkers && !bounds.isEmpty()) {
            console.log('Fitting bounds to markers');
            mapInstance.current.fitBounds(bounds, {
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

        console.log('Map updated with locations and matches');
    }, [location, matches, showLocation, loading]);

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
            const currentVenue = getVenueForTeam(currentMatch.homeTeam.name);
            const nextVenue = getVenueForTeam(nextMatch.homeTeam.name);

            if (!currentVenue?.coordinates || !nextVenue?.coordinates) {
                console.warn('Missing venue coordinates:', {
                    currentTeam: currentMatch.homeTeam.name,
                    nextTeam: nextMatch.homeTeam.name,
                    hasCurrentVenue: !!currentVenue,
                    hasNextVenue: !!nextVenue
                });
                continue;
            }

            const transportKey = `${currentMatch.id}-${nextMatch.id}`;
            const transport = selectedTransportation[transportKey];
            
            if (!transport) {
                console.warn('No transportation selected for route:', transportKey);
                continue;
            }

            console.log('Adding route:', {
                from: currentMatch.homeTeam.name,
                to: nextMatch.homeTeam.name,
                transportType: transport.type,
                transportKey
            });

            // Create a line between the venues
            const coordinates = [
                currentVenue.coordinates,
                nextVenue.coordinates
            ];

            // For flights, create an arc
            let routeCoordinates = coordinates;
            if (transport.type === 'flight') {
                routeCoordinates = createArcCoordinates(
                    currentVenue.coordinates,
                    nextVenue.coordinates
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
                const venue = getVenueForTeam(match.homeTeam.name);
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

    // Add markers for matches
    useEffect(() => {
        if (!mapInstance.current || loading) return;

        // Remove existing markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        matches.forEach(match => {
            const venue = getVenueForTeam(match.homeTeam.name);
            if (!venue?.coordinates) return;

            const isSelected = selectedMatches.some(m => m.id === match.id);
            
            // Create marker element
            const el = document.createElement('div');
            el.className = 'match-marker';
            el.style.width = '10px';
            el.style.height = '10px';
            el.style.backgroundColor = isSelected ? '#FF385C' : '#385CFF';
            el.style.borderRadius = '50%';
            el.style.border = '1px solid white';
            el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            el.style.cursor = 'pointer';

            // Create popup
            const popup = new mapboxgl.Popup({
                offset: 25,
                closeButton: false,
                className: 'match-popup'
            }).setHTML(`
                <div style="padding: 12px;">
                    <div style="margin-bottom: 8px;">
                        <strong>${format(new Date(match.utcDate), 'EEE, MMM d • h:mm a')}</strong>
                    </div>
                    <div style="margin-bottom: 8px;">
                        <span>${match.homeTeam.name}</span>
                        <span style="margin: 0 4px;">vs</span>
                        <span>${match.awayTeam.name}</span>
                    </div>
                    <div style="color: #666;">
                        ${venue.stadium}, ${venue.location}
                    </div>
                </div>
            `);

            // Create and store marker
            const marker = new mapboxgl.Marker({
                element: el,
                anchor: 'center'
            })
            .setLngLat(venue.coordinates)
            .setPopup(popup);

            // Add click handler
            el.addEventListener('click', () => {
                // Close other popups
                markers.current.forEach(m => m.getPopup().remove());
                // Open this popup
                marker.togglePopup();
            });

            marker.addTo(mapInstance.current);
            markers.current.push(marker);
        });
    }, [matches, loading, selectedMatches]);

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