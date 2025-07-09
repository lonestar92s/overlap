const mongoose = require('mongoose');
require('dotenv').config();
const Team = require('../src/models/Team');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const bundesligaTeams = await Team.find({ country: 'Germany' });
  bundesligaTeams.forEach(team => {
    console.log(`${team.name}: city='${team.city}', venue.city='${team.venue?.city || ''}'`);
  });
  await mongoose.disconnect();
}

main(); 