import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

const scrypt = promisify(scryptCallback);
const cookieName = 'chart_session';
const sessionSeconds = 60 * 60 * 24 * 30;

let cached;
export function db() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url || (!url.startsWith('file:') && !process.env.TURSO_AUTH_TOKEN)) throw new Error('Turso is not configured');
  if (!cached || cached.url !== url) {
    const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    const ready = client.execute('PRAGMA foreign_keys = ON');
    const query = async (statement, args = []) => {
      await ready;
      const result = await client.execute({ sql: statement, args });
      return Array.from(result.rows);
    };
    const sql = async (parts, ...values) => {
      let statement = parts[0];
      for (let i = 0; i < values.length; i++) statement += '?' + parts[i + 1];
      return query(statement, values);
    };
    sql.query = query;
    sql.client = client;
    cached = { url, sql };
  }
  return cached.sql;
}

export function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function error(message, status = 400) { return json({ error: message }, status); }

export async function body(req) {
  if (Number(req.headers.get('content-length') || 0) > 250000) throw new Error('Request is too large');
  return req.json();
}

export function digest(value) { return createHash('sha256').update(value).digest('hex'); }
export function equalSecrets(a, b) {
  const x = Buffer.from(digest(a)); const y = Buffer.from(digest(b));
  return timingSafeEqual(x, y);
}
export async function passwordHash(password, salt) {
  return (await scrypt(password, salt, 64)).toString('hex');
}
export function validateCredentials(name, password) {
  if (typeof name !== 'string' || !/^[\p{L}\p{N}_ .-]{2,32}$/u.test(name.trim())) return 'Name must be 2–32 letters, numbers, spaces, dots, dashes, or underscores';
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return 'Password must be 10–128 characters';
  return null;
}
export function cookie(req, token, maxAge = sessionSeconds) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}
export function tokenFrom(req) {
  const raw = req.headers.get('cookie') || '';
  const match = raw.match(/(?:^|;\s*)chart_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}
export async function currentProfile(req, sql = db()) {
  const token = tokenFrom(req);
  if (!token) return null;
  const rows = await sql`SELECT p.id, p.name, p.role FROM sessions s JOIN profiles p ON p.id = s.profile_id WHERE s.token_hash = ${digest(token)} AND s.expires_at > unixepoch() LIMIT 1`;
  return rows[0] || null;
}
export async function createSession(req, profile, sql = db()) {
  const token = randomBytes(32).toString('hex');
  await sql`INSERT INTO sessions (token_hash, profile_id, expires_at) VALUES (${digest(token)}, ${profile.id}, unixepoch() + ${sessionSeconds})`;
  return json({ profile }, 200, { 'Set-Cookie': cookie(req, token) });
}
export async function guarded(handler) {
  try { return await handler(); }
  catch (cause) {
    console.error(cause);
    if (cause instanceof SyntaxError) return error('Invalid request data');
    if (cause.message === 'Request is too large') return error(cause.message, 413);
    return error('The service is unavailable. Please try again later.', 503);
  }
}
export { randomUUID };
