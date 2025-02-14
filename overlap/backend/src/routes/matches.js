const express = require('express');
const axios = require('axios');
const https = require('https');
const router = express.Router();

// Create HTTPS agent with SSL certificate check disabled (for development only)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Get matches for a competition
router.get('/competitions/:competitionId/matches', async (req, res) => {
    try {
        const { competitionId } = req.params;
        const { dateFrom, dateTo } = req.query;
        
        console.log(`Fetching matches for competition ${competitionId} from ${dateFrom} to ${dateTo}`);

        const response = await axios.get(
            `https://api.football-data.org/v4/competitions/${competitionId}/matches`,
            {
                headers: {
                    'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || '2a9e46d07879477e9e4b1506101a299f'
                },
                params: {
                    dateFrom,
                    dateTo
                },
                httpsAgent // Add the HTTPS agent to the request
            }
        );
        
        console.log(`Successfully fetched matches for ${competitionId}`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching matches:', {
            competitionId: req.params.competitionId,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        // If the error is from the football API
        if (error.response?.data) {
            return res.status(error.response.status || 500).json({
                error: 'Football API Error',
                message: error.response.data.message || 'Unknown API error',
                details: error.response.data
            });
        }

        // For all other errors
        res.status(500).json({ 
            error: 'Failed to fetch matches',
            message: error.message
        });
    }
});

module.exports = router; 