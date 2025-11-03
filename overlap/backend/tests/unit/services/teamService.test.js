const teamService = require('../../../src/services/teamService');
const Team = require('../../../src/models/Team');

// Mock the Team model
jest.mock('../../../src/models/Team');

describe('Team Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchTeams', () => {
    it('should search teams by name', async () => {
      const mockTeams = [
        {
          _id: '507f1f77bcf86cd799439011',
          name: 'Arsenal FC',
          apiId: 42,
          logo: 'arsenal.png',
          country: 'England'
        },
        {
          _id: '507f1f77bcf86cd799439012',
          name: 'Arsenal de Sarandí',
          apiId: 43,
          logo: 'arsenal-sarandi.png',
          country: 'Argentina'
        }
      ];

      Team.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockTeams)
          })
        })
      });

      const results = await teamService.searchTeams('Arsenal');

      expect(Team.find).toHaveBeenCalled();
      expect(results).toBeDefined();
    });

    it('should return empty array for no matches', async () => {
      Team.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      const results = await teamService.searchTeams('NonExistentTeam');

      expect(results).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      Team.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      await expect(teamService.searchTeams('Arsenal')).rejects.toThrow('Database error');
    });
  });

  describe('getTeamById', () => {
    it('should get team by ID', async () => {
      const mockTeam = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Arsenal FC',
        apiId: 42
      };

      Team.findOne = jest.fn().mockResolvedValue(mockTeam);

      const result = await teamService.getTeamById('507f1f77bcf86cd799439011');

      expect(Team.findOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011' });
      expect(result).toEqual(mockTeam);
    });

    it('should return null if team not found', async () => {
      Team.findOne = jest.fn().mockResolvedValue(null);

      const result = await teamService.getTeamById('nonexistent');

      expect(result).toBeNull();
    });
  });
});

