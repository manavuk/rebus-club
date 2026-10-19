// Names the service worker's cache after a hash of the files it caches, so any change to the
// app gets a fresh cache and nobody has to remember to bump it. Run: node scripts/stamp-sw.mjs
// (the pre-commit hook in .githooks runs it for you).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url);
const swUrl = new URL('sw.js', root);
const sw = readFileSync(swUrl, 'utf8');

const list = sw.match(/const APP = \[([\s\S]*?)\];/);
if (!list) throw new Error('Could not find the APP list in sw.js');
const files = [...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');

const hash = createHash('sha256');
for (const f of files) hash.update(f + '\0').update(readFileSync(new URL(f, root)));
const name = `rebus-club-${hash.digest('hex').slice(0, 10)}`;

const out = sw.replace(/const CACHE = '[^']*';/, `const CACHE = '${name}';`);
if (out === sw) console.log(`sw.js cache is already ${name}`);
else { writeFileSync(swUrl, out); console.log(`sw.js cache is now ${name}`); }
