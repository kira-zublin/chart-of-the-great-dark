import { applyChatSchema } from './migrate-004.js';
import { applyPushSchema } from './migrate-005.js';

if (process.env.VERCEL_ENV === 'preview') {
  await applyChatSchema();
  await applyPushSchema();
  console.log('Preview chat schemas applied.');
} else {
  console.log('Preview migration skipped outside Vercel Preview.');
}
