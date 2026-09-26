import { applyChatSchema } from './migrate-004.js';
import { applyPushSchema } from './migrate-005.js';
import { applyWorldSchema } from './migrate-006.js';
import { applyChoirParent } from './migrate-007.js';
import { applyLocationAccess } from './migrate-008.js';
import { applyLocationCards } from './migrate-009.js';
import { applyJukeboxSchema } from './migrate-010.js';
import { retireChoirPrototype } from './migrate-011.js';
import { applyStandupScale } from './migrate-012.js';

if (process.env.VERCEL_ENV === 'preview') {
  await applyChatSchema();
  await applyPushSchema();
  await applyWorldSchema();
  await applyChoirParent();
  await applyLocationAccess();
  await applyLocationCards();
  await applyJukeboxSchema();
  await retireChoirPrototype();
  await applyStandupScale();
  console.log('Preview chat, world, and jukebox schemas applied.');
} else {
  console.log('Preview migration skipped outside Vercel Preview.');
}
