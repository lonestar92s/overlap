// Competition priority policy for team-first, no-location NL queries.
// Order: primary domestic league(s) -> domestic cups -> continental competitions.

const COUNTRY_POLICY = {
  'United Kingdom': {
    domesticCupIds: ['45', '48', '528'] // FA Cup, League Cup (EFL), Community Shield
  },
  'England': {
    domesticCupIds: ['45', '48', '528']
  },
  'Spain': {
    domesticCupIds: ['143', '556'] // Copa del Rey, Super Cup (if available)
  },
  'Germany': {
    domesticCupIds: ['81'] // DFB Pokal
  },
  'Italy': {
    domesticCupIds: ['137'] // Coppa Italia
  },
  'France': {
    domesticCupIds: ['66'] // Coupe de France
  },
  'Portugal': {
    domesticCupIds: ['97'] // Taca da Liga (known in current mapping)
  },
  'Netherlands': {
    domesticCupIds: []
  },
  'USA': {
    domesticCupIds: []
  },
  'United States': {
    domesticCupIds: []
  },
  'Brazil': {
    domesticCupIds: []
  },
  'Argentina': {
    domesticCupIds: []
  }
};

const COUNTRY_TO_CONFEDERATION = {
  'United Kingdom': 'UEFA',
  'England': 'UEFA',
  'Spain': 'UEFA',
  'Germany': 'UEFA',
  'France': 'UEFA',
  'Italy': 'UEFA',
  'Portugal': 'UEFA',
  'Netherlands': 'UEFA',
  'Belgium': 'UEFA',
  'Scotland': 'UEFA',
  'Turkey': 'UEFA',
  'Austria': 'UEFA',
  'Switzerland': 'UEFA',
  'Croatia': 'UEFA',
  'United States': 'CONCACAF',
  'USA': 'CONCACAF',
  'Mexico': 'CONCACAF',
  'Brazil': 'CONMEBOL',
  'Argentina': 'CONMEBOL',
  'Uruguay': 'CONMEBOL',
  'Colombia': 'CONMEBOL'
};

const CONTINENTAL_POLICY = {
  UEFA: ['2', '3', '848'], // Champions League, Europa League, Conference League
  CONMEBOL: ['13'], // Copa Libertadores
  CONCACAF: [],
  CAF: [],
  AFC: [],
  OFC: []
};

const DEFAULT_MAX_COMPETITIONS = 6;

module.exports = {
  COUNTRY_POLICY,
  COUNTRY_TO_CONFEDERATION,
  CONTINENTAL_POLICY,
  DEFAULT_MAX_COMPETITIONS
};
