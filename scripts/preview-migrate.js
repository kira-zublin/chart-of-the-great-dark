import { applyChatSchema } from './migrate-004.js';
import { applyPushSchema } from './migrate-005.js';
import { applyWorldSchema } from './migrate-006.js';
import { applyChoirParent } from './migrate-007.js';
import { applyLocationAccess } from './migrate-008.js';
import { applyLocationCards } from './migrate-009.js';
import { applyJukeboxSchema } from './migrate-010.js';
import { retireChoirPrototype } from './migrate-011.js';
import { applyStandupScale } from './migrate-012.js';
import { retireDocksidePrototype } from './migrate-013.js';
import { applyStandupVariants } from './migrate-014.js';
import { applyInstances } from './migrate-015.js';
import { applyJukeboxVolume } from './migrate-016.js';
import { applyCreatureSchema } from './migrate-017.js';
import { applyRulesLibrarySchema } from './migrate-018.js';
import { applyCrewSheetSchema } from './migrate-019.js';

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
  await retireDocksidePrototype();
  await applyStandupVariants();
  await applyInstances();
  await applyJukeboxVolume();
  await applyCreatureSchema();
  await applyRulesLibrarySchema();
  await applyCrewSheetSchema();
  console.log('Preview chat, world, jukebox, and creature, and rules reference schemas applied.');
} else {
  console.log('Preview migration skipped outside Vercel Preview.');
}
