import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

// Get driving directions using Google Directions API
const getDrivingDirections = async (origin, destination) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/api/directions/driving`, {
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`
            }
        });

        if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0].legs[0];
            return {
                type: 'driving',
                duration: route.duration.text,
                distance: route.distance.text,
                price: `~$${Math.round(route.distance.value * 0.1 / 1000)}`, // Rough estimate of fuel cost
                details: `Via ${route.steps.map(step => step.html_instructions).join(' → ')}`,
                polyline: response.data.routes[0].overview_polyline.points
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting driving directions:', error);
        return null;
    }
};

// Get walking directions using Google Directions API
const getWalkingDirections = async (origin, destination) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/api/directions/walking`, {
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`
            }
        });

        if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0].legs[0];
            // Only return walking option if distance is less than 10km (about 6.2 miles)
            if (route.distance.value <= 10000) {
                return {
                    type: 'walking',
                    duration: route.duration.text,
                    distance: route.distance.text,
                    price: 'Free',
                    details: `Via ${route.steps.map(step => step.html_instructions).join(' → ')}`,
                    polyline: response.data.routes[0].overview_polyline.points
                };
            }
            return null;
        }
        return null;
    } catch (error) {
        console.error('Error getting walking directions:', error);
        return null;
    }
};

// Get transit directions using Google Directions API
const getTransitDirections = async (origin, destination) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/api/directions/transit`, {
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`
            }
        });

        if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0].legs[0];
            
            // Get transit mode details
            const transitModes = new Set();
            const transitSteps = route.steps.filter(step => step.travel_mode === 'TRANSIT');
            transitSteps.forEach(step => {
                if (step.transit_details?.line?.vehicle?.type) {
                    transitModes.add(step.transit_details.line.vehicle.type.toLowerCase());
                }
            });

            const modesString = Array.from(transitModes).join(' & ');
            
            return {
                type: 'transit',
                duration: route.duration.text,
                distance: route.distance.text,
                price: 'Check local transit prices',
                details: `${modesString ? `Via ${modesString} - ` : ''}${route.steps.map(step => step.html_instructions).join(' → ')}`,
                polyline: response.data.routes[0].overview_polyline.points,
                transitModes: Array.from(transitModes)
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting transit directions:', error);
        return null;
    }
};

// Get intercity rail directions
const getRailDirections = async (origin, destination, date) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/api/directions/rail`, {
            params: {
                origin: `${origin.lat},${origin.lng}`,
                destination: `${destination.lat},${destination.lng}`,
                date
            }
        });

        if (response.data.status === 'OK' && response.data.routes.length > 0) {
            const route = response.data.routes[0].legs[0];
            
            // Only return rail option if services are available
            if (route.rail_services?.available) {
                return {
                    type: 'rail',
                    duration: route.duration.text,
                    distance: route.distance.text,
                    price: 'Check rail operator',
                    details: route.rail_services.message || 'Intercity rail service available',
                    transitType: 'intercity'
                };
            }
            return null;
        }
        return null;
    } catch (error) {
        console.error('Error getting rail directions:', error);
        return null;
    }
};

// Get flight options using Amadeus API
const getFlightOptions = async (origin, destination, date) => {
    try {
        // Get nearest airports first
        const [originAirports, destinationAirports] = await Promise.all([
            getNearestAirports(origin.lat, origin.lng),
            getNearestAirports(destination.lat, destination.lng)
        ]);

        if (!originAirports?.length || !destinationAirports?.length) {
            return null;
        }

        // If origin and destination are near the same airport, try to find alternative airports
        let originAirport = originAirports[0];
        let destinationAirport = destinationAirports[0];

        if (originAirport.iataCode === destinationAirport.iataCode && originAirports.length > 1) {
            // Use the second nearest airport for the destination if available
            destinationAirport = destinationAirports[1];
        }

        // If still the same airport or no flights found, return driving/transit only
        if (originAirport.iataCode === destinationAirport.iataCode) {
            return null;
        }

        const response = await axios.get(`${BACKEND_URL}/api/flights/search`, {
            params: {
                originCode: originAirport.iataCode,
                destinationCode: destinationAirport.iataCode,
                date: date,
                adults: 1,
                max: 1
            }
        });

        if (response.data.data && response.data.data.length > 0) {
            const flight = response.data.data[0];
            return {
                type: 'flight',
                duration: `${Math.floor(flight.itineraries[0].duration / 60)}h ${flight.itineraries[0].duration % 60}m`,
                price: `$${Math.round(flight.price.total)}`,
                details: `${originAirport.name} → ${destinationAirport.name}`,
                airports: {
                    origin: originAirport,
                    destination: destinationAirport
                }
            };
        }
        return null;
    } catch (error) {
        console.error('Error getting flight options:', error);
        return null;
    }
};

// Helper function to get nearest airports (plural)
const getNearestAirports = async (latitude, longitude) => {
    try {
        const response = await axios.get(`${BACKEND_URL}/api/airports/nearest`, {
            params: {
                latitude,
                longitude,
                radius: 100,
                limit: 3 // Get up to 3 nearest airports
            }
        });

        if (response.data.data && response.data.data.length > 0) {
            return response.data.data.map(airport => ({
                iataCode: airport.iataCode,
                name: airport.name,
                coordinates: {
                    latitude: airport.geoCode.latitude,
                    longitude: airport.geoCode.longitude
                }
            }));
        }
        return null;
    } catch (error) {
        console.error('Error getting nearest airports:', error);
        return null;
    }
};

// Main function to get all transportation options
export const getTransportationOptions = async (origin, destination, date) => {
    const originCoords = { lat: origin[1], lng: origin[0] };
    const destinationCoords = { lat: destination[1], lng: destination[0] };

    // Calculate distance between points using Haversine formula
    const R = 3959; // Earth's radius in miles
    const dLat = (destinationCoords.lat - originCoords.lat) * Math.PI / 180;
    const dLon = (destinationCoords.lng - originCoords.lng) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(originCoords.lat * Math.PI / 180) * Math.cos(destinationCoords.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in miles

    // Get basic transportation options first
    const [drivingRoute, transitRoute, walkingRoute, railRoute] = await Promise.all([
        getDrivingDirections(originCoords, destinationCoords),
        getTransitDirections(originCoords, destinationCoords),
        getWalkingDirections(originCoords, destinationCoords),
        getRailDirections(originCoords, destinationCoords, date)
    ]);

    const options = [];
    if (walkingRoute) options.push(walkingRoute);
    if (transitRoute) options.push(transitRoute);
    if (railRoute) options.push(railRoute);
    if (drivingRoute) options.push(drivingRoute);

    // Only check for flights if distance is greater than 100 miles
    if (distance > 100) {
        const flightRoute = await getFlightOptions(originCoords, destinationCoords, date);
        if (flightRoute) options.push(flightRoute);
    }

    return options;
}; 