/* The production sign-in check. On Cloudflare, Access puts a signed token on every admin request and the Worker verifies it.
   Locally the login is skipped, so this path was never exercised. Here we make our own signing key, stand in for
   Cloudflare's list of keys, and try good and bad tokens against the real Worker code (no network, no Cloudflare).
   Run:  node auth.test.mjs   (also part of npm run test:all) */
import worker from './src/index.js';

const TEAM = 'test-team.cloudflareaccess.com';
const AUD = 'aud-for-emajane-admin';
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const text = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));

async function makeKey(kid) {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { kid, priv: pair.privateKey, jwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } };
}
const good = await makeKey('key-1');
const stranger = await makeKey('key-1');          // a different key that claims to be key-1

async function token({ key = good, header = {}, claims = {}, tamper = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = { alg: 'RS256', kid: key.kid, typ: 'JWT', ...header };
  const p = { aud: [AUD], iss: 'https://' + TEAM, exp: now + 3600, nbf: now - 30, email: 'emma@example.com', ...claims };
  const signing = text(h) + '.' + text(p);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key.priv, new TextEncoder().encode(signing)));
  const out = signing + '.' + b64url(sig);
  if (!tamper) return out;
  const [a, , c] = out.split('.');
  return `${a}.${text({ ...p, email: 'attacker@example.com' })}.${c}`;   // the words changed, the signature did not
}

/* a tiny stand-in for the key-value store */
const store = new Map();
const KV = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, getWithMetadata: async (k) => ({ value: store.get(k) ?? null, metadata: null }) };
const env = { CONTENT: KV, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

/* stand in for Cloudflare's list of keys */
let certsAsked = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, ...rest) => {
  if (String(url) === `https://${TEAM}/cdn-cgi/access/certs`) { certsAsked++; return new Response(JSON.stringify({ keys: [good.jwk] }), { headers: { 'Content-Type': 'application/json' } }); }
  return realFetch(url, ...rest);
};

const ORIGIN = 'https://emajane.example';
const call = (path, { method = 'GET', jwt, headers = {}, body, e = env } = {}) =>
  worker.fetch(new Request(ORIGIN + path, { method, headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), ...headers }, body }), e);

let failed = 0;
const check = async (name, fn) => { try { if (!(await fn())) throw new Error('did not hold'); console.log('  ok  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + ' ' + (e.message || '')); } };

await check('a good token is accepted, and names who is signed in', async () => { const r = await call('/api/admin/me', { jwt: await token() }); return r.status === 200 && (await r.json()).email === 'emma@example.com'; });
await check('Cloudflare\'s keys are fetched once and kept', async () => { await call('/api/admin/me', { jwt: await token() }); await call('/api/admin/me', { jwt: await token() }); return certsAsked === 1; });
await check('no token is refused', async () => (await call('/api/admin/me')).status === 401);
await check('a token for another application is refused', async () => (await call('/api/admin/me', { jwt: await token({ claims: { aud: ['someone-elses-app'] } }) })).status === 401);
await check('an expired token is refused', async () => (await call('/api/admin/me', { jwt: await token({ claims: { exp: Math.floor(Date.now() / 1000) - 60 } }) })).status === 401);
await check('a token that is not valid yet is refused', async () => (await call('/api/admin/me', { jwt: await token({ claims: { nbf: Math.floor(Date.now() / 1000) + 3600 } }) })).status === 401);
await check('a token from another team is refused', async () => (await call('/api/admin/me', { jwt: await token({ claims: { iss: 'https://evil.cloudflareaccess.com' } }) })).status === 401);
await check('a token that says it is unsigned is refused', async () => (await call('/api/admin/me', { jwt: await token({ header: { alg: 'none' } }) })).status === 401);
await check('a token that picks a weaker kind of signature is refused', async () => (await call('/api/admin/me', { jwt: await token({ header: { alg: 'HS256' } }) })).status === 401);
await check('a token whose words were changed is refused', async () => (await call('/api/admin/me', { jwt: await token({ tamper: true }) })).status === 401);
await check('a token signed with a different key is refused, even if it claims the right key name', async () => (await call('/api/admin/me', { jwt: await token({ key: stranger }) })).status === 401);
await check('a token naming a key we do not know is refused', async () => (await call('/api/admin/me', { jwt: await token({ header: { kid: 'unknown' } }) })).status === 401);
await check('rubbish in the token header is refused', async () => (await call('/api/admin/me', { jwt: 'not.a.token' })).status === 401 && (await call('/api/admin/me', { jwt: 'x' })).status === 401);
await check('with Access not set up, even a good token is refused', async () => (await call('/api/admin/me', { jwt: await token(), e: { CONTENT: KV } })).status === 401);
await check('the login bypass works only when it is exactly "1"', async () => {
  const on = await call('/api/admin/me', { e: { CONTENT: KV, DEV_BYPASS: '1' } });
  const off = await call('/api/admin/me', { e: { CONTENT: KV, DEV_BYPASS: 'true' } });
  const none = await call('/api/admin/me', { e: { CONTENT: KV, DEV_BYPASS: '' } });
  return on.status === 200 && off.status === 401 && none.status === 401;
});

/* what a signed-in person may do */
const doc = JSON.stringify({ items: [] });
const put = (jwt, headers = {}) => call('/api/admin/content/gatherings', { method: 'PUT', jwt, body: doc, headers: { 'Content-Type': 'application/json', ...headers } });
await check('a signed-in save needs to come from the admin page (custom header)', async () => (await put(await token())).status === 403);
await check('a signed-in save from another website is refused', async () => (await put(await token(), { 'X-Emajane-Admin': '1', Origin: 'https://evil.example' })).status === 403);
await check('a signed-in save from the admin page is accepted, and records who made it', async () => {
  const r = await put(await token(), { 'X-Emajane-Admin': '1', Origin: ORIGIN });
  const saved = JSON.parse(store.get('content:gatherings') || '{}');
  return r.status === 200 && saved.updatedBy === 'emma@example.com';
});
await check('a save with no token is refused, whatever else it carries', async () => (await put(undefined, { 'X-Emajane-Admin': '1', Origin: ORIGIN })).status === 401);
await check('the public pages never ask for a token', async () => (await call('/api/content')).status === 200 && (await call('/api/content/gatherings')).status === 200);
await check('a picture upload needs a token too', async () => (await call('/api/admin/media', { method: 'POST', body: new Uint8Array([0xff, 0xd8, 0xff]), headers: { 'Content-Type': 'image/jpeg', 'X-Emajane-Admin': '1' } })).status === 401);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
