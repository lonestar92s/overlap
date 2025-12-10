/**
 * Team Ticketing URL Mapping
 * 
 * Maps team names to their official ticketing pages.
 * These are general ticketing pages, not match-specific URLs.
 * 
 * To add new teams:
 * 1. Add entry: "Team Name": "https://ticketing-url.com"
 * 2. Run populateTicketingUrls.js script to sync to database
 */

// Premier League
const PREMIER_LEAGUE_TICKETING = {
    "Arsenal FC": "https://www.arsenal.com/tickets",
    "Aston Villa FC": "https://www.avfc.co.uk/tickets",
    "Brentford FC": "https://www.brentfordfc.com/tickets",
    "Brighton & Hove Albion FC": "https://www.brightonandhovealbion.com/tickets",
    "Burnley FC": "https://www.burnleyfootballclub.com/tickets",
    "Chelsea FC": "https://www.chelseafc.com/en/tickets/mens-tickets",
    "Crystal Palace FC": "https://www.cpfc.co.uk/tickets",
    "Everton FC": "https://www.evertonfc.com/tickets",
    "Fulham FC": "https://www.fulhamfc.com/tickets",
    "Liverpool FC": "https://www.liverpoolfc.com/tickets",
    "Luton Town FC": "https://www.lutontown.co.uk/tickets",
    "Manchester City FC": "https://www.mancity.com/tickets",
    "Manchester United FC": "https://www.manutd.com/en/tickets-and-hospitality",
    "Newcastle United FC": "https://www.nufc.co.uk/tickets",
    "Nottingham Forest FC": "https://www.nottinghamforest.co.uk/tickets",
    "Sheffield United FC": "https://www.sufc.co.uk/tickets",
    "Tottenham Hotspur FC": "https://www.tottenhamhotspur.com/tickets",
    "West Ham United FC": "https://www.whufc.com/tickets",
    "Wolverhampton Wanderers FC": "https://www.wolves.co.uk/tickets"
};

// La Liga
const LA_LIGA_TICKETING = {
    "Real Madrid CF": "https://www.realmadrid.com/en/tickets",
    "FC Barcelona": "https://www.fcbarcelona.com/en/tickets",
    "Atlético de Madrid": "https://www.atleticodemadrid.com/en/tickets",
    "Sevilla FC": "https://www.sevillafc.es/en/tickets",
    "Valencia CF": "https://www.valenciacf.com/en/tickets",
    "Real Betis Balompié": "https://www.realbetisbalompie.es/en/tickets",
    "Villarreal CF": "https://www.villarrealcf.es/en/tickets",
    "Athletic Club": "https://www.athletic-club.eus/en/tickets",
    "Real Sociedad": "https://www.realsociedad.eus/en/tickets",
    "RC Celta de Vigo": "https://www.rccelta.es/en/tickets"
};

// Bundesliga
const BUNDESLIGA_TICKETING = {
    "FC Bayern München": "https://fcbayern.com/en/tickets",
    "Borussia Dortmund": "https://www.bvb.de/eng/Tickets",
    "RB Leipzig": "https://www.rbleipzig.com/en/tickets",
    "Bayer 04 Leverkusen": "https://www.bayer04.de/en-us/tickets",
    "Eintracht Frankfurt": "https://www.eintracht.de/en/tickets",
    "VfL Wolfsburg": "https://www.vfl-wolfsburg.de/en/tickets",
    "SC Freiburg": "https://www.scfreiburg.com/en/tickets",
    "1. FC Union Berlin": "https://www.fc-union-berlin.de/en/tickets",
    "VfB Stuttgart": "https://www.vfb.de/en/tickets",
    "Borussia Mönchengladbach": "https://www.borussia.de/en/tickets",
    "Werder Bremen": "https://www.werder.de/en/tickets",
    "1. FC Heidenheim": "https://www.fc-heidenheim.de/tickets",
    "TSG Hoffenheim": "https://www.tsg-hoffenheim.de/en/tickets",
    "1. FSV Mainz 05": "https://www.mainz05.de/en/tickets",
    "FC Augsburg": "https://www.fcaugsburg.de/en/tickets"
};

// Serie A
const SERIE_A_TICKETING = {
    "AC Milan": "https://www.acmilan.com/en/tickets",
    "Inter": "https://www.inter.it/en/tickets",
    "Juventus": "https://www.juventus.com/en/tickets",
    "AS Roma": "https://www.asroma.com/en/tickets",
    "Napoli": "https://www.sscnapoli.it/en/tickets",
    "Lazio": "https://www.sslazio.it/en/tickets",
    "Atalanta": "https://www.atalanta.it/en/tickets",
    "Fiorentina": "https://www.acffiorentina.com/en/tickets"
};

// Ligue 1
const LIGUE_1_TICKETING = {
    "Paris Saint Germain": "https://www.psg.fr/en/tickets",
    "AS Monaco": "https://www.asmonaco.com/en/tickets",
    "Olympique Marseille": "https://www.om.fr/en/tickets",
    "Olympique Lyon": "https://www.ol.fr/en/tickets",
    "Lille OSC": "https://www.losc.fr/en/tickets",
    "OGC Nice": "https://www.ogcnice.com/en/tickets"
};

// MLS
const MLS_TICKETING = {
    "Atlanta United FC": "https://www.atlutd.com/tickets",
    "Austin FC": "https://www.austinfc.com/tickets",
    "Chicago Fire FC": "https://www.chicago-fire.com/tickets",
    "FC Cincinnati": "https://www.fccincinnati.com/tickets",
    "Colorado Rapids": "https://www.coloradorapids.com/tickets",
    "Columbus Crew": "https://www.columbuscrew.com/tickets",
    "FC Dallas": "https://www.fcdallas.com/tickets",
    "D.C. United": "https://www.dcunited.com/tickets",
    "Houston Dynamo FC": "https://www.houstondynamofc.com/tickets",
    "Inter Miami CF": "https://www.intermiamicf.com/tickets",
    "LA Galaxy": "https://www.lagalaxy.com/tickets",
    "Los Angeles FC": "https://www.lafc.com/tickets",
    "Minnesota United FC": "https://www.mnufc.com/tickets",
    "CF Montréal": "https://www.cfmontreal.com/en/tickets",
    "Nashville SC": "https://www.nashvillesc.com/tickets",
    "New England Revolution": "https://www.revolutionsoccer.net/tickets",
    "New York City FC": "https://www.nycfc.com/tickets",
    "New York Red Bulls": "https://www.newyorkredbulls.com/tickets",
    "Orlando City SC": "https://www.orlandocitysc.com/tickets",
    "Philadelphia Union": "https://www.philadelphiaunion.com/tickets",
    "Portland Timbers": "https://www.timbers.com/tickets",
    "Real Salt Lake": "https://www.rsl.com/tickets",
    "San Jose Earthquakes": "https://www.sjearthquakes.com/tickets",
    "Seattle Sounders FC": "https://www.soundersfc.com/tickets",
    "Sporting Kansas City": "https://www.sportingkc.com/tickets",
    "St. Louis City SC": "https://www.stlcitysc.com/tickets",
    "Toronto FC": "https://www.torontofc.ca/tickets",
    "Vancouver Whitecaps FC": "https://www.whitecapsfc.com/tickets"
};

// Combine all mappings
const TEAM_TICKETING_URLS = {
    ...PREMIER_LEAGUE_TICKETING,
    ...LA_LIGA_TICKETING,
    ...BUNDESLIGA_TICKETING,
    ...SERIE_A_TICKETING,
    ...LIGUE_1_TICKETING,
    ...MLS_TICKETING
};

module.exports = {
    PREMIER_LEAGUE_TICKETING,
    LA_LIGA_TICKETING,
    BUNDESLIGA_TICKETING,
    SERIE_A_TICKETING,
    LIGUE_1_TICKETING,
    MLS_TICKETING,
    TEAM_TICKETING_URLS
};
