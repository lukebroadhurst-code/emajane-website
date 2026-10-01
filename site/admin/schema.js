/* EMAJANE content schema.

   The single description of everything Emma can change on her website.
   The admin uses it to build the questions she sees and to check her answers.
   The Worker uses the same file to check every save, so the two can never disagree.
   Plain JavaScript, no dependencies, runs in a browser and in a Worker.

   All the words in here are read by Emma (and maybe by a child or a grandparent),
   so they are short and plain. */

export const LIMITS = { imageBytes: 2 * 1024 * 1024, itemId: 40 };

/* "Which town or city? Please write something in this box."  or  "Web address of the page: Please paste it." */
export const problemLine = (e) => (e.field ? `${/[?.!:]$/.test(e.field) ? e.field : e.field + ':'} ${e.message}` : e.message);

/* ---- how a question is described ---------------------------------------------------------------- */
const text = (ask, o = {}) => ({ type: 'text', ask, max: 100, ...o });
const longtext = (ask, o = {}) => ({ type: 'longtext', ask, max: 600, rows: 5, ...o });
const url = (ask, o = {}) => ({ type: 'url', ask, ...o });
const email = (ask, o = {}) => ({ type: 'email', ask, ...o });
const date = (ask, o = {}) => ({ type: 'date', ask, required: true, ...o });
const choice = (ask, options, o = {}) => ({ type: 'choice', ask, options, ...o });
const textlist = (ask, o = {}) => ({ type: 'textlist', ask, max: 80, maxItems: 20, ...o });
const image = (ask, o = {}) => ({ type: 'image', ask, maxSize: 2000, format: 'jpeg', ...o });

/* ---- the sections of the website ---------------------------------------------------------------- */
export const DOCS = {
  gatherings: {
    label: 'Gatherings',
    blurb: 'Your concerts and gigs: the days and places you are playing.',
    lede: 'Add a day when you are playing. Take off a day that is not happening any more. Days that have gone are hidden from your website for you.',
    kind: 'list', max: 80, noun: 'gathering', anchor: 'live',
    fields: {
      date: date('When is it?'),
      city: text('Which town or city?', { max: 80, required: true }),
      venue: text('Which place is it at?', { max: 120, help: 'The name of the hall, church or theatre. You can leave this empty.' }),
      status: choice('Are there tickets?', [['tickets', 'Yes, people can buy tickets'], ['soldout', 'No, it is sold out'], ['free', 'It is free. No ticket is needed.']], { default: 'tickets' }),
      ticketUrl: url('Web address of the ticket page', {
        showIf: { status: ['tickets', 'free'] }, requiredIf: { status: ['tickets'] },
        requiredMessage: 'Please paste the web address of the ticket page. Or go back and choose “sold out” or “free”.',
        help: 'Open the ticket page on your computer. Copy the web address from the top of the screen. Paste it here.',
      }),
    },
  },

  album: {
    label: 'The album',
    blurb: 'Its name, the songs, and where people can listen.',
    lede: 'The name of your album, the songs, and where people listen or buy.',
    kind: 'form', anchor: 'music',
    groups: [
      { title: 'The top of your website', fields: {
        eyebrow: text('A few small words above the title', { max: 60, help: 'For example: Debut album · Part I · In' }),
        title: text('What is the album called?', { max: 60, required: true, help: 'It shows in big capital letters.' }),
        tagline: textlist('Small words under the buttons', { max: 60, maxItems: 4, addLabel: 'Add another part', help: 'Each part goes on its own line on a phone.' }),
      } },
      { title: 'The Listening Room', fields: {
        part: text('Which part is it?', { max: 40, help: 'For example: Part I — In' }),
        description: longtext('Tell people about the album', { max: 600, rows: 5 }),
        tracks: textlist('The songs, in order', { max: 80, maxItems: 24, addLabel: 'Add another song' }),
        exchangeNote: longtext('A note about giving something in return', { max: 300, rows: 3 }),
      } },
      { title: 'Where people listen and buy', fields: {
        listenUrl: url('Where can people listen?', { help: 'Paste the web address of the page. If you leave this empty, the lower Listen button is hidden and the top one scrolls down your page.' }),
        buyUrl: url('Where can people buy the album?', { help: 'Paste the web address of the page. If you leave this empty, the Buy buttons scroll down to your shop.' }),
      } },
    ],
  },

  words: {
    label: 'My words',
    blurb: 'Your message, your story and the words by the email box.',
    lede: 'The words on your website that are about you.',
    kind: 'form', anchor: 'about',
    groups: [
      { title: 'A word from you', fields: {
        quote: longtext('Your message', { max: 500, rows: 6, required: true }),
        quoteNote: text('A small line underneath', { max: 100 }),
      } },
      { title: 'About you', fields: {
        aboutHeading: text('Heading', { max: 100, required: true }),
        aboutText: longtext('Your story in a few lines', { max: 900, rows: 7 }),
        aboutLinkUrl: url('Is there a longer story online?', { help: 'Paste the web address. If you leave this empty, no link is shown.' }),
      } },
      { title: 'The email box', fields: {
        joinHeading: text('Heading above the email box', { max: 60, required: true }),
        joinText: longtext('Words above the email box', { max: 240, rows: 3 }),
        joinNote: text('A small line under the box', { max: 100 }),
      } },
    ],
  },

  shop: {
    label: 'Shop',
    blurb: 'The things you sell.',
    lede: 'The records, CDs and clothes on your website. People buy them on your shop page, not here.',
    kind: 'list', max: 12, noun: 'item', anchor: 'shop',
    rootFields: {
      allUrl: url('Is there a page with everything you sell?', { help: 'Paste the web address. If you leave this empty, no link is shown.' }),
    },
    fields: {
      name: text('What is it called?', { max: 80, required: true }),
      note: text('A few more words about it', { max: 100, help: 'For example: 12″ vinyl, 180g' }),
      price: text('How much is it?', { max: 20, help: 'Write it just as you want it shown. For example: £30' }),
      status: choice('Is it in stock?', [['available', 'Yes, people can buy it'], ['soldout', 'No, it is sold out']], { default: 'available' }),
      buyUrl: url('Where do people buy it?', {
        showIf: { status: ['available'] },
        help: 'Paste the web address of the page where it is sold. If you leave this empty, it says “Coming soon”.',
      }),
      image: image('A photograph of it', { maxSize: 1400, optional: true, help: 'You can leave this empty. Then your website shows a simple drawing instead.' }),
      look: choice('No photograph? Pick a drawing.', [['vinyl', 'A record'], ['cd', 'A CD'], ['tee', 'A T-shirt']], { default: 'vinyl' }),
    },
  },

  photos: {
    label: 'Pictures',
    blurb: 'The photograph and artwork on your website.',
    lede: 'Change a picture on your website. The computer makes it the right size for you.',
    kind: 'form', anchor: 'top',
    groups: [
      { title: 'The artwork at the top of the page', fields: {
        heroArt: image('The artwork', { maxSize: 1400, format: 'png', default: 'assets/art-bone.png', help: 'This works best as a light picture on a see-through background.' }),
        heroArtAlt: text('Describe the artwork in a few words', { max: 140, required: true, help: 'This is read out loud to people who cannot see the picture.' }),
      } },
      { title: 'The album cover', fields: {
        albumCover: image('The album cover', { maxSize: 1400, default: 'assets/album-art.jpg' }),
        albumCoverAlt: text('Describe the cover in a few words', { max: 140, required: true, help: 'This is read out loud to people who cannot see the picture.' }),
      } },
      { title: 'The photograph about you', fields: {
        aboutPhoto: image('The photograph', { maxSize: 2000, default: 'assets/photo-leaves.jpg' }),
        aboutPhotoAlt: text('Describe the photograph in a few words', { max: 140, required: true, help: 'This is read out loud to people who cannot see the picture.' }),
      } },
    ],
  },

  contact: {
    label: 'How to reach me',
    blurb: 'Your email addresses and social media.',
    lede: 'Where people can write to you and find you online.',
    kind: 'form', anchor: 'contact',
    groups: [
      { title: 'Email', fields: {
        contactEmail: email('Your email address for messages', { help: 'People who press “Contact” write to this address. If you leave it empty, “Contact” is hidden.' }),
        bookingsEmail: email('Your email address for bookings', { help: 'People who press “Bookings” write to this address. If you leave it empty, “Bookings” is hidden.' }),
      } },
      { title: 'Social media', fields: {
        instagram: url('Your Instagram page', { help: 'Paste the web address. If you leave this empty, it is hidden.' }),
        youtube: url('Your YouTube page', { help: 'Paste the web address. If you leave this empty, it is hidden.' }),
      } },
      { title: 'The bottom of the page', fields: {
        credit: text('Thank someone at the bottom of the page', { max: 100, help: 'For example: Artwork by @name' }),
      } },
    ],
  },
};

export const ORDER = ['gatherings', 'album', 'words', 'shop', 'photos', 'contact'];

/* All the questions of a section in one object, whatever its shape. */
export function fieldsOf(spec) {
  if (spec.fields && !spec.groups) return spec.fields;
  return Object.assign({}, ...(spec.groups || []).map((g) => g.fields));
}

/* ---- checking answers --------------------------------------------------------------------------- */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const clean = (v) => String(v == null ? '' : v).replace(CONTROL, '');

export const matches = (obj, cond) => Object.entries(cond).every(([k, allowed]) => allowed.includes(obj && obj[k]));

const MSG = {
  required: 'Please write something in this box.',
  pick: 'Please choose one.',
  date: 'Please choose the day, the month and the year.',
  noDay: 'That day is not on the calendar. Please check the day and the month.',
  url: 'This does not look like a web address. A web address starts with https://',
  email: 'This does not look like an email address. It should look like name@example.com',
  image: 'This picture cannot be used. Please choose another picture.',
  tooLong: (max, n) => `This is too long. The most you can write here is ${max} letters. You have written ${n}.`,
  tooMany: (max) => `There are too many here. The most is ${max}.`,
};

const EMAIL = /^[A-Za-z0-9._+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const IMAGE_REF = /^(assets\/[\w.-]{1,80}\.(jpe?g|png|webp)|\/media\/[a-f0-9]{16,64})$/i;

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function checkUrl(s) {
  if (s.length > 500 || /\s/.test(s)) return false;
  let u;
  try { u = new URL(s); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.');
}

/* Check one set of answers. Returns { value, errors } where each error is { path, field, message }. */
export function validateFields(fields, input, base = '') {
  const errors = [];
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  for (const [key, f] of Object.entries(fields)) {
    const path = base ? `${base}.${key}` : key;
    const fail = (message) => errors.push({ path, field: f.ask, message });
    const raw = src[key];
    const known = { ...src, ...out };   // earlier answers (already cleaned) win over the raw ones
    const required = !!f.required || (f.requiredIf && matches(known, f.requiredIf));

    if (f.showIf && !matches(known, f.showIf)) { out[key] = f.type === 'textlist' ? [] : ''; continue; }

    switch (f.type) {
      case 'text': {
        const s = clean(raw).replace(/\s+/g, ' ').trim();
        if (!s && required) fail(f.requiredMessage || MSG.required);
        else if (s.length > f.max) fail(MSG.tooLong(f.max, s.length));
        out[key] = s; break;
      }
      case 'longtext': {
        const s = clean(raw).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        if (!s && required) fail(f.requiredMessage || MSG.required);
        else if (s.length > f.max) fail(MSG.tooLong(f.max, s.length));
        out[key] = s; break;
      }
      case 'url': {
        const s = clean(raw).trim();
        if (!s) { if (required) fail(f.requiredMessage || MSG.required); }
        else if (!checkUrl(s)) fail(MSG.url);
        out[key] = s; break;
      }
      case 'email': {
        const s = clean(raw).trim();
        if (!s) { if (required) fail(f.requiredMessage || MSG.required); }
        else if (s.length > 120 || !EMAIL.test(s)) fail(MSG.email);
        out[key] = s; break;
      }
      case 'date': {
        const s = clean(raw).trim();
        if (!s) { if (required) fail(MSG.date); }
        else if (!validDate(s)) fail(/^\d{4}-\d{2}-\d{2}$/.test(s) ? MSG.noDay : MSG.date);
        out[key] = s; break;
      }
      case 'choice': {
        const values = f.options.map((o) => o[0]);
        let s = clean(raw).trim();
        if (!s && f.default && raw === undefined) s = f.default;
        if (!values.includes(s)) { fail(MSG.pick); s = f.default || ''; }
        out[key] = s; break;
      }
      case 'textlist': {
        const arr = Array.isArray(raw) ? raw : [];
        const lines = arr.map((x) => clean(x).replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (lines.length > f.maxItems) fail(MSG.tooMany(f.maxItems));
        else if (lines.some((l) => l.length > f.max)) fail(MSG.tooLong(f.max, Math.max(...lines.map((l) => l.length))));
        else if (!lines.length && required) fail(f.requiredMessage || MSG.required);
        out[key] = lines.slice(0, f.maxItems); break;
      }
      case 'image': {
        const s = clean(raw).trim();
        if (!s) { if (required) fail(MSG.required); }
        else if (!IMAGE_REF.test(s)) fail(MSG.image);
        out[key] = s; break;
      }
      default: out[key] = '';
    }
  }
  return { value: out, errors };
}

/* Check a whole section. Returns { value } or { errors }. */
export function validateDoc(name, input) {
  const spec = DOCS[name];
  if (!spec) return { errors: [{ path: '', field: '', message: 'That part of the website does not exist.' }] };
  const errors = [];
  let value;

  if (spec.kind === 'list') {
    const items = input && Array.isArray(input.items) ? input.items : null;
    if (!items) return { errors: [{ path: 'items', field: spec.label, message: 'The list is missing.' }] };
    if (items.length > spec.max) errors.push({ path: 'items', field: spec.label, message: MSG.tooMany(spec.max) });
    const root = validateFields(spec.rootFields || {}, input, '');
    errors.push(...root.errors);
    const ids = new Set();
    const out = items.slice(0, spec.max).map((it, i) => {
      const r = validateFields(spec.fields, it, `items[${i}]`);
      errors.push(...r.errors);
      const id = clean(it && it.id).slice(0, LIMITS.itemId);
      if (!/^[\w-]+$/.test(id) || ids.has(id)) errors.push({ path: `items[${i}].id`, field: spec.label, message: 'Something went wrong with the list. Please refresh the page and try again.' });
      ids.add(id);
      return { id, ...r.value };
    });
    value = { ...root.value, items: out };
  } else {
    const r = validateFields(fieldsOf(spec), input, '');
    errors.push(...r.errors);
    value = r.value;
  }
  return errors.length ? { errors } : { value: { ...value, placeholder: false } };
}
