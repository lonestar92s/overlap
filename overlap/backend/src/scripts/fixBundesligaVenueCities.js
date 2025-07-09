const mongoose = require('mongoose');
require('dotenv').config();
const Team = require('../models/Team');

// Mapping of team name to correct city and country
const venueCityCountry = {
  'FC Bayern München': { city: 'Munich', country: 'Germany' },
  'Borussia Dortmund': { city: 'Dortmund', country: 'Germany' },
  'SC Freiburg': { city: 'Freiburg', country: 'Germany' },
  'VfL Wolfsburg': { city: 'Wolfsburg', country: 'Germany' },
  'Borussia Mönchengladbach': { city: 'Mönchengladbach', country: 'Germany' },
  '1. FSV Mainz 05': { city: 'Mainz', country: 'Germany' },
  '1. FC Heidenheim': { city: 'Heidenheim', country: 'Germany' },
  '1. FC Union Berlin': { city: 'Berlin', country: 'Germany' },
  'FC St. Pauli': { city: 'Hamburg', country: 'Germany' },
  '1. FC Köln': { city: 'Cologne', country: 'Germany' },
  'TSG 1899 Hoffenheim': { city: 'Sinsheim', country: 'Germany' },
  'Bayer 04 Leverkusen': { city: 'Leverkusen', country: 'Germany' },
  'Eintracht Frankfurt': { city: 'Frankfurt', country: 'Germany' },
  'FC Augsburg': { city: 'Augsburg', country: 'Germany' },
  'Hamburger SV': { city: 'Hamburg', country: 'Germany' },
  'RB Leipzig': { city: 'Leipzig', country: 'Germany' },
  'VfB Stuttgart': { city: 'Stuttgart', country: 'Germany' },
  'SV Werder Bremen': { city: 'Bremen', country: 'Germany' }
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  let updated = 0;
  for (const [teamName, { city, country }] of Object.entries(venueCityCountry)) {
    const teams = await Team.find({ name: teamName });
    for (const team of teams) {
      if (team.venue) {
        team.venue.city = city;
        team.venue.country = country;
        await team.save();
        updated++;
        console.log(`✅ Updated ${team.name}: venue.city='${city}', venue.country='${country}'`);
      } else {
        console.log(`⚠️  No venue object for ${team.name}`);
      }
    }
  }
  await mongoose.disconnect();
  console.log(`\nDone. Updated ${updated} team(s).`);
}

main(); 