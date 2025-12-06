/**
 * Script to identify and fix corrupted venue coordinates
 * 
 * Run with: node src/scripts/fixCorruptedVenueCoordinates.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Venue = require('../models/Venue');
const geocodingService = require('../services/geocodingService');

// Known corrupted venues with their correct coordinates
const VENUE_CORRECTIONS = {
  // Vitality Stadium - Bournemouth, UK (not New York!)
  504: {
    name: 'Vitality Stadium',
    city: 'Bournemouth',
    country: 'England',
    correctCoordinates: [-1.8384, 50.7352] // [lng, lat] - GeoJSON format
  },
  // Emirates Stadium - London, UK (not New Zealand!)
  494: {
    name: 'Emirates Stadium', 
    city: 'London',
    country: 'England',
    correctCoordinates: [-0.1086, 51.5549] // [lng, lat]
  },
  // St. James' Park - Newcastle, UK
  562: {
    name: "St. James' Park",
    city: 'Newcastle upon Tyne',
    country: 'England',
    correctCoordinates: [-1.621667, 54.975556] // [lng, lat] - precise coordinates
  },
  // Elland Road - Leeds, UK
  546: {
    name: 'Elland Road',
    city: 'Leeds',
    country: 'England',
    correctCoordinates: [-1.572222, 53.777778] // [lng, lat] - precise coordinates
  },
  // Estadi Municipal de Montilivi - Girona, Spain
  1478: {
    name: 'Estadi Municipal de Montilivi',
    city: 'Girona',
    country: 'Spain',
    correctCoordinates: [2.828996, 41.961230] // [lng, lat]
  },
  // Reale Arena - San Sebastián, Spain
  1491: {
    name: 'Reale Arena',
    city: 'Donostia-San Sebastián',
    country: 'Spain',
    correctCoordinates: [-1.973569, 43.301390] // [lng, lat]
  },
  // Estadio Coliseum - Getafe, Spain
  20422: {
    name: 'Estadio Coliseum',
    city: 'Getafe',
    country: 'Spain',
    correctCoordinates: [-3.714933, 40.325725] // [lng, lat]
  },
  // Volksparkstadion - Hamburg, Germany
  720: {
    name: 'Volksparkstadion',
    city: 'Hamburg',
    country: 'Germany',
    correctCoordinates: [9.898706, 53.587154] // [lng, lat]
  },
  // Celtic Park - Glasgow, Scotland
  1386: {
    name: 'Celtic Park',
    city: 'Glasgow',
    country: 'Scotland',
    correctCoordinates: [-4.206823, 55.850181] // [lng, lat]
  },
  // Stade Gabriel-Montpied - Clermont-Ferrand, France
  21429: {
    name: 'Stade Gabriel-Montpied',
    city: 'Clermont-Ferrand',
    country: 'France',
    correctCoordinates: [3.121500, 45.815877] // [lng, lat]
  },
  // Park Hall Stadium - Oswestry, Wales
  1684: {
    name: 'Park Hall Stadium',
    city: 'Oswestry / Croesoswallt, Shropshire',
    country: 'Wales',
    correctCoordinates: [-3.026785, 52.875571] // [lng, lat]
  },
  // Additional corrections from geocoding
  491: {
    name: 'Mill Farm Stadium',
    city: 'Wesham',
    country: 'England',
    correctCoordinates: [-2.88971222672844, 53.797399799999994] // [lng, lat]
  },
  493: {
    name: 'Electrical Services Stadium',
    city: 'Aldershot, Hampshire',
    country: 'England',
    correctCoordinates: [-1.06501, 50.818754] // [lng, lat]
  },
  648: {
    name: 'Stade Ange Casanova',
    city: 'Ajaccio',
    country: 'France',
    correctCoordinates: [8.771950548735202, 41.951326] // [lng, lat]
  },
  747: {
    name: 'Donaustadion',
    city: 'Ulm',
    country: 'Germany',
    correctCoordinates: [10.009386689538044, 48.4045157] // [lng, lat]
  },
  886: {
    name: 'Stadio Comunale Alberto Pinto',
    city: 'Caserta',
    country: 'Italy',
    correctCoordinates: [14.34639212360069, 41.07446605] // [lng, lat]
  },
  1384: {
    name: 'Indodrill Stadium',
    city: 'Alloa',
    country: 'Scotland',
    correctCoordinates: [-3.7786443861654595, 56.116556849999995] // [lng, lat]
  },
  1388: {
    name: 'Tannadice Park',
    city: 'Dundee',
    country: 'Scotland',
    correctCoordinates: [-2.9690462572946066, 56.47458035] // [lng, lat]
  },
  1395: {
    name: 'Tulloch Caledonian Stadium',
    city: 'Inverness',
    country: 'Scotland',
    correctCoordinates: [-4.216973233562136, 57.4947132] // [lng, lat]
  },
  1458: {
    name: 'Estadio Carlos Belmonte',
    city: 'Albacete',
    country: 'Spain',
    correctCoordinates: [-1.8521439618755478, 38.9810821] // [lng, lat]
  },
  1464: {
    name: 'Estadio Municipal de Butarque',
    city: 'Leganés',
    country: 'Spain',
    correctCoordinates: [-3.7606429639200516, 40.34056215] // [lng, lat]
  },
  1465: {
    name: 'Estadio Anxo Carro',
    city: 'Lugo',
    country: 'Spain',
    correctCoordinates: [-7.5709840782925415, 43.00334225] // [lng, lat]
  },
  1468: {
    name: 'Estadio Camp Nou Municipal',
    city: 'Reus',
    country: 'Spain',
    correctCoordinates: [-3.692501, 37.740892] // [lng, lat]
  },
  1471: {
    name: 'Estadio Abanca-Riazor',
    city: 'La Coruña',
    country: 'Spain',
    correctCoordinates: [-8.417509838016294, 43.368715699999996] // [lng, lat]
  },
  1472: {
    name: 'Estadio Municipal de Ipurúa',
    city: 'Eibar',
    country: 'Spain',
    correctCoordinates: [-7.597583, 43.668191] // [lng, lat]
  },
  1480: {
    name: 'Estadio El Alcoraz',
    city: 'Huesca',
    country: 'Spain',
    correctCoordinates: [-0.4241424500487978, 42.13186235] // [lng, lat]
  },
  1483: {
    name: 'Estadio La Rosaleda',
    city: 'Málaga',
    country: 'Spain',
    correctCoordinates: [-4.426535165860329, 36.734959700000005] // [lng, lat]
  },
  1667: {
    name: 'Park Avenue',
    city: 'Aberystwyth, Ceredigion',
    country: 'Wales',
    correctCoordinates: [-4.074568, 52.4088797] // [lng, lat]
  },
  1670: {
    name: 'Jenner Park',
    city: 'Barry / Y Barri, Vale of Glamorgan',
    country: 'Wales',
    correctCoordinates: [-3.2657803260002787, 51.410913699999995] // [lng, lat]
  },
  1671: {
    name: 'Old Road',
    city: 'Briton Ferry',
    country: 'Wales',
    correctCoordinates: [-3.8164236, 51.6408919] // [lng, lat]
  },
  1678: {
    name: 'New Bridge Meadow Stadium',
    city: 'Hwlffordd / Haverfordwest, Pembrokeshie',
    country: 'Wales',
    correctCoordinates: [-4.967711, 51.809172] // [lng, lat]
  },
  1996: {
    name: 'Stade des Allées Jean Leroi',
    city: 'Blois',
    country: 'France',
    correctCoordinates: [1.451242, 43.607583] // [lng, lat]
  },
  2009: {
    name: 'Stade Henri Seigneur',
    city: 'Croix',
    country: 'France',
    correctCoordinates: [3.151045, 50.678001] // [lng, lat]
  },
  2040: {
    name: 'Stade Marcel-Billard',
    city: 'Oissel',
    country: 'France',
    correctCoordinates: [1.0890969650763833, 49.351616899999996] // [lng, lat]
  },
  2918: {
    name: 'Estadio Francisco Artés Carrasco',
    city: 'Lorca',
    country: 'Spain',
    correctCoordinates: [-1.735183081086514, 37.63882425] // [lng, lat]
  },
  3246: {
    name: 'Links Park',
    city: 'Montrose',
    country: 'Scotland',
    correctCoordinates: [-2.459112515250773, 56.71370505] // [lng, lat]
  },
  3254: {
    name: 'Neuer Tivoli',
    city: 'Aachen',
    country: 'Germany',
    correctCoordinates: [6.096494, 50.781685] // [lng, lat]
  },
  3260: {
    name: 'SPORTCLUB Arena',
    city: 'Verl',
    country: 'Germany',
    correctCoordinates: [8.513382427109317, 51.88349895] // [lng, lat]
  },
  3518: {
    name: 'Central Park',
    city: 'Cowdenbeath',
    country: 'Scotland',
    correctCoordinates: [-3.3471341958577003, 56.108888199999996] // [lng, lat]
  },
  3707: {
    name: 'Estadio Fernando Torres',
    city: 'Fuenlabrada',
    country: 'Spain',
    correctCoordinates: [-3.8266897721006643, 40.29111255] // [lng, lat]
  },
  3996: {
    name: 'Estadio Municipal Villanovense',
    city: 'Villanueva de la Serena',
    country: 'Spain',
    correctCoordinates: [-5.78628805, 38.97476295] // [lng, lat]
  },
  4928: {
    name: 'Prestonfield',
    city: 'Linlithgow',
    country: 'Scotland',
    correctCoordinates: [-3.6122152527989835, 55.9726674] // [lng, lat]
  },
  4939: {
    name: 'Galabank',
    city: 'Annan',
    country: 'Scotland',
    correctCoordinates: [-3.261417238745259, 54.99464245] // [lng, lat]
  },
  4943: {
    name: 'Balmoral Stadium',
    city: 'Aberdeen',
    country: 'Scotland',
    correctCoordinates: [-2.096828425990587, 57.11256605] // [lng, lat]
  },
  4945: {
    name: 'K Park Training Academy',
    city: 'East Kilbride',
    country: 'Scotland',
    correctCoordinates: [-4.150074579014255, 55.748843300000004] // [lng, lat]
  },
  4946: {
    name: 'Ainslie Park Stadium',
    city: 'Edinburgh',
    country: 'Scotland',
    correctCoordinates: [-3.2322494298975837, 55.970990900000004] // [lng, lat]
  },
  4949: {
    name: 'Bellslea Park',
    city: 'Fraserburgh',
    country: 'Scotland',
    correctCoordinates: [-2.0052834111829614, 57.689369400000004] // [lng, lat]
  },
  4950: {
    name: 'New Central Park',
    city: 'Kelty',
    country: 'Scotland',
    correctCoordinates: [-3.37925666498467, 56.136158699999996] // [lng, lat]
  },
  4951: {
    name: 'Balmoor Stadium',
    city: 'Peterhead',
    country: 'Scotland',
    correctCoordinates: [-1.7958369005124721, 57.511075250000005] // [lng, lat]
  },
  4953: {
    name: 'Stair Park',
    city: 'Stranraer',
    country: 'Scotland',
    correctCoordinates: [-5.0124846460281, 54.902201399999996] // [lng, lat]
  },
  5413: {
    name: 'Victoria Park',
    city: 'Buckie',
    country: 'Scotland',
    correctCoordinates: [-2.9670578909332788, 57.6723322] // [lng, lat]
  },
  5418: {
    name: 'Princess Royal Park',
    city: 'Banff',
    country: 'Scotland',
    correctCoordinates: [-2.517996294549488, 57.6634919] // [lng, lat]
  },
  5420: {
    name: 'Mosset Park',
    city: 'Forres',
    country: 'Scotland',
    correctCoordinates: [-3.615034193925548, 57.61288825] // [lng, lat]
  },
  5423: {
    name: 'Raydale Park',
    city: 'Gretna',
    country: 'Scotland',
    correctCoordinates: [-3.0725147731835527, 54.99328225] // [lng, lat]
  },
  5429: {
    name: 'Seafield Park',
    city: 'Grantown-on-Spey',
    country: 'Scotland',
    correctCoordinates: [-3.6006805839616995, 57.3328796] // [lng, lat]
  },
  5432: {
    name: 'Harmsworth Park',
    city: 'Wick',
    country: 'Scotland',
    correctCoordinates: [-3.0933464237924104, 58.4328614] // [lng, lat]
  },
  5458: {
    name: 'Christie Park',
    city: 'Huntly',
    country: 'Scotland',
    correctCoordinates: [-2.7831805555850693, 57.4491532] // [lng, lat]
  },
  5460: {
    name: 'Estadio Municipal San Benito',
    city: 'Porcuna',
    country: 'Spain',
    correctCoordinates: [-4.176793, 37.870897] // [lng, lat]
  },
  5461: {
    name: 'Estadio La Espiguera',
    city: 'Melilla',
    country: 'Spain',
    correctCoordinates: [-3.692501, 37.740892] // [lng, lat]
  },
  6438: {
    name: 'Vöhlin-Stadion',
    city: 'Illertissen',
    country: 'Germany',
    correctCoordinates: [10.108614, 48.223015] // [lng, lat]
  },
  6470: {
    name: 'Sportpark Husterhöhe',
    city: 'Pirmasens',
    country: 'Germany',
    correctCoordinates: [7.601581, 49.203633] // [lng, lat]
  },
  6500: {
    name: 'Estadio Municipal de Linarejos',
    city: 'Linares',
    country: 'Spain',
    correctCoordinates: [-3.622981710299437, 38.10310645] // [lng, lat]
  },
  6515: {
    name: 'Campo de Fútbol Juan Guedes',
    city: 'Las Palmas de Gran Canaria',
    country: 'Spain',
    correctCoordinates: [-4.63981, 36.546047] // [lng, lat]
  },
  6516: {
    name: 'Estadio Municipal de Tarazona',
    city: 'Tarazona',
    country: 'Spain',
    correctCoordinates: [-1.6132325386092141, 42.0481934] // [lng, lat]
  },
  6589: {
    name: 'Stadio Leporaia',
    city: 'San Miniato',
    country: 'Italy',
    correctCoordinates: [10.798901, 43.683866] // [lng, lat]
  },
  6682: {
    name: 'Estadio de Luchán',
    city: 'Ejea de los Caballeros',
    country: 'Spain',
    correctCoordinates: [-1.123933, 42.12588] // [lng, lat]
  },
  6686: {
    name: 'Estadi de la Nova Creu Alta',
    city: 'Sabadell',
    country: 'Spain',
    correctCoordinates: [2.091332956531592, 41.55472465] // [lng, lat]
  },
  6777: {
    name: 'Campo Municipal El Collao',
    city: 'Alcoy',
    country: 'Spain',
    correctCoordinates: [-0.49031, 38.691171] // [lng, lat]
  },
  6783: {
    name: 'Estadio Municipal Nuevo Pepico Amat',
    city: 'Elda',
    country: 'Spain',
    correctCoordinates: [-6.089127, 36.286921] // [lng, lat]
  },
  6785: {
    name: 'Ciudad Deportiva de San Vicente del Raspeig',
    city: 'San Vicente del Raspeig',
    country: 'Spain',
    correctCoordinates: [-0.522173832986639, 38.40368745] // [lng, lat]
  },
  6790: {
    name: 'Estadio Nou Camp de Morvedre',
    city: 'Sagunt',
    country: 'Spain',
    correctCoordinates: [-0.058367, 39.97831] // [lng, lat]
  },
  6800: {
    name: 'Estadio Anexo Butarque',
    city: 'Leganés',
    country: 'Spain',
    correctCoordinates: [-3.760632, 40.340474] // [lng, lat]
  },
  6801: {
    name: 'Estadio Municipal de El Soto',
    city: 'Móstoles',
    country: 'Spain',
    correctCoordinates: [-3.606735, 40.025591] // [lng, lat]
  },
  6806: {
    name: 'Estadio Las Veredillas',
    city: 'Torrejón de Ardoz',
    country: 'Spain',
    correctCoordinates: [-3.471002, 40.466126] // [lng, lat]
  },
  6829: {
    name: 'Estadio Matías Prats',
    city: 'Torredonjimeno',
    country: 'Spain',
    correctCoordinates: [-3.9481947705935276, 37.7641818] // [lng, lat]
  },
  6837: {
    name: 'Estadio Escribano Castilla',
    city: 'Motril',
    country: 'Spain',
    correctCoordinates: [-3.512716912704995, 36.75432505] // [lng, lat]
  },
  6854: {
    name: 'Estadio Municipal de Chapín',
    city: 'Jerez de la Frontera',
    country: 'Spain',
    correctCoordinates: [-6.120522772041738, 36.68934245] // [lng, lat]
  },
  6865: {
    name: 'Estadi Son Bibiloni (Antonio Asensio)',
    city: 'Palma de Mallorca',
    country: 'Spain',
    correctCoordinates: [2.677463, 39.574119] // [lng, lat]
  },
  6881: {
    name: 'Campo de Futbol Vega de San Mateo',
    city: 'Vega de San Mateo',
    country: 'Spain',
    correctCoordinates: [-1.085349, 37.962672] // [lng, lat]
  },
  6906: {
    name: 'Estadio CD Azuaga',
    city: 'Azuaga',
    country: 'Spain',
    correctCoordinates: [-3.692501, 37.740892] // [lng, lat]
  },
  6925: {
    name: 'Estadio Lorenzo Goikoa',
    city: 'Villava',
    country: 'Spain',
    correctCoordinates: [-1.6139913309340326, 42.829630300000005] // [lng, lat]
  },
  8165: {
    name: 'Lupo Stadio',
    city: 'Wolfsburg',
    country: 'Germany',
    correctCoordinates: [10.806188, 52.434792] // [lng, lat]
  },
  8178: {
    name: 'Jonny Rehbein Sportplatz',
    city: 'Hamburg',
    country: 'Germany',
    correctCoordinates: [10.03408300373391, 53.58397835] // [lng, lat]
  },
  8635: {
    name: 'Stadion Vegesack',
    city: 'Bremen',
    country: 'Germany',
    correctCoordinates: [8.631572110791396, 53.17181665] // [lng, lat]
  },
  10816: {
    name: 'Stade d\'Erbajolo',
    city: 'Bastia',
    country: 'France',
    correctCoordinates: [9.435989873621526, 42.66292265] // [lng, lat]
  },
  10819: {
    name: 'Stade Plaine Sportive 1',
    city: 'Rousset',
    country: 'France',
    correctCoordinates: [6.83592, 47.964584] // [lng, lat]
  },
  11915: {
    name: 'Estadio Nuevo Mirandilla',
    city: 'Cádiz',
    country: 'Spain',
    correctCoordinates: [-6.273016730848631, 36.5026039] // [lng, lat]
  },
  12336: {
    name: 'Camp De Futbol Municipal',
    city: 'Palma de Mallorca',
    country: 'Spain',
    correctCoordinates: [1.328472, 42.214787] // [lng, lat]
  },
  18621: {
    name: 'IMS Arena',
    city: 'Velbert',
    country: 'Germany',
    correctCoordinates: [7.06206957391357, 51.345203850000004] // [lng, lat]
  },
  18637: {
    name: 'Spain Park',
    city: 'Aberdeen',
    country: 'Scotland',
    correctCoordinates: [-2.0954131722752534, 57.129035099999996] // [lng, lat]
  },
  19135: {
    name: 'Estadio Eloy Ávila Cano Bollullos',
    city: 'Bollullos Par del Condado',
    country: 'Spain',
    correctCoordinates: [-6.539785, 37.34664] // [lng, lat]
  },
  19152: {
    name: 'Estadio Nuevo Municipal',
    city: 'Armilla',
    country: 'Spain',
    correctCoordinates: [-3.767157, 37.775513] // [lng, lat]
  },
  19155: {
    name: 'Estadio de La Arboleja',
    city: 'Cieza',
    country: 'Spain',
    correctCoordinates: [-4.725487, 41.584106] // [lng, lat]
  },
  19215: {
    name: 'The BBSP Stadium Rugby Park',
    city: 'Kilmarnock',
    country: 'Scotland',
    correctCoordinates: [-4.509366172453859, 55.60409735] // [lng, lat]
  },
  19242: {
    name: 'Klein Arena',
    city: 'Sprockhövel',
    country: 'Germany',
    correctCoordinates: [7.250986, 51.342432] // [lng, lat]
  },
  19573: {
    name: 'Am Esper Roding Platz 1',
    city: 'Roding',
    country: 'Germany',
    correctCoordinates: [12.508468, 49.199911] // [lng, lat]
  },
  20420: {
    name: 'The Scot Foam Stadium at Dens Park',
    city: 'Dundee',
    country: 'Scotland',
    correctCoordinates: [-2.970387, 56.472881] // [lng, lat]
  },
  20532: {
    name: 'Sportplatz an der Mühlenstraße',
    city: 'Wandlitz',
    country: 'Germany',
    correctCoordinates: [13.49065745, 52.7917583] // [lng, lat]
  },
  20971: {
    name: 'Sportplatz Wilhelmshöh',
    city: 'Hohenwestedt',
    country: 'Germany',
    correctCoordinates: [12.350724, 49.144284] // [lng, lat]
  },
  21010: {
    name: 'Poststadion Kunstrasen 1',
    city: 'Verl',
    country: 'Germany',
    correctCoordinates: [6.773739, 51.407181] // [lng, lat]
  },
  21188: {
    name: 'Camp El Arco',
    city: 'Soneja',
    country: 'Spain',
    correctCoordinates: [-0.432136, 39.817393] // [lng, lat]
  },
  21275: {
    name: 'Ciudad Deportiva Las Lagunas',
    city: 'Las Lagunas de Mijas',
    country: 'Spain',
    correctCoordinates: [-4.639493617625936, 36.54622035] // [lng, lat]
  },
  21314: {
    name: 'Victory Park',
    city: 'Chorley, Lancashire',
    country: 'England',
    correctCoordinates: [-2.6294423483324945, 53.6460264] // [lng, lat]
  },
  21883: {
    name: 'Kunstrasenplatz Hollenbach am Vereinsheim',
    city: 'Mulfingen',
    country: 'Germany',
    correctCoordinates: [10.027416, 49.246633] // [lng, lat]
  },
  22483: {
    name: 'Campo de fútbol Francisco Bermúdez Hernández',
    city: 'Tías',
    country: 'Spain',
    correctCoordinates: [-3.803357, 37.763383] // [lng, lat]
  },
  22486: {
    name: 'Campo Fútbol Puebla de la Calzada',
    city: 'Puebla de la Calzada',
    country: 'Spain',
    correctCoordinates: [-5.80319, 38.699553] // [lng, lat]
  },
  22488: {
    name: 'Estadio El Pinar 1',
    city: 'Zizur Mayor',
    country: 'Spain',
    correctCoordinates: [-5.465093, 36.16305] // [lng, lat]
  }
};

// Sanity check: venue coordinates should be within reasonable bounds for their country
const COUNTRY_BOUNDS = {
  'England': { latMin: 49.9, latMax: 55.8, lngMin: -6.0, lngMax: 2.0 },
  'UK': { latMin: 49.9, latMax: 60.9, lngMin: -8.0, lngMax: 2.0 },
  'Scotland': { latMin: 54.6, latMax: 60.9, lngMin: -8.0, lngMax: -0.7 },
  'Wales': { latMin: 51.4, latMax: 53.4, lngMin: -5.3, lngMax: -2.6 },
  'France': { latMin: 41.3, latMax: 51.1, lngMin: -5.1, lngMax: 9.6 },
  'Spain': { latMin: 36.0, latMax: 43.8, lngMin: -9.3, lngMax: 4.3 },
  'Germany': { latMin: 47.3, latMax: 55.1, lngMin: 5.9, lngMax: 15.0 },
  'Italy': { latMin: 35.5, latMax: 47.1, lngMin: 6.6, lngMax: 18.5 },
};

async function connectDB() {
  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI not found in environment variables');
  }
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
}

async function findCorruptedVenues() {
  console.log('\n🔍 Scanning for corrupted venue coordinates...\n');
  
  const venues = await Venue.find({ coordinates: { $exists: true, $ne: null } }).lean();
  const corrupted = [];
  
  for (const venue of venues) {
    const coords = venue.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) continue;
    
    const [lng, lat] = coords; // GeoJSON format: [longitude, latitude]
    const country = venue.country || 'Unknown';
    
    // Check if coordinates are valid numbers
    if (typeof lng !== 'number' || typeof lat !== 'number' || isNaN(lng) || isNaN(lat)) {
      corrupted.push({ venue, reason: 'Invalid coordinate types' });
      continue;
    }
    
    // Check if coordinates are within world bounds
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      corrupted.push({ venue, reason: 'Coordinates outside world bounds' });
      continue;
    }
    
    // Check if coordinates are reasonable for the country
    const bounds = COUNTRY_BOUNDS[country];
    if (bounds) {
      if (lat < bounds.latMin || lat > bounds.latMax || lng < bounds.lngMin || lng > bounds.lngMax) {
        corrupted.push({ 
          venue, 
          reason: `Coordinates outside ${country} bounds`,
          expected: bounds,
          actual: { lat, lng }
        });
      }
    }
  }
  
  return corrupted;
}

// Rate limiting helper - LocationIQ allows 2 requests/second
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const GEOCODE_DELAY_MS = 600; // 600ms between requests to stay well under 2/sec limit

async function fixCorruptedVenues(dryRun = true, skipGeocode = false) {
  // First, apply known corrections regardless of whether they're flagged as corrupted
  console.log('\n📋 Applying known corrections from VENUE_CORRECTIONS...\n');
  
  for (const [venueId, correction] of Object.entries(VENUE_CORRECTIONS)) {
    const venueIdNum = parseInt(venueId);
    const venue = await Venue.findOne({ venueId: venueIdNum });
    
    if (!venue) {
      console.log(`  ⚠️  Venue ID ${venueIdNum} (${correction.name}) not found in database`);
      continue;
    }
    
    const currentCoords = venue.coordinates || venue.location?.coordinates;
    if (!currentCoords || !Array.isArray(currentCoords) || currentCoords.length !== 2) {
      console.log(`  ⚠️  Venue ID ${venueIdNum} (${correction.name}) has no coordinates`);
      continue;
    }
    
    const [currentLng, currentLat] = currentCoords;
    const [correctLng, correctLat] = correction.correctCoordinates;
    
    // Check if coordinates already match (within tolerance)
    const tolerance = 0.0001;
    const coordsMatch = Math.abs(currentLng - correctLng) < tolerance && 
                        Math.abs(currentLat - correctLat) < tolerance;
    
    if (coordsMatch) {
      console.log(`  ✅ ${correction.name} (ID: ${venueIdNum}) - Coordinates already correct`);
      continue;
    }
    
    console.log(`  🔧 ${correction.name} (ID: ${venueIdNum})`);
    console.log(`     Current: [${currentLng}, ${currentLat}]`);
    console.log(`     Correct: [${correctLng}, ${correctLat}]`);
    
    if (!dryRun) {
      await Venue.updateOne(
        { _id: venue._id },
        { 
          $set: { 
            coordinates: correction.correctCoordinates,
            location: {
              type: 'Point',
              coordinates: correction.correctCoordinates
            },
            lastUpdated: new Date()
          } 
        }
      );
      console.log(`     💾 FIXED!`);
    } else {
      console.log(`     📝 Would update to correct coordinates`);
    }
    console.log('');
  }
  
  // Then process corrupted venues
  const corrupted = await findCorruptedVenues();
  
  console.log(`\n📊 Found ${corrupted.length} venues with potentially corrupted coordinates:\n`);
  
  if (skipGeocode) {
    console.log('⏭️  Skipping geocoding (--no-geocode flag set). Only applying known corrections.\n');
  }
  
  let geocodeCount = 0;
  
  for (const { venue, reason, expected, actual } of corrupted) {
    console.log(`  ❌ ${venue.name} (ID: ${venue.venueId || venue.apiId || venue._id})`);
    console.log(`     City: ${venue.city}, Country: ${venue.country}`);
    console.log(`     Current coords: [${venue.coordinates[0]}, ${venue.coordinates[1]}]`);
    console.log(`     Issue: ${reason}`);
    if (expected && actual) {
      console.log(`     Expected bounds: lat ${expected.latMin}-${expected.latMax}, lng ${expected.lngMin}-${expected.lngMax}`);
      console.log(`     Actual: lat ${actual.lat}, lng ${actual.lng}`);
    }
    
    // Check if we have a known correction
    const venueId = venue.venueId || venue.apiId;
    const correction = VENUE_CORRECTIONS[venueId];
    
    if (correction) {
      console.log(`     ✅ Known correction available: [${correction.correctCoordinates[0]}, ${correction.correctCoordinates[1]}]`);
      
      if (!dryRun) {
        await Venue.updateOne(
          { _id: venue._id },
          { $set: { coordinates: correction.correctCoordinates } }
        );
        console.log(`     💾 FIXED!`);
      }
    } else if (!skipGeocode) {
      // Try to geocode (with rate limiting)
      console.log(`     🔍 Attempting to geocode...`);
      
      // Rate limit: wait between geocode requests
      if (geocodeCount > 0) {
        console.log(`     ⏳ Rate limiting: waiting ${GEOCODE_DELAY_MS}ms...`);
        await delay(GEOCODE_DELAY_MS);
      }
      geocodeCount++;
      
      try {
        const geocoded = await geocodingService.geocodeVenueCoordinates(
          venue.name,
          venue.city,
          venue.country
        );
        if (geocoded) {
          console.log(`     ✅ Geocoded: [${geocoded[0]}, ${geocoded[1]}]`);
          if (!dryRun) {
            await Venue.updateOne(
              { _id: venue._id },
              { $set: { coordinates: geocoded } }
            );
            console.log(`     💾 FIXED!`);
          }
        } else {
          console.log(`     ⚠️ Could not geocode - manual fix needed`);
        }
      } catch (err) {
        console.log(`     ⚠️ Geocoding error: ${err.message}`);
      }
    } else {
      console.log(`     ⏭️  Skipping geocode (no known correction)`);
    }
    console.log('');
  }
  
  console.log(`\n📊 Summary: ${geocodeCount} geocode API calls made`);

  if (dryRun) {
    console.log('\n📝 This was a DRY RUN. To apply corrections:');
    console.log('   node src/scripts/fixCorruptedVenueCoordinates.js --fix');
    if (!skipGeocode) {
      console.log('   (or --fix --no-geocode to skip geocoding)\n');
    }
  } else {
    console.log('\n✅ Corrections applied!\n');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--fix');
  const skipGeocode = args.includes('--no-geocode');
  
  console.log('🔧 Venue Coordinate Fixer');
  console.log('========================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY FIXES'}`);
  console.log(`Geocoding: ${skipGeocode ? 'DISABLED' : 'ENABLED (with rate limiting)'}`);
  console.log('');
  console.log('Usage:');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js           # Dry run, with geocoding');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js --fix     # Apply fixes, with geocoding');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js --no-geocode  # Dry run, known corrections only');
  console.log('  node src/scripts/fixCorruptedVenueCoordinates.js --fix --no-geocode  # Apply only known corrections');
  
  try {
    await connectDB();
    await fixCorruptedVenues(dryRun, skipGeocode);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

main();

