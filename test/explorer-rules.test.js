import test from 'node:test';
import assert from 'node:assert/strict';
import { attributes, attributeIssues, carried, carryLimit, findProfession, maxima, origins, penalty, pools, professions, raiseCost, splitFeatures, joinFeatures, talentMax, talentSource, talents, today } from '../explorer-rules.js';
import { cleanSheet } from '../lib/sheet.js';

test('pools come from the attribute pairs that share a wheel edge', () => {
  assert.deepEqual(maxima({ strength: 3, agility: 4, logic: 4, insight: 3, perception: 4, empathy: 6 }), { health: 7, hope: 10, heart: 7 });
  // Around the wheel, each pool's two attributes sit next to each other.
  for (const [index, pool] of pools.entries()) assert.deepEqual(new Set([attributes[index * 2].key, attributes[index * 2 + 1].key]), new Set(pool.from));
});

test('a condition takes two dice from the attribute it weakens', () => {
  assert.equal(penalty(['dazed'], 'agility'), 2);
  assert.equal(penalty(['dazed'], 'strength'), 0);
  assert.equal(penalty([], 'agility'), 0);
});

test('creation checks 24 points, 2 to 5 each, and 6 only for the key attribute', () => {
  const stats = { strength: 3, agility: 4, logic: 4, insight: 3, perception: 4, empathy: 6 };
  assert.equal(attributeIssues(stats, 'empathy').ok, true);
  assert.deepEqual(attributeIssues(stats, 'logic').outside, ['empathy']);
  assert.equal(attributeIssues({ ...stats, strength: 4 }, 'empathy').total, 25);
});

test('talent costs, levels and sources follow the book', () => {
  assert.equal(raiseCost(0), 5); assert.equal(raiseCost(1), 10); assert.equal(raiseCost(2), 15);
  assert.equal(talentMax('Renowned'), 1); assert.equal(talentMax('Charmer'), 3); assert.equal(talentMax('A custom talent'), 3);
  const context = { origin: 'Among the Alleys and Shanties of Aluminum Bay', profession: 'Artist', specialty: 'Staircase Poet' };
  assert.equal(talentSource('Actor', context), 'Origin');
  assert.equal(talentSource('Charmer', context), 'Specialty · Key');
  assert.equal(talentSource('Lookout', context), '');
});

test('book choices name real talents and a key attribute', () => {
  const names = new Set(talents.map(item => item.name));
  for (const origin of origins) assert.ok(names.has(origin.talent), origin.talent);
  for (const job of professions) {
    assert.ok(attributes.some(item => item.key === job.key), job.name);
    assert.equal(job.specialties.length, 6, job.name);
    for (const [, free] of job.specialties) assert.ok(names.has(free), free);
    for (const key of job.talents) assert.ok(names.has(key), key);
  }
  assert.equal(findProfession('Scholar').key, 'logic');
});

test('carrying counts rows by weight against Strength + 4', () => {
  assert.equal(carryLimit({ strength: 3 }), 7);
  assert.equal(carried([{ weight: 'Regular' }, { weight: 'Light' }, { weight: 'Heavy' }, { weight: 'Tiny' }, { weight: 'odd old text' }]), 4.5);
});

test('features round-trip between text and chips, and dates are local days', () => {
  assert.deepEqual(splitFeatures(' Stun, Long ,, '), ['Stun', 'Long']);
  assert.equal(joinFeatures(['Stun', 'Long']), 'Stun, Long');
  assert.equal(today(new Date(2026, 8, 6)), '2026-09-06');
});

test('the sheet stores injuries as cards but still accepts older free text', () => {
  const cards = cleanSheet({ injuries: [{ name: 'Broken ribs', effect: 'Exhausted and Dazed', heal: '2D6 days', lethal: false }], keepsakeUsedOn: '2026-09-26' });
  assert.equal(cards.injuries[0].name, 'Broken ribs');
  assert.equal(cards.keepsakeUsedOn, '2026-09-26');
  assert.equal(cleanSheet({ trauma: 'Nightmares' }).trauma, 'Nightmares');
  assert.equal(cleanSheet({ injuries: [{ name: 'x', lethal: 'yes' }] }), null);
  assert.equal(cleanSheet({ keepsakeUsedOn: 'yesterday' }), null);
  assert.deepEqual(cleanSheet({}).blight, []);
});
