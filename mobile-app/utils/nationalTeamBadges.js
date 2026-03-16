/**
 * Local national team / federation badge assets (from fifa-world-cup-2026 pack).
 * Used for international teams instead of remote logos or country flags.
 *
 * Map is: normalized team/country name (lowercase, no accents) -> require(asset).
 * React Native requires static require() paths, so we use a lookup object.
 */

const BADGES = {
  algeria: require('../assets/national-teams/algeria-national-team.football-logos.cc.png'),
  argentina: require('../assets/national-teams/argentina-national-team.football-logos.cc.png'),
  australia: require('../assets/national-teams/australia-national-team.football-logos.cc.png'),
  austria: require('../assets/national-teams/austria-national-team.football-logos.cc.png'),
  belgium: require('../assets/national-teams/belgium-national-team.football-logos.cc.png'),
  brazil: require('../assets/national-teams/brazil-national-team.football-logos.cc.png'),
  'cabo-verde': require('../assets/national-teams/cabo-verde-national-team.football-logos.cc.png'),
  canada: require('../assets/national-teams/canada-national-team.football-logos.cc.png'),
  colombia: require('../assets/national-teams/colombia-national-team.football-logos.cc.png'),
  'cote-d-ivoire': require('../assets/national-teams/cote-d-ivoire-national-team.football-logos.cc.png'),
  croatia: require('../assets/national-teams/croatia-national-team.football-logos.cc.png'),
  curacao: require('../assets/national-teams/curacao-national-team.football-logos.cc.png'),
  netherlands: require('../assets/national-teams/dutch-national-team.football-logos.cc.png'),
  ecuador: require('../assets/national-teams/ecuador-national-team.football-logos.cc.png'),
  egypt: require('../assets/national-teams/egypt-national-team.football-logos.cc.png'),
  england: require('../assets/national-teams/england-national-team.football-logos.cc.png'),
  france: require('../assets/national-teams/france-national-team.football-logos.cc.png'),
  germany: require('../assets/national-teams/germany-national-team.football-logos.cc.png'),
  ghana: require('../assets/national-teams/ghana-national-team.football-logos.cc.png'),
  haiti: require('../assets/national-teams/haiti-national-team.football-logos.cc.png'),
  iran: require('../assets/national-teams/iran-national-team.football-logos.cc.png'),
  japan: require('../assets/national-teams/japan-national-team.football-logos.cc.png'),
  jordan: require('../assets/national-teams/jordan-national-team.football-logos.cc.png'),
  mexico: require('../assets/national-teams/mexico-national-team.football-logos.cc.png'),
  morocco: require('../assets/national-teams/morocco-national-team.football-logos.cc.png'),
  'new-zealand': require('../assets/national-teams/new-zealand-national-team.football-logos.cc.png'),
  norway: require('../assets/national-teams/norway-national-team.football-logos.cc.png'),
  panama: require('../assets/national-teams/panama-national-team.football-logos.cc.png'),
  paraguay: require('../assets/national-teams/paraguay-national-team.football-logos.cc.png'),
  portugal: require('../assets/national-teams/portuguese-football-federation.football-logos.cc.png'),
  qatar: require('../assets/national-teams/qatar-national-team.football-logos.cc.png'),
  'saudi-arabia': require('../assets/national-teams/saudi-arabia-national-team.football-logos.cc.png'),
  scotland: require('../assets/national-teams/scotland-national-team.football-logos.cc.png'),
  senegal: require('../assets/national-teams/senegal-national-team.football-logos.cc.png'),
  'south-africa': require('../assets/national-teams/south-africa-national-team.football-logos.cc.png'),
  'south-korea': require('../assets/national-teams/south-korea-national-team.football-logos.cc.png'),
  spain: require('../assets/national-teams/spain-national-team.football-logos.cc.png'),
  switzerland: require('../assets/national-teams/switzerland-national-team.football-logos.cc.png'),
  tunisia: require('../assets/national-teams/tunisia-national-team.football-logos.cc.png'),
  uruguay: require('../assets/national-teams/uruguay-national-team.football-logos.cc.png'),
  usa: require('../assets/national-teams/usa-national-team.football-logos.cc.png'),
  uzbekistan: require('../assets/national-teams/uzbekistan-national-team.football-logos.cc.png'),
};

/** Normalize team or country name for lookup (lowercase, collapse spaces/dashes, remove accents). */
function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aliases: API/display names -> BADGES key */
const ALIASES = {
  'united states': 'usa',
  'u.s.a.': 'usa',
  'us': 'usa',
  'united states of america': 'usa',
  'ivory coast': 'cote-d-ivoire',
  "cote d'ivoire": 'cote-d-ivoire',
  'cape verde': 'cabo-verde',
  'korea republic': 'south-korea',
  'korea': 'south-korea',
  'republic of korea': 'south-korea',
  'holland': 'netherlands',
  'new zealand': 'new-zealand',
  'saudi arabia': 'saudi-arabia',
  'south africa': 'south-africa',
  'south korea': 'south-korea',
};

/**
 * Get local national team badge source for a team name (or country).
 * Returns require() source or null if no badge.
 *
 * @param {string} teamNameOrCountry - e.g. "England", "Brazil", "USA"
 * @returns {{ uri?: string } | number | null} - source for <Image source={...} /> or null
 */
export function getNationalTeamBadgeSource(teamNameOrCountry) {
  const normalized = normalizeName(teamNameOrCountry);
  if (!normalized) return null;

  const key = ALIASES[normalized] || normalized.replace(/\s+/g, '-');
  const source = BADGES[key];
  return source ?? null;
}

/**
 * Whether the match is an international one (league country is International/Europe or similar).
 * When true, we prefer local national team badges over remote logos when available.
 */
export function isInternationalMatch(match) {
  const country = match?.league?.country ?? match?.competition?.area?.name ?? match?.area?.name ?? '';
  if (!country || typeof country !== 'string') return false;
  const c = country.toLowerCase();
  return c === 'international' || c === 'europe' || c === 'world';
}
