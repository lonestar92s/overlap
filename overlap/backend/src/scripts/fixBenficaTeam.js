const mongoose = require('mongoose');
const Team = require('../models/Team');

async function fixBenficaTeam() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/overlap', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('📦 Connected to MongoDB');
        
        // Find the SL Benfica team
        const team = await Team.findOne({ 
            $or: [
                { name: 'SL Benfica' },
                { name: { $regex: /benfica/i } }
            ]
        });
        
        if (team) {
            console.log('✅ Found team:', team.name);
            
            // Add "Benfica" as an alias if not already present
            if (!team.aliases) {
                team.aliases = [];
            }
            
            const benficaAlias = 'Benfica';
            if (!team.aliases.includes(benficaAlias)) {
                team.aliases.push(benficaAlias);
                await team.save();
                console.log(`✅ Added alias "${benficaAlias}" to ${team.name}`);
            } else {
                console.log(`⏭️  Alias "${benficaAlias}" already exists`);
            }
            
            // Also set apiName if not set
            if (!team.apiName) {
                team.apiName = 'Benfica';
                await team.save();
                console.log(`✅ Set apiName to "Benfica"`);
            }
            
            console.log('✅ Team aliases:', team.aliases);
            console.log('✅ Team apiName:', team.apiName);
        } else {
            console.log('❌ SL Benfica team not found in database');
            
            // List all teams with "benfica" in the name
            const benficaTeams = await Team.find({ 
                name: { $regex: /benfica/i } 
            });
            console.log('🔍 Teams with "benfica" in name:', benficaTeams.map(t => t.name));
        }
        
        console.log('✨ Fix completed');
    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

fixBenficaTeam();
