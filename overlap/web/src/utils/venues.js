// Helper function to get coordinates for venues
export const getVenueCoordinates = (venueName, city) => {
    // This is a simplified version. In a real application, you would want to use
    // a proper geocoding service or database to get accurate coordinates
    const coordinates = {
        'Soldier Field': [-87.6167, 41.8625],
        'Yankee Stadium': [-73.9261, 40.8296],
        'BMO Stadium': [-118.2650, 33.7378],
        'Providence Park': [-122.6920, 45.5215],
        'Energizer Park': [-90.1994, 38.6270],
        'Subaru Park': [-75.3785, 39.8307],
        'Gillette Stadium': [-71.2642, 42.0909],
        'Lower.com Field': [-83.0000, 39.9697],
        'Shell Energy Stadium': [-95.3552, 29.7518],
        'Children\'s Mercy Park': [-94.8245, 39.1212],
        'Allianz Field': [-93.1611, 44.9537],
        'Q2 Stadium': [-97.7500, 30.3833],
        'America First Field': [-111.8800, 40.5700],
        'Dick\'s Sporting Goods Park': [-104.6720, 39.8050]
    };

    return coordinates[venueName] || null;
}; 