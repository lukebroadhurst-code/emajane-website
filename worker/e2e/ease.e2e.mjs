/* Ease of use: the things that decide whether a young child or an older person can use the admin.
   Every screen is measured at three writing sizes, on a computer, on a phone and on the narrowest screen.
   These are measurements of the page. They do not replace watching a real person use it. */
import { PRACTICE, group, expect, same, axe, put, sayYes, calmTest, giveFile } from './lib.mjs';

const ADMIN = PRACTICE + '/admin/';
const SIZES = ['normal', 'big', 'bigger'];
const VIEWPORTS = [
  { name: 'computer', width: 1100, height: 900 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'narrowest', width: 320, height: 640 },
];
const SCREENS = [
  ['first page', '#/', 'What would you like to change?'],
  ['gatherings', '#/gatherings', 'Gatherings'],
  ['album', '#/album', 'The album'],
  ['words', '#/words', 'My words'],
  ['shop', '#/shop', 'Shop'],
  ['pictures', '#/photos', 'Pictures'],
  ['contact', '#/contact', 'How to reach me'],
];

/* Runs inside the page and reports what is too small, too wide or cut off. */
function audit() {
  const shown = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    if (r.width <= 1 || r.height <= 1) return false;                         // the "only for screen readers" trick
    for (let p = el; p && p !== document.body; p = p.parentElement) { if (p.hidden || getComputedStyle(p).display === 'none') return false; }
    return true;
  };
  const name = (el) => String(el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.id || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 36);
  const out = { smallText: [], smallTargets: [], offscreen: [], clipped: [], sideScroll: false, headings: 0, ids: [] };

  /* writing smaller than 18 pixels */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || seen.has(el) || !n.nodeValue.trim() || /^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName) || !shown(el)) continue;
    seen.add(el);
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px < 18) out.smallText.push(name(el) + ' ' + px + 'px');
  }

  /* things to press or fill in, smaller than 44 by 44 */
  const targets = document.querySelectorAll('button, a[href], summary, select, textarea, input:not([type=hidden]):not([type=file])');
  targets.forEach((el) => {
    if (!shown(el)) return;
    let box = el;
    if (el.matches('input[type=checkbox], input[type=radio]')) box = (el.labels && el.labels[0]) || el;   // the whole label can be pressed
    const r = box.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) out.smallTargets.push(name(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    if ((r.left < -1 || r.right > innerWidth + 1) && !el.matches('.skip')) out.offscreen.push(name(el));   // the skip link waits off-screen until it is used
  });

  /* cut off or hidden by overflow */
  document.querySelectorAll('body *').forEach((el) => {
    if (!shown(el)) return;
    const cs = getComputedStyle(el);
    if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY) && el.textContent.trim() && !/^(HTML|BODY|DIALOG|IFRAME|SELECT|IMG)$/.test(el.tagName)) {
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) out.clipped.push(name(el));
    }
  });

  out.sideScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  out.headings = document.querySelectorAll('h1').length;
  const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
  out.ids = Object.keys(ids).filter((k) => ids[k] > 1);
  return out;
}

/* Collects every problem on a screen, then fails once with all of them. */
function collector() {
  const found = [];
  const c = (what, got, expected = []) => { if (JSON.stringify(got) !== JSON.stringify(expected)) found.push(`${what} ${JSON.stringify(Array.isArray(got) ? got.slice(0, 4) : got)}`); };
  c.done = () => { if (found.length) throw new Error(found.join('\n        ')); };
  return c;
}

const SPACING = `* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }`;   // the WCAG text-spacing test

export async function run(ctx) {
  const browser = await ctx.context();
  const page = await ctx.page(browser);
  const test = calmTest(page);
  await page.goto(ADMIN); await page.locator('h1').waitFor();

  const open = async (hash, heading) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.locator('h1', { hasText: heading }).waitFor();
    await page.waitForTimeout(120);
  };
  const setSize = async (size) => { await page.evaluate((s) => localStorage.setItem('emajane-size', s), size); await page.reload(); await page.locator('h1').waitFor(); };
  const setView = (vp) => page.setViewportSize({ width: vp.width, height: vp.height });

  /* ---- the main measurement: every screen, three sizes, three window widths ---- */
  for (const vp of VIEWPORTS) {
    for (const size of SIZES) {
      group(`Ease: ${vp.name} (${vp.width}px wide), writing size "${size}"`);
      await setView(vp); await setSize(size);
      for (const [label, hash, heading] of SCREENS) {
        await test(ctx, label, async () => {
          await open(hash, heading);
          const a = await page.evaluate(audit); const c = collector();
          c('text under 18px:', a.smallText); c('buttons or boxes under 44px:', a.smallTargets);
          c('things outside the window:', a.offscreen); c('words cut off:', a.clipped);
          c('the page needs sideways scrolling:', a.sideScroll, false);
          c('main headings (want exactly 1):', a.headings, 1); c('the same id used twice:', a.ids);
          c('accessibility problems:', await axe(page));
          c.done();
        });
      }
    }
  }

  /* ---- the screens that only appear sometimes ---- */
  for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
    group(`Ease: moments that come and go (${vp.name}, "bigger")`);
    await setView(vp); await setSize('bigger');

    await test(ctx, 'a form with problems pointed out', async () => {
      await open('#/gatherings', 'Gatherings');
      await page.getByRole('button', { name: 'Add a gathering' }).click();
      await page.getByRole('button', { name: 'Add to my list' }).click();
      await page.locator('.field.bad').first().waitFor();
      const a = await page.evaluate(audit); const c = collector();
      c('too small, outside or cut off:', [a.smallText, a.smallTargets, a.offscreen, a.clipped].flat()); c('sideways scrolling:', a.sideScroll, false);
      c('accessibility problems:', await axe(page)); c.done();
      const bad = await page.locator('.field.bad input, .field.bad select, .field.bad textarea').first().evaluate((el) => ({ invalid: el.getAttribute('aria-invalid'), described: !!el.getAttribute('aria-describedby') }));
      same(bad, { invalid: 'true', described: true }, 'a box with a problem tells a screen reader why');
      expect(/\S/.test(await page.locator('.field.bad .err, .field.bad [id$="-err"]').first().innerText().catch(() => 'x')), 'the problem is written in words, not just in colour');
      await page.getByRole('button', { name: 'Not now' }).click();
    });

    await test(ctx, 'the question before something goes on the website', async () => {
      await open('#/album', 'The album');
      await page.getByLabel('What is the album called?').fill('Measured title');
      await put(page).click();
      await page.getByRole('dialog').waitFor();
      const a = await page.evaluate(audit); const c = collector();
      c('too small, outside or cut off:', [a.smallText, a.smallTargets, a.offscreen, a.clipped].flat());
      c('accessibility problems:', await axe(page)); c.done();
      const buttons = await page.getByRole('dialog').getByRole('button').allInnerTexts();
      expect(buttons.length === 2, 'exactly two plain answers: ' + buttons.join(' | '));
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(page);
    });

    await test(ctx, 'the help window', async () => {
      await page.getByRole('button', { name: 'Need help?' }).click();
      await page.getByRole('dialog').waitFor();
      const a = await page.evaluate(audit); const c = collector();
      c('too small, outside or cut off:', [a.smallText, a.smallTargets, a.offscreen, a.clipped].flat());
      c('accessibility problems:', await axe(page)); c.done();
      await page.keyboard.press('Escape');
    });

    await test(ctx, 'a message after pressing a button', async () => {
      await open('#/album', 'The album');
      await page.getByLabel('What is the album called?').fill('Another measured title');
      await page.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(page);
      await page.locator('#notices .notice').waitFor();
      const a = await page.evaluate(audit); const c = collector();
      c('too small, outside or cut off:', [a.smallText, a.smallTargets, a.offscreen, a.clipped].flat());
      c('accessibility problems:', await axe(page)); c.done();
    });
  }

  /* ---- reading the page with the text spacing that some readers set for themselves ---- */
  group('Ease: readers who widen the spacing between letters, words and lines');
  await setView(VIEWPORTS[2]); await setSize('normal');
  for (const [label, hash, heading] of SCREENS) {
    await test(ctx, label, async () => {
      await open(hash, heading);
      await page.addStyleTag({ content: SPACING });
      const a = await page.evaluate(audit); const c = collector();
      c('words cut off:', a.clipped); c('sideways scrolling:', a.sideScroll, false);
      await page.reload(); await page.locator('h1').waitFor();
      c.done();
    });
  }

  /* ---- moving about with the keyboard ---- */
  group('Ease: keyboard, focus and time');
  await setView(VIEWPORTS[0]); await setSize('normal');
  await test(ctx, 'the first press of Tab offers a way past the top, and it works', async () => {
    await page.goto(ADMIN); await page.reload(); await page.locator('h1').waitFor();
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({ text: document.activeElement.textContent.trim(), visible: document.activeElement.getBoundingClientRect().top >= 0 }));
    expect(/skip|main|straight/i.test(first.text) && first.visible, 'a visible skip link comes first: ' + JSON.stringify(first));
    await page.keyboard.press('Enter');
    same(await page.evaluate(() => document.activeElement.id), 'main', 'focus moves to the main part of the page');
  });

  for (const [label, hash, heading] of [SCREENS[0], SCREENS[1], SCREENS[2]]) {
    await test(ctx, `${label}: every stop shows a thick ring and is never hidden behind something else`, async () => {
      await open(hash, heading);
      await page.getByRole('button', { name: 'Add a gathering' }).count().then(async (n) => { if (n) await page.getByRole('button', { name: 'Add a gathering' }).click(); });
      await page.locator('h1').focus();
      const problems = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const s = await page.evaluate(() => {
          const el = document.activeElement; if (!el || el === document.body) return null;
          el.scrollIntoView({ block: 'center' });
          const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20));
          const free = !top || el === top || el.contains(top) || top.contains(el) || (el.labels && [...el.labels].some((l) => l.contains(top)));
          return { what: (el.getAttribute('aria-label') || el.textContent || el.name || el.tagName).trim().slice(0, 30), ring: parseFloat(cs.outlineWidth), style: cs.outlineStyle, free };
        });
        if (!s) continue;
        if (!(s.ring >= 3 && s.style !== 'none')) problems.push(`${s.what}: ring ${s.ring}px ${s.style}`);
        if (!s.free) problems.push(`${s.what}: hidden behind something`);
      }
      same(problems.slice(0, 5), [], 'focus:');
    });
  }

  await test(ctx, 'messages stay until they are closed (nothing disappears while it is being read)', async () => {
    await open('#/album', 'The album');
    await page.getByLabel('What is the album called?').fill('Slow reader');
    await page.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(page);
    await page.locator('#notices .notice').waitFor();
    await page.waitForTimeout(9000);
    same(await page.locator('#notices .notice').count(), 1, 'still there after nine seconds');
  });

  await test(ctx, 'with animation switched off in the computer\'s settings, nothing moves', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open('#/gatherings', 'Gatherings');
    const moving = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => { const cs = getComputedStyle(el); return parseFloat(cs.animationDuration) > 0.05 || parseFloat(cs.transitionDuration) > 0.05; }).map((e) => e.className || e.tagName).slice(0, 5));
    same(moving, [], 'things that still move:');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });

  await test(ctx, 'the page says what language it is in and each screen has its own title', async () => {
    same(await page.evaluate(() => document.documentElement.lang), 'en-GB');
    const titles = [];
    for (const [, hash, heading] of SCREENS) { await open(hash, heading); titles.push(await page.title()); }
    same(new Set(titles).size, SCREENS.length, 'a different title on every screen: ' + titles.join(' / '));
  });

  await test(ctx, 'the writing-size buttons are the first thing at the top, and say what they do', async () => {
    await open('#/', 'What would you like to change?');
    const names = await page.locator('#tools button').allInnerTexts();
    expect(names.length >= 4, 'size buttons and help are there: ' + names.join(' | '));
    same(await page.locator('#tools [role=group]').getAttribute('aria-labelledby') !== null && (await page.locator('#sizes-label').innerText()).length > 0, true, 'the group has a name');
  });

  await page.setViewportSize({ width: 1100, height: 900 });
}
