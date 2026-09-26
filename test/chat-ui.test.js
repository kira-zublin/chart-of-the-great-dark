import test from 'node:test';
import assert from 'node:assert/strict';
import { rollCard } from '../chat-ui.js';

test('roll cards present server dice in order and keep push costs', () => {
  const skill = rollCard({ type: 'skill', attribute: 'perception', talent: 'Observation', talentLevel: 2, baseDice: [6, 3, 1], gearDice: [6, 2], successes: 2 });
  assert.equal(skill.title, 'Perception + Observation (2)');
  assert.deepEqual(skill.dice, [{ value: 6, gear: false }, { value: 3, gear: false }, { value: 1, gear: false }, { value: 6, gear: true }, { value: 2, gear: true }]);
  assert.equal(skill.result, '2 Successes');
  assert.equal(skill.costs, '');

  const push = rollCard({ type: 'push', pushCount: 1, attribute: null, talent: '', baseDice: [1, 4], gearDice: [1], successes: 0, hopeLoss: 1, gearWear: 1 });
  assert.equal(push.title, 'Push 1 · Dice pool');
  assert.equal(push.result, 'No successes');
  assert.equal(push.costs, '1 Hope loss · 1 gear wear');

  assert.equal(rollCard({ type: 'pool', baseDice: [6], gearDice: [], successes: 1 }).result, '1 Success');
  assert.deepEqual(rollCard({ type: 'simple', dice: [5] }), { title: 'Rolled d6', dice: [{ value: 5, gear: false }], result: null, costs: '' });
});
