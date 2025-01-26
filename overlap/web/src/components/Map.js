import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box } from '@mui/material';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

// Set the access token
mapboxgl.accessToken = MAPBOX_TOKEN;

const Map = () => {
    const mapContainer = useRef(null);
    const map = useRef(null);

    useEffect(() => {
        if (!MAPBOX_TOKEN) {
            console.error('Mapbox token is not configured');
            return;
        }

        if (map.current) return; // Initialize map only once

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-0.118092, 51.509865], // London coordinates
            zoom: 5,
            interactive: false // Disable interactions for now
        });

        // Cleanup on unmount
        return () => {
            if (map.current) {
                map.current.remove();
            }
        };
    }, []);

    if (!MAPBOX_TOKEN) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '300px',
                    borderRadius: 2,
                    backgroundColor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    mt: 4
                }}
            >
                Map unavailable - Mapbox token not configured
            </Box>
        );
    }

    return (
        <Box
            ref={mapContainer}
            sx={{
                width: '100%',
                height: '300px',
                borderRadius: 2,
                overflow: 'hidden',
                mt: 4
            }}
        />
    );
};

export default Map; 