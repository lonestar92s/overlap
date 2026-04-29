const mongoose = require('mongoose');
require('dotenv').config();
async function check() {
    const uri = process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!uri) {
        process.exit(1);
    }
    try {
        // Connect - if URI doesn't have a database name, MongoDB uses default (usually 'test')
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        // Check raw collection counts (bypassing models)
        const leagueCount = await db.collection('leagues').countDocuments();
        const teamCount = await db.collection('teams').countDocuments();
        const venueCount = await db.collection('venues').countDocuments();
        const userCount = await db.collection('users').countDocuments();
        // If collections are empty, check what databases exist
        if (leagueCount === 0 && teamCount === 0 && venueCount === 0) {
            const admin = db.admin();
            const dbs = await admin.listDatabases();
        } else {
            // Show sample documents
            const sampleLeague = await db.collection('leagues').findOne();
            const sampleTeam = await db.collection('teams').findOne();
            const sampleVenue = await db.collection('venues').findOne();
            if (sampleLeague) console.log(`   League sample: ${sampleLeague.name || sampleLeague._id}`);
            if (sampleTeam) console.log(`   Team sample: ${sampleTeam.name || sampleTeam._id}`);
            if (sampleVenue) console.log(`   Venue sample: ${sampleVenue.name || sampleVenue.venueId}`);
        }
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    process.exit(0);
}
check();
