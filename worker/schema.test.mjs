/* Unit checks for the shared schema. Run with:  npm run test:schema */
import fs from 'node:fs';
import { DOCS, ORDER, validateDoc, validateFields, fieldsOf } from '../site/admin/schema.js';

let failed = 0;
const check = (name, ok, detail = '') => { if (ok) console.log('  ok  ' + name); else { failed++; console.log('FAIL  ' + name + ' ' + detail); } };
const seed = (n) => JSON.parse(fs.readFileSync(new URL(`../site/content/${n}.json`, import.meta.url), 'utf8'));

// every starting file passes the same checks as a real save
for (const n of ORDER) {
  const r = validateDoc(n, seed(n));
  check(`starting text for "${n}" is valid`, !r.errors, JSON.stringify(r.errors));
}

const g = (o = {}) => ({ id: 'a1', date: '2027-03-05', city: 'Bath', venue: '', status: 'tickets', ticketUrl: 'https://example.com/x', ...o });
const gv = (items) => validateDoc('gatherings', { items });
check('gatherings: good item passes', !gv([g()]).errors);
check('gatherings: tickets need a link', !!gv([g({ ticketUrl: '' })]).errors);
check('gatherings: sold out clears link', gv([g({ status: 'soldout' })]).value.items[0].ticketUrl === '');
check('gatherings: free needs no link', !gv([g({ status: 'free', ticketUrl: '' })]).errors);
check('gatherings: http refused', !!gv([g({ ticketUrl: 'http://x.example' })]).errors);
check('gatherings: javascript: refused', !!gv([g({ ticketUrl: 'javascript:alert(1)' })]).errors);
check('gatherings: link with a password refused', !!gv([g({ ticketUrl: 'https://a:b@example.com/' })]).errors);
check('gatherings: 31 February refused', !!gv([g({ date: '2027-02-31' })]).errors);
check('gatherings: blank city refused', !!gv([g({ city: '  ' })]).errors);
check('gatherings: unknown status refused', !!gv([g({ status: 'vip' })]).errors);
check('gatherings: duplicate ids refused', !!gv([g(), g()]).errors);
check('gatherings: bad id refused', !!gv([g({ id: 'a b!' })]).errors);
check('gatherings: too many refused', !!gv(Array.from({ length: 81 }, (_, i) => g({ id: 'x' + i }))).errors);
check('gatherings: extra fields dropped', !('evil' in gv([g({ evil: '<script>' })]).value.items[0]));
check('gatherings: control characters removed', gv([g({ city: 'Ba\u0000th‮' })]).value.items[0].city === 'Bath');
check('gatherings: errors carry the question', gv([g({ city: '' })]).errors[0].field === 'Which town or city?');
check('gatherings: errors say where', gv([g({ city: '' })]).errors[0].path === 'items[0].city');
check('gatherings: published copy is never a placeholder', gv([g()]).value.placeholder === false);

const pv = (o) => validateDoc('photos', { ...seed('photos'), ...o });
check('photos: media reference accepted', !pv({ aboutPhoto: '/media/0123456789abcdef0123456789abcdef' }).errors);
check('photos: data URL refused', !!pv({ aboutPhoto: 'data:image/png;base64,AAAA' }).errors);
check('photos: outside path refused', !!pv({ aboutPhoto: 'https://evil.example/x.png' }).errors);
check('photos: traversal refused', !!pv({ aboutPhoto: 'assets/../secret.png' }).errors);
check('photos: picture description needed', !!pv({ aboutPhotoAlt: '' }).errors);

const cv = (o) => validateDoc('contact', { ...seed('contact'), ...o });
check('contact: good email accepted', !cv({ contactEmail: 'emma@example.com' }).errors);
check('contact: mail header tricks refused', !!cv({ contactEmail: 'a@b.co?bcc=x@y.zz' }).errors);
check('contact: spaces refused', !!cv({ contactEmail: 'a b@c.co' }).errors);
check('contact: empty email allowed', !cv({ contactEmail: '' }).errors);

const av = (o) => validateDoc('album', { ...seed('album'), ...o });
check('album: title needed', !!av({ title: '' }).errors);
check('album: too many songs refused', !!av({ tracks: Array.from({ length: 25 }, (_, i) => 'Song ' + i) }).errors);
check('album: empty song lines dropped', av({ tracks: ['A', '', '  ', 'B'] }).value.tracks.join() === 'A,B');
check('album: long description refused', !!av({ description: 'x'.repeat(601) }).errors);

const sv = (items, o = {}) => validateDoc('shop', { ...seed('shop'), items, ...o });
const si = (o = {}) => ({ id: 's1', name: 'Hoodie', note: '', price: '£40', status: 'available', buyUrl: '', image: '', look: 'tee', ...o });
check('shop: item passes', !sv([si()]).errors);
check('shop: more than 12 refused', !!sv(Array.from({ length: 13 }, (_, i) => si({ id: 's' + i }))).errors);
check('shop: sold out clears buy link', sv([si({ status: 'soldout', buyUrl: 'https://x.example/y' })]).value.items[0].buyUrl === '');
check('shop: bad look refused', !!sv([si({ look: 'hat' })]).errors);
check('shop: whole-shop link checked', !!sv([si()], { allUrl: 'not a link' }).errors);

const fv = validateFields(fieldsOf(DOCS.gatherings), { date: '', city: '', status: 'tickets' });
check('single item check lists every problem', fv.errors.length >= 3, JSON.stringify(fv.errors.map((e) => e.path)));
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
