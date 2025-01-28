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
    const markerRefs = useRef({}); // Change to use a plain object

    // Clear the map container and initialize map
    useEffect(() => {
        // Debug logging
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

        // Clear container before initialization
        mapContainer.current.innerHTML = '';

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
                // Clear timeout on successful load
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            map.on('error', (e) => {
                console.error('Mapbox error:', e);
                setMapError(`Error loading map: ${e.error?.message || 'Unknown error'}`);
                setLoading(false);
                // Clear timeout on error
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            // Set timeout for map load
            timeoutRef.current = setTimeout(() => {
                if (loading && !mapInstance.current) {
                    console.error('Map load timeout');
                    setMapError('Map took too long to load');
                    setLoading(false);
                    if (map) {
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
            
            if (map) {
                try {
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

    // Create styled popup HTML
    const createPopupHTML = (venue, match) => {
        const { date, time } = formatMatchDateTime(match.utcDate);
        return `
            <div style="
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
                padding: 8px;
                min-width: 220px;
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
                <div style="
                    font-size: 13px;
                    color: #666;
                    margin-bottom: 8px;
                ">
                    ${date} at ${time}
                </div>
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 12px;
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
    };

    // Expose method to trigger popup for a specific match
    useEffect(() => {
        if (setActiveMarker) {
            setActiveMarker((match) => {
                const marker = markerRefs.current[match.id];
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
        // Skip if map is not initialized or loading
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

        // Always reset if not showing location
        if (!showLocation) {
            mapInstance.current.flyTo({
                center: [-0.118092, 51.509865], // London coordinates
                zoom: 8,
                essential: true
            });
            
            // Remove all existing markers
            Object.values(markerRefs.current).forEach(marker => marker.remove());
            markerRefs.current = {};
            return;
        }

        // Remove all existing markers
        Object.values(markerRefs.current).forEach(marker => marker.remove());
        markerRefs.current = {};

        const bounds = new mapboxgl.LngLatBounds();
        let hasMarkers = false;

        // Add match venue markers first
        if (matches && matches.length > 0) {
            console.log('Adding match markers:', matches.length);
            matches.forEach(match => {
                const venue = getVenueForTeam(match.homeTeam.name);
                if (!venue || !venue.coordinates) return false;

                // Create popup but don't add it to map yet
                const popup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    maxWidth: '300px'
                }).setHTML(createPopupHTML(venue, match));

                // Create and add venue marker with popup
                const venueMarker = new mapboxgl.Marker({
                    color: '#4CAF50'
                })
                    .setLngLat(venue.coordinates)
                    .setPopup(popup) // Attach popup to marker
                    .addTo(mapInstance.current);

                // Store marker reference with match ID
                markerRefs.current[match.id] = venueMarker;
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

    // Clear the map container
    useEffect(() => {
        if (mapContainer.current) {
            mapContainer.current.innerHTML = '';
        }
    }, []);

    useEffect(() => {
        // Debug logging
        console.log('Mapbox Token:', MAPBOX_TOKEN);
        console.log('Container ref:', mapContainer.current);

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
            console.log('Initializing map...');
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
                // Clear timeout on successful load
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            map.on('error', (e) => {
                console.error('Mapbox error:', e);
                setMapError(`Error loading map: ${e.error?.message || 'Unknown error'}`);
                setLoading(false);
                // Clear timeout on error
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            });

            // Set timeout before style load
            timeoutRef.current = setTimeout(() => {
                if (loading && !mapInstance.current) {
                    console.error('Map load timeout');
                    setMapError('Map took too long to load');
                    setLoading(false);
                    if (map) {
                        map.remove();
                    }
                }
            }, 10000);

            map.on('style.load', () => {
                console.log('Map style loaded');
            });

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
            
            if (map) {
                try {
                    // Remove event listeners
                    map.off('load');
                    map.off('error');
                    map.off('style.load');
                    
                    // Remove the map instance
                    map.remove();
                } catch (error) {
                    console.error('Error cleaning up map:', error);
                }
            }
            
            mapInstance.current = null;
            
            // Clear container on cleanup
            if (mapContainer.current) {
                mapContainer.current.innerHTML = '';
            }
        };
    }, []); // Empty dependency array since we only want this to run once

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
                height: '500px',
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