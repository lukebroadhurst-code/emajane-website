/* Checks the content API against a running Worker.
   Start it with `npm run dev` (uses the local login bypass), then `npm test`.
   Set BASE to test somewhere else. Publishes and then restores test data, so run it only against a dev copy. */
const BASE = process.env.BASE || 'http://localhost:8788';
let failed = 0;
const put = (body, headers = {}) => fetch(BASE + '/api/admin/content/gatherings', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const item = (o = {}) => ({ id: 't1', date: '2027-03-05', city: 'Bath', venue: '', status: 'tickets', ticketUrl: 'https://example.com/x', ...o });
async function check(name, fn) { try { const ok = await fn(); if (!ok) throw new Error('failed'); console.log('  ok  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + ' ' + (e.message || '')); } }

await check('admin identifies the signed-in user', async () => (await (await fetch(BASE + '/api/admin/me')).json()).email);
await check('unknown content name is 404', async () => (await fetch(BASE + '/api/content/secrets')).status === 404);
await check('a good list publishes', async () => (await put({ items: [item()] })).status === 200);
await check('published list is readable', async () => (await (await fetch(BASE + '/api/content/gatherings', { cache: 'no-store' })).json()).items[0].city === 'Bath');
await check('http link refused', async () => (await put({ items: [item({ ticketUrl: 'http://x.example' })] })).status === 400);
await check('javascript link refused', async () => (await put({ items: [item({ ticketUrl: 'javascript:alert(1)' })] })).status === 400);
await check('impossible date refused', async () => (await put({ items: [item({ date: '2027-13-45' })] })).status === 400);
await check('missing city refused', async () => (await put({ items: [item({ city: ' ' })] })).status === 400);
await check('unknown status refused', async () => (await put({ items: [item({ status: 'vip' })] })).status === 400);
await check('duplicate ids refused', async () => (await put({ items: [item(), item()] })).status === 400);
await check('too many items refused', async () => (await put({ items: Array.from({ length: 81 }, (_, i) => item({ id: 'x' + i })) })).status === 400);
await check('other-site origin refused', async () => (await put({ items: [item()] }, { Origin: 'https://evil.example' })).status === 403);
await check('non-JSON refused', async () => (await put('x', { 'Content-Type': 'text/plain' })).status === 415);
await check('oversized body refused', async () => (await put(JSON.stringify({ items: [], pad: 'a'.repeat(70000) }))).status === 413);
await check('sold out clears the link and extra fields are dropped', async () => {
  await put({ items: [item({ status: 'soldout', ticketUrl: 'https://x.example', evil: '<script>' })] });
  const d = await (await fetch(BASE + '/api/content/gatherings', { cache: 'no-store' })).json();
  return d.items[0].ticketUrl === '' && !('evil' in d.items[0]);
});
await check('previous version is kept', async () => (await fetch(BASE + '/api/admin/content/gatherings/previous')).status === 200);
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
