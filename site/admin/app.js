/* The admin: the first page and one screen for each part of the website.

   Built so that a young child or an older person can use it:
   - the first page is six big boxes, nothing else to choose from
   - every screen has one job, with a big "Back to the start" button
   - changes are saved as you go; nothing reaches the website until you say so
   - before anything goes live you see exactly what will change and answer a plain yes or no
   - everything can be undone
   - messages stay until you close them */

import { DOCS, ORDER, validateDoc, validateFields, fieldsOf, problemLine } from './schema.js?v=dev';
import { T } from './copy.js?v=dev';
import { icon } from './icons.js?v=dev';
import * as store from './store.js?v=dev';
import { h, button, notify, clearNotice, ask, refocus, scrollableByKeyboard, buildFields, clone, longDate, whenText, isPast, uid } from './ui.js?v=dev';

const C = window.EMAJANE_CONFIG || {};
const view = document.getElementById('view');
const crumb = document.getElementById('crumb');
const main = document.getElementById('main');
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The "skip to the main part" link moves the keyboard there without touching the address, so the screen is never redrawn. */
const skip = document.querySelector('.skip');
if (skip) skip.addEventListener('click', (e) => { e.preventDefault(); main.focus(); });

const TILE_ICON = { gatherings: 'calendar', album: 'music', words: 'chat', shop: 'bag', photos: 'picture', contact: 'mail' };

/* How each list is shown. */
const LIST_UI = {
  gatherings: {
    t: T.lists.gatherings,
    sort: (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
    isPast: (it) => isPast(it.date),
    title: (it) => it.city,
    meta: (it) => longDate(it.date),
    sub: (it) => it.venue,
    pill: (it) => (it.status === 'soldout' ? T.lists.gatherings.soldOut : it.status === 'free' ? T.lists.gatherings.free : T.lists.gatherings.tickets),
    label: (it) => `${it.city}, ${longDate(it.date)}`,
    detail: (it) => [`${it.city}, ${longDate(it.date)}`, it.venue, LIST_UI.gatherings.pill(it), it.status === 'soldout' ? '' : clip(String(it.ticketUrl || '').replace(/^https:\/\//, ''), 44)].filter(Boolean).join(' · '),
    warn: (it) => (isPast(it.date) ? T.list.passed : null),
  },
  shop: {
    t: T.lists.shop,
    manual: true,
    title: (it) => it.name,
    meta: (it) => it.price,
    sub: (it) => it.note,
    pill: (it) => (it.status === 'soldout' ? T.lists.shop.soldOut : it.buyUrl ? T.lists.shop.onSale : T.lists.shop.soon),
    label: (it) => it.name,
    detail: (it) => [it.name, it.price, LIST_UI.shop.pill(it), it.status === 'soldout' ? '' : clip(String(it.buyUrl || '').replace(/^https:\/\//, ''), 44)].filter(Boolean).join(' · '),
  },
};

/* ---- comparing what is on the website with what is waiting ------------------------------------------- */
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
function plain(name, doc) {
  const r = validateDoc(name, doc);
  const v = clone(r.value || doc);
  delete v.updated; delete v.updatedBy; delete v.placeholder;
  return stable(v);
}
const differs = (name, a, b) => plain(name, a) !== plain(name, b);

/* A few of the new words, so that what is about to go on the website can be checked at a glance. */
const clip = (s, n = 48) => { const one = String(s).replace(/\s+/g, ' ').trim(); return one.length > n ? one.slice(0, n - 1).trimEnd() + '…' : one; };
function nowText(f, v) {
  if (f.type === 'textlist') return T.list.nowCount((v || []).length);
  if (f.type === 'image') return T.list.nowPicture;
  if (f.type === 'choice') { const o = (f.options || []).find((x) => x[0] === v); return o ? T.list.nowSays(o[1]) : T.list.nowEmpty; }
  return v ? T.list.nowSays(clip(v)) : T.list.nowEmpty;
}
function summarize(S) {
  const { name, spec } = S;
  const a = validateDoc(name, S.live).value || S.live;
  const b = validateDoc(name, S.draft).value || S.draft;
  const out = [];
  if (spec.kind === 'list') {
    const ui = LIST_UI[name];
    const A = new Map(a.items.map((x) => [x.id, x]));
    const B = new Map(b.items.map((x) => [x.id, x]));
    b.items.forEach((x) => {
      if (!A.has(x.id)) out.push(T.list.changeAdded(ui.detail(x)));
      else if (stable(A.get(x.id)) !== stable(x)) out.push(T.list.changeEdited(ui.detail(x)));
    });
    a.items.forEach((x) => { if (!B.has(x.id)) out.push(T.list.changeRemoved(ui.label(x))); });
    if (ui.manual) {
      const was = a.items.filter((x) => B.has(x.id)).map((x) => x.id).join();
      const now = b.items.filter((x) => A.has(x.id)).map((x) => x.id).join();
      if (was !== now) out.push(T.list.changeOrder);
    }
    Object.entries(spec.rootFields || {}).forEach(([k, f]) => { if (stable(a[k]) !== stable(b[k])) out.push(T.list.changeField(f.ask, nowText(f, b[k]))); });
  } else {
    Object.entries(fieldsOf(spec)).forEach(([k, f]) => { if (stable(a[k]) !== stable(b[k])) out.push(T.list.changeField(f.ask, nowText(f, b[k]))); });
  }
  return out;
}

/* ---- the top of every page --------------------------------------------------------------------------- */
function setSize(k) {
  document.documentElement.dataset.size = k;
  try { localStorage.setItem('emajane-size', k); } catch { /* ignore */ }
  document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === k)));
}

function showHelp() {
  const before = document.activeElement;
  const titleId = uid('help');
  const closeBtn = button(T.help.close, { kind: 'primary', size: 'big', onClick: () => dlg.close() });
  const dbody = h('div', { class: 'dbody' },
    h('h2', { id: titleId, text: T.help.title }),
    h('p', { style: 'font-weight:700', text: T.help.safe }),
    h('ol', { style: 'margin: 0 0 1rem 1.4rem' }, T.help.steps.map((s) => h('li', { text: s, style: 'margin-bottom:.5rem' }))),
    h('p', { text: T.help.mistake }),
    C.support ? h('p', { style: 'font-weight:700', text: T.help.support(C.support) }) : null);
  const hint = h('p', { class: 'scrollhint', hidden: true, 'aria-hidden': 'true' }, icon('down'), T.scrollHint);
  const dlg = h('dialog', { class: 'q', 'aria-labelledby': titleId }, dbody, hint, h('div', { class: 'row answers' }, closeBtn));
  let stopWatching = () => {};
  dlg.addEventListener('close', () => { stopWatching(); dlg.remove(); refocus(before); });
  document.body.append(dlg);
  dlg.showModal();
  stopWatching = scrollableByKeyboard(dbody, titleId, hint);
  closeBtn.focus();
}

async function renderTools() {
  let saved = 'normal';
  try { saved = localStorage.getItem('emajane-size') || 'normal'; } catch { /* ignore */ }
  if (!['normal', 'big', 'bigger'].includes(saved)) saved = 'normal';
  const seg = h('div', { class: 'seg' }, ['normal', 'big', 'bigger'].map((k) =>
    h('button', { type: 'button', 'data-size': k, 'aria-pressed': String(k === saved), text: T.size[k], onClick: () => setSize(k) })));
  const tools = document.getElementById('tools');
  tools.replaceChildren(
    h('div', { class: 'sizes', role: 'group', 'aria-labelledby': 'sizes-label' }, h('span', { id: 'sizes-label', class: 'lab', text: T.size.label }), seg),
    button(T.helpButton, { icon: 'help', size: 'small', onClick: showHelp }));
  document.documentElement.dataset.size = saved;
  const who = await store.who();
  if (who) tools.append(h('span', { class: 'when', text: T.signedInAs(who) }));
}

function practiceBanner() {
  if (!store.practice) return null;
  return h('div', { class: 'practice' }, icon('info'), h('div', {}, h('h2', { text: T.practice.title }), h('p', { text: T.practice.text })));
}

/* ---- routing ----------------------------------------------------------------------------------------- */
let screenToken = 0;
let flushPending = () => {};   // saves anything typed in the last moment on the screen being shown
async function route() {
  flushPending(); flushPending = () => {};
  const token = ++screenToken;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());   // leaving a screen cancels any question still open on it
  clearNotice();
  const name = location.hash.replace(/^#\/?/, '').split('?')[0];
  view.replaceChildren(h('p', { text: T.loading }));
  try {
    if (DOCS[name]) await showDoc(name, token); else await showHome(token);
  } catch (e) {
    console.error(e);
    if (token === screenToken) { view.replaceChildren(h('h1', { text: T.siteName, tabindex: '-1' })); notify({ kind: 'error', text: T.loadFailed, actions: [{ label: T.actions.refresh, icon: 'undo', primary: true, onClick: () => location.reload() }] }); }
  }
  if (token !== screenToken) return;
  window.scrollTo({ top: 0 });
  // The first time, leave the keyboard where the browser puts it (at the top, on the skip link).
  // After that, going to another screen puts the keyboard on its heading, so a screen reader says where you are.
  if (movedBefore) { const heading = view.querySelector('h1'); if (heading) heading.focus({ preventScroll: true }); }
  movedBefore = true;
}
let movedBefore = false;

/* ---- the first page ---------------------------------------------------------------------------------- */
async function showHome(token) {
  const [docs, stat] = await Promise.all([store.liveAll(ORDER), store.statusAll(ORDER)]);
  if (token !== screenToken) return;
  document.title = `${T.siteName} · EMAJANE`;
  crumb.hidden = true;

  let waiting = 0;
  const tiles = ORDER.map((n) => {
    const spec = DOCS[n];
    const dr = store.draft(n);
    const dirty = !!dr && differs(n, docs[n], dr);
    if (dirty) waiting++;
    const when = stat[n] && stat[n].updated ? T.home.lastChanged(whenText(stat[n].updated)) : '';
    const chip = dirty
      ? h('span', { class: 'chip waiting' }, icon('pencil'), T.home.waiting)
      : h('span', { class: 'chip' }, icon('check'), T.home.upToDate);
    return h('li', {}, h('a', { class: 'tile', href: `#/${n}` }, icon(TILE_ICON[n]), h('h2', { text: spec.label }), h('p', { text: spec.blurb }), chip, when ? h('p', { class: 'when', text: when }) : null));
  });

  view.replaceChildren(...[
    h('h1', { tabindex: '-1', text: T.home.heading }),
    h('p', { class: 'lede', text: T.home.lede }),
    practiceBanner(),
    waiting ? h('div', { class: 'notice info', role: 'status' }, icon('pencil'), h('div', { class: 'body' }, h('h2', { text: T.home.waitingTitle }), h('p', { text: T.home.waitingText }))) : null,
    h('ul', { class: 'tiles' }, tiles),
    h('div', { class: 'row' },
      h('a', { class: 'btn big', href: '../', target: '_blank', rel: 'noopener' }, icon('external'), h('span', { text: T.home.seeWebsite })),
      store.practice ? button(T.practiceTools.clear, { icon: 'trash', size: 'big', onClick: clearPractice }) : null),
  ].filter(Boolean));
}

async function clearPractice() {
  const ok = await ask({ title: T.practiceTools.title, text: T.practiceTools.text, yes: T.practiceTools.yes, no: T.practiceTools.no, safe: true });
  if (!ok) return;
  store.resetPractice();
  await route();
  notify({ kind: 'ok', text: T.practiceTools.done });
}

/* ---- one screen -------------------------------------------------------------------------------------- */
async function showDoc(name, token) {
  const spec = DOCS[name];
  const [live, seed, stat] = await Promise.all([store.live(name), store.seed(name), store.statusAll([name])]);
  if (token !== screenToken) return;
  const saved = store.draft(name);
  const S = {
    name, spec, live, seed, draft: saved || clone(live), hasPrevious: !!(stat[name] && stat[name].hasPrevious) || !!live.updated, busy: false,
    forms: [], panels: [], listEl: null, itemForm: null, flashId: null, token,
  };
  const alive = () => token === screenToken;                 // false once the person has moved to another screen
  const say = (opts) => (alive() ? notify(opts) : null);     // so a late answer to a question cannot write on the wrong screen
  document.title = `${spec.label} · ${T.siteName}`;
  crumb.hidden = false;
  crumb.replaceChildren(h('a', { class: 'btn', href: '#/' }, icon('home'), h('span', { text: T.backToStart })));

  /* saving as you go */
  let timer = null;
  const dirty = () => differs(name, S.live, S.draft);
  const persist = () => {
    clearTimeout(timer); timer = null;
    if (dirty()) { if (!store.saveDraft(name, S.draft)) say({ kind: 'warn', text: T.problems.other }); }
    else store.clearDraft(name);
    updatePanels();
  };
  const onEdit = () => { clearTimeout(timer); timer = setTimeout(persist, 250); updatePanels(); };
  flushPending = () => { if (timer) persist(); };   // leaving the screen, or closing the tab, must not lose the last letters

  /* ---- the panel with the big buttons ---- */
  function panel(extraClass) {
    const d = dirty();
    if (!d) {
      return h('div', { class: `panel ${extraClass || ''}` },
        h('p', { class: 'state' }, icon('check'), T.status.clean),
        S.live.updated ? h('p', { class: 'when', text: T.home.lastChanged(whenText(S.live.updated)) }) : null);
    }
    const putBtn = button(S.busy ? T.confirmLive.working : T.actions.putLive, { icon: 'check', kind: 'primary', size: 'big', onClick: putLive });
    const seeBtn = button(T.actions.seeHow, { icon: 'eye', size: 'big', onClick: openPreview });
    if (S.busy) { putBtn.disabled = true; seeBtn.disabled = true; }
    return h('div', { class: `panel waiting ${extraClass || ''}` },
      h('p', { class: 'state' }, icon('pencil'), T.status.dirty),
      h('div', { class: 'row' }, seeBtn, putBtn));
  }
  function updatePanels() {
    S.panels.forEach((p, i) => { const next = panel(i ? 'bottom' : ''); p.replaceWith(next); S.panels[i] = next; });
    if (S.more) { const next = moreTools(); S.more.replaceWith(next); S.more = next; }
  }

  /* ---- the foot of the page ---- */
  function moreTools() {
    const d = dirty();
    const item = (label, help, opts) => h('div', { class: 'moreitem' }, button(label, opts), h('p', { class: 'help', text: help }));   // each says what it does
    const items = [];
    if (d) items.push(item(T.actions.throwAway, T.actions.throwAwayHelp, { icon: 'trash', onClick: throwAway }));
    if (S.hasPrevious) items.push(item(T.actions.oldVersion, T.actions.oldVersionHelp, { icon: 'undo', onClick: undoPublish }));
    if (differs(name, S.draft, S.seed)) items.push(item(T.actions.startAgain, T.actions.startAgainHelp, { onClick: startAgain }));
    return h('section', { class: 'more', hidden: !items.length }, h('h2', { text: T.moreThings }), h('div', { class: 'moreitems' }, items));
  }

  /* ---- problems ---- */
  function showProblems(errors, focusFn) {
    say({
      kind: 'warn', title: T.problems.title, text: T.problems.text,
      list: errors.slice(0, 6).map(problemLine),
      actions: focusFn ? [{ label: T.problems.goTo, icon: 'down', primary: true, onClick: focusFn }] : [],
      focus: true,
    });
  }
  function handleError(e) {
    if (e.status === 401 || e.status === 403) say({ kind: 'warn', text: T.problems.signedOut, actions: [{ label: T.actions.signInAgain, icon: 'undo', primary: true, onClick: () => location.reload() }], focus: true });
    else if (e.status === 0) say({ kind: 'warn', text: e.message || T.problems.offline, focus: true });
    else if (e.status === 409) say({ kind: 'warn', text: T.problems.conflict, actions: [{ label: T.actions.refresh, icon: 'undo', primary: true, onClick: () => location.reload() }], focus: true });
    else if (e.status === 400) say({ kind: 'warn', text: e.message, focus: true });
    else say({ kind: 'error', text: T.problems.other, focus: true });
  }

  /* ---- putting it on the website ---- */
  async function putLive() {
    if (S.busy) return;
    const result = validateDoc(name, S.draft);
    if (result.errors) {
      const first = firstBadField(result.errors);
      showProblems(result.errors, first);
      if (first) first();
      return;
    }
    const changes = summarize(S);
    if (!changes.length) { say({ kind: 'info', text: T.problems.nothing }); return; }
    const yes = await ask({
      title: T.confirmLive.title,
      text: store.practice ? T.confirmLive.textPractice : T.confirmLive.text,
      body: h('div', {}, h('p', { style: 'font-weight:700;margin:.6rem 0 0', text: T.confirmLive.changes }), h('ul', { class: 'changes' }, changes.map((c) => h('li', { text: c })))),
      yes: T.confirmLive.yes, no: T.confirmLive.no, focusYes: true,
    });
    if (!yes || !alive()) return;
    clearNotice();
    S.busy = true; updatePanels();
    try {
      const res = await store.publish(name, result.value, S.live.updated);
      S.live = { ...result.value, updated: res.updated };
      S.draft = clone(S.live);
      store.clearDraft(name);
      S.hasPrevious = true;
      S.busy = false;
      if (!alive()) return;
      draw();
      say({
        kind: 'ok', title: T.done.title, text: store.practice ? T.done.textPractice : T.done.text, focus: true,
        actions: [
          { label: T.actions.seeWebsite, icon: 'external', primary: true, onClick: () => window.open(`../#${spec.anchor}`, '_blank', 'noopener') },
          { label: T.actions.undoThis, icon: 'undo', onClick: undoPublish },
        ],
      });
    } catch (e) { S.busy = false; updatePanels(); handleError(e); }
  }

  /* The version before the last change. After the very first change that is the first version. */
  async function olderVersion() {
    const prev = await store.previous(name).catch(() => null);
    return prev || (S.live.updated ? clone(S.seed) : null);
  }

  async function undoPublish() {
    const prev = await olderVersion();
    if (!prev) { say({ kind: 'info', text: T.undo.none }); return; }
    const yes = await ask({ title: T.undo.title, text: T.undo.text, yes: T.undo.yes, no: T.undo.no, safe: true });
    if (!yes) return;
    const r = validateDoc(name, prev);
    if (r.errors) { say({ kind: 'warn', text: T.problems.other }); return; }
    S.busy = true; updatePanels();
    try {
      const wasDirty = dirty();
      const res = await store.publish(name, r.value, S.live.updated);
      S.live = { ...r.value, updated: res.updated };
      if (!wasDirty) { S.draft = clone(S.live); store.clearDraft(name); }
      S.hasPrevious = true; S.busy = false;
      if (!alive()) return;
      draw();
      say({ kind: 'ok', text: T.undo.done, focus: true });
    } catch (e) { S.busy = false; updatePanels(); handleError(e); }
  }

  async function throwAway() {
    const yes = await ask({ title: T.throwAway.title, text: T.throwAway.text, yes: T.throwAway.yes, no: T.throwAway.no, safe: true });
    if (!yes) return;
    S.draft = clone(S.live); store.clearDraft(name); draw();
    say({ kind: 'ok', text: T.throwAway.done, focus: true });
  }

  async function startAgain() {
    const yes = await ask({ title: T.again.title, text: T.again.text, yes: T.again.yes, no: T.again.no, safe: true });
    if (!yes) return;
    S.draft = clone(S.seed); persist(); draw();
    say({ kind: 'ok', text: T.again.done, focus: true });
  }

  /* ---- seeing how it looks ---- */
  function openPreview() {
    store.saveDraft(name, S.draft);
    const before = document.activeElement;
    const titleId = uid('look');
    const closeBtn = button(T.preview.close, { icon: 'close', size: 'big', onClick: () => dlg.close() });
    const putBtn = dirty() ? button(T.actions.putLive, { icon: 'check', kind: 'primary', size: 'big', onClick: () => { dlg.close(); putLive(); } }) : null;
    const dlg = h('dialog', { class: 'look', 'aria-labelledby': titleId },
      h('header', {}, h('h2', { id: titleId, text: T.preview.title }), h('p', { text: T.preview.text }), h('div', { class: 'row' }, closeBtn, putBtn)),
      h('iframe', { title: T.preview.frame, src: `../?preview=1#${spec.anchor}` }));
    dlg.addEventListener('close', () => { dlg.remove(); refocus(before); });
    document.body.append(dlg);
    dlg.showModal();
    closeBtn.focus();
  }

  /* ---- finding the first box with a problem ---- */
  function firstBadField(errors) {
    for (const f of S.forms) {
      const hit = f.showErrors(errors);
      if (hit) return () => { hit.focus(); const el = document.querySelector('.field.bad'); if (el) el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); };
    }
    return null;
  }

  /* ---- the questions ---- */
  function formBody() {
    return spec.groups.map((g, gi) => {
      const fb = buildFields(g.fields, S.draft, { onChange: onEdit, idBase: `g${gi}` });
      S.forms.push(fb);
      const hid = uid('group');
      return h('section', { class: 'group', 'aria-labelledby': hid }, h('h2', { id: hid, text: g.title }), ...fb.nodes);
    });
  }

  /* ---- a list of things ---- */
  const ui = LIST_UI[name];
  function sortedItems() {
    const items = S.draft.items.slice();
    return ui && ui.sort ? items.sort(ui.sort) : items;
  }
  function card(it, index, total) {
    const title = ui.title(it);
    const change = button(T.list.change, { icon: 'pencil', onClick: () => openItemForm(it) });
    const takeOff = button(T.list.takeOff, { icon: 'trash', kind: 'quiet', onClick: () => removeItem(it) });
    const acts = [change];
    change.setAttribute('aria-label', `${T.list.change}: ${title}`);
    takeOff.setAttribute('aria-label', `${T.list.takeOff}: ${title}`);
    if (ui.manual) {
      const up = button(T.form.moveUp, { icon: 'up', size: 'small', onClick: () => moveItem(it, -1, 'up') });
      const down = button(T.form.moveDown, { icon: 'down', size: 'small', onClick: () => moveItem(it, 1, 'down') });
      up.setAttribute('aria-label', `${T.form.moveUp}: ${title}`); down.setAttribute('aria-label', `${T.form.moveDown}: ${title}`);
      up.dataset.act = 'up'; down.dataset.act = 'down';
      up.hidden = index === 0; down.hidden = index === total - 1;
      acts.push(up, down);
    }
    acts.push(takeOff);
    const el = h('li', { class: 'card', 'data-id': it.id },
      ui.meta(it) ? h('p', { class: 'meta', text: ui.meta(it) }) : null,
      h('h3', { text: title }),
      ui.sub(it) ? h('p', { class: 'sub', text: ui.sub(it) }) : null,
      h('span', { class: 'pill', text: ui.pill(it) }),
      h('div', { class: 'row' }, acts));
    if (S.flashId === it.id) el.classList.add('flash');
    return el;
  }
  function drawList() {
    const items = sortedItems();
    const upcoming = ui.isPast ? items.filter((x) => !ui.isPast(x)) : items;
    const past = ui.isPast ? items.filter((x) => ui.isPast(x)).reverse() : [];
    const wrap = h('div', {},
      upcoming.length
        ? h('div', {}, ui.t.upcoming ? h('h2', { class: 'sectionhead', text: ui.t.upcoming }) : null, h('ul', { class: 'rows' }, upcoming.map((it, i) => card(it, i, upcoming.length))))
        : h('div', { class: 'empty' }, h('p', { text: ui.t.empty, style: 'margin:0' })),
      past.length ? h('details', { class: 'past', open: past.some((x) => x.id === S.flashId) }, h('summary', { text: `${ui.t.past} (${past.length})` }), h('p', { class: 'help', text: ui.t.pastHelp, style: 'margin:.2rem 0 .8rem' }), h('ul', { class: 'rows' }, past.map((it, i) => card(it, i, past.length)))) : null);
    if (S.listEl) { S.listEl.replaceWith(wrap); }
    S.listEl = wrap;
    return wrap;
  }
  function newItem() {
    const it = { id: 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
    for (const [k, f] of Object.entries(spec.fields)) it[k] = f.type === 'textlist' ? [] : (f.default || '');
    return it;
  }
  function closeItemForm() {
    if (S.itemForm) { S.itemForm.el.remove(); S.itemForm = null; }
    if (S.addBtn) S.addBtn.hidden = false;
  }
  function openItemForm(existing) {
    closeItemForm();
    const editing = existing ? clone(existing) : newItem();
    const fb = buildFields(spec.fields, editing, { idBase: uid('item') });
    const titleId = uid('form');
    const form = h('form', { class: 'item', novalidate: true, 'aria-labelledby': titleId },
      h('h2', { id: titleId, text: existing ? ui.t.formEdit : ui.t.formNew }),
      ...fb.nodes,
      h('div', { class: 'row' },
        button(existing ? T.list.saveChanges : T.list.addToList, { type: 'submit', kind: 'primary', size: 'big' }),
        button(T.list.notNow, { size: 'big', onClick: () => { closeItemForm(); S.addBtn.focus(); } })));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = validateFields(spec.fields, editing, '');
      if (r.errors.length) {
        const first = fb.showErrors(r.errors);
        say({ kind: 'warn', title: T.problems.title, text: T.problems.text, list: r.errors.slice(0, 5).map(problemLine), focus: false });
        if (first) { first.focus(); form.querySelector('.field.bad')?.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); }
        return;
      }
      const item = { id: editing.id, ...r.value };
      if (existing) S.draft.items = S.draft.items.map((x) => (x.id === item.id ? item : x)); else S.draft.items.push(item);
      S.flashId = item.id;
      closeItemForm();
      persist(); drawList();
      const warn = ui.warn ? ui.warn(item) : null;
      say({
        kind: warn ? 'warn' : 'ok', title: existing ? T.list.savedTitle : T.list.addedTitle, text: warn || T.list.notLiveYet, focus: true,
        actions: warn ? [] : [{ label: T.actions.putLive, icon: 'check', primary: true, onClick: putLive }],
      });
      setTimeout(() => { S.flashId = null; }, 3200);
    });
    S.itemForm = { el: form };
    S.addBtn.hidden = true;
    S.addBtn.after(form);
    form.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    fb.field(Object.keys(spec.fields)[0]).focus();
  }
  async function removeItem(it) {
    const yes = await ask({ title: T.list.removeTitle(ui.title(it)), text: T.list.removeText, yes: T.list.removeYes, no: T.list.removeNo, safe: true });
    if (!yes) return;
    const index = S.draft.items.findIndex((x) => x.id === it.id);
    const [gone] = S.draft.items.splice(index, 1);
    persist(); drawList();
    say({
      kind: 'ok', title: T.list.removedTitle(ui.title(it)), text: T.list.removedText, focus: true,
      actions: [{ label: T.actions.putBack, icon: 'undo', primary: true, onClick: () => {
        S.draft.items.splice(index, 0, gone); S.flashId = gone.id;
        persist(); drawList();
        say({ kind: 'ok', title: T.list.putBackTitle(ui.title(gone)), text: T.list.putBackText, focus: true });
        setTimeout(() => { S.flashId = null; }, 3200);
      } }],
    });
  }
  function moveItem(it, delta, which) {
    const i = S.draft.items.findIndex((x) => x.id === it.id);
    const j = i + delta;
    if (j < 0 || j >= S.draft.items.length) return;
    [S.draft.items[i], S.draft.items[j]] = [S.draft.items[j], S.draft.items[i]];
    S.flashId = it.id;
    persist(); drawList();
    const row = S.listEl.querySelector(`[data-id="${it.id}"]`);
    const again = row && (row.querySelector(`[data-act="${which}"]:not([hidden])`) || row.querySelector('[data-act]:not([hidden])') || row.querySelector('button'));
    if (again) again.focus();
    say({ kind: 'ok', text: T.list.movedTo(ui.title(it), j + 1) });
    setTimeout(() => { S.flashId = null; }, 3200);
  }
  function listBody() {
    const nodes = [];
    if (spec.rootFields) {
      const fb = buildFields(spec.rootFields, S.draft, { onChange: onEdit, idBase: 'root' });
      S.forms.push(fb);
      nodes.push(h('section', { class: 'group', 'aria-labelledby': 'root-h' }, h('h2', { id: 'root-h', text: ui.t.everything }), ...fb.nodes));
    }
    S.addBtn = button(ui.t.add, { icon: 'plus', kind: 'primary', size: 'big', onClick: () => openItemForm(null) });
    S.listEl = null;
    nodes.push(h('div', { style: 'margin-block:1.4rem' }, S.addBtn));
    nodes.push(drawList());
    return nodes;
  }

  /* ---- put the whole screen on the page ---- */
  function draw() {
    if (!alive()) return;
    S.forms = []; S.panels = []; S.itemForm = null; S.listEl = null;
    const top = panel();
    S.panels.push(top);
    const body = spec.kind === 'list' ? listBody() : formBody();
    const parts = [h('h1', { tabindex: '-1', text: spec.label }), h('p', { class: 'lede', text: spec.lede }), top, practiceBanner(), ...body];
    if (spec.kind === 'form') {
      const bottom = panel('bottom');
      S.panels.push(bottom);
      parts.push(bottom);
    }
    S.more = moreTools();
    parts.push(S.more);
    view.replaceChildren(...parts.filter(Boolean));
  }

  draw();
  if (saved && dirty()) say({ kind: 'info', text: T.welcomeBack });
}

/* ---- start ------------------------------------------------------------------------------------------- */
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', () => flushPending());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPending(); });
renderTools().then(route);
