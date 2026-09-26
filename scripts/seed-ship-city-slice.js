import { db } from '../lib/server.js';

// A reviewable local slice. Run only against an isolated development database.
const places = [
  ['chasm', 'settlement', 'ship-city', 'The Chasm', 'The deep cleft at the heart of Ship City, ringed with palaces, markets and precarious bridges beneath the Dome.', 'The city opens around you in a dizzying stack of inhabited rings.', 'Every cage ride is a wager on where you will end up.', 'Ivara, cable cage operator', 'accessible'],
  ['aluminum-bay', 'settlement', 'ship-city', 'Aluminum Bay', 'Cargo, travelers and rumor enter Ship City through this sprawling harbor of cranes, pressure piers and dim warehouse halls.', 'The harbor never quite stops moving.', 'If it came into this city, someone in the Bay remembers who carried it.', 'Tavi, crane rat', 'accessible'],
  ['vermilion-house', 'diorama', 'chasm', 'Vermilion House', 'Perched halfway down the Chasm, this three-story stone complex is the Explorers Guild headquarters. Its courtyard gathers delvers between assignments; the Archive, offices and Master Moska’s quarters lie in separate wings.', 'The Explorers Guild’s home is equal parts mission office and reunion hall.', 'They call it a small Guild until they need someone to go first.', 'Rena, veteran delver', 'accessible'],
  ['astrolaab-tower', 'diorama', 'chasm', 'Astrolaab Tower', 'The Navigators’ tower rises from the upper Chasm through the Dome. Its public offices and observation halls display the Guild’s maps; the Conclave of Eyes meets far above, beyond ordinary visitors’ reach.', 'Follow the star maps upward into the Navigators’ seat of power.', 'The tower has a window for every star, and a locked door for every answer.', 'Sahir, algebraist apprentice', 'inaccessible'],
  ['bird-market', 'diorama', 'chasm', 'The Bird Market', 'In a ravine off the fourth ring, handlers and traders bargain among stacked alcoves, narrow stairs and hanging globes of light. Garuda of every color turn the market into a chorus that fades when evening lamps are dimmed.', 'A noisy ravine of Garuda, handlers and hopeful buyers.', 'A Bird chooses as often as it is chosen.', 'Dela, Garuda handler', 'accessible'],
  ['lotus-ring', 'diorama', 'chasm', 'The Lotus Ring', 'Music, food and conversation crowd this entertainment quarter below the upper rings. Cantinas and performance halls offer a place to celebrate a return or hear what the city is whispering tonight.', 'The Chasm’s night life carries on through every watch.', 'Give me one quiet evening and I will give it back to you twice as loud.', 'Aram, cantina keeper', 'accessible'],
  ['the-haze', 'poi', 'chasm', 'The Haze', 'Hot air from the workshops rises into the lower Chasm and hangs as near constant fog. Markets appear in side alleys beside gambling rooms, fight clubs and cantinas; newcomers are advised to find a guide before descending.', 'Below the ninth ring, the streets vanish into warm fog.', 'The fog does not hide you. It hides the people watching you.', 'Anonymous street seller', 'accessible'],
  ['bazaar-bizarre', 'diorama', 'aluminum-bay', 'Bazaar Bizarre', 'Follow the service passages away from the customs lanes to find this semi-legal market. Crane rats, stevedores and smugglers trade salvaged tools, oddities and goods of uncertain provenance, while Guild patrols currently look the other way.', 'The Bay’s unofficial market rewards curiosity and careful bargaining.', 'Ask where a thing came from only if you can afford the answer.', 'Mera, stall keeper', 'accessible'],
  ['lost-garuda', 'diorama', 'aluminum-bay', 'The Lost Garuda', 'Innkeeper Mahmeed Behk and his family keep this lively inn and cantina running for crane rats, ship crews and explorers alike. Shroom ale, pine rum and the evening’s gossip travel freely between its tables.', 'A crowded harbor refuge where crews exchange news.', 'The first round buys a seat. The second buys a story.', 'Davi, regular patron', 'accessible'],
  ['warehouse-nine', 'diorama', 'aluminum-bay', 'Explorers Guild Warehouse 9', 'The Explorers Guild keeps vehicles, expedition gear and a pier in Aluminum Bay. Engineers and crews prepare battered shuttles and rovers here before departure; every missing part can delay an expedition.', 'Prepare a vessel, collect supplies or find the Guild engineers.', 'It will fly. I did not promise it would do so quietly.', 'Guild engineer', 'accessible'],
  ['warehouse-murk', 'delve', 'aluminum-bay', 'Warehouse Murk', 'The Bay’s immense storage hall disappears into shadow above stacked cargo and hanging cranes. The Loaders tend its shelves, and damaged-goods markets draw bargain hunters into aisles where a person can easily lose their way.', 'An enormous cargo hall with more shadows than records.', 'Keep the red hooks on your left if you want to find the exit.', 'Loader’s advice', 'accessible'],
  ['the-husk', 'poi', 'aluminum-bay', 'The Husk of the Amidana', 'Beyond the piers, aluminum dust gathers around the stripped remains of the former Greatship Amidana. Scavengers still search oxygenated pockets for rare parts, but its interior warrants a separate expedition map.', 'A dead Greatship waits beyond the harbor’s safe routes.', '', '', 'accessible'],
  ['hull-town', 'poi', 'ship-city', 'Hull Town', 'The welded hulls of the original Diaspora fleet form an outer district of homes, workshops and chain walks. It is easy to hide here, and easier still to lose your way between pressurized modules.', 'The first ships became a neighborhood that keeps changing shape.', '', '', 'accessible'],
  ['cave-gardens', 'settlement', 'ship-city', 'Cave Gardens', 'A chain of cultivated caverns shelters orchards, purple meadows and working hydroponics. The Gardeners Guild tends the city’s food and living collections here; its generous public paths narrow toward carefully controlled growing rooms.', 'Follow the scent of herbs into the asteroid’s living heart.', 'Every leaf has a purpose here, even if we have forgotten it.', 'Preci, Gardener', 'accessible'],
  ['turbine-halls', 'settlement', 'ship-city', 'Turbine Halls', 'The Machinists’ factory city surrounds the Cherolab with vaulted machinery, intimate dwellings and angular murals. Maintenance crews keep Ship City alive while Gray Caps watch the passages leading deeper into the engine.', 'The engine of Ship City hums behind painted industrial walls.', 'Listen long enough and you can tell which machine needs us.', 'Rafi, Machinist', 'accessible'],
  ['inner-sanctum', 'poi', 'ship-city', 'Inner Sanctum', 'The Coriolites dwell among old stone palaces and ceremonial plazas. Masked worshippers gather at the Ziggurat of the Nine Icons, while family elders make decisions behind guarded doors.', 'Incense and old power linger in the Coriolites’ cave.', '', '', 'accessible'],
  ['inbetween', 'poi', 'ship-city', 'The Inbetween', 'Between the Prow, Cave Gardens and Maw, crooked alleys lead to antiquarians, small libraries and bookshops. Its maze can shelter a rare discovery or swallow a pursuer.', 'A district of books, hidden shops and difficult directions.', '', '', 'accessible'],
  ['serpentine', 'poi', 'ship-city', 'The Serpentine', 'This crowded rift is a bright tangle of balconies, food stalls, inns and music. Bargains and rumors change hands across the markets as quickly as the crowds change direction.', 'Follow the music through a rift that never seems to sleep.', '', '', 'accessible'],
  ['purple-meadows', 'diorama', 'cave-gardens', 'The Purple Meadows', 'Low purple flowering plants spread beneath the stone vault, with winding paths and benches among the beds. Gardeners, children and returning crews share this rare place to rest while tending lamps stand in for a sun.', 'A cultivated meadow gives the city room to breathe.', 'The flowers remember every hand that planted them.', 'Mira, meadow tender', 'accessible'],
  ['hydroponic-terraces', 'diorama', 'cave-gardens', 'Hydroponic Terraces', 'Tiered nutrient channels and hanging roots feed the city from inside a cavern of pipes and stone. Gardeners check the flow, trade cuttings and send baskets of food toward the crowded districts.', 'Follow the water and the workers who keep it flowing.', 'A failed pump is a famine if no one notices soon enough.', 'Tolan, grower', 'accessible'],
  ['seed-archive', 'diorama', 'cave-gardens', 'Seed Archive', 'Beyond a guarded greenhouse door, the Gardeners catalogue old and newly recovered seeds. Visitors can see the lamplit receiving room, but the climate-controlled vaults and experimental beds require Guild permission.', 'Rare living collections wait behind a controlled threshold.', 'A seed is a promise we may not be able to make twice.', 'Nema, archive keeper', 'inaccessible'],
  ['mosaicists-walk', 'diorama', 'turbine-halls', 'Mosaicists’ Walk', 'An inhabited passage through the Halls pairs small dwellings and repair shops with angular murals. The painted forms echo the rhythm of nearby machines; apprentices argue over colors as crews pass beneath them.', 'The Machinists turn a work route into a gallery.', 'If the pattern feels wrong, hear the turbine again.', 'Ishan, Mosaicist apprentice', 'accessible'],
  ['service-gallery', 'delve', 'turbine-halls', 'Service Gallery', 'Walkways and maintenance bays wind around immense turbine housings. An inspection route can become a tense search when a unit stalls, the lamps fail or a passage has to be sealed.', 'Trace a fault through a maze of working machinery.', 'Keep one hand on the rail when the vibration changes.', 'Lira, maintenance chief', 'accessible'],
  ['cherolab-gate', 'diorama', 'turbine-halls', 'Cherolab Gate', 'Gray Caps hold a checkpoint before the inner Cherolab, where the Machinists’ most vital work continues beyond armored doors. Petitioners wait under a vaulted ceiling painted in angular color while guards inspect their permits.', 'The guarded threshold to the engine that sustains Ship City.', 'Everyone hears the engine. Few are invited to meet it.', 'Gray Cap sentry', 'inaccessible']
];

const markers = [
  ['city-chasm', 'ship-city', 'chasm', 43, 37], ['city-aluminum-bay', 'ship-city', 'aluminum-bay', 42, 75],
  ['city-hull-town', 'ship-city', 'hull-town', 28, 25], ['city-cave-gardens', 'ship-city', 'cave-gardens', 31, 46],
  ['city-turbine-halls', 'ship-city', 'turbine-halls', 34, 60], ['city-inner-sanctum', 'ship-city', 'inner-sanctum', 65, 62],
  ['city-inbetween', 'ship-city', 'inbetween', 22, 53], ['city-serpentine', 'ship-city', 'serpentine', 62, 34],
  ['chasm-vermilion', 'chasm', 'vermilion-house', 42, 41], ['chasm-astrolaab', 'chasm', 'astrolaab-tower', 50, 14],
  ['chasm-birds', 'chasm', 'bird-market', 14, 24], ['chasm-lotus', 'chasm', 'lotus-ring', 83, 29], ['chasm-haze', 'chasm', 'the-haze', 52, 76],
  ['bay-bazaar', 'aluminum-bay', 'bazaar-bizarre', 81, 43], ['bay-garuda', 'aluminum-bay', 'lost-garuda', 84, 72],
  ['bay-warehouse-nine', 'aluminum-bay', 'warehouse-nine', 40, 69], ['bay-murk', 'aluminum-bay', 'warehouse-murk', 56, 26],
  ['bay-husk', 'aluminum-bay', 'the-husk', 13, 66],
  ['gardens-meadows', 'cave-gardens', 'purple-meadows', 24, 42], ['gardens-hydroponics', 'cave-gardens', 'hydroponic-terraces', 66, 48],
  ['gardens-archive', 'cave-gardens', 'seed-archive', 76, 20],
  ['turbines-mosaics', 'turbine-halls', 'mosaicists-walk', 25, 37], ['turbines-gallery', 'turbine-halls', 'service-gallery', 55, 70],
  ['turbines-cherolab', 'turbine-halls', 'cherolab-gate', 79, 28]
];

const murkGrid = JSON.stringify({ width: 12, height: 8, entry: [1, 3], blocked: [
  ...[1, 2, 3, 4, 5, 6].flatMap(y => [4, 6, 7].map(x => [x, y])), [10, 2], [10, 3], [10, 5], [10, 6]
], rooms: [
  { id: 'loading', name: 'Loading floor', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 4 }, (_, x) => [x, y])).flat() },
  { id: 'stacks', name: 'Cargo stacks', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 4 }, (_, x) => [x + 4, y])).flat() },
  { id: 'rear', name: 'Rear aisles', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 4 }, (_, x) => [x + 8, y])).flat() }
] });

const serviceGrid = JSON.stringify({ width: 12, height: 8, entry: [0, 4], blocked: [
  ...[1, 2, 5, 6].flatMap(y => [4, 5, 6, 7, 8].map(x => [x, y]))
], rooms: [
  { id: 'intake', name: 'Intake walk', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 4 }, (_, x) => [x, y])).flat() },
  { id: 'turbines', name: 'Turbine bays', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 4 }, (_, x) => [x + 4, y])).flat() },
  { id: 'controls', name: 'Control gallery', squares: Array.from({ length: 8 }, (_, y) => Array.from({ length: 4 }, (_, x) => [x + 8, y])).flat() }
] });

export async function seedShipCitySlice(sql = db()) {
  // Retire only original sample city markers; do not remove the locations or any character positions.
  await sql.query("DELETE FROM location_links WHERE id IN ('city-dock', 'city-choir') AND from_id = 'ship-city'");
  for (const [id, kind, parent, title, description, teaser, quote, speaker, access] of places) {
    await sql.query('INSERT OR IGNORE INTO locations (id, kind, parent_id, title, description, teaser, quote, quote_speaker, access_level, grid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, kind, parent, title, description, teaser, quote, speaker, access, id === 'warehouse-murk' ? murkGrid : id === 'service-gallery' ? serviceGrid : '{}']);
  }
  // These were Points of Interest in the first local slice; make repeated preview seeds upgrade them in place.
  for (const id of ['cave-gardens', 'turbine-halls']) {
    await sql.query("UPDATE locations SET kind = 'settlement' WHERE id = ? AND parent_id = 'ship-city' AND kind = 'poi'", [id]);
  }
  await sql.query("UPDATE locations SET description = 'Built around and through an asteroid, Ship City is the Diaspora’s crowded capital: a city of welded ships, deep caverns, Guild halls and working harbors. Choose a district to explore.' WHERE id = 'ship-city' AND description = 'The expedition begins among the docks and guild halls.'");
  for (const [id, from, to, x, y] of markers) await sql.query('INSERT OR IGNORE INTO location_links (id, from_id, to_id, kind, label, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, from, to, 'marker', places.find(place => place[0] === to)[3], x, y]);
}
