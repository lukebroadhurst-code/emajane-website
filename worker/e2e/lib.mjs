/* Shared helpers for the browser tests.
   Starts the real back end (wrangler dev, fresh storage) and a plain file server for practice mode,
   then gives each test a clean browser. */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '../../site');
const WORKER = path.resolve(HERE, '..');
export const BRAVE = process.env.BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
export const REAL = 'http://localhost:8791';
export const PRACTICE = 'http://staging.localhost:8801';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

function startFileServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(SITE, p);
    if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(8801, '127.0.0.1', () => resolve(server)));
}

async function startWrangler() {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'emajane-e2e-'));
  const proc = spawn('npx', ['wrangler', 'dev', '--port', '8791', '--persist-to', state], { cwd: WORKER, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; }); proc.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(REAL + '/'); if (r.ok) return { proc, state }; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  proc.kill(); throw new Error('wrangler did not start:\n' + log.slice(-800));
}

export async function setup() {
  const files = await startFileServer();
  const wr = await startWrangler();
  const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
  const results = [];
  const api = {
    browser, results,
    /* a fresh browser profile; pages made from it share storage, like tabs in one browser */
    async context(opts = {}) { return browser.newContext({ viewport: { width: 1100, height: 900 }, ...opts }); },
    async page(ctx) {
      const page = await ctx.newPage();
      page.problems = [];
      page.on('pageerror', (e) => page.problems.push('script error: ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error') page.problems.push('console: ' + m.text()); });
      if (process.env.TRACE) {   // TRACE=1 npm run e2e   shows each time the main area of the admin is repainted, and by whom
        await page.addInitScript(() => {
          const T0 = performance.now(); const ts = () => String(Math.round(performance.now() - T0)).padStart(6);
          document.addEventListener('click', (e) => console.info('[view] ' + ts() + ' CLICK ' + String((e.target.closest('button,a,label,summary') || e.target).textContent || '').trim().slice(0, 40)), true);
          window.addEventListener('hashchange', () => console.info('[view] ' + ts() + ' HASH ' + location.hash));
          const sm = HTMLDialogElement.prototype.showModal, cl = HTMLDialogElement.prototype.close;
          HTMLDialogElement.prototype.showModal = function () { console.info('[view] ' + ts() + ' DIALOG OPEN ' + (this.querySelector('h2') || {}).textContent); return sm.apply(this, arguments); };
          HTMLDialogElement.prototype.close = function () { console.info('[view] ' + ts() + ' DIALOG CLOSE ' + (this.querySelector('h2') || {}).textContent); return cl.apply(this, arguments); };
          const orig = Element.prototype.replaceChildren;
          Element.prototype.replaceChildren = function (...a) {
            if (this.id === 'view') console.info('[view] ' + ts() + ' PAINT ' + location.hash + ' <- ' + String((a.find((n) => n && n.textContent) || {}).textContent || '').slice(0, 24) + ' | ' + new Error().stack.split('\n').slice(2, 5).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+/, '')).join(' < '));
            return orig.apply(this, a);
          };
        });
        page.on('console', (m) => { if (m.type() === 'info' && m.text().startsWith('[view]')) console.log('     ' + m.text()); });
      }
      return page;
    },
    async close() {
      await browser.close(); files.close();
      wr.proc.kill('SIGTERM'); await new Promise((r) => setTimeout(r, 500));
      try { fs.rmSync(wr.state, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
  return api;
}

let current = '';
export function group(name) { current = name; console.log('\n' + name); }
export async function test(ctx, name, fn) {
  const label = `${current}: ${name}`;
  try { await fn(); ctx.results.push({ label, ok: true }); console.log('  ok  ' + name); }
  catch (e) { ctx.results.push({ label, ok: false, error: e }); console.log('FAIL  ' + name + '\n        ' + String(e.message || e).split('\n').slice(0, 6).join('\n        ')); }
}
export function expect(cond, message = 'expectation failed') { if (!cond) throw new Error(message); }
export function same(actual, expected, message = '') { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`); }

const AXE = fs.readFileSync(path.resolve(WORKER, 'node_modules/axe-core/axe.min.js'), 'utf8');
export async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { rules: { 'color-contrast-enhanced': { enabled: true } }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
}

/* what a person does most: a date, written by hand into the three drop-downs */
export async function chooseDate(page, { day, month, year }) {
  await page.getByLabel('Day', { exact: true }).selectOption(String(day));
  await page.getByLabel('Month', { exact: true }).selectOption(String(month));
  await page.getByLabel('Year', { exact: true }).selectOption(String(year));
}

/* make a picture in the browser and hand it to a file box, as if chosen from the computer */
export async function giveFile(page, inputSelector, { width = 3000, height = 2000, type = 'image/jpeg', name = 'holiday.jpg', colour = '#336699' } = {}) {
  await page.evaluate(async ({ inputSelector, width, height, type, name, colour }) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const g = c.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, width, height); g.fillStyle = '#fff'; g.fillRect(width / 4, height / 4, width / 2, height / 2);
    const blob = await new Promise((res) => c.toBlob(res, type === 'image/gif' ? 'image/png' : type, 0.95));
    const file = new File([blob], name, { type });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.querySelector(inputSelector);
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { inputSelector, width, height, type, name, colour });
}


/* ---- things every suite does with the admin ----------------------------------------------------------- */
export const nextYear = new Date().getFullYear() + 1;
export const put = (page) => page.getByRole('button', { name: 'Put it on my website' }).first();
export const yes = (page) => page.getByRole('dialog').getByRole('button', { name: /^Yes/ });
export const notice = (page) => page.locator('#notices .notice');
export const done = (page) => notice(page).getByRole('heading', { name: 'Done!' });
/* Says "yes" and waits until the question is gone, which is when the page has acted on the answer. */
export const sayYes = async (page) => {
  await yes(page).waitFor();
  await page.waitForTimeout(450);          // "yes" is ignored for the first moment, so a double press cannot answer by accident
  await yes(page).click();
  await page.locator('dialog').waitFor({ state: 'detached' });
};

/* Closes anything left open by the test before, so one failure does not spoil the next test. */
export async function calm(page) {
  for (let i = 0; i < 3 && await page.locator('dialog[open]').count(); i++) await page.keyboard.press('Escape');
  const b = page.getByRole('button', { name: 'Not now' });
  if (await b.count()) await b.first().click();
}

/* A test that starts calm, and when it fails says what was on the screen. */
export const calmTest = (page) => (ctx, name, fn) => test(ctx, name, async () => {
  await calm(page);
  try { await fn(); }
  catch (e) {
    const seen = await page.evaluate(() => ({ url: location.hash, dialogs: document.querySelectorAll('dialog[open]').length, text: (document.getElementById('view') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 260), notice: (document.getElementById('notices') || {}).innerText })).catch(() => ({}));
    e.message += '\n        [on screen: ' + JSON.stringify(seen) + ']';
    throw e;
  }
});

export async function addGathering(page, { month = 11, day = 12, year = nextYear, city, venue = '', status = 'tickets', url = 'https://example.com/tickets' }) {
  await page.getByRole('button', { name: 'Add a gathering' }).click();
  await chooseDate(page, { day, month, year });
  await page.getByLabel('Which town or city?').fill(city);
  if (venue) await page.getByLabel('Which place is it at?').fill(venue);
  await page.getByLabel(status === 'soldout' ? 'No, it is sold out' : status === 'free' ? 'It is free' : 'Yes, people can buy tickets').check();
  if (status !== 'soldout' && url) await page.getByLabel('Web address of the ticket page').fill(url);
  await page.getByRole('button', { name: 'Add to my list' }).click();
}
