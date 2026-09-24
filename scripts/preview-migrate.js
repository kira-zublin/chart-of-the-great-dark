import { applyChatSchema } from './migrate-004.js';

if (process.env.VERCEL_ENV === 'preview') {
  await applyChatSchema();
  console.log('Preview chat schema applied.');
} else {
  console.log('Preview migration skipped outside Vercel Preview.');
}
