const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    const uri = process.env.MONGO_PUBLIC_URL || process.env.MONGODB_URI || process.env.MONGO_URL;
    
    if (!uri) {
        console.log('❌ No MongoDB URI found');
        process.exit(1);
    }
    
    try {
        // Connect - if URI doesn't have a database name, MongoDB uses default (usually 'test')
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        console.log(`📊 Database name: ${dbName}\n`);
        
        // Check raw collection counts (bypassing models)
        const leagueCount = await db.collection('leagues').countDocuments();
        const teamCount = await db.collection('teams').countDocuments();
        const venueCount = await db.collection('venues').countDocuments();
        const userCount = await db.collection('users').countDocuments();
        
        console.log('📋 Collection counts:');
        console.log(`   leagues: ${leagueCount}`);
        console.log(`   teams: ${teamCount}`);
        console.log(`   venues: ${venueCount}`);
        console.log(`   users: ${userCount}`);
        
        // If collections are empty, check what databases exist
        if (leagueCount === 0 && teamCount === 0 && venueCount === 0) {
            console.log('\n⚠️  Collections are empty. Checking if data went to a different database...');
            const admin = db.admin();
            const dbs = await admin.listDatabases();
            console.log('\n📦 Available databases:', dbs.databases.map(d => `${d.name} (${(d.sizeOnDisk / 1024).toFixed(2)} KB)`).join(', '));
        } else {
            // Show sample documents
            console.log('\n📝 Sample documents:');
            const sampleLeague = await db.collection('leagues').findOne();
            const sampleTeam = await db.collection('teams').findOne();
            const sampleVenue = await db.collection('venues').findOne();
            
            if (sampleLeague) console.log(`   League sample: ${sampleLeague.name || sampleLeague._id}`);
            if (sampleTeam) console.log(`   Team sample: ${sampleTeam.name || sampleTeam._id}`);
            if (sampleVenue) console.log(`   Venue sample: ${sampleVenue.name || sampleVenue.venueId}`);
        }
        
        await mongoose.disconnect();
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    process.exit(0);
}

check();

