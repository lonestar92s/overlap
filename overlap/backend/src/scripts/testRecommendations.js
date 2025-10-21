const mongoose = require('mongoose');
const User = require('../models/User');
const recommendationService = require('../services/recommendationService');

// Test data for Paris trip scenario
const testTrip = {
    _id: 'test-trip-123',
    name: 'Paris Football Trip',
    description: 'Test trip to Paris',
    matches: [
        {
            matchId: 'test-match-1',
            homeTeam: { name: 'PSG', logo: '' },
            awayTeam: { name: 'Real Madrid', logo: '' },
            league: 'Champions League',
            venue: 'Parc des Princes',
            venueData: {
                coordinates: [2.2522, 48.8414], // Paris coordinates
                city: 'Paris',
                country: 'France'
            },
            date: new Date('2026-01-03T20:00:00Z'),
            addedAt: new Date()
        },
        {
            matchId: 'test-match-2',
            homeTeam: { name: 'PSG', logo: '' },
            awayTeam: { name: 'Barcelona', logo: '' },
            league: 'Champions League',
            venue: 'Parc des Princes',
            venueData: {
                coordinates: [2.2522, 48.8414], // Paris coordinates
                city: 'Paris',
                country: 'France'
            },
            date: new Date('2026-01-07T20:00:00Z'),
            addedAt: new Date()
        }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
};

const testUser = {
    _id: 'test-user-123',
    email: 'test@example.com',
    subscription: {
        tier: 'pro', // Full access to all leagues
        isActive: true
    },
    preferences: {
        recommendationRadius: 400 // 400 miles default
    }
};

async function testRecommendationSystem() {
    try {
        console.log('🧪 Testing Recommendation System');
        console.log('================================');
        
        // Test the recommendation service directly
        console.log('\n📋 Test Trip Details:');
        console.log(`- Trip: ${testTrip.name}`);
        console.log(`- Dates: Jan 1-9, 2026`);
        console.log(`- Saved matches: ${testTrip.matches.length}`);
        console.log(`- User subscription: ${testUser.subscription.tier}`);
        console.log(`- Recommendation radius: ${testUser.preferences.recommendationRadius} miles`);
        
        console.log('\n🎯 Generating recommendations...');
        
        const recommendations = await recommendationService.getRecommendationsForTrip(
            testTrip._id,
            testUser,
            testTrip
        );
        
        console.log(`\n✅ Generated ${recommendations.length} recommendations:`);
        
        if (recommendations.length === 0) {
            console.log('❌ No recommendations generated. This could be due to:');
            console.log('- No matches found in the API for the test dates');
            console.log('- API key issues');
            console.log('- No matches within the specified radius');
        } else {
            recommendations.forEach((rec, index) => {
                console.log(`\n${index + 1}. ${rec.match.teams.home.name} vs ${rec.match.teams.away.name}`);
                console.log(`   Date: ${rec.recommendedForDate}`);
                console.log(`   League: ${rec.match.league.name}`);
                console.log(`   Venue: ${rec.match.fixture.venue.name}, ${rec.match.fixture.venue.city}`);
                console.log(`   Reason: ${rec.reason}`);
                console.log(`   Proximity: ${rec.proximity}`);
                console.log(`   Score: ${rec.score}`);
                if (rec.alternativeDates.length > 0) {
                    console.log(`   Alternative dates: ${rec.alternativeDates.join(', ')}`);
                }
            });
        }
        
        console.log('\n🔍 Testing edge cases...');
        
        // Test with freemium user (restricted leagues)
        const freemiumUser = {
            ...testUser,
            subscription: { tier: 'freemium', isActive: true }
        };
        
        console.log('\n📋 Testing with freemium user (restricted leagues)...');
        const freemiumRecommendations = await recommendationService.getRecommendationsForTrip(
            testTrip._id,
            freemiumUser,
            testTrip
        );
        
        console.log(`✅ Freemium user got ${freemiumRecommendations.length} recommendations`);
        
        // Test with trip that has no saved matches
        const emptyTrip = {
            ...testTrip,
            matches: []
        };
        
        console.log('\n📋 Testing with trip that has no saved matches...');
        const emptyTripRecommendations = await recommendationService.getRecommendationsForTrip(
            emptyTrip._id,
            testUser,
            emptyTrip
        );
        
        console.log(`✅ Empty trip got ${emptyTripRecommendations.length} recommendations (should be 0)`);
        
        console.log('\n🎉 Recommendation system test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testRecommendationSystem()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { testRecommendationSystem };


