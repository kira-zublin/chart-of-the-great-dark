import { currentProfile, db, error, guarded, json } from '../lib/server.js';

// Read-only rules reference for signed-in players and the GM: talent descriptions and the critical injury,
// mental trauma, Blight manifestation and gear feature tables. Empty until the library has been imported.
export async function GET(req) {
  return guarded(async () => {
    const sql = db();
    if (!(await currentProfile(req, sql))) return error('Sign in to read the rules reference', 401);
    let rows;
    try { rows = await sql.query('SELECT kind, key, name, data FROM rules_entries ORDER BY kind, position'); }
    catch (cause) {
      // Before migration 018 runs, the sheet simply works without descriptions.
      if (/no such table/i.test(cause.message)) return json({ entries: [] });
      throw cause;
    }
    return json({ entries: rows.map(row => ({ kind: row.kind, key: row.key, name: row.name, data: JSON.parse(row.data) })) }, 200, { 'Cache-Control': 'private, max-age=300' });
  });
}
