// Rebus Club results API: a Cloudflare Worker with a D1 database.
//
//   POST /result   {puzzle, client, outcome, hints, wrongs, secs, mode}
//                  One player's first go at a built-in puzzle. outcome: 1 solved, 0 gave up, -1 skipped.
//                  client is a random id the game keeps in the browser; no names or accounts.
//   GET  /stats    {v: 1, puzzles: {id: [players, score, oneGo]}}
//                  How hard players found each puzzle. score is the average struggle per player,
//                  from 0 (solved first time within 20 seconds) to 1 (gave up). oneGo is the share
//                  who solved it first time without hints.
//
// The game turns these numbers into difficulty levels itself (adjustedLevel in index.html), since it
// knows the level each puzzle was written for.

const MIN_REPORT = 3;      // puzzles with fewer players than this are left out of /stats
const DAILY_LIMIT = 600;   // results accepted per network per day
const CACHE_SECS = 600;    // how long /stats may be cached

// One player's struggle on one puzzle, 0..1. Giving up is the strongest signal; a skip is close
// behind. For a solve, wrong guesses, hints and time beyond 20 seconds each add to it.
const SCORE_SQL = `CASE outcome WHEN 0 THEN 1.0 WHEN -1 THEN 0.8
  ELSE MIN(0.9, 0.15 * MIN(wrongs, 5) + 0.2 * MIN(hints, 2) + 0.35 * MIN(MAX(secs - 20, 0), 180) / 180.0) END`;

const MODES = ['practice', 'daily', 'quiz', 'endless'];

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.length ? (allowed.includes(origin) ? origin : allowed[0]) : '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/result' && req.method === 'POST') {
        if (allowed.length && !allowed.includes(origin)) return new Response('Origin not allowed', { status: 403, headers: cors });
        return await addResult(req, env, cors);
      }
      if (url.pathname === '/stats' && req.method === 'GET') return await stats(req, env, ctx, cors);
      return new Response('Not found', { status: 404, headers: cors });
    } catch (e) {
      return new Response('Server error', { status: 500, headers: cors });
    }
  },
};

async function addResult(req, env, cors) {
  const bad = msg => new Response(msg, { status: 400, headers: cors });
  const text = await req.text();
  if (text.length > 500) return bad('Too long');
  let r;
  try { r = JSON.parse(text); } catch { return bad('Not JSON'); }
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!r || !/^b_[a-z0-9]{1,100}$/.test(r.puzzle) || !/^[a-z0-9]{16,40}$/.test(r.client)
    || ![1, 0, -1].includes(r.outcome) || !int(r.hints, 0, 2) || !int(r.wrongs, 0, 99)
    || !int(r.secs, 0, 86400) || !MODES.includes(r.mode)) return bad('Bad result');

  // Rate limit per network per day. The address is only kept as a salted hash that changes daily,
  // and old rows are cleared out.
  const day = new Date().toISOString().slice(0, 10);
  const key = await sha256(`${env.SALT || ''}|${day}|${req.headers.get('CF-Connecting-IP') || ''}`);
  const n = await env.DB.prepare(
    'INSERT INTO limits (key, day, n) VALUES (?1, ?2, 1) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n'
  ).bind(key, day).first('n');
  if (n > DAILY_LIMIT) return new Response('Too many results today', { status: 429, headers: cors });

  // Only a player's first go counts, so a puzzle they've already reported is ignored.
  await env.DB.prepare(
    'INSERT OR IGNORE INTO results (puzzle, client, outcome, hints, wrongs, secs, mode, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  ).bind(r.puzzle, r.client, r.outcome, r.hints, r.wrongs, Math.min(r.secs, 3600), r.mode, Date.now()).run();

  if (Math.random() < 0.01) await env.DB.prepare('DELETE FROM limits WHERE day < ?1').bind(day).run();
  return new Response(null, { status: 204, headers: cors });
}

async function stats(req, env, ctx, cors) {
  // The Cache API only works on a custom domain; on workers.dev every request reads D1, which is fine.
  const cacheKey = new Request(new URL('/stats', req.url).toString());
  let res = await caches.default.match(cacheKey);
  if (!res) {
    const { results } = await env.DB.prepare(
      `SELECT puzzle, COUNT(*) AS n, AVG(${SCORE_SQL}) AS score,
              AVG(CASE WHEN outcome = 1 AND wrongs = 0 AND hints = 0 THEN 1.0 ELSE 0.0 END) AS one_go
       FROM results GROUP BY puzzle HAVING COUNT(*) >= ?1`
    ).bind(MIN_REPORT).all();
    const round = x => Math.round(x * 1000) / 1000;
    const puzzles = {};
    for (const r of results) puzzles[r.puzzle] = [r.n, round(r.score), round(r.one_go)];
    res = new Response(JSON.stringify({ v: 1, puzzles }), {
      headers: { 'content-type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECS}` },
    });
    ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  }
  res = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
  return res;
}

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
