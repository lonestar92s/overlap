// Stadium coordinate lookup service
// This provides coordinates for major stadiums to enrich API venue data

const STADIUM_COORDINATES = {
    // MLS Stadiums
    'Soldier Field': [-87.6167, 41.8623],
    'Inter&Co Stadium': [-81.389, 28.541],
    'BMO Field': [-79.4189, 43.6332],
    'Sports Illustrated Stadium': [-74.1503, 40.7369],
    'Gillette Stadium': [-71.2643, 42.0909],
    'Stade Saputo': [-73.553, 45.5619],
    'Audi Field': [-77.0122, 38.8677],
    'Chase Stadium': [-80.1610, 25.7781],
    'Toyota Stadium': [-96.8352, 32.7798],
    'Shell Energy Stadium': [-95.3518, 29.7520],
    'Dignity Health Sports Park': [-118.2615, 33.8644],
    'Lower.com Field': [-83.0179, 39.9682],
    'Dick\'s Sporting Goods Park': [-104.8919, 39.8059],
    'Yankee Stadium': [-73.9265, 40.8296],
    'Stanford Stadium': [-122.1606, 37.4347],
    'PayPal Park': [-121.9252, 37.3513],
    'Lumen Field': [-122.3316, 47.5952],
    'BMO Stadium': [-118.2840, 34.0122],
    'Children\'s Mercy Park': [-94.8236, 39.1220],
    'TQL Stadium': [-84.5203, 39.1031],
    'GEODIS Park': [-86.7677, 36.1301],
    'Q2 Stadium': [-97.7173, 30.3883],
    'America First Field': [-111.9425, 40.5823],
    'Providence Park': [-122.6919, 45.5214],
    'Snapdragon Stadium': [-117.1195, 32.7831],
    'Subaru Park': [-75.3781, 39.8327],
    'Bank of America Stadium': [-80.8532, 35.2258],

    // Japanese J1 League Stadiums
    'Panasonic Stadium Suita': [135.5888, 34.7850], // Gamba Osaka
    'Saitama Stadium 2002': [139.6253, 35.9097], // Urawa Red Diamonds
    'Ajinomoto Stadium': [139.5272, 35.6648], // FC Tokyo
    'Nissan Stadium': [139.6048, 35.5098], // Yokohama F. Marinos
    'Kashima Soccer Stadium': [140.6337, 35.9955], // Kashima Antlers
    'Sapporo Dome': [141.4099, 43.0150], // Hokkaido Consadole Sapporo
    'Todoroki Athletics Stadium': [139.6511, 35.5644], // Kawasaki Frontale
    'Yanmar Stadium Nagai': [135.5166, 34.6062], // Cerezo Osaka
    'Denka Big Swan Stadium': [139.0623, 37.9161], // Albirex Niigata
    'Toyota Stadium': [137.1563, 35.1067], // Nagoya Grampus
    'Mizuho Athletic Stadium': [136.9429, 35.1312], // Nagoya Grampus (alt)
    'Edion Stadium Hiroshima': [132.4525, 34.3833], // Sanfrecce Hiroshima
    'Best Amenity Stadium': [130.3881, 33.8830], // Avispa Fukuoka
    'Shonan BMW Stadium Hiratsuka': [139.3439, 35.3281], // Shonan Bellmare
    'IAI Stadium Nihondaira': [138.3478, 34.9417], // Shimizu S-Pulse
    'Yurtec Stadium Sendai': [140.9022, 38.2682], // Vegalta Sendai
    'Noevir Stadium Kobe': [135.1838, 34.6586], // Vissel Kobe
    'Kyoto Sanga Stadium': [135.7681, 34.9058], // Kyoto Sanga FC
    'City Light Stadium': [140.1058, 35.6065], // Kashiwa Reysol
    'Ekimae Real Estate Stadium': [139.3729, 35.4578], // Machida Zelvia

    // Brazilian Stadiums
    'Estádio São Januário': [-43.2290, -22.9068],
    'Estadio Jornalista Mário Filho': [-43.2302, -22.9121], // Maracanã
    'Estádio José Pinheiro Borda': [-51.2356, -30.0668], // Beira-Rio
    'Casa de Apostas Arena Fonte Nova': [-38.5041, -12.9789],
    'Estádio Governador Magalhães Pinto': [-43.9692, -19.8658], // Mineirão
    'Estádio Alfredo Jaconi': [-51.1929, -28.2092],
    'Estádio Governador Plácido Aderaldo Castelo': [-38.5214, -3.8073], // Castelão
    'Estádio José Maria de Campos Maia': [-49.3645, -20.8058],
    'Neo Química Arena': [-46.4742, -23.5454],
    'Estádio Urbano Caldeira': [-46.3356, -23.9618], // Vila Belmiro
    'Arena do Grêmio': [-51.2356, -30.0668],
    'Allianz Parque': [-46.6917, -23.5272],
    'Estádio do Morumbi': [-46.7197, -23.6009],

    // European Stadiums (for other leagues)
    'Santiago Bernabéu': [-3.6883, 40.4531],
    'Camp Nou': [2.1204, 41.3809],
    'Old Trafford': [-2.2922, 53.4631],
    'Emirates Stadium': [-0.1085, 51.5549],
    'Anfield': [-2.9608, 53.4308],
    'Stamford Bridge': [-0.1910, 51.4816],
    'Etihad Stadium': [-2.2009, 53.4831],
    'Tottenham Hotspur Stadium': [-0.0670, 51.6043],
    'London Stadium': [-0.0172, 51.5388],
    'Wembley Stadium': [-0.2795, 51.5560]
};

class CoordinateService {
    /**
     * Get coordinates for a stadium by name
     * @param {string} stadiumName - Name of the stadium
     * @returns {Array|null} - [longitude, latitude] or null if not found
     */
    getCoordinatesByStadium(stadiumName) {
        if (!stadiumName) return null;
        
        // Direct match
        if (STADIUM_COORDINATES[stadiumName]) {
            return STADIUM_COORDINATES[stadiumName];
        }
        
        // Fuzzy matching for similar names
        const normalizedName = stadiumName.toLowerCase().trim();
        
        for (const [knownStadium, coords] of Object.entries(STADIUM_COORDINATES)) {
            const knownNormalized = knownStadium.toLowerCase().trim();
            
            // Check if names are similar (contains or partial match)
            if (normalizedName.includes(knownNormalized) || knownNormalized.includes(normalizedName)) {
                return coords;
            }
            
            // Check for key words (like "Stadium", "Arena", "Field")
            const nameWords = normalizedName.split(/\s+/);
            const knownWords = knownNormalized.split(/\s+/);
            
            // If main part of the name matches (excluding common suffixes)
            const mainName = nameWords.filter(word => !['stadium', 'arena', 'field', 'park'].includes(word)).join(' ');
            const knownMainName = knownWords.filter(word => !['stadium', 'arena', 'field', 'park'].includes(word)).join(' ');
            
            if (mainName && knownMainName && (mainName.includes(knownMainName) || knownMainName.includes(mainName))) {
                return coords;
            }
        }
        
        return null;
    }

    /**
     * Enrich venue data with coordinates
     * @param {Object} venueData - Venue data from API
     * @returns {Object} - Enhanced venue data with coordinates if found
     */
    enrichVenueWithCoordinates(venueData) {
        if (!venueData || !venueData.name) return venueData;
        
        // If coordinates already exist, return as is
        if (venueData.coordinates && venueData.coordinates.length === 2) {
            return venueData;
        }
        
        // Try to get coordinates by stadium name
        const coordinates = this.getCoordinatesByStadium(venueData.name);
        
        if (coordinates) {
            return {
                ...venueData,
                coordinates: coordinates
            };
        }
        
        return venueData;
    }

    /**
     * Get all available stadiums
     * @returns {Array} - List of stadium names that have coordinates
     */
    getAvailableStadiums() {
        return Object.keys(STADIUM_COORDINATES);
    }

    /**
     * Add new stadium coordinates (for dynamic updates)
     * @param {string} stadiumName - Name of the stadium
     * @param {Array} coordinates - [longitude, latitude]
     */
    addStadiumCoordinates(stadiumName, coordinates) {
        if (stadiumName && coordinates && coordinates.length === 2) {
            STADIUM_COORDINATES[stadiumName] = coordinates;
        }
    }
}

module.exports = new CoordinateService();
