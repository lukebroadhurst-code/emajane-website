/* Where the admin keeps things.

   Practice mode (GitHub staging, *.localhost): everything stays in this browser.
   Real mode (Cloudflare, wrangler dev): the Worker at /api keeps it and checks the login.
   The screens above this file never need to know which one they are in. */

import { T } from './copy.js?v=dev';

const C = window.EMAJANE_CONFIG || { api: '', demo: true };
export const practice = !!C.demo;

const KEY = {
  draft: (n) => `emajane-draft:${n}`,
  demo: (n) => `emajane-demo:${n}`,
  prev: (n) => `emajane-demo-prev:${n}`,
  meta: (n) => `emajane-demo-meta:${n}`,
  media: (id) => `emajane-media:${id}`,
};

function read(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function readRaw(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return true; } catch { return false; }
}
function drop(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
const clone = (o) => JSON.parse(JSON.stringify(o));

export class ApiError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}

async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const opts = { method, credentials: 'same-origin', headers: { ...headers } };
  if (method !== 'GET') opts.headers['X-Emajane-Admin'] = '1';
  if (body !== undefined) opts.body = body;
  opts.redirect = 'manual';   // if the sign-in has run out, Cloudflare answers with a redirect to its login page: do not follow it
  let res;
  try { res = await fetch(C.api + path, opts); }
  catch { throw new ApiError(0, T.problems.offline); }          // no connection at all
  if (res.type === 'opaqueredirect') throw new ApiError(401, T.problems.signedOut);
  if (raw && res.ok) return res;
  let data = {};
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, data.error || T.problems.other, { errors: data.errors });
  return data;
}

/* ---- the first versions (the text that ships with the website) -------------------------------------- */
const seeds = {};
export async function seed(name) {
  if (!seeds[name]) {
    const r = await fetch(`../content/${name}.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Could not load the first version');
    seeds[name] = await r.json();
  }
  return clone(seeds[name]);
}

/* ---- what is on the website now -------------------------------------------------------------------- */
async function published() {
  try {
    const r = await fetch(`${C.api}/content`, { cache: 'no-cache' });
    if (r.ok) return await r.json();
  } catch { /* fall through to the first versions */ }
  return {};
}

async function liveFrom(name, all) {
  if (practice) {
    const copy = read(KEY.demo(name));
    if (copy) return { ...copy, updated: (read(KEY.meta(name)) || {}).updated || null };
    return { ...(await seed(name)), updated: null };
  }
  if (all[name]) return all[name];
  return { ...(await seed(name)), updated: null };
}

export async function live(name) {
  return liveFrom(name, practice ? {} : await published());
}

export async function liveAll(names) {
  const all = practice ? {} : await published();
  const docs = await Promise.all(names.map((n) => liveFrom(n, all)));
  return Object.fromEntries(names.map((n, i) => [n, docs[i]]));
}

/* ---- changes that are saved but not on the website yet ---------------------------------------------- */
export const draft = (name) => read(KEY.draft(name));
export const saveDraft = (name, doc) => write(KEY.draft(name), doc);
export const clearDraft = (name) => drop(KEY.draft(name));

/* ---- putting it on the website --------------------------------------------------------------------- */
export async function publish(name, doc, baseUpdated) {
  if (practice) {
    const current = read(KEY.demo(name));
    if (current) write(KEY.prev(name), current);
    const updated = new Date().toISOString();
    if (!write(KEY.demo(name), doc)) throw new ApiError(0, T.form.noRoom);
    write(KEY.meta(name), { updated });
    return { updated };
  }
  return api(`/admin/content/${name}`, {
    method: 'PUT', body: JSON.stringify(doc),
    headers: { 'Content-Type': 'application/json', 'X-Base-Updated': baseUpdated || '' },
  });
}

/* The version before the last change, or null. */
export async function previous(name) {
  if (practice) return read(KEY.prev(name));
  try { return await api(`/admin/content/${name}/previous`); }
  catch (e) { if (e.status === 404) return null; throw e; }
}

export async function who() {
  if (practice) return null;
  try { return (await api('/admin/me')).email; } catch { return null; }
}

/* When each section was last put on the website: { name: { updated } } */
export async function statusAll(names) {
  if (practice) return Object.fromEntries(names.map((n) => [n, { updated: (read(KEY.meta(n)) || {}).updated || null, hasPrevious: !!read(KEY.prev(n)) }]));
  try { return (await api('/admin/status')).docs; } catch { return {}; }
}

/* ---- pictures --------------------------------------------------------------------------------------- */
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(blob);
  });
}

/* Returns the reference to store in the content, such as /media/ab12... */
export async function uploadPicture(blob) {
  if (practice) {
    const id = randomId();
    if (!write(KEY.media(id), await blobToDataUrl(blob))) throw new ApiError(0, T.form.noRoom);
    return `/media/${id}`;
  }
  const res = await api('/admin/media', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type } });
  return res.url;
}

/* Where to show a picture from, as seen from the admin page. */
export function pictureSrc(ref) {
  if (!ref) return '';
  const m = /^\/media\/([a-f0-9]+)$/.exec(ref);
  if (m) return practice ? (readRaw(KEY.media(m[1])) || '') : ref;
  return `../${ref}`;
}

/* Practice mode only: forget everything done in practice. */
export function resetPractice() {
  try {
    Object.keys(localStorage).filter((k) => /^emajane-(draft|demo|demo-prev|demo-meta|media):/.test(k)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
