/* Checks the content API against a running Worker.
   Start it with `npm run dev` (it uses the local login bypass), then run `npm test`. `npm run test:all` runs it for you.
   Set BASE to test somewhere else. This publishes test data, so only run it against a development copy. */
import fs from 'node:fs';
import { ORDER } from '../site/admin/schema.js';

const BASE = process.env.BASE || 'http://localhost:8788';
let failed = 0;
const seed = (n) => JSON.parse(fs.readFileSync(new URL(`../site/content/${n}.json`, import.meta.url), 'utf8'));
const ADMIN = { 'X-Emajane-Admin': '1' };

const put = (name, body, headers = {}) => fetch(`${BASE}/api/admin/content/${name}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...ADMIN, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (name) => fetch(`${BASE}/api/content/${name}`, { cache: 'no-store' });
const item = (o = {}) => ({ id: 't1', date: '2027-03-05', city: 'Bath', venue: '', status: 'tickets', ticketUrl: 'https://example.com/x', ...o });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const upload = (bytes, type, headers = {}) => fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: { 'Content-Type': type, ...ADMIN, ...headers }, body: bytes });

async function check(name, fn) {
  try { const ok = await fn(); if (!ok) throw new Error('did not hold'); console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + ' ' + (e.message || '')); }
}

// ---- who and what ------------------------------------------------------------------------------
await check('admin identifies the signed-in user', async () => (await (await fetch(`${BASE}/api/admin/me`)).json()).email);
await check('unknown section is 404', async () => (await get('secrets')).status === 404);
await check('unknown section cannot be saved', async () => (await put('secrets', {})).status === 404);

// ---- every section saves and reads back --------------------------------------------------------
for (const n of ORDER) {
  await check(`"${n}" starting text publishes`, async () => (await put(n, seed(n))).status === 200);
  await check(`"${n}" reads back`, async () => { const d = await (await get(n)).json(); return d.placeholder === false && d.updatedBy; });
}
await check('all sections arrive in one request', async () => { const d = await (await fetch(`${BASE}/api/content`, { cache: 'no-store' })).json(); return ORDER.every((n) => d[n]); });
await check('status lists every section', async () => { const d = await (await fetch(`${BASE}/api/admin/status`)).json(); return ORDER.every((n) => d.docs[n].published && d.docs[n].updated); });

// ---- bad input is refused, in plain words ------------------------------------------------------
await check('http ticket link refused', async () => (await put('gatherings', { items: [item({ ticketUrl: 'http://x.example' })] })).status === 400);
await check('javascript link refused', async () => (await put('gatherings', { items: [item({ ticketUrl: 'javascript:alert(1)' })] })).status === 400);
await check('impossible date refused', async () => (await put('gatherings', { items: [item({ date: '2027-02-31' })] })).status === 400);
await check('missing ticket link refused', async () => (await put('gatherings', { items: [item({ ticketUrl: '' })] })).status === 400);
await check('refusal explains itself', async () => { const d = await (await put('gatherings', { items: [item({ city: '' })] })).json(); return /town or city/i.test(d.error) && d.errors[0].path === 'items[0].city'; });
await check('duplicate ids refused', async () => (await put('gatherings', { items: [item(), item()] })).status === 400);
await check('email header trick refused', async () => (await put('contact', { ...seed('contact'), contactEmail: 'a@b.co?bcc=x@y.zz' })).status === 400);
await check('picture from another website refused', async () => (await put('photos', { ...seed('photos'), aboutPhoto: 'https://evil.example/x.png' })).status === 400);
await check('data: picture refused', async () => (await put('photos', { ...seed('photos'), aboutPhoto: 'data:image/png;base64,AAAA' })).status === 400);
await check('not JSON refused', async () => (await put('gatherings', 'x', { 'Content-Type': 'text/plain' })).status === 415);
await check('oversized body refused', async () => (await put('gatherings', JSON.stringify({ items: [], pad: 'a'.repeat(70000) }))).status === 413);
await check('extra fields are dropped', async () => {
  await put('gatherings', { items: [item({ status: 'soldout', ticketUrl: 'https://x.example', evil: '<script>' })] });
  const d = await (await get('gatherings')).json();
  return d.items[0].ticketUrl === '' && !('evil' in d.items[0]);
});

// ---- the doors are locked from other websites ---------------------------------------------------
await check('other-site origin refused', async () => (await put('gatherings', { items: [item()] }, { Origin: 'https://evil.example' })).status === 403);
await check('save without the admin header refused', async () => (await fetch(`${BASE}/api/admin/content/gatherings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [item()] }) })).status === 403);
await check('picture without the admin header refused', async () => (await fetch(`${BASE}/api/admin/media`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG })).status === 403);

// ---- older version, and two people editing at once -----------------------------------------------
await check('the older version is kept', async () => {
  await put('gatherings', { items: [item({ id: 'v1', city: 'First' })] });
  await put('gatherings', { items: [item({ id: 'v2', city: 'Second' })] });
  const p = await (await fetch(`${BASE}/api/admin/content/gatherings/previous`)).json();
  return p.items[0].city === 'First';
});
await check('a stale editor is stopped', async () => {
  const cur = await (await get('gatherings')).json();
  const first = await put('gatherings', { items: [item({ id: 'c1', city: 'Mine' })] }, { 'X-Base-Updated': cur.updated });
  const second = await put('gatherings', { items: [item({ id: 'c2', city: 'Theirs' })] }, { 'X-Base-Updated': cur.updated });
  return first.status === 200 && second.status === 409 && /Someone else/.test((await second.json()).error);
});
await check('an editor who is up to date can save', async () => {
  const cur = await (await get('gatherings')).json();
  return (await put('gatherings', { items: [item({ id: 'c3' })] }, { 'X-Base-Updated': cur.updated })).status === 200;
});

// ---- pictures ------------------------------------------------------------------------------------
let pngId = '';
await check('a PNG uploads', async () => { const r = await upload(PNG, 'image/png'); const d = await r.json(); pngId = d.id; return r.status === 200 && /^[a-f0-9]{32}$/.test(d.id) && d.url === '/media/' + d.id; });
await check('the same picture gets the same address', async () => (await (await upload(PNG, 'image/png')).json()).id === pngId);
await check('a JPEG uploads', async () => (await upload(JPG, 'image/jpeg')).status === 200);
await check('a picture is served safely', async () => {
  const r = await fetch(`${BASE}/media/${pngId}`);
  return r.status === 200 && r.headers.get('content-type') === 'image/png' && r.headers.get('x-content-type-options') === 'nosniff' && /immutable/.test(r.headers.get('cache-control')) && /sandbox/.test(r.headers.get('content-security-policy')) && Buffer.from(await r.arrayBuffer()).equals(PNG);
});
await check('a GIF is refused', async () => (await upload(Buffer.from('GIF89a'), 'image/gif')).status === 415);
await check('an SVG is refused', async () => (await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/svg+xml')).status === 415);
await check('text pretending to be a PNG is refused', async () => (await upload(Buffer.from('not a picture at all'), 'image/png')).status === 400);
await check('a JPEG labelled as PNG is refused', async () => (await upload(JPG, 'image/png')).status === 400);
await check('a huge picture is refused', async () => (await upload(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), 'image/png')).status === 413);
await check('a missing picture is 404', async () => (await fetch(`${BASE}/media/${'0'.repeat(32)}`)).status === 404);
await check('a bad picture address is 404', async () => (await fetch(`${BASE}/media/..%2Fsecret`)).status === 404);
await check('an uploaded picture can be used in a section', async () => (await put('photos', { ...seed('photos'), aboutPhoto: '/media/' + pngId })).status === 200);

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
