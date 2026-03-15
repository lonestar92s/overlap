const fs = require('fs');
const path = require('path');
const booleanIntersectsModule = require('@turf/boolean-intersects');
const { polygon } = require('@turf/helpers');

const booleanIntersects = booleanIntersectsModule.default || booleanIntersectsModule;

const WORLD_GEOJSON_ROOT = path.dirname(require.resolve('world-geojson/package.json'));

const REGIONAL_FALLBACK_COUNTRIES = {
    'Americas-Region': ['USA', 'Canada', 'Mexico'],
    'Europe-Region': ['England', 'Spain', 'Germany', 'Italy', 'France'],
    'AsiaPacific-Region': ['Japan', 'Australia', 'South-Korea', 'China'],
    'Africa-Region': ['Egypt', 'South-Africa', 'Morocco', 'Nigeria']
};

const REGION_BOUNDS = {
    'Europe': { ne: { lat: 71, lng: 40 }, sw: { lat: 35, lng: -10 } },
    'Africa': { ne: { lat: 37, lng: 52 }, sw: { lat: -35, lng: -20 } },
    'SouthAmerica': { ne: { lat: 15, lng: -30 }, sw: { lat: -55, lng: -85 } },
    'NorthAmerica': { ne: { lat: 75, lng: -50 }, sw: { lat: 15, lng: -170 } },
    'Asia': { ne: { lat: 75, lng: 180 }, sw: { lat: -10, lng: 60 } },
    'AsiaPacific': { ne: { lat: 75, lng: 180 }, sw: { lat: -50, lng: 60 } }
};

const COUNTRY_CENTER_COORDS = {
    'England': { lat: 52.3555, lng: -1.1743 },
    'Scotland': { lat: 56.4907, lng: -4.2026 },
    'Wales': { lat: 52.1307, lng: -3.7837 },
    'Northern-Ireland': { lat: 54.7877, lng: -6.4923 },
    'Ireland': { lat: 53.1424, lng: -7.6921 },
    'France': { lat: 46.6034, lng: 1.8883 },
    'Spain': { lat: 40.4637, lng: -3.7492 },
    'Portugal': { lat: 39.3999, lng: -8.2245 },
    'Italy': { lat: 41.8719, lng: 12.5674 },
    'Germany': { lat: 51.1657, lng: 10.4515 },
    'Netherlands': { lat: 52.1326, lng: 5.2913 },
    'Belgium': { lat: 50.5039, lng: 4.4699 },
    'Switzerland': { lat: 46.8182, lng: 8.2275 },
    'Austria': { lat: 47.5162, lng: 14.5501 },
    'Denmark': { lat: 56.2639, lng: 9.5018 },
    'Sweden': { lat: 60.1282, lng: 18.6435 },
    'Norway': { lat: 60.4720, lng: 8.4689 },
    'Finland': { lat: 61.9241, lng: 25.7482 },
    'Iceland': { lat: 64.9631, lng: -19.0208 },
    'Poland': { lat: 51.9194, lng: 19.1451 },
    'Czech-Republic': { lat: 49.8175, lng: 15.4730 },
    'Hungary': { lat: 47.1625, lng: 19.5033 },
    'Romania': { lat: 45.9432, lng: 24.9668 },
    'Bulgaria': { lat: 42.7339, lng: 25.4858 },
    'Ukraine': { lat: 48.3794, lng: 31.1656 },
    'Russia': { lat: 61.5240, lng: 105.3188 },
    'Serbia': { lat: 44.0165, lng: 21.0059 },
    'Croatia': { lat: 45.1000, lng: 15.2000 },
    'Slovenia': { lat: 46.1512, lng: 14.9955 },
    'Slovakia': { lat: 48.6690, lng: 19.6990 },
    'Bosnia-Herzegovina': { lat: 43.9159, lng: 17.6791 },
    'Montenegro': { lat: 42.7087, lng: 19.3744 },
    'North-Macedonia': { lat: 41.5124, lng: 21.7453 },
    'Albania': { lat: 41.1533, lng: 20.1683 },
    'Kosovo': { lat: 42.6026, lng: 20.9030 },
    'Greece': { lat: 39.0742, lng: 21.8243 },
    'Cyprus': { lat: 35.1264, lng: 33.4299 },
    'Malta': { lat: 35.9375, lng: 14.3754 },
    'Turkey': { lat: 38.9637, lng: 35.2433 },
    'Saudi-Arabia': { lat: 23.8859, lng: 45.0792 },
    'United-Arab-Emirates': { lat: 23.4241, lng: 53.8478 },
    'Qatar': { lat: 25.3548, lng: 51.1839 },
    'Israel': { lat: 31.0461, lng: 34.8516 },
    'Iran': { lat: 32.4279, lng: 53.6880 },
    'USA': { lat: 39.8283, lng: -98.5795 },
    'Canada': { lat: 56.1304, lng: -106.3468 },
    'Mexico': { lat: 23.6345, lng: -102.5528 },
    'Brazil': { lat: -14.2350, lng: -51.9253 },
    'Argentina': { lat: -38.4161, lng: -63.6167 },
    'Colombia': { lat: 4.5709, lng: -74.2973 },
    'Chile': { lat: -35.6751, lng: -71.5430 },
    'Peru': { lat: -9.1900, lng: -75.0152 },
    'Ecuador': { lat: -1.8312, lng: -78.1834 },
    'Uruguay': { lat: -32.5228, lng: -55.7658 },
    'Paraguay': { lat: -23.4425, lng: -58.4438 },
    'Venezuela': { lat: 6.4238, lng: -66.5897 },
    'Bolivia': { lat: -16.2902, lng: -63.5887 },
    'Japan': { lat: 36.2048, lng: 138.2529 },
    'South-Korea': { lat: 35.9078, lng: 127.7669 },
    'China': { lat: 35.8617, lng: 104.1954 },
    'India': { lat: 20.5937, lng: 78.9629 },
    'Australia': { lat: -25.2744, lng: 133.7751 },
    'Indonesia': { lat: -0.7893, lng: 113.9213 },
    'Thailand': { lat: 15.8700, lng: 100.9925 },
    'Vietnam': { lat: 14.0583, lng: 108.2772 },
    'Malaysia': { lat: 4.2105, lng: 101.9758 },
    'Singapore': { lat: 1.3521, lng: 103.8198 },
    'Egypt': { lat: 26.8206, lng: 30.8025 },
    'South-Africa': { lat: -30.5595, lng: 22.9375 },
    'Morocco': { lat: 31.7917, lng: -7.0926 },
    'Algeria': { lat: 28.0339, lng: 1.6596 },
    'Tunisia': { lat: 33.8869, lng: 9.5375 },
    'Nigeria': { lat: 9.0820, lng: 8.6753 },
    'Ghana': { lat: 7.9465, lng: -1.0232 },
    'Senegal': { lat: 14.4974, lng: -14.4524 },
    'Cameroon': { lat: 7.3697, lng: 12.3547 },
    'Ivory-Coast': { lat: 7.5400, lng: -5.5471 },
    'Kenya': { lat: -0.0236, lng: 37.9062 }
};

const COUNTRY_NAME_ALIASES = {
    'Czechia': 'Czech-Republic',
    'Czech Republic': 'Czech-Republic',
    'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
    'Bosnia-Herzegovina': 'Bosnia-Herzegovina',
    'Northern Ireland': 'Northern-Ireland',
    'North Macedonia': 'North-Macedonia',
    'South Korea': 'South-Korea',
    'Saudi Arabia': 'Saudi-Arabia',
    'UAE': 'United-Arab-Emirates',
    'United Arab Emirates': 'United-Arab-Emirates',
    'South Africa': 'South-Africa',
    'Ivory Coast': 'Ivory-Coast',
    "Cote d'Ivoire": 'Ivory-Coast'
};

const COUNTRY_BOUNDARY_SOURCES = {
    'England': [{ countryName: 'United Kingdom', areaName: 'England' }],
    'Scotland': [{ countryName: 'United Kingdom', areaName: 'Scotland' }],
    'Wales': [{ countryName: 'United Kingdom', areaName: 'Wales' }],
    'Northern-Ireland': [{ countryName: 'United Kingdom', areaName: 'Northern Ireland' }],
    'Ireland': [{ countryName: 'Ireland' }],
    'France': [{ countryName: 'France', areaName: 'Mainland' }, { countryName: 'France' }],
    'Spain': [{ countryName: 'Spain', areaName: 'Mainland' }, { countryName: 'Spain' }],
    'Portugal': [{ countryName: 'Portugal', areaName: 'Mainland' }, { countryName: 'Portugal' }],
    'Italy': [{ countryName: 'Italy', areaName: 'Mainland' }, { countryName: 'Italy' }],
    'Germany': [{ countryName: 'Germany' }],
    'Netherlands': [{ countryName: 'Netherlands', areaName: 'Mainland' }, { countryName: 'Netherlands' }],
    'Belgium': [{ countryName: 'Belgium' }],
    'Switzerland': [{ countryName: 'Switzerland' }],
    'Austria': [{ countryName: 'Austria' }],
    'Denmark': [{ countryName: 'Denmark', areaName: 'Mainland' }, { countryName: 'Denmark' }],
    'Sweden': [{ countryName: 'Sweden' }],
    'Norway': [{ countryName: 'Norway', areaName: 'Mainland' }, { countryName: 'Norway' }],
    'Finland': [{ countryName: 'Finland' }],
    'Iceland': [{ countryName: 'Iceland' }],
    'Poland': [{ countryName: 'Poland' }],
    'Czech-Republic': [{ countryName: 'Czech Republic' }, { countryName: 'Czechia' }],
    'Hungary': [{ countryName: 'Hungary' }],
    'Romania': [{ countryName: 'Romania' }],
    'Bulgaria': [{ countryName: 'Bulgaria' }],
    'Ukraine': [{ countryName: 'Ukraine' }],
    'Russia': [{ countryName: 'Russia' }],
    'Serbia': [{ countryName: 'Serbia' }],
    'Croatia': [{ countryName: 'Croatia' }],
    'Slovenia': [{ countryName: 'Slovenia' }],
    'Slovakia': [{ countryName: 'Slovakia' }],
    'Bosnia-Herzegovina': [{ countryName: 'Bosnia and Herzegovina' }, { countryName: 'Bosnia-Herzegovina' }],
    'Montenegro': [{ countryName: 'Montenegro' }],
    'North-Macedonia': [{ countryName: 'North Macedonia' }, { countryName: 'Macedonia' }],
    'Albania': [{ countryName: 'Albania' }],
    'Kosovo': [{ countryName: 'Kosovo' }],
    'Greece': [{ countryName: 'Greece' }],
    'Cyprus': [{ countryName: 'Cyprus' }],
    'Malta': [{ countryName: 'Malta' }],
    'Turkey': [{ countryName: 'Turkey' }],
    'Saudi-Arabia': [{ countryName: 'Saudi Arabia' }],
    'United-Arab-Emirates': [{ countryName: 'United Arab Emirates' }],
    'Qatar': [{ countryName: 'Qatar' }],
    'Israel': [{ countryName: 'Israel' }],
    'Iran': [{ countryName: 'Iran' }],
    'USA': [{ countryName: 'USA', areaName: 'Mainland' }, { countryName: 'U.S.A.', areaName: 'Mainland' }, { countryName: 'USA' }, { countryName: 'U.S.A.' }],
    'Canada': [{ countryName: 'Canada' }],
    'Mexico': [{ countryName: 'Mexico' }],
    'Brazil': [{ countryName: 'Brazil' }],
    'Argentina': [{ countryName: 'Argentina' }],
    'Colombia': [{ countryName: 'Colombia' }],
    'Chile': [{ countryName: 'Chile' }],
    'Peru': [{ countryName: 'Peru' }],
    'Ecuador': [{ countryName: 'Ecuador', areaName: 'Mainland' }, { countryName: 'Ecuador' }],
    'Uruguay': [{ countryName: 'Uruguay' }],
    'Paraguay': [{ countryName: 'Paraguay' }],
    'Venezuela': [{ countryName: 'Venezuela' }],
    'Bolivia': [{ countryName: 'Bolivia' }],
    'Japan': [{ countryName: 'Japan' }],
    'South-Korea': [{ countryName: 'South Korea' }, { countryName: 'Korea' }],
    'China': [{ countryName: 'China' }],
    'India': [{ countryName: 'India' }],
    'Australia': [{ countryName: 'Australia' }],
    'Indonesia': [{ countryName: 'Indonesia' }],
    'Thailand': [{ countryName: 'Thailand' }],
    'Vietnam': [{ countryName: 'Vietnam' }],
    'Malaysia': [{ countryName: 'Malaysia' }],
    'Singapore': [{ countryName: 'Singapore' }],
    'Egypt': [{ countryName: 'Egypt' }],
    'South-Africa': [{ countryName: 'South Africa' }],
    'Morocco': [{ countryName: 'Morocco' }],
    'Algeria': [{ countryName: 'Algeria' }],
    'Tunisia': [{ countryName: 'Tunisia' }],
    'Nigeria': [{ countryName: 'Nigeria' }],
    'Ghana': [{ countryName: 'Ghana' }],
    'Senegal': [{ countryName: 'Senegal' }],
    'Cameroon': [{ countryName: 'Cameroon' }],
    'Ivory-Coast': [{ countryName: 'Ivory Coast' }, { countryName: "Cote d'Ivoire" }],
    'Kenya': [{ countryName: 'Kenya' }]
};

const boundaryCache = new Map();

function normalizeCountryName(countryName) {
    if (!countryName) {
        return countryName;
    }

    return COUNTRY_NAME_ALIASES[countryName] || countryName;
}

function formatWorldGeoJsonName(name) {
    return name
        .replace(/ /g, '_')
        .replace(/\./g, '')
        .replace(/&/g, 'and')
        .toLowerCase();
}

function getBoundaryFilePath(source) {
    if (source.areaName) {
        return path.join(
            WORLD_GEOJSON_ROOT,
            'areas',
            formatWorldGeoJsonName(source.countryName),
            `${formatWorldGeoJsonName(source.areaName)}.json`
        );
    }

    return path.join(
        WORLD_GEOJSON_ROOT,
        'countries',
        `${formatWorldGeoJsonName(source.countryName)}.json`
    );
}

function normalizeLongitude(lng) {
    let normalized = lng;

    while (normalized > 180) {
        normalized -= 360;
    }

    while (normalized < -180) {
        normalized += 360;
    }

    return normalized;
}

function normalizeCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) {
        return coordinates;
    }

    if (coordinates.length === 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
        return [normalizeLongitude(coordinates[0]), coordinates[1]];
    }

    return coordinates.map(normalizeCoordinates);
}

function loadBoundaryForCountry(countryName) {
    const normalizedCountryName = normalizeCountryName(countryName);

    if (boundaryCache.has(normalizedCountryName)) {
        return boundaryCache.get(normalizedCountryName);
    }

    const sources = COUNTRY_BOUNDARY_SOURCES[normalizedCountryName] || [{ countryName: normalizedCountryName }];

    for (const source of sources) {
        const filePath = getBoundaryFilePath(source);
        if (!fs.existsSync(filePath)) {
            continue;
        }

        const rawGeoJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const normalizedGeoJson = {
            ...rawGeoJson,
            features: (rawGeoJson.features || []).map((feature) => ({
                ...feature,
                geometry: feature.geometry
                    ? {
                        ...feature.geometry,
                        coordinates: normalizeCoordinates(feature.geometry.coordinates)
                    }
                    : feature.geometry
            }))
        };

        boundaryCache.set(normalizedCountryName, normalizedGeoJson);
        return normalizedGeoJson;
    }

    boundaryCache.set(normalizedCountryName, null);
    return null;
}

function createBoundsPolygon(bounds) {
    return polygon([[
        [bounds.southwest.lng, bounds.southwest.lat],
        [bounds.northeast.lng, bounds.southwest.lat],
        [bounds.northeast.lng, bounds.northeast.lat],
        [bounds.southwest.lng, bounds.northeast.lat],
        [bounds.southwest.lng, bounds.southwest.lat]
    ]]);
}

function isCountryVisibleInBounds(countryName, bounds) {
    const boundary = loadBoundaryForCountry(countryName);
    if (!boundary || !boundary.features || boundary.features.length === 0) {
        return false;
    }

    const viewportPolygon = createBoundsPolygon(bounds);

    return boundary.features.some((feature) => {
        try {
            return booleanIntersects(feature, viewportPolygon);
        } catch (error) {
            return false;
        }
    });
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function detectPrimaryCountryFromCenter(bounds) {
    const centerLat = (bounds.northeast.lat + bounds.southwest.lat) / 2;
    const centerLng = (bounds.northeast.lng + bounds.southwest.lng) / 2;
    let primaryCountry = null;
    let minDistance = Infinity;
    const DISTANCE_THRESHOLD = 750;

    for (const [countryName, coords] of Object.entries(COUNTRY_CENTER_COORDS)) {
        const distance = calculateDistanceKm(centerLat, centerLng, coords.lat, coords.lng);
        if (distance < minDistance && distance < DISTANCE_THRESHOLD) {
            minDistance = distance;
            primaryCountry = countryName;
        }
    }

    if (!primaryCountry) {
        if (centerLat > 35 && centerLat < 71 && centerLng > -25 && centerLng < 60) {
            primaryCountry = 'Europe-Region';
        } else if (centerLat > -55 && centerLat < 75 && centerLng > -170 && centerLng < -30) {
            primaryCountry = 'Americas-Region';
        } else if (centerLat > -50 && centerLat < 75 && centerLng > 60 && centerLng < 180) {
            primaryCountry = 'AsiaPacific-Region';
        } else if (centerLat > -40 && centerLat < 40 && centerLng > -25 && centerLng < 60) {
            primaryCountry = 'Africa-Region';
        } else {
            primaryCountry = `Remote-${Math.round(centerLat)}-${Math.round(centerLng)}`;
        }
    }

    return {
        primaryCountry,
        centerLat,
        centerLng,
        distance: minDistance === Infinity ? null : minDistance
    };
}

function getIntersectingRegions(bounds) {
    const regions = new Set();

    for (const [region, regBounds] of Object.entries(REGION_BOUNDS)) {
        const latIntersects = Math.max(bounds.southwest.lat, regBounds.sw.lat) <= Math.min(bounds.northeast.lat, regBounds.ne.lat);
        const lngIntersects = Math.max(bounds.southwest.lng, regBounds.sw.lng) <= Math.min(bounds.northeast.lng, regBounds.ne.lng);
        if (latIntersects && lngIntersects) {
            regions.add(region);
        }
    }

    return regions;
}

function getVisibleCountries(bounds) {
    return Object.keys(COUNTRY_BOUNDARY_SOURCES)
        .filter((countryName) => isCountryVisibleInBounds(countryName, bounds))
        .map(normalizeCountryName)
        .sort();
}

function getVisibleSearchContext(bounds) {
    const visibleCountries = getVisibleCountries(bounds);
    const fallback = detectPrimaryCountryFromCenter(bounds);
    const activeRegions = getIntersectingRegions(bounds);

    return {
        bounds,
        visibleCountries,
        activeRegions,
        primaryCountry: visibleCountries[0] || fallback.primaryCountry,
        centerLat: fallback.centerLat,
        centerLng: fallback.centerLng,
        distance: fallback.distance
    };
}

function isRealCountry(countryName) {
    return !!countryName && !countryName.endsWith('-Region') && !countryName.startsWith('Remote-');
}

function getDomesticCountriesFromContext(searchContext) {
    const domesticCountries = new Set(
        (searchContext.visibleCountries || [])
            .map(normalizeCountryName)
            .filter(Boolean)
    );

    const normalizedPrimaryCountry = normalizeCountryName(searchContext.primaryCountry);

    if (isRealCountry(normalizedPrimaryCountry)) {
        domesticCountries.add(normalizedPrimaryCountry);
    }

    if (domesticCountries.size === 0 && REGIONAL_FALLBACK_COUNTRIES[normalizedPrimaryCountry]) {
        REGIONAL_FALLBACK_COUNTRIES[normalizedPrimaryCountry].forEach((countryName) => {
            domesticCountries.add(countryName);
        });
    }

    return Array.from(domesticCountries);
}

module.exports = {
    REGION_BOUNDS,
    REGIONAL_FALLBACK_COUNTRIES,
    calculateDistanceKm,
    getIntersectingRegions,
    getVisibleCountries,
    getVisibleSearchContext,
    getDomesticCountriesFromContext,
    normalizeCountryName
};
