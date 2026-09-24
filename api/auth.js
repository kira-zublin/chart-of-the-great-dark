import { body, cookie, createSession, currentProfile, db, digest, equalSecrets, error, guarded, json, passwordHash, randomUUID, tokenFrom, validateCredentials } from '../lib/server.js';
import { randomBytes } from 'node:crypto';

export async function GET(req) {
  return guarded(async () => json({ profile: await currentProfile(req) }));
}

export async function POST(req) {
  return guarded(async () => {
    const data = await body(req);
    const name = typeof data.name === 'string' ? data.name.trim() : data.name;
    const issue = validateCredentials(name, data.password);
    if (issue) return error(issue);
    const sql = db();
    if (data.action === 'register') {
      if (!process.env.REGISTRATION_INVITE_CODE) return error('Registration is not configured', 503);
      if (typeof data.inviteCode !== 'string' || !equalSecrets(data.inviteCode, process.env.REGISTRATION_INVITE_CODE)) return error('Invalid invitation code', 403);
      if (!['player', 'gm'].includes(data.role)) return error('Choose Player or GM');
      const salt = randomBytes(16).toString('hex');
      const hash = await passwordHash(data.password, salt);
      const id = randomUUID();
      const found = await sql`SELECT id FROM profiles WHERE lower(name) = lower(${name}) LIMIT 1`;
      if (found.length) return error('That name is already in use', 409);
      try { await sql`INSERT INTO profiles (id, name, password_salt, password_hash, role) VALUES (${id}, ${name}, ${salt}, ${hash}, ${data.role})`; }
      catch (cause) { if (String(cause.code).startsWith('SQLITE_CONSTRAINT')) return error('That name is already in use', 409); throw cause; }
      return createSession(req, { id, name, role: data.role }, sql);
    }
    if (data.action === 'login') {
      const rows = await sql`SELECT id, name, role, password_salt, password_hash, locked_until FROM profiles WHERE lower(name) = lower(${name}) LIMIT 1`;
      if (!rows.length) return error('Invalid name or password', 401);
      const row = rows[0];
      if (row.locked_until && Number(row.locked_until) > Math.floor(Date.now() / 1000)) return error('Too many attempts. Try again in 15 minutes.', 429);
      if (!equalSecrets(await passwordHash(data.password, row.password_salt), row.password_hash)) {
        await sql`UPDATE profiles SET failed_logins = CASE WHEN locked_until < unixepoch() THEN 1 ELSE failed_logins + 1 END, locked_until = CASE WHEN locked_until < unixepoch() THEN NULL WHEN failed_logins >= 9 THEN unixepoch() + 900 ELSE NULL END WHERE id = ${row.id}`;
        return error('Invalid name or password', 401);
      }
      await sql`UPDATE profiles SET failed_logins = 0, locked_until = NULL WHERE id = ${row.id}`;
      return createSession(req, { id: row.id, name: row.name, role: row.role }, sql);
    }
    return error('Unknown action');
  });
}

export async function DELETE(req) {
  return guarded(async () => {
    const token = tokenFrom(req);
    if (token) { const sql = db(); await sql`DELETE FROM sessions WHERE token_hash = ${digest(token)}`; }
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(req, '', 0) });
  });
}
