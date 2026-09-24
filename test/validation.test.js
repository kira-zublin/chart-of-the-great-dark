import test from 'node:test';
import assert from 'node:assert/strict';
import { canCreate, canEdit, clean } from '../api/characters.js';
import { cookie, equalSecrets, passwordHash, tokenFrom, validateCredentials } from '../lib/server.js';
import { cleanSheet } from '../lib/sheet.js';
import { cleanCrewField } from '../api/crew.js';

const valid = {
  kind: 'pc', name: 'Amina', profession: 'Explorer', origin: '', faction: '',
  appearance: '', motivation: '', description: 'Charts the horizon',
  attributes: { strength: 2, agility: 3, logic: 2, insight: 1, perception: 4, empathy: 2 }
};

test('character fields are validated and extra client fields are discarded', () => {
  assert.deepEqual(clean({ ...valid, owner_id: 'someone-else' }), valid);
  assert.equal(clean({ ...valid, name: '' }), null);
  assert.equal(clean({ ...valid, attributes: { ...valid.attributes, empathy: 100 } }), null);
  assert.equal(clean({ ...valid, attributes: { ...valid.attributes, empathy: 'not a number' } }), null);
});

test('passwords use salted hashes and secrets compare safely', async () => {
  const first = await passwordHash('a long passphrase', 'first-salt');
  const second = await passwordHash('a long passphrase', 'second-salt');
  assert.notEqual(first, second);
  assert.ok(equalSecrets(first, first));
  assert.ok(!equalSecrets(first, second));
  assert.match(validateCredentials('Traveler', 'short'), /Password/);
});

test('player and GM edit boundaries are enforced by server logic', () => {
  const player = { id: 'alice', role: 'player' };
  const gm = { id: 'gm', role: 'gm' };
  assert.ok(canCreate(player, 'pc'));
  assert.ok(!canCreate(player, 'npc'));
  assert.ok(canCreate(gm, 'npc'));
  assert.ok(canEdit(player, { owner_id: 'alice', kind: 'pc' }, 'pc'));
  assert.ok(!canEdit(player, { owner_id: 'bob', kind: 'pc' }, 'pc'));
  assert.ok(!canEdit(player, { owner_id: 'alice', kind: 'pc' }, 'npc'));
  assert.ok(canEdit(gm, { owner_id: 'bob', kind: 'pc' }, 'pc'));
});

test('session cookie is HTTP only and cleared on logout', () => {
  const request = new Request('https://example.test/');
  assert.match(cookie(request, 'a'.repeat(64)), /HttpOnly; SameSite=Lax; Path=\/; Max-Age=.*; Secure/);
  assert.match(cookie(request, '', 0), /Max-Age=0/);
  assert.equal(tokenFrom(new Request('https://example.test/', { headers: { cookie: `other=x; chart_session=${'a'.repeat(64)}` } })), 'a'.repeat(64));
});

test('extended sheet and crew fields reject malformed persistent data', () => {
  assert.equal(cleanSheet({ conditions: ['not-a-condition'] }), null);
  assert.equal(cleanSheet({ talents: [{ name: 'Lookout', level: 100 }] }), null);
  assert.equal(cleanSheet({ weapons: [{ name: 'Pistol', bonus: 2, damage: -1 }] }), null);
  assert.equal(cleanCrewField('bird', { name: 'Garuda', health: -1 }), null);
  assert.equal(cleanCrewField('unknown', 'text'), null);
  assert.equal(cleanCrewField('crew_points', 0), 0);
});
