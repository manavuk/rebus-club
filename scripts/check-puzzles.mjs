// Checks the built-in puzzle bank: every puzzle renders, has a clue, answers and a meaning,
// and no answer or ID is used twice. Run: node scripts/check-puzzles.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const src = ['render.js', 'puzzles.js', 'meanings.js'].map(f => readFileSync(new URL(f, root), 'utf8')).join('\n');
const { B, MEANINGS } = vm.runInNewContext(src + '\n;({B, MEANINGS})', {});

// Same normalisation the game uses when judging answers.
const norm = s => String(s).toLowerCase().replace(/[‘’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const key = s => norm(s).replace(/ /g, '');

const errors = [];
const ids = new Map();
const answers = new Map();
for (const [i, p] of B.entries()) {
  const at = `#${i} (${p.a?.[0] ?? '?'})`;
  if (!Number.isInteger(p.d) || p.d < 1 || p.d > 8) errors.push(`${at}: difficulty ${p.d} is not 1-8`);
  if (!Array.isArray(p.a) || !p.a.length || p.a.some(a => typeof a !== 'string' || !a.trim())) errors.push(`${at}: needs at least one non-empty answer`);
  else if (p.a.some(a => a !== a.toLowerCase())) errors.push(`${at}: answers should be lowercase`);
  if (typeof p.h !== 'string' || !p.h.trim()) errors.push(`${at}: missing clue`);
  else if (p.h.length > 140) errors.push(`${at}: clue is over 140 characters`);
  if (typeof p.r !== 'string' || !p.r.trim()) errors.push(`${at}: renders nothing`);
  if (p.alt != null && (typeof p.alt !== 'string' || !p.alt.trim())) errors.push(`${at}: alt should be a non-empty string`);
  if (typeof p.m !== 'string' || !p.m.trim()) errors.push(`${at}: no meaning in meanings.js (key ${p.id})`);
  else if (p.m.length > 200) errors.push(`${at}: meaning is over 200 characters`);
  if (ids.has(p.id)) errors.push(`${at}: id ${p.id} already used by #${ids.get(p.id)}`);
  ids.set(p.id, i);
  for (const a of new Set((p.a || []).map(key))) {
    if (answers.has(a)) errors.push(`${at}: answer "${a}" is also accepted by #${answers.get(a)}`);
    else answers.set(a, i);
  }
}

for (const k of Object.keys(MEANINGS)) if (!ids.has(k)) errors.push(`meanings.js: ${k} matches no puzzle`);

const tiers = {};
for (const p of B) tiers[p.d] = (tiers[p.d] || 0) + 1;
console.log(`${B.length} puzzles. By difficulty: ${Object.entries(tiers).map(([d, n]) => `${d}:${n}`).join('  ')}`);
if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length > 1 ? 's' : ''}:\n` + errors.map(e => '  ' + e).join('\n'));
  process.exit(1);
}
console.log('All puzzles OK.');
