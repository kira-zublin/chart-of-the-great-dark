import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CENTER, JUMUAH, KIND_ICON, orbitPoint, orbitRadius } from '../star-chart.js';

test('the Jumuah chart keeps every place inside the star-map chart space', () => {
  const keys = JUMUAH.map(item => item.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const item of JUMUAH) {
    const [x, y] = item.at;
    assert.ok(x > 0 && x < 900 && y > 0 && y < 600, `${item.key} is at ${x}, ${y}`);
  }
  assert.deepEqual(orbitPoint(0, 0), CENTER);
  assert.ok(orbitRadius(54) < 300, 'the outermost tributary fits the chart height');
});

test('every chart icon, including the ones used for world locations, has an image file', () => {
  const icons = new Set([...JUMUAH.map(item => item.icon).filter(Boolean), ...Object.values(KIND_ICON)]);
  for (const icon of icons) assert.ok(existsSync(new URL(`../assets/icons/chart/${icon}.svg`, import.meta.url)), `${icon}.svg is missing`);
});
