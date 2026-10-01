/* The pieces the admin screens are built from.

   Choices made for people who read slowly, see poorly, or are very young:
   - every box has a plain question above it and says if it is needed
   - dates use three big drop-downs, with the date written out in words underneath
   - web addresses have a Paste button and a Try-this-link button
   - messages stay until you close them; nothing fades away by itself
   - questions that could lose something appear as a clear pop-up with two plain answers
   Nothing here ever puts typed text on the page as HTML. */

import { icon } from './icons.js?v=dev';
import { T } from './copy.js?v=dev';
import { LIMITS, matches, validateFields } from './schema.js?v=dev';
import * as store from './store.js?v=dev';

/* ---- building elements ------------------------------------------------------------------------------ */
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}

let counter = 0;
export const uid = (p = 'x') => `${p}-${++counter}`;
export const clone = (o) => JSON.parse(JSON.stringify(o));
const pad = (n) => String(n).padStart(2, '0');

export function button(label, { icon: ic, kind = '', size = '', onClick, type = 'button', id, describedby } = {}) {
  const b = h('button', { type, id, class: ['btn', kind, size].filter(Boolean).join(' '), 'aria-describedby': describedby });
  if (ic) b.append(icon(ic));
  b.append(h('span', { text: label }));
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/* ---- dates written for people ----------------------------------------------------------------------- */
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function longDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
}
export function whenText(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function isPast(iso) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(iso + 'T12:00:00') < t;
}

/* ---- messages that stay until closed ---------------------------------------------------------------- */
export function clearNotice() { const b = document.getElementById('notices'); if (b) b.replaceChildren(); }

export function notify({ kind = 'ok', title, text, list, actions = [], focus = false } = {}) {
  const box = document.getElementById('notices');
  box.replaceChildren();
  const iconName = kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'warning';
  const acts = actions.map((a) => button(a.label, { icon: a.icon, kind: a.primary ? 'primary' : '', size: a.primary ? 'big' : '', onClick: a.onClick }));
  acts.push(button(T.closeMessage, { icon: 'close', size: 'small', onClick: () => { box.replaceChildren(); } }));
  const el = h('div', { class: `notice ${kind}`, role: kind === 'ok' || kind === 'info' ? 'status' : 'alert', tabindex: '-1' },
    icon(iconName),
    h('div', { class: 'body' },
      title && h('h2', { text: title }),
      text && h('p', { text }),
      list && list.length && h('ul', {}, list.map((x) => h('li', {}, x.nodeType ? x : String(x)))),
      h('div', { class: 'row' }, acts)));
  box.append(el);
  el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (focus) el.focus({ preventScroll: true });
  return el;
}

/* ---- a pop-up with two plain answers ---------------------------------------------------------------- */
/* After a pop-up closes, the keyboard goes back to where it was. If that thing has gone, to the main part of the page. */
export function refocus(before) {
  if (before && before.isConnected && before.focus) before.focus();
  else { const m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); }
}

/* A box that scrolls must be reachable with the keyboard. While it overflows it gets a place in the Tab order and a name,
   so someone who cannot use a mouse can scroll it with the arrow keys. Returns a function that stops watching. */
export function scrollableByKeyboard(box, labelledby, hint) {   // `hint`: a note outside the box, shown while there is more to read below
  const fit = () => {
    if (hint) hint.hidden = true;                      // measure without the note, so showing it cannot change the answer
    const over = box.scrollHeight > box.clientHeight + 1;
    const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 2;
    if (hint) hint.hidden = !over || atEnd;
    if (over) { box.tabIndex = 0; box.setAttribute('role', 'region'); box.setAttribute('aria-labelledby', labelledby); }
    else { box.removeAttribute('tabindex'); box.removeAttribute('role'); box.removeAttribute('aria-labelledby'); }
  };
  fit();
  window.addEventListener('resize', fit);
  box.addEventListener('scroll', fit, { passive: true });
  return () => window.removeEventListener('resize', fit);
}

/* `safe: true` is for questions where "no" is the careful answer (taking something off, throwing changes away):
   then "no" is the dark button, comes first, and has the keyboard. */
export function ask({ title, text, body, yes, no, focusYes = false, safe = false }) {
  return new Promise((resolve) => {
    const before = document.activeElement;
    let answer = false;
    const titleId = uid('dlg');
    const openedAt = performance.now();
    // A double press of the button that opened this question must not answer it by accident: "yes" waits a moment.
    const yesBtn = button(yes, { kind: safe ? '' : 'primary', size: 'big', onClick: () => { if (performance.now() - openedAt < 400) return; answer = true; dlg.close(); } });
    const noBtn = button(no, { kind: safe ? 'primary' : '', size: 'big', onClick: () => { answer = false; dlg.close(); } });
    const dbody = h('div', { class: 'dbody' }, h('h2', { id: titleId, text: title }), text && h('p', { text }), body);
    const hint = h('p', { class: 'scrollhint', hidden: true, 'aria-hidden': 'true' }, icon('down'), T.scrollHint);
    const dlg = h('dialog', { class: 'q', 'aria-labelledby': titleId }, dbody, hint, h('div', { class: 'row answers' }, safe ? [noBtn, yesBtn] : [yesBtn, noBtn]));
    let stopWatching = () => {};
    dlg.addEventListener('close', () => { stopWatching(); dlg.remove(); refocus(before); resolve(answer); });
    document.body.append(dlg);
    dlg.showModal();
    stopWatching = scrollableByKeyboard(dbody, titleId, hint);
    (focusYes && !safe ? yesBtn : noBtn).focus();
  });
}

/* ---- pictures --------------------------------------------------------------------------------------- */
export async function processPicture(file, { maxSize = 2000, format = 'jpeg' } = {}) {
  const okType = /^image\/(jpeg|png|webp)$/i.test(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
  if (!okType) throw new Error(T.form.badPicture);
  if (file.size > 30 * 1024 * 1024) throw new Error(T.form.hugePicture);
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { try { bitmap = await createImageBitmap(file); } catch { throw new Error(T.form.pictureFailed); } }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  let w = Math.max(1, Math.round(bitmap.width * scale));
  let ht = Math.max(1, Math.round(bitmap.height * scale));
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const canvas = document.createElement('canvas');
  const qualities = [0.86, 0.78, 0.7, 0.62, 0.55, 0.5];
  for (let i = 0; i < qualities.length; i++) {
    canvas.width = w; canvas.height = ht;
    const ctx = canvas.getContext('2d');
    if (mime === 'image/jpeg') { ctx.fillStyle = '#0B0A09'; ctx.fillRect(0, 0, w, ht); }   // see-through parts become the page's dark colour
    ctx.drawImage(bitmap, 0, 0, w, ht);
    const blob = await new Promise((res) => canvas.toBlob(res, mime, qualities[i]));
    if (blob && blob.size <= LIMITS.imageBytes) return blob;
    w = Math.round(w * 0.85); ht = Math.round(ht * 0.85);   // still too big: a little smaller, then try again
  }
  throw new Error(T.form.hugePicture);
}

/* ---- one question ------------------------------------------------------------------------------------ */
/* Each builder returns { el, setError(message), focus() }. `set` is called with the new answer. */

function shell(f, id, { group = false, controls = [], inputs = [] } = {}) {
  const needed = f.required || f.requiredIf;
  const alwaysAnswered = f.type === 'choice' && f.default;           // one answer is always chosen, so "if you like" would mislead
  const tag = alwaysAnswered && !needed ? null : h('span', { class: needed ? 'tag needed' : 'tag', text: `(${needed ? T.form.needed : T.form.optional})` });
  const ask = group ? h('legend', { class: 'ask' }, f.ask, tag) : h('label', { class: 'ask', for: id }, f.ask, tag);
  const help = f.help ? h('p', { class: 'help', id: `${id}-help`, text: f.help }) : null;
  const errText = h('span');
  const err = h('p', { class: 'err', id: `${id}-err`, hidden: true }, icon('warning'), errText);
  const root = h(group ? 'fieldset' : 'div', { class: 'field', 'data-key': f.key || '' }, ask, help, ...controls, err);
  const describe = [help && help.id, err.id].filter(Boolean).join(' ');
  inputs.forEach((i) => i.setAttribute('aria-describedby', [describe, i.getAttribute('data-extra-desc')].filter(Boolean).join(' ')));
  return {
    root,
    setError(message) {
      err.hidden = !message; errText.textContent = message || '';
      root.classList.toggle('bad', !!message);
      inputs.forEach((i) => { if (message) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); });
    },
    focus() { (inputs[0] || root).focus(); },
  };
}

function textField(f, value, set, id, long) {
  const input = long
    ? h('textarea', { id, rows: String(f.rows || 5) })
    : h('input', { id, type: 'text', autocomplete: 'off' });
  input.value = value || '';
  const counter = h('p', { class: 'counter', id: `${id}-count`, hidden: true });
  input.setAttribute('data-extra-desc', counter.id);
  const s = shell(f, id, { controls: [input, counter], inputs: [input] });
  const paint = () => {
    const n = input.value.trim().length, left = f.max - n;
    counter.hidden = !(n >= f.max * 0.8);
    counter.textContent = left >= 0 ? T.form.lettersLeft(left) : `This is ${-left} ${-left === 1 ? 'letter' : 'letters'} too long.`;
  };
  input.addEventListener('input', () => { set(input.value); paint(); });
  paint();
  return { el: s.root, setError: s.setError, focus: () => input.focus(), input };
}

function linkField(f, value, set, id, kind) {
  const input = h('input', { id, type: kind === 'email' ? 'email' : 'url', autocomplete: 'off', spellcheck: 'false', inputmode: kind === 'email' ? 'email' : 'url' });
  input.value = value || '';
  const pasteNote = h('p', { class: 'help', id: `${id}-paste`, hidden: true, role: 'status' });
  input.setAttribute('data-extra-desc', pasteNote.id);
  let controls;
  if (kind === 'email') {
    controls = [input];
  } else {
    const pasteBtn = button(T.form.paste, { icon: 'clipboard', size: 'small', describedby: `${id}-linkhelp`, onClick: async () => {
      try {
        const txt = (await navigator.clipboard.readText()).trim();
        input.value = txt; set(txt); input.dispatchEvent(new Event('blur')); pasteNote.hidden = true; input.focus();
      } catch { pasteNote.textContent = T.form.pasteBlocked; pasteNote.hidden = false; input.focus(); }
    } });
    const tryBtn = button(T.form.tryLink, { icon: 'external', size: 'small', describedby: `${id}-linkhelp`, onClick: () => {
      const v = input.value.trim();
      if (/^https:\/\/\S+$/i.test(v)) { window.open(v, '_blank', 'noopener'); pasteNote.hidden = true; }
      else { pasteNote.textContent = T.form.tryFirst; pasteNote.hidden = false; input.focus(); }
    } });
    const how = h('details', { class: 'how' }, h('summary', { text: T.form.findLink }), h('ol', {}, T.form.findLinkSteps.map((x) => h('li', { text: x }))));
    controls = [h('div', { class: 'linkbox' }, input, h('div', { class: 'row' }, pasteBtn, tryBtn),
      h('p', { id: `${id}-linkhelp`, class: 'help', text: T.form.linkHelp }), how)];
  }
  controls.push(pasteNote);
  const s = shell(f, id, { controls, inputs: [input] });
  input.addEventListener('input', () => set(input.value));
  return { el: s.root, setError: s.setError, focus: () => input.focus(), input };
}

function dateField(f, value, set, id) {
  const thisYear = new Date().getFullYear();
  const [y0, m0, d0] = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').map(Number) : [0, 0, 0];
  const years = [];
  for (let y = Math.min(thisYear, y0 || thisYear); y <= thisYear + 4; y++) years.push(y);
  let yearTouched = !!y0;                  // until she chooses a year herself, we choose a sensible one
  const make = (suffix, label, options, current) => {
    const sel = h('select', { id: `${id}-${suffix}` }, h('option', { value: '', text: T.form.choose }), options.map(([v, t]) => h('option', { value: String(v), text: t })));
    sel.value = current ? String(current) : '';
    return { sel, label: h('div', { class: 'dpart' }, h('label', { for: sel.id, text: label }), sel) };
  };
  const day = make('d', T.form.day, Array.from({ length: 31 }, (_, i) => [i + 1, String(i + 1)]), d0);
  const month = make('m', T.form.month, MONTHS.map((n, i) => [i + 1, n]), m0);
  const year = make('y', T.form.year, years.map((y) => [y, String(y)]), y0 || thisYear);
  const readout = h('p', { class: 'readout', id: `${id}-read`, 'aria-live': 'polite' });
  const paint = () => { readout.textContent = /^\d{4}-/.test(value || '') ? T.form.thatIs(longDate(value)) : ''; };
  const s = shell(f, id, { group: true, controls: [h('div', { class: 'date3' }, day.label, month.label, year.label), readout], inputs: [day.sel, month.sel, year.sel] });
  const real = (iso) => new Date(iso + 'T12:00:00Z').toISOString().slice(0, 10) === iso;
  const update = () => {
    const dd = +day.sel.value, mm = +month.sel.value;
    if (!yearTouched && dd && mm) {                       // we choose the year: this year, or next year if that day has gone
      const first = `${thisYear}-${pad(mm)}-${pad(dd)}`;
      year.sel.value = String(real(first) && isPast(first) ? thisYear + 1 : thisYear);
    }
    const yy = +year.sel.value;
    if (dd && mm && yy) {
      const iso = `${yy}-${pad(mm)}-${pad(dd)}`;
      if (real(iso)) { value = iso; set(iso); paint(); s.setError(''); }
      else { value = ''; set(''); readout.textContent = T.form.notOnCalendar; }
    } else { value = ''; set(''); readout.textContent = ''; }
  };
  year.sel.addEventListener('change', () => { yearTouched = true; });
  [day.sel, month.sel, year.sel].forEach((x) => x.addEventListener('change', update));
  paint();
  return { el: s.root, setError: s.setError, focus: () => day.sel.focus() };
}

function choiceField(f, value, set, id) {
  const name = uid('choice');
  const radios = f.options.map(([v, label]) => {
    const input = h('input', { type: 'radio', name, value: v });
    input.checked = (value || f.default) === v;
    input.addEventListener('change', () => { if (input.checked) set(v); });
    return { v, input, el: h('label', { class: 'choice' }, input, h('span', { text: label })) };
  });
  const s = shell(f, id, { group: true, controls: [h('div', { class: 'choices' }, radios.map((r) => r.el))], inputs: [] });
  return { el: s.root, setError: s.setError, focus: () => (radios.find((r) => r.input.checked) || radios[0]).input.focus() };
}

function textlistField(f, value, set, id) {
  let items = Array.isArray(value) ? [...value] : [];
  const list = h('div', { class: 'lines' });
  const addBtn = button(f.addLabel || 'Add another', { icon: 'plus', onClick: () => { items.push(''); set([...items]); render(items.length - 1); } });
  const s = shell(f, id, { group: true, controls: [list, h('div', { class: 'row' }, addBtn)], inputs: [] });
  function move(i, d) { [items[i], items[i + d]] = [items[i + d], items[i]]; set([...items]); render(i + d, 'move'); }
  function render(focusIndex, focusWhat) {
    list.replaceChildren(...items.map((text, i) => {
      const input = h('input', { type: 'text', id: `${id}-${i}`, autocomplete: 'off', 'aria-label': `${f.ask}, number ${i + 1}` });
      input.value = text;
      input.addEventListener('input', () => { items[i] = input.value; set([...items]); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); items.splice(i + 1, 0, ''); set([...items]); render(i + 1); } });
      const up = button(T.form.moveUp, { icon: 'up', size: 'small', onClick: () => move(i, -1) });
      const down = button(T.form.moveDown, { icon: 'down', size: 'small', onClick: () => move(i, 1) });
      up.hidden = i === 0; down.hidden = i === items.length - 1;
      up.setAttribute('aria-label', `${T.form.moveUp}: ${f.ask}, number ${i + 1}`); down.setAttribute('aria-label', `${T.form.moveDown}: ${f.ask}, number ${i + 1}`);
      const gone = button(T.form.takeAway, { icon: 'trash', size: 'small', onClick: () => { items.splice(i, 1); set([...items]); render(Math.min(i, items.length - 1)); } });
      gone.setAttribute('aria-label', `${T.form.takeAway}: ${f.ask}, number ${i + 1}`);
      return h('div', { class: 'line' }, h('span', { class: 'num', 'aria-hidden': 'true', text: `${i + 1}.` }), input, h('div', { class: 'acts' }, up, down, gone));
    }));
    if (focusIndex != null && focusIndex >= 0) {
      if (focusWhat === 'move') (list.querySelectorAll('.line')[focusIndex].querySelector('.acts button:not([hidden])') || list.querySelectorAll('input')[focusIndex]).focus();
      else list.querySelectorAll('input')[focusIndex].focus();
    }
  }
  render();
  return { el: s.root, setError: s.setError, focus: () => (list.querySelector('input') || addBtn).focus() };
}

function imageField(f, value, set, id) {
  let current = value || '';
  const frame = h('div', { class: 'frame' });
  const status = h('p', { class: 'status', id: `${id}-status`, role: 'status' });
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, id: `${id}-file`, 'aria-hidden': 'true', tabindex: '-1' });
  const choose = button(T.form.choosePicture, { icon: 'picture', onClick: () => file.click() });
  const first = button(T.form.useFirstPicture, { icon: 'undo', size: 'small', onClick: () => change(f.default, '') });
  const remove = button(T.form.removePicture, { icon: 'trash', size: 'small', onClick: () => change('', '') });
  const s = shell(f, id, { group: true, controls: [h('div', { class: 'pic' }, frame, h('div', { class: 'row' }, choose, first, remove), status, file)], inputs: [] });
  function paint() {
    const src = store.pictureSrc(current);
    frame.replaceChildren(src ? h('img', { src, alt: 'The picture you have now' }) : h('span', { class: 'none', text: T.form.noPicture }));
    first.hidden = !(f.default && current !== f.default);
    remove.hidden = !(f.optional && current);
  }
  function change(ref, message) { current = ref; set(ref); paint(); status.textContent = message; s.setError(''); }
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    status.textContent = T.form.makingPicture; choose.disabled = true;
    try {
      const blob = await processPicture(chosen, { maxSize: f.maxSize, format: f.format });
      change(await store.uploadPicture(blob), T.form.pictureReady);
    } catch (e) { status.textContent = e.message || T.form.pictureFailed; }
    choose.disabled = false; file.value = '';
  });
  paint();
  return { el: s.root, setError: s.setError, focus: () => choose.focus() };
}

export function makeField(key, f, value, set, id) {
  const field = { ...f, key };
  switch (f.type) {
    case 'text': return textField(field, value, set, id, false);
    case 'longtext': return textField(field, value, set, id, true);
    case 'url': return linkField(field, value, set, id, 'url');
    case 'email': return linkField(field, value, set, id, 'email');
    case 'date': return dateField(field, value, set, id);
    case 'choice': return choiceField(field, value, set, id);
    case 'textlist': return textlistField(field, value, set, id);
    case 'image': return imageField(field, value, set, id);
    default: throw new Error('Unknown kind of question: ' + f.type);
  }
}

/* ---- a whole set of questions ----------------------------------------------------------------------- */
/* `obj` is changed as the person answers. `onChange` is told after every change. */
export function buildFields(fields, obj, { onChange = () => {}, idBase = uid('f') } = {}) {
  const made = {};
  const nodes = [];
  const refresh = () => {
    for (const [key, f] of Object.entries(fields)) if (f.showIf) made[key].el.hidden = !matches(obj, f.showIf);
  };
  for (const [key, f] of Object.entries(fields)) {
    const field = makeField(key, f, obj[key], (v) => { obj[key] = v; refresh(); onChange(key, v); }, `${idBase}-${key}`);
    made[key] = field;
    nodes.push(field.el);
    // a clearly wrong answer is pointed out when the person leaves the box, not while typing
    const input = field.input;
    if (input && (f.type === 'url' || f.type === 'email')) {
      input.addEventListener('blur', () => {
        if (!input.value.trim()) { field.setError(''); return; }
        const r = validateFields({ [key]: f }, obj);
        field.setError(r.errors.length ? r.errors[0].message : '');
      });
    }
  }
  refresh();
  return {
    nodes,
    refresh,
    clearErrors() { Object.values(made).forEach((m) => m.setError('')); },
    /* errors: [{ path, message }], where path is the key. Returns the first box with a problem. */
    showErrors(errors) {
      Object.values(made).forEach((m) => m.setError(''));
      let first = null;
      for (const e of errors) {
        const key = e.path.split('.').pop();
        if (made[key]) { made[key].setError(e.message); first = first || made[key]; }
      }
      return first;
    },
    field: (key) => made[key],
  };
}
