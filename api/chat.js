import { randomInt } from 'node:crypto';
import { body, currentProfile, db, error, guarded, json } from '../lib/server.js';

const attributes = new Set(['strength', 'agility', 'logic', 'insight', 'perception', 'empathy']);
const select = `SELECT m.id, m.player_name, m.character_id, m.character_name, m.kind, m.body, m.roll, m.push_of, m.created_at,
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
  const label = roll.attribute ? `${roll.attribute}${roll.talent ? ` + ${roll.talent} (${roll.talentLevel})` : ''}` : 'dice pool';
  const modifier = roll.modifier ? ` ${roll.modifier > 0 ? '+' : ''}${roll.modifier}` : '';
  const dice = `base [${roll.baseDice.join(', ')}]${roll.gearDice.length ? `, gear [${roll.gearDice.join(', ')}]` : ''}`;
  const result = `${roll.successes} ${roll.successes === 1 ? 'success' : 'successes'}`;
  if (roll.type === 'push') return `pushed ${label} (${roll.pushCount}): ${dice} — ${result}; ${roll.hopeLoss} Hope loss, ${roll.gearWear} gear wear`;
  return `rolled ${label}${modifier}: ${dice} — ${result}`;
}

const dice = count => Array.from({ length: count }, () => randomInt(1, 7));
const successes = (baseDice, gearDice) => [...baseDice, ...gearDice].filter(die => die === 6).length;
const reroll = values => values.map(die => die === 1 || die === 6 ? die : randomInt(1, 7));

export async function POST(req) {
  return guarded(async () => {
    const sql = db(); const profile = await currentProfile(req, sql);
    if (!profile) return error('Sign in to send chat', 401);
    const input = await body(req);
    const character = await selectedCharacter(sql, profile, input.characterId);
    if (character === false) return error('Character unavailable', 403);
    let kind, message = '', roll = null, pushOf = null;
    if (input.type === 'text') {
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2000) return error('Message must be 1–2000 characters');
      kind = 'text'; message = input.text.trim();
    } else if (input.type === 'simple') {
      kind = 'roll'; roll = { type: 'simple', dice: [randomInt(1, 7)] };
    } else if (input.type === 'pool') {
      const base = input.base; const modifier = input.modifier ?? 0; const gear = input.gear ?? 0;
      if (!Number.isInteger(base) || base < 1 || base > 30 || !Number.isInteger(modifier) || modifier < -10 || modifier > 10 || !Number.isInteger(gear) || gear < 0 || gear > 10) return error('Invalid roll options');
      const count = Math.max(1, Math.min(30, base + modifier));
      const baseDice = dice(count); const gearDice = dice(gear);
      roll = { type: 'pool', base, modifier, gear, baseDice, gearDice, successes: successes(baseDice, gearDice) };
      kind = 'roll';
    } else if (input.type === 'skill') {
      if (!character) return error('Select a character to roll an action');
      const modifier = input.base === undefined ? input.modifier ?? 0 : 0; const gear = input.gear ?? 0;
      if (!attributes.has(input.attribute) || !Number.isInteger(modifier) || modifier < -10 || modifier > 10 || !Number.isInteger(gear) || gear < 0 || gear > 10) return error('Invalid roll options');
      const stats = JSON.parse(character.attributes); const sheet = JSON.parse(character.sheet);
      const talent = input.talent || '';
      const found = talent ? sheet.talents?.find(item => item.name === talent) : null;
      if (talent && (!found || typeof talent !== 'string')) return error('Talent unavailable');
      const level = found?.level || 0;
      const suggested = Math.max(1, Math.min(30, stats[input.attribute] + level + modifier));
      if (input.base !== undefined && (!Number.isInteger(input.base) || input.base < 1 || input.base > 30)) return error('Invalid base dice count');
      const count = input.base ?? suggested;
      const baseDice = dice(count); const gearDice = dice(gear);
      roll = { type: 'skill', attribute: input.attribute, talent, talentLevel: level, base: count, modifier, gear, baseDice, gearDice, successes: successes(baseDice, gearDice) };
      kind = 'roll';
    } else if (input.type === 'push') {
      if (!Number.isSafeInteger(input.messageId) || input.messageId < 1) return error('Invalid roll to push');
      const previous = (await sql`SELECT id, profile_id, character_id, kind, roll FROM chat_messages WHERE id = ${input.messageId} LIMIT 1`)[0];
      if (!previous || previous.kind !== 'roll') return error('Roll unavailable', 404);
      if (previous.profile_id !== profile.id) return error('Only the roller can push', 403);
      const prior = JSON.parse(previous.roll);
      if (!['pool', 'skill', 'push'].includes(prior.type)) return error('This roll cannot be pushed');
      const pushCount = (prior.pushCount || 0) + 1;
      const hasRenowned = prior.attribute === 'empathy' && previous.character_id &&
        (await sql`SELECT sheet FROM characters WHERE id = ${previous.character_id} LIMIT 1`)[0]?.sheet;
      const secondAllowed = hasRenowned && JSON.parse(hasRenowned).talents?.some(item => item.name === 'Renowned');
      if (pushCount > (secondAllowed ? 2 : 1)) return error('This roll cannot be pushed again');
      const existing = await sql`SELECT id FROM chat_messages WHERE push_of = ${previous.id} LIMIT 1`;
      if (existing.length) return error('This roll has already been pushed', 409);
      const baseDice = reroll(prior.baseDice); const gearDice = reroll(prior.gearDice);
      roll = { type: 'push', attribute: prior.attribute || null, talent: prior.talent || '', talentLevel: prior.talentLevel || 0, base: prior.base ?? null, modifier: prior.modifier || 0, gear: prior.gear || 0, pushCount, baseDice, gearDice, successes: successes(baseDice, gearDice), hopeLoss: baseDice.filter(die => die === 1).length, gearWear: gearDice.filter(die => die === 1).length };
      pushOf = previous.id; kind = 'roll';
      // Keep the identity attached to the roll, even if the UI selection changed.
      const source = (await sql`SELECT character_id, character_name FROM chat_messages WHERE id = ${previous.id}`)[0];
      let saved;
      try {
        saved = await sql`INSERT INTO chat_messages (profile_id, player_name, character_id, character_name, kind, body, roll, push_of) VALUES (${profile.id}, ${profile.name}, ${source.character_id}, ${source.character_name}, ${kind}, '', ${JSON.stringify(roll)}, ${pushOf}) RETURNING id`;
      } catch (cause) {
        if (String(cause.code || '').startsWith('SQLITE_CONSTRAINT')) return error('This roll has already been pushed', 409);
        throw cause;
      }
      const rows = await sql.query(`${select} WHERE m.id = ?`, [saved[0].id]);
      return json({ message: present(rows[0]) }, 201);
    } else return error('Unknown message type');
    const rows = await sql`INSERT INTO chat_messages (profile_id, player_name, character_id, character_name, kind, body, roll) VALUES (${profile.id}, ${profile.name}, ${character?.id ?? null}, ${character?.name ?? null}, ${kind}, ${message}, ${roll ? JSON.stringify(roll) : null}) RETURNING id`;
    const saved = await sql.query(`${select} WHERE m.id = ?`, [rows[0].id]);
    return json({ message: present(saved[0]) }, 201);
  });
}
