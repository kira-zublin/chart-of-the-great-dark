import { randomInt } from 'node:crypto';
import { body, currentProfile, db, error, guarded, json } from '../lib/server.js';

const attributes = new Set(['strength', 'agility', 'logic', 'insight', 'perception', 'empathy']);
const select = `SELECT m.id, m.player_name, m.character_id, m.character_name, m.kind, m.body, m.roll, m.created_at,
  EXISTS (SELECT 1 FROM character_images i WHERE i.character_id = m.character_id AND i.slot = 'portrait') AS has_portrait
  FROM chat_messages m`;
const present = row => ({ ...row, has_portrait: Boolean(row.has_portrait), roll: row.roll ? JSON.parse(row.roll) : null });
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const line = value => String(value ?? '').replace(/\r?\n/g, ' ⏎ ').replace(/\r/g, ' ');

async function selectedCharacter(sql, profile, id) {
  if (id == null || id === '') return null;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return false;
  const rows = await sql`SELECT id, name, owner_id, kind, attributes, sheet FROM characters WHERE id = ${id} LIMIT 1`;
  const character = rows[0];
  if (!character || (profile.role !== 'gm' && (character.owner_id !== profile.id || character.kind !== 'pc'))) return false;
  return character;
}

export async function GET(req) {
  return guarded(async () => {
    const sql = db();
    if (!await currentProfile(req, sql)) return error('Sign in to read chat', 401);
    const params = new URL(req.url).searchParams;
    if (params.get('export') === 'text') {
      const from = params.get('from'); const through = params.get('through');
      if (!date(from) || !date(through) || from > through) return error('Choose a valid date range');
      const start = Math.floor(Date.parse(from + 'T00:00:00Z') / 1000);
      const end = Math.floor(Date.parse(through + 'T00:00:00Z') / 1000) + 86400;
      const rows = await sql.query(`${select} WHERE m.created_at >= ? AND m.created_at < ? ORDER BY m.id`, [start, end]);
      const lines = rows.map(row => {
        const speaker = row.character_name ? `${row.character_name} <${row.player_name}>` : row.player_name;
        const content = row.kind === 'roll' ? describeRoll(JSON.parse(row.roll)) : line(row.body);
        return `[${new Date(Number(row.created_at) * 1000).toISOString()}] ${line(speaker)}: ${content}`;
      });
      return new Response(lines.join('\n') + (lines.length ? '\n' : ''), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="campaign-chat-${from}-to-${through}.txt"`, 'Cache-Control': 'no-store' } });
    }
    const after = params.get('after');
    if (after && !/^\d+$/.test(after)) return error('Invalid chat cursor');
    const rows = after
      ? await sql.query(`${select} WHERE m.id > ? ORDER BY m.id LIMIT 100`, [Number(after)])
      : await sql.query(`SELECT * FROM (${select} ORDER BY m.id DESC LIMIT 100) ORDER BY id`);
    return json({ messages: rows.map(present) });
  });
}

export function describeRoll(roll) {
  if (roll.type === 'simple') return `rolled d6: ${roll.dice[0]}`;
  return `rolled ${roll.attribute}${roll.talent ? ` + ${roll.talent} (${roll.talentLevel})` : ''}${roll.modifier ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : ''}${roll.gear ? ` + ${roll.gear} gear` : ''}: base [${roll.baseDice.join(', ')}]${roll.gear ? `, gear [${roll.gearDice.join(', ')}]` : ''} — ${roll.successes} ${roll.successes === 1 ? 'success' : 'successes'}`;
}

export async function POST(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to send chat', 401);
    const input = await body(req);
    const character = await selectedCharacter(sql, profile, input.characterId);
    if (character === false) return error('Character unavailable', 403);
    let kind, message = '', roll = null;
    if (input.type === 'text') {
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) return error('Message must be 1–2000 characters');
      kind = 'text'; message = input.text.trim();
    } else if (input.type === 'simple') {
      kind = 'roll'; roll = { type: 'simple', dice: [randomInt(1, 7)] };
    } else if (input.type === 'skill') {
      if (!character) return error('Select a character to roll an action');
      const modifier = input.modifier ?? 0; const gear = input.gear ?? 0;
      if (!attributes.has(input.attribute) || !Number.isInteger(modifier) || modifier < -10 || modifier > 10 || !Number.isInteger(gear) || gear < 0 || gear > 10) return error('Invalid roll options');
      const stats = JSON.parse(character.attributes); const sheet = JSON.parse(character.sheet);
      const talent = input.talent || '';
      const found = talent ? sheet.talents?.find(item => item.name === talent) : null;
      if (talent && (!found || typeof talent !== 'string')) return error('Talent unavailable');
      const level = found?.level || 0;
      const count = Math.max(1, Math.min(30, stats[input.attribute] + level + modifier));
      const baseDice = Array.from({ length: count }, () => randomInt(1, 7));
      const gearDice = Array.from({ length: gear }, () => randomInt(1, 7));
      roll = { type: 'skill', attribute: input.attribute, talent, talentLevel: level, modifier, gear, baseDice, gearDice, successes: [...baseDice, ...gearDice].filter(die => die === 6).length };
      kind = 'roll';
    } else return error('Unknown message type');
    const rows = await sql`INSERT INTO chat_messages (profile_id, player_name, character_id, character_name, kind, body, roll) VALUES (${profile.id}, ${profile.name}, ${character?.id ?? null}, ${character?.name ?? null}, ${kind}, ${message}, ${roll ? JSON.stringify(roll) : null}) RETURNING id`;
    const saved = await sql.query(`${select} WHERE m.id = ?`, [rows[0].id]);
    return json({ message: present(saved[0]) }, 201);
  });
}
