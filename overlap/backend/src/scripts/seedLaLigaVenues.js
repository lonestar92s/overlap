const mongoose = require('mongoose');
const Venue = require('../models/Venue');
require('dotenv').config();

const laLigaVenues = [
    {
        name: 'Santiago Bernabeu',
        city: 'Madrid',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-3.6883445, 40.4530541] // [longitude, latitude]
        },
        capacity: 81044
    },
    {
        name: 'Wanda Metropolitano',
        city: 'Madrid',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-3.5994674, 40.4361939]
        },
        capacity: 68456
    },
    {
        name: 'San Mames',
        city: 'Bilbao',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-2.9494683, 43.2641331]
        },
        capacity: 53289
    },
    {
        name: 'Estadio de la Cerámica',
        city: 'Villarreal',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-0.1038277, 39.9442177]
        },
        capacity: 23500
    },
    {
        name: 'Ramon Sanchez Pizjuan',
        city: 'Seville',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-5.9701232, 37.3839337]
        },
        capacity: 43883
    },
    {
        name: 'Ciutat de Valencia',
        city: 'Valencia',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-0.3580098, 39.4949887]
        },
        capacity: 26354
    },
    {
        name: 'Estadio Benito Villamarin',
        city: 'Seville',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-5.9816871, 37.3564968]
        },
        capacity: 60721
    },
    {
        name: 'Anoeta',
        city: 'San Sebastian',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-1.9736919, 43.3014793]
        },
        capacity: 39500
    },
    {
        name: 'El Sadar',
        city: 'Pamplona',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-1.6367118, 42.7959275]
        },
        capacity: 23576
    },
    {
        name: 'Son Moix',
        city: 'Palma',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [2.6319073, 39.5895631]
        },
        capacity: 23142
    },
    {
        name: 'Mestalla',
        city: 'Valencia',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-0.3580098, 39.4749887]
        },
        capacity: 48600
    },
    {
        name: 'Estadio Municipal de Balaidos',
        city: 'Vigo',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-8.7400523, 42.2122771]
        },
        capacity: 29000
    },
    {
        name: 'RCDE Stadium',
        city: 'Barcelona',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [2.0749461, 41.3474373]
        },
        capacity: 40500
    },
    {
        name: 'Mendizorroza',
        city: 'Vitoria-Gasteiz',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-2.6989645, 42.8390185]
        },
        capacity: 19840
    },
    {
        name: 'Municipal de Montilivi',
        city: 'Girona',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [2.8275833, 41.9561111]
        },
        capacity: 13500
    },
    {
        name: 'Campo de Vallecas',
        city: 'Madrid',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-3.6586111, 40.3919444]
        },
        capacity: 14708
    },
    {
        name: 'Martinez Valero',
        city: 'Elche',
        country: 'Spain',
        countryCode: 'ES',
        location: {
            type: 'Point',
            coordinates: [-0.7986111, 38.2669444]
        },
        capacity: 33732
    }
];

async function seedLaLigaVenues() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing La Liga venues
        await Venue.deleteMany({ country: 'Spain' });
        console.log('Cleared existing Spanish venues');

        // Insert new venues
        const result = await Venue.insertMany(laLigaVenues);
        console.log(`✅ Successfully added ${result.length} La Liga venues`);

        // Verify the data
        const count = await Venue.countDocuments({ country: 'Spain' });
        console.log(`Total Spanish venues in database: ${count}`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');

    } catch (error) {
        console.error('Error seeding La Liga venues:', error);
        process.exit(1);
    }
}

// Run the seeding
seedLaLigaVenues(); 