import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/server.js';
import { applyLocationAccess } from './migrate-008.js';
import { applyLocationCards } from './migrate-009.js';
import { backupTurso } from './backup-turso.js';
import { places, markers, seedShipCitySlice } from './seed-ship-city-slice.js';

const sql = db();
const mode = process.argv[2] || 'status';
if (!['status', 'apply'].includes(mode)) throw new Error('Usage: publish-ship-city.js status | apply <new-backup.sqlite>');

const locationIds = new Set(places.map(place => place[0]));
const markerIds = new Set(markers.map(marker => marker[0]));
const locationColumns = new Set((await sql.query('PRAGMA table_info(locations)')).map(row => row.name));
if (!locationColumns.size) throw new Error('World schema 006 is missing. Stop before publishing Ship City.');
const existingLocations = (await sql.query('SELECT id FROM locations')).map(row => row.id).filter(id => locationIds.has(id));
const existingMarkers = (await sql.query('SELECT id FROM location_links')).map(row => row.id).filter(id => markerIds.has(id));
const strandedPositions = await sql.query("SELECT location_id, COUNT(*) AS count FROM character_positions WHERE location_id IN ('dockside', 'choir') GROUP BY location_id");
console.log(`Ship City preflight: ${existingLocations.length} matching locations, ${existingMarkers.length} matching markers, ${strandedPositions.reduce((sum, row) => sum + Number(row.count), 0)} characters at retired sample markers.`);
console.log(`Location cards migration 009: ${locationColumns.has('teaser') ? 'present' : 'needed'}; access migration 008: ${locationColumns.has('access_level') ? 'present' : 'needed'}.`);

if (mode === 'apply') {
  if (!process.argv[3]?.endsWith('.sqlite')) throw new Error('Supply a new .sqlite backup path.');
  if (existingLocations.length || existingMarkers.length) throw new Error('Ship City IDs already exist; inspect the database before applying this one-time release.');
  if (strandedPositions.length) throw new Error('Characters occupy locations whose sample city markers would be retired; move them before publishing.');
  const backup = await backupTurso(process.argv[3], sql);
  console.log(`Production backup verified: ${backup.path} (${backup.tables} tables, ${backup.bytes} bytes).`);
  await applyLocationAccess(sql);
  await applyLocationCards(sql);
  const transaction = await sql.client.transaction('write');
  try {
    const transactionalSql = { query: async (statement, args = []) => Array.from((await transaction.execute({ sql: statement, args })).rows) };
    await seedShipCitySlice(transactionalSql);
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback();
    throw cause;
  }
  const inserted = (await sql.query('SELECT id FROM locations')).filter(row => locationIds.has(row.id)).length;
  const linked = (await sql.query('SELECT id FROM location_links')).filter(row => markerIds.has(row.id)).length;
  if (inserted !== locationIds.size || linked !== markerIds.size) throw new Error(`Published count mismatch: ${inserted}/${locationIds.size} locations, ${linked}/${markerIds.size} markers.`);
  console.log(`Published ${inserted} Ship City locations and ${linked} map markers.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) !== resolve(process.argv[1])) throw new Error('Run this script directly.');
