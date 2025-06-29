import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, CircularProgress, Typography } from '@mui/material';
// getVenueForTeam import removed - using coordinates from API response
import { format } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { getVenueCoordinates } from '../utils/venues';
import { formatMatchDateTime } from '../utils/timezone';

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

    // Create styled popup HTML for multiple matches at the same venue
    const createVenuePopupHTML = (venue, matches) => {
        const matchList = matches.map(match => {
            const homeTeam = match.teams.home;
            const awayTeam = match.teams.away;
            
            // Get stadium local time using centralized timezone utility
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
                    <div class="match-time" style="font-size: 12px; color: #666; text-align: center;">${matchDateTime.date} at ${matchDateTime.time} ${matchDateTime.timeZone}</div>
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

    // Separate effect to watch for matches changes specifically
    useEffect(() => {
        console.log('🔄 MATCHES CHANGED DETECTED:', {
            matchCount: matches?.length || 0,
            matchIds: matches?.map(m => m.fixture?.id) || []
        });
        
        // Force marker update by clearing and recreating them
        if (mapInstance.current && !loading) {
            console.log('🔄 Forcing marker update due to matches change');
            // Clear existing markers
            markers.current.forEach(marker => marker.remove());
            markers.current = [];
            markerRefs.current = {};
            
            // Trigger the main effect by updating a dummy state
            // This ensures markers are recreated
        }
    }, [matches]);

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
            matchTeams: matches?.map(m => `${m.teams?.home?.name} vs ${m.teams?.away?.name}`) || [],
            matchIds: matches?.map(m => m.fixture?.id) || [],
            matchesHash: JSON.stringify(matches?.map(m => m.fixture?.id).sort())
        });

        // Remove all existing markers first
        console.log('🧹 Removing', markers.current.length, 'existing markers');
        markers.current.forEach(marker => marker.remove());
        markers.current = [];
        markerRefs.current = {}; // Also clear marker refs

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
                const coordinates = venueData?.coordinates;
                
                // Validate coordinates - must be array with 2 numeric values
                if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2 || 
                    typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number' ||
                    coordinates[0] === 0 || coordinates[1] === 0) {
                    console.log(`❌ NO VALID COORDINATES: ${venueData?.name || 'Unknown venue'} - coordinates: ${JSON.stringify(coordinates)} - skipping marker`);
                    return;
                }

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
                markers.current.push(venueMarker); // Add to markers array for cleanup
                bounds.extend(coordinates);
                hasMarkers = true;
                
                console.log(`✅ MARKER CREATED: ${venueData.name} - Total markers: ${markers.current.length}`);
            });

            // If we have both user location and matches, fit bounds to show all markers
            if (location && hasMarkers) {
                mapInstance.current.fitBounds(bounds, {
                    padding: 50,
                    maxZoom: 12
                });
            }
        }
        
        console.log('🏁 MAP UPDATE COMPLETE:', {
            totalMarkersCreated: markers.current.length,
            hasUserLocation: !!location,
            hasMarkers,
            matchesProcessed: matches?.length || 0
        });

    }, [location, showLocation, matches, loading]);

    // Update heart buttons in open popups when favoritedMatches changes
    useEffect(() => {
        if (!mapInstance.current) return;

        // Update all visible heart buttons
        const heartButtons = document.querySelectorAll('.heart-btn');
        heartButtons.forEach(btn => {
            const matchId = btn.getAttribute('data-match-id');
            if (matchId) {
                const svg = btn.querySelector('svg');
                const isFavorited = favoritedMatches.includes(parseInt(matchId));
                
                if (isFavorited) {
                    svg.setAttribute('fill', '#FF385C');
                    svg.setAttribute('stroke', '#FF385C');
                } else {
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', '#666');
                }
            }
        });
    }, [favoritedMatches]);

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

            // Validate both coordinate sets - must be arrays with 2 numeric values
            const isValidCoords = (coords) => coords && Array.isArray(coords) && coords.length === 2 && 
                typeof coords[0] === 'number' && typeof coords[1] === 'number' && 
                coords[0] !== 0 && coords[1] !== 0;

            if (!isValidCoords(currentCoordinates) || !isValidCoords(nextCoordinates)) {
                console.warn('Invalid venue coordinates for route:', {
                    currentTeam: currentMatch.teams.home.name,
                    nextTeam: nextMatch.teams.home.name,
                    currentVenue: currentVenue.name,
                    nextVenue: nextVenue.name,
                    currentCoords: currentCoordinates,
                    nextCoords: nextCoordinates
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
                const coords = venue?.coordinates;
                // Validate coordinates before extending bounds
                if (coords && Array.isArray(coords) && coords.length === 2 && 
                    typeof coords[0] === 'number' && typeof coords[1] === 'number' &&
                    coords[0] !== 0 && coords[1] !== 0) {
                    bounds.extend(coords);
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