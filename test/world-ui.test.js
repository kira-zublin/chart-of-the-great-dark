import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneDropPosition } from '../world-ui.js';

test('Vista drop keeps the standup bottom center where the dragged image ends', () => {
  const scene = { left: 100, top: 50, width: 1000, height: 800 };
  const grabbedNearTop = sceneDropPosition({ x: 420, y: 300 }, { offsetX: 20, offsetY: 100, width: 200, height: 300 }, scene);
  const grabbedNearBottom = sceneDropPosition({ x: 500, y: 470 }, { offsetX: 100, offsetY: 270, width: 200, height: 300 }, scene);
  assert.deepEqual(grabbedNearTop, [400, 563]);
  assert.deepEqual(grabbedNearBottom, grabbedNearTop);
  assert.deepEqual(sceneDropPosition({ x: -200, y: -200 }, { offsetX: 20, offsetY: 20, width: 200, height: 300 }, scene), [0, 38]);
});
