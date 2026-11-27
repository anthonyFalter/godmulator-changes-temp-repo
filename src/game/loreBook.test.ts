import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLoreBookSpreads,
  ensureLoreBook,
  markLoreBookRead,
  syncLoreBookFromChronicle,
} from './loreBook';
import { addChronicle, createInitialSimulationState } from './simulation';

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
  assert.ok(pages.length >= 3);
});
