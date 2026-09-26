import test from 'node:test';
import assert from 'node:assert/strict';
import { dialogLine, heardIn, outOfCharacter, readingPause } from '../vista-dialog.js';

const message = fields => ({ id: 7, kind: 'text', body: 'We should go.', player_name: 'Alice', character_id: 'c1', character_name: 'Saira', has_portrait: true, from_gm: false, ...fields });

test('out-of-character talk, rolls and blank lines stay out of the Vista dialog', () => {
  for (const body of ['// brb', '((is it my turn?))', 'OOC: snacks', '  ooc: later']) assert.ok(outOfCharacter(body), body);
  for (const body of ['Ooc is a strange word', 'Look (quietly) left', 'http://example.com']) assert.ok(!outOfCharacter(body), body);
  assert.equal(dialogLine(message({ body: '((pause))' })), null);
  assert.equal(dialogLine(message({ kind: 'roll', body: '' })), null);
  assert.equal(dialogLine(message({ body: '   ' })), null);
});

test('dialog lines use the character portrait, the anonymous explorer, or the GM narrator', () => {
  assert.deepEqual(dialogLine(message({ body: '  We should go.  ' })), { id: 7, narrator: false, text: 'We should go.', speaker: 'Saira', portrait: '/api/image?id=c1&slot=portrait' });
  assert.equal(dialogLine(message({ has_portrait: false })).portrait, 'assets/characters/anonymous-explorer.png');
  assert.deepEqual(dialogLine(message({ from_gm: true, character_id: null, character_name: null, player_name: 'Keeper' })), { id: 7, narrator: true, text: 'We should go.', speaker: 'Keeper', portrait: null });
  assert.equal(dialogLine(message({ from_gm: true, character_id: 'npc', character_name: 'Moska' })).speaker, 'Moska', 'the GM speaking as an NPC');
});

test('only characters in the Vista and the GM are heard there', () => {
  const speakers = new Set(['c1']);
  assert.ok(heardIn(message(), speakers));
  assert.ok(!heardIn(message({ character_id: 'c2' }), speakers), 'a character elsewhere');
  assert.ok(!heardIn(message({ character_id: null }), speakers), 'a player with no character');
  assert.ok(heardIn(message({ from_gm: true, character_id: null }), speakers));
  assert.ok(heardIn(message({ from_gm: true, character_id: 'npc' }), speakers));
  assert.equal(readingPause('short'), 1325); assert.equal(readingPause('x'.repeat(1000)), 4000);
});
