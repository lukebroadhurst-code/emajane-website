/* EMAJANE content API.
   GET  /api/content/:name                     public, the published content
   PUT  /api/admin/content/:name               admin only, publish new content
   GET  /api/admin/content/:name/previous      admin only, the version before the last publish
   GET  /api/admin/me                          admin only, who is signed in
   Everything under /api/admin is also placed behind Cloudflare Access; the checks here are a second lock. */

const NAMES = { gatherings: validateGatherings };
const STATUSES = ['tickets', 'soldout', 'free'];
const MAX_BODY = 64 * 1024;

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extra } });
const fail = (status, error) => json({ error }, status, { 'Cache-Control': 'no-store' });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    try {
      if (parts[0] === 'content' && parts.length === 2 && request.method === 'GET') return getContent(env, parts[1]);
      if (parts[0] === 'admin') {
        const who = await requireAdmin(request, env);
        if (!who) return fail(401, 'Please sign in.');
        if (parts[1] === 'me' && request.method === 'GET') return json({ email: who }, 200, { 'Cache-Control': 'no-store' });
        if (parts[1] === 'content' && parts.length === 3 && request.method === 'PUT') return putContent(request, env, parts[2], who, url);
        if (parts[1] === 'content' && parts.length === 4 && parts[3] === 'previous' && request.method === 'GET') return getPrevious(env, parts[2]);
      }
      return fail(404, 'Not found.');
    } catch (e) {
      console.error(e);
      return fail(500, 'Something went wrong on the website. Nothing was changed.');
    }
  },
};

async function getContent(env, name) {
  if (!NAMES[name]) return fail(404, 'Not found.');
  const stored = await env.CONTENT.get('content:' + name);
  if (!stored) return fail(404, 'Not published yet.');
  return new Response(stored, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=10' } });
}

async function getPrevious(env, name) {
  if (!NAMES[name]) return fail(404, 'Not found.');
  const prev = await env.CONTENT.get('previous:' + name);
  if (!prev) return fail(404, 'No earlier version.');
  return new Response(prev, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function putContent(request, env, name, who, url) {
  if (!NAMES[name]) return fail(404, 'Not found.');
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return fail(403, 'Request came from another site.');
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return fail(415, 'Send JSON.');
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, 'That is too much to save at once.');
  let body; try { body = JSON.parse(raw); } catch { return fail(400, 'That was not readable.'); }
  const result = NAMES[name](body);
  if (result.error) return fail(400, result.error);

  const current = await env.CONTENT.get('content:' + name);
  if (current) await env.CONTENT.put('previous:' + name, current);
  const doc = JSON.stringify({ ...result.value, updated: new Date().toISOString(), updatedBy: who });
  await env.CONTENT.put('content:' + name, doc);
  return json({ ok: true }, 200, { 'Cache-Control': 'no-store' });
}

/* ---- validation: rebuild the object from known fields only ------------------------------------------ */
function validateGatherings(body) {
  if (!body || !Array.isArray(body.items)) return { error: 'The list of gatherings is missing.' };
  if (body.items.length > 80) return { error: 'That is more gatherings than the website can list.' };
  const items = [];
  const ids = new Set();
  for (const g of body.items) {
    const id = String(g && g.id || '').slice(0, 40);
    if (!/^[\w-]+$/.test(id) || ids.has(id)) return { error: 'A gathering has a bad reference. Refresh and try again.' };
    ids.add(id);
    const date = String(g.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T12:00:00Z'))) return { error: 'A date is not valid.' };
    const city = String(g.city || '').trim();
    if (!city || city.length > 80) return { error: 'Every gathering needs a city of up to 80 letters.' };
    const venue = String(g.venue || '').trim();
    if (venue.length > 120) return { error: 'A venue name is too long.' };
    const status = String(g.status || '');
    if (!STATUSES.includes(status)) return { error: 'A ticket status is not valid.' };
    let ticketUrl = String(g.ticketUrl || '').trim();
    if (status === 'soldout') ticketUrl = '';
    if (ticketUrl) {
      let u; try { u = new URL(ticketUrl); } catch { return { error: 'A ticket link is not a proper web address.' }; }
      if (u.protocol !== 'https:' || ticketUrl.length > 400 || /\s/.test(ticketUrl)) return { error: 'Ticket links must start with https://' };
    }
    items.push({ id, date, city, venue, status, ticketUrl });
  }
  return { value: { placeholder: false, items } };
}

/* ---- who is signed in: Cloudflare Access sends a signed token, we check it ------------------------- */
let jwksCache = { at: 0, keys: null };

async function requireAdmin(request, env) {
  if (env.DEV_BYPASS === '1') return 'local-test@emajane.local';   // only ever set in .dev.vars on a developer machine
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;      // not configured: refuse rather than guess
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) return null;
  let header, payload;
  try { header = JSON.parse(atob64(h)); payload = JSON.parse(atob64(p)); } catch { return null; }
  if (header.alg !== 'RS256') return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD) || payload.exp < now || payload.nbf > now + 60) return null;
  if (payload.iss !== 'https://' + env.ACCESS_TEAM_DOMAIN) return null;

  if (!jwksCache.keys || Date.now() - jwksCache.at > 10 * 60 * 1000) {
    const r = await fetch('https://' + env.ACCESS_TEAM_DOMAIN + '/cdn-cgi/access/certs');
    if (!r.ok) return null;
    jwksCache = { at: Date.now(), keys: (await r.json()).keys };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64bytes(s), new TextEncoder().encode(h + '.' + p));
  return ok ? String(payload.email || payload.sub || 'admin') : null;
}
function b64bytes(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); }
function atob64(str) { return new TextDecoder().decode(b64bytes(str)); }
