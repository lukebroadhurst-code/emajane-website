/* EMAJANE content API.

   Public (anyone can read):
     GET  /api/content                    every published section in one go
     GET  /api/content/:name              one published section
     GET  /media/:id                      a picture
   Admin (Cloudflare Access login, checked again here):
     GET  /api/admin/me                   who is signed in
     GET  /api/admin/status               when each section was last put on the website
     PUT  /api/admin/content/:name        put new content on the website
     GET  /api/admin/content/:name/previous   the version before the last change
     POST /api/admin/media                add a picture

   Every save is checked by the same schema the admin uses (site/admin/schema.js). */

import { DOCS, validateDoc, LIMITS, problemLine } from '../../site/admin/schema.js';

const MAX_DOC_BYTES = 64 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...extra } });
const fail = (status, error, more = {}) => json({ error, ...more }, status, NO_STORE);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/media/') && request.method === 'GET') return getMedia(env, url.pathname.slice('/media/'.length));

      const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
      if (parts[0] === 'content' && request.method === 'GET') {
        if (parts.length === 1) return getAll(env);
        if (parts.length === 2) return getContent(env, parts[1]);
      }
      if (parts[0] === 'admin') {
        const who = await requireAdmin(request, env);
        if (!who) return fail(401, 'Please sign in again.');
        if (parts[1] === 'me' && request.method === 'GET') return json({ email: who }, 200, NO_STORE);
        if (parts[1] === 'status' && request.method === 'GET') return getStatus(env);
        if (parts[1] === 'content' && parts.length === 4 && parts[3] === 'previous' && request.method === 'GET') return getPrevious(env, parts[2]);
        if (parts[1] === 'content' && parts.length === 3 && request.method === 'PUT') {
          const blocked = notFromAdmin(request, url);
          return blocked || putContent(request, env, parts[2], who);
        }
        if (parts[1] === 'media' && parts.length === 2 && request.method === 'POST') {
          const blocked = notFromAdmin(request, url);
          return blocked || putMedia(request, env);
        }
      }
      return fail(404, 'Not found.');
    } catch (e) {
      console.error(e);
      return fail(500, 'Something went wrong on the website. Nothing was changed.');
    }
  },
};

/* A save must come from the admin page itself, not from some other website. */
function notFromAdmin(request, url) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return fail(403, 'That request came from another website.');
  if (request.headers.get('X-Emajane-Admin') !== '1') return fail(403, 'That request did not come from the admin.');
  return null;
}

/* ---- reading ------------------------------------------------------------------------------------- */
async function getAll(env) {
  const names = Object.keys(DOCS);
  const docs = await Promise.all(names.map((n) => env.CONTENT.get('content:' + n)));
  const body = '{' + names.filter((_, i) => docs[i]).map((n) => `${JSON.stringify(n)}:${docs[names.indexOf(n)]}`).join(',') + '}';
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=10', 'X-Content-Type-Options': 'nosniff' } });
}

async function getContent(env, name) {
  if (!DOCS[name]) return fail(404, 'Not found.');
  const stored = await env.CONTENT.get('content:' + name);
  if (!stored) return fail(404, 'Not put on the website yet.');
  return new Response(stored, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=10', 'X-Content-Type-Options': 'nosniff' } });
}

async function getPrevious(env, name) {
  if (!DOCS[name]) return fail(404, 'Not found.');
  const prev = await env.CONTENT.get('previous:' + name);
  if (!prev) return fail(404, 'There is no older version.');
  return new Response(prev, { headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE, 'X-Content-Type-Options': 'nosniff' } });
}

async function getStatus(env) {
  const names = Object.keys(DOCS);
  const rows = await Promise.all(names.map(async (n) => {
    const [cur, prev] = await Promise.all([env.CONTENT.get('content:' + n), env.CONTENT.get('previous:' + n)]);
    let meta = {};
    try { meta = cur ? JSON.parse(cur) : {}; } catch { /* ignore */ }
    return [n, { published: !!cur, updated: meta.updated || null, updatedBy: meta.updatedBy || null, hasPrevious: !!prev }];
  }));
  return json({ docs: Object.fromEntries(rows) }, 200, NO_STORE);
}

/* ---- saving -------------------------------------------------------------------------------------- */
async function putContent(request, env, name, who) {
  if (!DOCS[name]) return fail(404, 'Not found.');
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return fail(415, 'Please send JSON.');
  const raw = await request.text();
  if (raw.length > MAX_DOC_BYTES) return fail(413, 'That is too much to save at once.');
  let body;
  try { body = JSON.parse(raw); } catch { return fail(400, 'That could not be read.'); }

  const result = validateDoc(name, body);
  if (result.errors) {
    const e = result.errors[0];
    return fail(400, problemLine(e), { errors: result.errors });
  }

  const current = await env.CONTENT.get('content:' + name);
  const base = request.headers.get('X-Base-Updated');            // what the editor was looking at; absent = no check
  if (current && base !== null) {
    let cu = null;
    try { cu = JSON.parse(current).updated || null; } catch { /* ignore */ }
    if ((cu || '') !== base) return fail(409, 'Someone else changed this while you were working. Please refresh the page to see their version, then make your change again.');
  }
  if (current) await env.CONTENT.put('previous:' + name, current);
  const updated = new Date().toISOString();
  await env.CONTENT.put('content:' + name, JSON.stringify({ ...result.value, updated, updatedBy: who }));
  return json({ ok: true, updated }, 200, NO_STORE);
}

/* ---- pictures ------------------------------------------------------------------------------------ */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const startsWith = (bytes, sig) => sig.every((v, i) => bytes[i] === v);

async function putMedia(request, env) {
  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (type !== 'image/jpeg' && type !== 'image/png') return fail(415, 'That file cannot be used as a picture. Please choose a different one.');
  const buf = await request.arrayBuffer();
  if (buf.byteLength > LIMITS.imageBytes) return fail(413, 'That picture is too big. Please choose a smaller one.');
  const bytes = new Uint8Array(buf.slice(0, 8));
  const real = type === 'image/jpeg' ? startsWith(bytes, [0xff, 0xd8, 0xff]) : startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!real) return fail(400, 'That file is not a real picture.');
  const id = hex(await crypto.subtle.digest('SHA-256', buf)).slice(0, 32);
  await env.CONTENT.put('media:' + id, buf, { metadata: { type } });
  return json({ id, url: '/media/' + id }, 200, NO_STORE);
}

async function getMedia(env, id) {
  if (!/^[a-f0-9]{16,64}$/.test(id)) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.CONTENT.getWithMetadata('media:' + id, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, {
    headers: {
      'Content-Type': (metadata && metadata.type) || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}

/* ---- who is signed in: Cloudflare Access sends a signed token, we check it ------------------------- */
let jwksCache = { at: 0, keys: null };

async function requireAdmin(request, env) {
  if (env.DEV_BYPASS === '1') return 'local-test@emajane.local';   // only ever set in .dev.vars on a developer machine
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;      // not set up yet: refuse rather than guess
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
