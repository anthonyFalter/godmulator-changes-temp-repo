import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLoreBookSpreads,
  ensureLoreBook,
  markLoreBookRead,
  syncLoreBookFromChronicle,
} from './loreBook';
import { addChronicle, createInitialSimulationState, stepSimulation } from './simulation';

test('Lore Book retroactively weaves Prologue, existing Wonders, and existing chronicle in chronological order', () => {
  const sim = createInitialSimulationState(24, 'LORE-RETRO');
  sim.worldName = 'Eldoria';
  sim.year = 14;
  sim.epochIndex = 1;
  sim.settlementNames = { s1: 'Sunspire' };
  sim.worldWonders = [
    {
      id: 'w1',
      kingdomId: 'k1',
      settlementId: 's1',
      species: 'human',
      name: 'Great Lighthouse',
      tileX: 10,
      tileZ: 12,
      hp: 2500,
      maxHp: 2500,
      shieldTimer: 0,
      builtYear: 9,
      bonusSummary: '+15% Trade',
    },
  ];
  // Pre-existing saved world without loreBook, with newest-first chronicle
  sim.loreBook = undefined;
  sim.chronicle = [
    {
      id: 'c2',
      yearLabel: 'Year 12',
      text: 'A Zombie Virus flask shattered, mutating 4 creatures into zombies!',
      tone: 'warning',
      timestamp: 2000,
      x: 15,
      z: 16,
    },
    {
      id: 'c1',
      yearLabel: 'Year 4',
      text: 'The Kingdom of Sunspire was founded!',
      tone: 'divine',
      timestamp: 1000,
      x: 8,
      z: 9,
    },
  ];

  const book = ensureLoreBook(sim);
  assert.equal(book.seededRetroactive, true);
  assert.equal(book.entries[0].category, 'creation', 'First entry must be Creation Prologue');
  assert.ok(book.entries.some((e) => e.category === 'wonder' && e.title.includes('Great Lighthouse')));

  const kingdomIdx = book.entries.findIndex((e) => e.sourceChronicleId === 'c1');
  const zombieIdx = book.entries.findIndex((e) => e.sourceChronicleId === 'c2');
  assert.ok(kingdomIdx >= 0 && zombieIdx > kingdomIdx, 'Retroactive chronicle must be woven oldest-to-newest');
  assert.equal(book.entries[zombieIdx].category, 'zombie');
  assert.equal(book.entries[zombieIdx].x, 15);
  assert.equal(book.entries[zombieIdx].z, 16);
});

test('Lore Book weaves live addChronicle events, coalesces same-year bursts, and builds 2-page spreads', () => {
  const sim = createInitialSimulationState(24, 'LORE-LIVE');
  sim.worldName = 'Aethelgard';
  sim.year = 5;
  ensureLoreBook(sim);
  markLoreBookRead(sim);
  assert.equal(sim.loreBook?.unreadCount, 0);

  // Two disasters in the same year should coalesce instead of spamming separate entries
  addChronicle(sim, 'A blazing meteor struck the northern hills!', 'warning', { x: 10, z: 10 });
  addChronicle(sim, 'Another fiery meteor tore through the valley!', 'warning', { x: 12, z: 11 });
  const disasterEntries = sim.loreBook!.entries.filter((e) => e.category === 'disaster');
  assert.equal(disasterEntries.length, 1, 'Same-year same-category bursts should coalesce');
  assert.equal(disasterEntries[0].count, 2);
  assert.ok((sim.loreBook?.unreadCount ?? 0) >= 1, 'New lore should increment unreadCount');

  // Advance age and add a God Titan event
  sim.year = 12;
  sim.epochIndex = 2;
  addChronicle(sim, 'The God Titan Death Beam detonated in a nuclear mushroom cloud!', 'warning', { x: 18, z: 18 });
  syncLoreBookFromChronicle(sim, true);

  const { spreads, pages, chapters } = buildLoreBookSpreads(sim, 'Aethelgard');
  assert.ok(spreads.length >= 2, 'Should have Title/TOC spread plus at least one story spread');
  assert.ok(pages.length >= 3, 'Should provide flat mobile pages');
  assert.equal(spreads[0].left.kind, 'title');
  assert.equal(spreads[0].right.kind, 'toc');
  assert.ok(chapters.length >= 2, 'Advancing epochs should create separate chapters');
  assert.equal(chapters[0].pageIndex, 2, 'First chapter starts on flat page index 2 (after Title & TOC)');
});

test('Lore Book replaces generic "My World", omits seed from title page, and poeticizes mechanical text', () => {
  const sim = createInitialSimulationState(24, 'SECRET-SEED-999');
  sim.worldName = 'My World';
  sim.settlementNames = {};
  sim.year = 3;
  ensureLoreBook(sim);
  addChronicle(sim, 'A Zombie Virus flask shattered, mutating 4 creatures into zombies!', 'warning', { x: 10, z: 10 });
  addChronicle(sim, 'Another Zombie Virus flask shattered, mutating 2 creatures into zombies!', 'warning', { x: 11, z: 11 });

  const { spreads, pages } = buildLoreBookSpreads(sim, 'My World');
  const titlePage = spreads[0].left;
  assert.equal(titlePage.kind, 'title');
  assert.notEqual(titlePage.worldName.toLowerCase(), 'my world');
  assert.equal('seed' in titlePage, false, 'Title page must not expose world seed');
  assert.ok(!titlePage.colophon.includes('SECRET-SEED-999'));

  const zombieEntry = sim.loreBook!.entries.find((e) => e.category === 'zombie');
  assert.ok(zombieEntry);
  assert.ok(!zombieEntry.body.includes('times recorded'), 'Coalescing should use poetic prose, not raw counts');
  assert.ok(!zombieEntry.body.includes('mutating 4 creatures'), 'Raw mechanical game text should be poeticized');

  addChronicle(sim, '<Aldric> has been crowned monarch of <Sunspire>!', 'divine');
  const crownEntry = sim.loreBook!.entries[sim.loreBook!.entries.length - 1];
  assert.ok(crownEntry.body.includes('Aldric') && crownEntry.body.includes('Sunspire'));
  assert.ok(!crownEntry.body.includes('<') && !crownEntry.body.includes('>'), 'Entity names must never include <>');
  assert.ok(!crownEntry.title.includes('<') && !crownEntry.title.includes('>'));
  assert.ok(pages.length >= 3);
});

test('Lore Book weaves race cultures, rebellions, and living monarchs into mythic tales', () => {
  const sim = createInitialSimulationState(24, 'LORE-CULTURE');
  sim.year = 18;
  sim.epochIndex = 1;
  sim.settlementNames = { s1: 'Ironhold' };
  sim.units.push(
    {
      id: 'u_king_1',
      name: 'Thrain',
      role: 'warrior',
      species: 'dwarf',
      faction: 'civilization',
      x: 10,
      z: 10,
      targetX: 10,
      targetZ: 10,
      hp: 100,
      maxHp: 100,
      state: 'idle',
      koTimer: 0,
      statusEffects: {},
      carryingType: null,
      carryingAmount: 0,
      actionCooldown: 0,
      windupTimer: 0,
      targetEntityId: null,
      settlementId: 's1',
      isKing: true,
      kills: 4,
    },
    {
      id: 'u_rebel_1',
      name: 'Kael the Defiant',
      role: 'warrior',
      species: 'elf',
      faction: 'civilization',
      x: 14,
      z: 14,
      targetX: 14,
      targetZ: 14,
      hp: 100,
      maxHp: 100,
      state: 'idle',
      koTimer: 0,
      statusEffects: {},
      carryingType: null,
      carryingAmount: 0,
      actionCooldown: 0,
      windupTimer: 0,
      targetEntityId: null,
      isRebel: true,
    },
  );

  const book = ensureLoreBook(sim);
  assert.ok(book.entries.some((e) => e.category === 'culture'), 'Should weave living race culture entry');
  assert.ok(book.entries.some((e) => e.category === 'rebellion'), 'Should weave active rebellion entry');
  assert.ok(book.entries.some((e) => e.category === 'legend' && e.title.includes('Thrain')), 'Should weave living monarch legend');
});

test('Lore Book weaves dynamic historical continuity for recurring God Titan and disasters', () => {
  const sim = createInitialSimulationState(24, 'LORE-CONTINUITY');
  ensureLoreBook(sim);

  // First Titan summon in Year 4
  sim.year = 4;
  addChronicle(sim, 'A colossal God Titan descended from the heavens!', 'divine', { x: 10, z: 10 });
  addChronicle(sim, 'A skyward beam reclaimed the God Titan back into the heavens.', 'divine', { x: 10, z: 10 });

  // Second Titan summon in Year 56 (52 years later!)
  sim.year = 56;
  addChronicle(sim, 'A colossal God Titan descended from the heavens!', 'divine', { x: 14, z: 14 });

  // Third Titan summon in Year 74
  sim.year = 74;
  addChronicle(sim, 'A colossal God Titan descended from the heavens!', 'divine', { x: 16, z: 16 });

  const titanSummons = sim.loreBook!.entries.filter((e) => e.motif === 'titan_summon');
  assert.equal(titanSummons.length, 3, 'Each Titan summon should produce its own lore verse');
  assert.notEqual(titanSummons[0].title, titanSummons[1].title, 'Repeated Titan summons must have distinct titles');
  assert.notEqual(titanSummons[0].body, titanSummons[1].body, 'Repeated Titan summons must have distinct prose');
  assert.ok(
    titanSummons[1].body.includes('52 years') || titanSummons[1].body.includes('Year 4'),
    `Second summon should reference the 52-year gap or Year 4, got: ${titanSummons[1].body}`,
  );
  assert.ok(
    titanSummons[2].body.toLowerCase().includes('third') &&
      (titanSummons[2].body.includes('Year 4') || titanSummons[2].body.includes('Year 56')),
    `Third summon should reference the third coming and prior year, got: ${titanSummons[2].body}`,
  );

  const titanExits = sim.loreBook!.entries.filter((e) => e.motif === 'titan_exit');
  assert.equal(titanExits.length, 1, 'Titan departure should be logged with titan_exit motif');
  assert.ok(
    /upward|departed|reclaimed|ascent|cloud/i.test(`${titanExits[0].title} ${titanExits[0].body}`),
    'Titan departure should use departure prose rather than arrival prose',
  );
});

test('Simulation logs fallen cities (even when last citizen dies after buildings) and Lore Book chronicles them dynamically', () => {
  const sim = createInitialSimulationState(24, 'LORE-FALL');
  sim.year = 12;
  ensureLoreBook(sim);
  sim.settlementNames = { s1: 'Oakhaven', s2: 'Sunspire' };
  const tileA = sim.tiles.find((t) => t.height > 0)!;
  tileA.claimedSettlementId = 's1';
  sim.buildings.push({
    id: 'b_oak',
    type: 'bonfire',
    tileX: tileA.x,
    tileZ: tileA.z,
    hp: 0, // destroyed on next tick
    maxHp: 100,
    constructionProgress: 100,
    epochLevel: 0,
    blessedTimer: 0,
    cursedTimer: 0,
    shieldTimer: 0,
    settlementId: 's1',
    species: 'human',
  });
  // Keep s2 alive with 1 unit for now
  sim.units.push({
    id: 'u_sun',
    name: 'Lyra',
    role: 'villager',
    species: 'elf',
    faction: 'civilization',
    x: tileA.x,
    z: tileA.z,
    targetX: tileA.x,
    targetZ: tileA.z,
    hp: 100,
    maxHp: 100,
    state: 'idle',
    koTimer: 0,
    statusEffects: {},
    carryingType: null,
    carryingAmount: 0,
    actionCooldown: 0,
    windupTimer: 0,
    targetEntityId: null,
    settlementId: 's2',
  });

  // Tick once: Oakhaven's last building dies with 0 living citizens -> Oakhaven falls!
  stepSimulation(sim, 0.05, { skipRandomEvents: true });
  assert.equal(sim.settlementNames['s1'], undefined, 'Fallen city s1 should be cleaned up');
  assert.equal(sim.settlementNames['s2'], 'Sunspire', 'Living city s2 should remain');

  // Later in Year 28, Sunspire's last citizen dies (with 0 buildings left) -> periodic/sweep catches Sunspire's fall!
  sim.year = 28;
  sim.units = sim.units.filter((u) => u.settlementId !== 's2');
  for (let i = 0; i < 15; i++) {
    stepSimulation(sim, 0.05, { skipRandomEvents: true });
  }
  assert.equal(sim.settlementNames['s2'], undefined, 'Abandoned/wiped city s2 should be caught and cleaned up');

  const fallenEntries = sim.loreBook!.entries.filter((e) => e.motif === 'city_fallen');
  assert.equal(fallenEntries.length, 2, 'Both Oakhaven and Sunspire falls should be chronicled');
  assert.equal(fallenEntries[0].category, 'disaster', 'Fallen city must NOT be misclassified as kingdom');
  assert.ok(fallenEntries[0].body.includes('Oakhaven'));
  assert.ok(fallenEntries[1].body.includes('Sunspire'));
  assert.ok(
    fallenEntries[1].body.includes('Oakhaven') && fallenEntries[1].body.includes('16 years'),
    `Second fallen city should reference Oakhaven and the 16-year gap, got: ${fallenEntries[1].body}`,
  );

  // Conquered city chronicle classification
  sim.year = 35;
  addChronicle(sim, 'The city of Thornhold has fallen and been conquered by Ironhold!', 'warning', { x: 8, z: 8 });
  const conquered = sim.loreBook!.entries.find((e) => e.motif === 'city_conquered');
  assert.ok(conquered, 'Conquered city should produce a city_conquered lore entry');
  assert.equal(conquered.category, 'war');
  assert.ok(conquered.body.includes('Thornhold') && conquered.body.includes('Ironhold'));
});

