import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getVenueForTeam } from '../data/venues';
import { format } from 'date-fns';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Set the access token
mapboxgl.accessToken = MAPBOX_TOKEN;

const Map = ({ location, showLocation, matches, setActiveMarker }) => {
    const mapContainer = useRef(null);
    const mapInstance = useRef(null);
    const [mapError, setMapError] = useState(null);
    const [loading, setLoading] = useState(true);
    const timeoutRef = useRef(null);
    const markerRefs = useRef({});

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
                    Object.values(markerRefs.current).forEach(marker => {
                        if (marker && marker.remove) {
                            marker.remove();
                        }
                    });
                    markerRefs.current = {};
                    
                    // Remove the map instance
                    map.remove();
                } catch (error) {
                    console.error('Error cleaning up map:', error);
                }
            }
            
            mapInstance.current = null;
        };
    }, []); // Empty dependency array since we only want this to run once

    // Format match date and time
    const formatMatchDateTime = (utcDate) => {
        const date = new Date(utcDate);
        return {
            date: format(date, 'EEE, MMM d'),
            time: format(date, 'h:mm a')
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
                    font-weight: 600;
                    font-size: 14px;
                    color: #444;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #eee;
                ">
                    ${venue.stadium}
                </div>
                ${matches.map(match => {
                    const { date, time } = formatMatchDateTime(match.utcDate);
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
        Object.values(markerRefs.current).forEach(marker => {
            if (marker && marker.remove) {
                marker.remove();
            }
        });
        markerRefs.current = {};

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
                padding: 50,
                maxZoom: 10
            });
        }

        console.log('Map updated with locations and matches');
    }, [location, matches, showLocation, loading]);

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
                height: '1000px',
                borderRadius: 2,
                overflow: 'hidden',
                mt: 4,
                position: 'relative',
                backgroundColor: '#f8f8f8'
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
                        backgroundColor: 'rgba(255, 255, 255, 0.9)'
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