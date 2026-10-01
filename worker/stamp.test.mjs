/* The release stamp: every file a page loads carries ?v=dev in the source, the stamp swaps it, and the stamped copy still works.
   Run:  node stamp.test.mjs   (also part of npm run test:all) */
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '../site');
const STAMP = path.resolve(HERE, '../tools/stamp.mjs');
const BRAVE = process.env.BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
let failed = 0;
const check = (name, ok, more = '') => { console.log((ok ? '  ok  ' : 'FAIL  ') + name + (ok || !more ? '' : '  ' + more)); if (!ok) failed++; };

/* 1. in the source, nothing the pages load is missing the mark */
const missing = [];
const read = (f) => fs.readFileSync(f, 'utf8');
const pages = [path.join(SITE, 'index.html'), path.join(SITE, 'admin/index.html')];
for (const page of pages) {
  for (const m of read(page).matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const url = m[1];
    if (/^(https?:|data:|mailto:|\.\.\/?$|#)/.test(url) || /\.(png|jpg|jpeg|svg|ico|woff2?)(\?|$)/i.test(url) || url.endsWith('/') || url === '../') continue;   // pictures and links are not the files that break
    if (!/\?v=dev$/.test(url)) missing.push(path.relative(SITE, page) + ' → ' + url);
  }
}
for (const f of fs.readdirSync(path.join(SITE, 'admin')).filter((n) => n.endsWith('.js'))) {
  for (const m of read(path.join(SITE, 'admin', f)).matchAll(/from '(\.[^']+)'/g)) if (!/\?v=dev$/.test(m[1])) missing.push(`admin/${f} → ${m[1]}`);
}
check('every script, style and module the pages load carries ?v=dev', missing.length === 0, missing.join('; '));

/* 2. a stamped copy swaps every mark and still works */
const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'emajane-stamp-'));
fs.cpSync(SITE, copy, { recursive: true });
const out = spawnSync('node', [STAMP, 'abc12345', copy], { encoding: 'utf8' });
check('the stamp runs', out.status === 0, out.stderr);
const left = [];
(function walk(d) { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) walk(f); else if (/\.(html|js|css)$/.test(n) && read(f).includes('?v=dev')) left.push(path.relative(copy, f)); } })(copy);
check('no ?v=dev is left in the stamped copy', left.length === 0, left.join(', '));
check('the repository itself is not changed by stamping a copy', !SITE.includes('abc12345') && !read(path.join(SITE, 'admin/app.js')).includes('abc12345'));
check('a bad release id is refused', spawnSync('node', [STAMP, '../x', copy], { encoding: 'utf8' }).status !== 0);

const requested = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); requested.push(u.pathname + u.search);
  let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(copy, p);
  if (!file.startsWith(copy) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(8806, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
const page = await (await browser.newContext()).newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
await page.goto('http://staging.localhost:8806/admin/');
await page.getByRole('heading', { name: 'What would you like to change?' }).waitFor({ timeout: 15000 }).catch(() => {});
check('the stamped admin opens and shows its first page', await page.getByRole('heading', { name: 'What would you like to change?' }).isVisible());
await page.getByRole('link', { name: /The album/ }).click();
await page.getByLabel('What is the album called?').waitFor({ timeout: 15000 }).catch(() => {});
check('the stamped admin can open a screen', await page.getByLabel('What is the album called?').isVisible());
await page.goto('http://staging.localhost:8806/'); await page.locator('h1').waitFor();
check('the stamped website opens', (await page.locator('h1').innerText()).length > 0);
check('no script problems in the stamped copy', problems.length === 0, problems.join(' | '));
const modules = requested.filter((r) => /\/admin\/.*\.js/.test(r));
check('every admin script was asked for by its stamped address', modules.length >= 6 && modules.every((r) => r.endsWith('?v=abc12345')), modules.join(' '));
await browser.close(); server.close(); fs.rmSync(copy, { recursive: true, force: true });
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
