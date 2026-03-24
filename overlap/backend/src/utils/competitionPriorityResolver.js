const {
  COUNTRY_POLICY,
  COUNTRY_TO_CONFEDERATION,
  CONTINENTAL_POLICY,
  DEFAULT_MAX_COMPETITIONS
} = require('../config/competitionPriorityPolicy');

function buildPrioritizedCompetitionIds({
  primaryLeagueIds = [],
  country = null,
  maxCompetitions = DEFAULT_MAX_COMPETITIONS
}) {
  const out = [];
  const pushUnique = (id) => {
    const s = String(id);
    if (!out.includes(s)) {
      out.push(s);
    }
  };

  primaryLeagueIds.forEach(pushUnique);

  if (country) {
    const countryPolicy = COUNTRY_POLICY[country];
    if (countryPolicy?.domesticCupIds?.length) {
      countryPolicy.domesticCupIds.forEach(pushUnique);
    }

    const confed = COUNTRY_TO_CONFEDERATION[country];
    if (confed && CONTINENTAL_POLICY[confed]) {
      CONTINENTAL_POLICY[confed].forEach(pushUnique);
    }
  }

  return out.slice(0, maxCompetitions);
}

module.exports = {
  buildPrioritizedCompetitionIds
};
