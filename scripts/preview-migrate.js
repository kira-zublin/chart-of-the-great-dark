import { applyChatSchema } from './migrate-004.js';
import { applyPushSchema } from './migrate-005.js';
import { applyWorldSchema } from './migrate-006.js';
import { applyChoirParent } from './migrate-007.js';
import { applyLocationAccess } from './migrate-008.js';

if (process.env.VERCEL_ENV === 'preview') {
  await applyChatSchema();
  await applyPushSchema();
  await applyWorldSchema();
  await applyChoirParent();
  await applyLocationAccess();
  console.log('Preview chat and world schemas applied.');
} else {
  console.log('Preview migration skipped outside Vercel Preview.');
}
