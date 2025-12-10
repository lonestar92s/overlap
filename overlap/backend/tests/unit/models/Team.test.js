const Team = require('../../../src/models/Team');
const mongoose = require('mongoose');

describe('Team Model', () => {
  beforeAll(async () => {
    // Skip tests if MongoDB is not available
    if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
      console.log('⚠️  MongoDB not configured, skipping Team model tests');
      return;
    }
    
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/overlap-test', {
          serverSelectionTimeoutMS: 5000
        });
      }
    } catch (error) {
      console.log('⚠️  Could not connect to MongoDB, skipping Team model tests:', error.message);
      return;
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clean up teams collection before each test
    if (mongoose.connection.readyState !== 0) {
      await Team.deleteMany({});
    }
  });

  describe('ticketingUrl field', () => {
    it('should save and retrieve ticketingUrl', async () => {
      if (mongoose.connection.readyState === 0) {
        return;
      }

      const teamData = {
        apiId: '123',
        name: 'Test Team',
        country: 'England',
        ticketingUrl: 'https://www.example.com/tickets'
      };

      const team = new Team(teamData);
      await team.save();

      const retrieved = await Team.findOne({ apiId: '123' });
      expect(retrieved.ticketingUrl).toBe('https://www.example.com/tickets');
    });

    it('should allow ticketingUrl to be optional', async () => {
      if (mongoose.connection.readyState === 0) {
        return;
      }

      const teamData = {
        apiId: '124',
        name: 'Test Team 2',
        country: 'England'
        // No ticketingUrl
      };

      const team = new Team(teamData);
      await team.save();

      const retrieved = await Team.findOne({ apiId: '124' });
      expect(retrieved.ticketingUrl).toBeUndefined();
    });

    it('should allow updating ticketingUrl', async () => {
      if (mongoose.connection.readyState === 0) {
        return;
      }

      const teamData = {
        apiId: '125',
        name: 'Test Team 3',
        country: 'England'
      };

      const team = new Team(teamData);
      await team.save();

      team.ticketingUrl = 'https://www.example.com/new-tickets';
      await team.save();

      const retrieved = await Team.findOne({ apiId: '125' });
      expect(retrieved.ticketingUrl).toBe('https://www.example.com/new-tickets');
    });
  });
});
