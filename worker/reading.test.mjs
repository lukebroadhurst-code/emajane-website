/* Plain words. Reads every sentence the admin shows and checks that it is short, simple and free of computer talk.
   Reading level is only a rough guide (and is easy to fool), so this is a floor, not proof.
   Run:  node reading.test.mjs            Show everything:  node reading.test.mjs --all */
import { T } from '../site/admin/copy.js';
import { DOCS } from '../site/admin/schema.js';

const SHOW_ALL = process.argv.includes('--all');

/* ---- gather every string a person can read ---- */
const found = [];
function walk(value, where) {
  if (typeof value === 'string') { found.push({ where, text: value }); return; }
  if (typeof value === 'function') {
    for (const args of [['Brighton'], ['Brighton', 3], [3], ['Brighton', 'Brighton'], ['', ''], ['a@b.com']]) {
      try { const r = value(...args); if (typeof r === 'string' && !/undefined|NaN/.test(r)) { found.push({ where, text: r }); return; } } catch { /* try the next */ }
    }
    return;
  }
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${where}[${i}]`)); return; }
  if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, `${where}.${k}`));
}
walk(T, 'T');
for (const [name, spec] of Object.entries(DOCS)) {
  for (const k of ['label', 'blurb', 'lede']) if (spec[k]) found.push({ where: `${name}.${k}`, text: spec[k] });
  const fields = { ...(spec.rootFields || {}), ...(spec.fields || {}), ...Object.assign({}, ...(spec.groups || []).map((g) => g.fields)) };
  for (const g of spec.groups || []) found.push({ where: `${name}.group`, text: g.title });
  for (const [k, f] of Object.entries(fields)) {
    if (f.ask) found.push({ where: `${name}.${k}.ask`, text: f.ask });
    if (f.help) found.push({ where: `${name}.${k}.help`, text: f.help });
    if (f.addLabel) found.push({ where: `${name}.${k}.addLabel`, text: f.addLabel });
    (f.options || []).forEach((o) => found.push({ where: `${name}.${k}.option`, text: o[1] }));
  }
}

/* ---- measuring ---- */
function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}
const wordsOf = (s) => s.split(/\s+/).map((w) => w.replace(/^[^A-Za-z0-9£]+|[^A-Za-z0-9£]+$/g, '')).filter(Boolean);
const sentencesOf = (s) => s.split(/(?<=[.?!])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
function grade(text) {
  const w = wordsOf(text); const s = sentencesOf(text);
  if (w.length < 8) return null;                                    // too short for the formula to mean anything
  const syl = w.reduce((n, x) => n + syllables(x), 0);
  return 0.39 * (w.length / s.length) + 11.8 * (syl / w.length) - 15.59;
}

/* words a child or a grandparent should not have to meet. Each has a plainer word in its place. */
const JARGON = [
  [/\bsubmit/i, 'send / put on'], [/\bupload/i, 'choose'], [/\bdownload/i, 'save'], [/\berror/i, 'problem'], [/\binvalid/i, 'not right'],
  [/\bURL\b/, 'web address'], [/\bdeploy/i, 'put on your website'], [/\bpublish/i, 'put on your website'], [/\bserver\b/i, 'your website'], [/\bdatabase/i, ''],
  [/\bcache/i, ''], [/\bauthenticat/i, 'sign in'], [/\bcredential/i, ''], [/\bconfigur/i, ''], [/\bnavigat/i, 'go'], [/\bdrop-?down/i, 'list'],
  [/\bmodal\b/i, ''], [/\bpop-?up/i, 'window'], [/\bdashboard/i, 'first page'], [/\bfield\b/i, 'box'], [/\bimage\b/i, 'picture'], [/\bJPEG|\bPNG\b|\bWebP\b/, 'picture'],
  [/\bAPI\b|\bJSON\b|\bHTML\b|\bCSS\b|\bhttps?:/i, ''], [/\bbrowser\b/i, ''], [/\bdelete/i, 'take off'], [/\bsession/i, ''], [/\btoken/i, ''],
  [/\bapplication\b|\bapp\b/i, ''], [/\bmenu\b/i, ''], [/\bretry\b/i, 'try again'], [/\bfailed\b/i, 'did not work'], [/\bcancel/i, 'not now'],
];

/* the one place a helper, not Emma, reads the words */
const ALLOWED = { 'T.noScript': ['browser'] };
let fails = 0;
const say = (m) => console.log(m);
const bad = [];
const stats = [];
for (const f of found) {
  const text = f.text.replace(/[“”]/g, '"');
  const sents = sentencesOf(text);
  const longest = Math.max(0, ...sents.map((s) => wordsOf(s).length));
  const g = grade(text);
  const hard = wordsOf(text).filter((w) => syllables(w) >= 4);
  stats.push({ ...f, g, longest, hard });
  if (longest > 20) bad.push(`${f.where}: a sentence of ${longest} words: "${text.slice(0, 90)}…"`);
  if (g !== null && g > 8) bad.push(`${f.where}: reading level ${g.toFixed(1)} (target 8 or lower): "${text.slice(0, 90)}…"`);
  for (const [re, instead] of JARGON) { const m = text.match(re); if (m && !(ALLOWED[f.where] || []).includes(m[0].toLowerCase())) bad.push(`${f.where}: computer word "${m[0]}"${instead ? ` (try “${instead}”)` : ''}: "${text.slice(0, 80)}"`); }
  if (hard.length > 1) bad.push(`${f.where}: long words ${hard.join(', ')}`);
  if (/[A-Z]{4,}/.test(text.replace(/\b(EMAJANE|JPEG|PNG|WEBP|URL)\b/g, ''))) bad.push(`${f.where}: SHOUTING in capitals: "${text.slice(0, 60)}"`);
}

const graded = stats.filter((s) => s.g !== null);
const avg = graded.reduce((n, s) => n + s.g, 0) / (graded.length || 1);
const allSentences = stats.flatMap((s) => sentencesOf(s.text).map((x) => wordsOf(x).length));
const avgLen = allSentences.reduce((n, x) => n + x, 0) / (allSentences.length || 1);

say(`\nPlain words: ${found.length} pieces of writing, ${allSentences.length} sentences`);
say(`  average sentence: ${avgLen.toFixed(1)} words (target 10 or fewer)`);
say(`  average reading level of the ${graded.length} longer pieces: ${avg.toFixed(1)} (target 6 or lower, roughly age 11)`);
if (avgLen > 10) bad.push(`the average sentence is ${avgLen.toFixed(1)} words long`);
if (avg > 6) bad.push(`the average reading level is ${avg.toFixed(1)}`);

const hardest = [...graded].sort((a, b) => b.g - a.g).slice(0, SHOW_ALL ? 999 : 8);
say(`\n  the ${SHOW_ALL ? '' : hardest.length + ' '}hardest to read:`);
hardest.forEach((s) => say(`    ${s.g.toFixed(1).padStart(5)}  ${s.where}  "${s.text.slice(0, 80)}"`));

if (bad.length) { say(`\n${bad.length} to look at:`); [...new Set(bad)].forEach((b) => say('  - ' + b)); fails = 1; }
else say('\nAll plain.');
process.exit(fails);
