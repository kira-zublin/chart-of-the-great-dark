import { db, digest, equalSecrets, error, guarded, json } from '../lib/server.js';

// Temporary release diagnostic. Comparing the database identity across deployments.
export async function GET(req) {
  const invite = process.env.REGISTRATION_INVITE_CODE;
  if (!invite || !equalSecrets(req.headers.get('x-diagnostic-invite') || '', invite)) return error('Not found', 404);
  return guarded(async () => {
    const url = process.env.TURSO_DATABASE_URL || '';
    const sql = db();
    const profiles = await sql.query('SELECT COUNT(*) AS count FROM profiles');
    return json({
      databaseFingerprint: digest(url).slice(0, 16),
      databaseScheme: url.startsWith('file:') ? 'file' : 'remote',
      profiles: Number(profiles[0].count),
      deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null
    });
  });
}
