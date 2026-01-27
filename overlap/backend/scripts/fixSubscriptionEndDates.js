const mongoose = require('mongoose');
const User = require('../src/models/User');
// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/overlap', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});
async function fixSubscriptionEndDates() {
    try {
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
        // Show current subscription stats
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$subscription.tier',
                    count: { $sum: 1 }
                }
            }
        ]);
        stats.forEach(stat => {
        });
    } catch (error) {
        console.error('❌ Error fixing subscription end dates:', error);
    } finally {
        mongoose.connection.close();
    }
}
fixSubscriptionEndDates(); 