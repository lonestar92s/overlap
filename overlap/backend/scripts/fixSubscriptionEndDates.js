const mongoose = require('mongoose');
const User = require('../src/models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/overlap', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function fixSubscriptionEndDates() {
    try {
        console.log('🔧 Fixing subscription end dates...');
        
        // Update all users to have null end dates (never expire)
        const result = await User.updateMany(
            { 'subscription.endDate': { $ne: null } }, // Find users with non-null end dates
            { 
                $set: { 
                    'subscription.endDate': null,
                    'subscription.isActive': true
                } 
            }
        );
        
        console.log(`✅ Updated ${result.modifiedCount} users to have never-expiring subscriptions`);
        
        // Show current subscription stats
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription.tier',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        console.log('\n📊 Current subscription stats:');
        stats.forEach(stat => {
            console.log(`   ${stat._id || 'undefined'}: ${stat.count} users`);
        });
        
    } catch (error) {
        console.error('❌ Error fixing subscription end dates:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
}

fixSubscriptionEndDates(); 