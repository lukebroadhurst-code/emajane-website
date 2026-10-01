/* Practice mode: how someone uses the admin on the staging site, where everything stays in the browser. */
import { PRACTICE, group, expect, same, chooseDate, giveFile, nextYear, put, yes, notice, done, sayYes, calmTest, addGathering } from './lib.mjs';

const ADMIN = PRACTICE + '/admin/';
const longDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '');
const closeForms = async (page) => { const b = page.getByRole('button', { name: 'Not now' }); if (await b.count()) await b.first().click(); };
async function openPast(page) {
  const closed = page.locator('details.past:not([open]) summary');
  if (await closed.count()) await closed.click();
}

export async function run(ctx) {
  group('Practice mode: the first page');
  const browser = await ctx.context();
  const admin = await ctx.page(browser);
  const site = await ctx.page(browser);
  const test = calmTest(admin);

  await test(ctx, 'six big boxes, a practice notice, nothing waiting', async () => {
    await admin.goto(ADMIN);
    await admin.getByRole('heading', { name: 'What would you like to change?' }).waitFor();
    same(await admin.locator('.tile').count(), 6, 'tiles');
    expect(await admin.getByText('This is a practice copy').isVisible(), 'practice notice');
    expect(await admin.locator('.chip.waiting').count() === 0, 'nothing should be waiting at the start');
    same(admin.problems, [], 'no script problems');
  });

  await test(ctx, 'writing size changes everything and is remembered', async () => {
    await admin.getByRole('button', { name: 'Big', exact: true }).click();
    same(await admin.evaluate(() => getComputedStyle(document.documentElement).fontSize), '26px');
    await admin.getByRole('button', { name: 'Biggest', exact: true }).click();
    same(await admin.evaluate(() => getComputedStyle(document.documentElement).fontSize), '30px');
    await admin.reload(); await admin.locator('h1').waitFor();
    same(await admin.evaluate(() => document.documentElement.dataset.size), 'bigger', 'remembered after a reload');
    await admin.getByRole('button', { name: 'Normal', exact: true }).click();
  });

  await test(ctx, 'help opens, can be closed with the keyboard, and focus returns', async () => {
    const helpBtn = admin.getByRole('button', { name: 'Need help?' });
    await helpBtn.click();
    expect(await admin.getByRole('dialog').getByRole('heading', { name: 'How this works' }).isVisible());
    same(await admin.getByRole('dialog').locator('li').count(), 4, 'four steps');
    const order = await admin.getByRole('dialog').locator('.dbody > *').evaluateAll((els) => els.map((e) => e.tagName + ':' + e.textContent.trim().slice(0, 24)));
    expect(/You cannot break/.test(order[1]) || /You cannot break/.test(order[2]), 'the reassurance comes before the steps: ' + order.join(' | '));
    expect(order.findIndex((x) => /^OL/.test(x)) > order.findIndex((x) => /You cannot break/.test(x)), 'the steps follow it');
    await admin.keyboard.press('Escape');
    expect(await admin.getByRole('dialog').count() === 0, 'closed');
    expect(await helpBtn.evaluate((el) => el === document.activeElement), 'focus back on the help button');
  });

  group('Practice mode: gatherings');
  await test(ctx, 'asking for nothing shows kind, plain messages', async () => {
    await admin.goto(ADMIN + '#/gatherings');
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    await admin.getByRole('button', { name: 'Add to my list' }).click();
    const text = await admin.locator('form.item').innerText();
    expect(/Please choose the day, the month and the year/.test(text), 'date message: ' + text);
    expect(/Please write something in this box/.test(text), 'city message');
    expect(/Please paste the web address of the ticket page/.test(text), 'ticket message');
    expect(await admin.locator('#notices .notice').isVisible(), 'a summary message is shown');
    expect(await admin.getByLabel('Day', { exact: true }).evaluate((el) => el === document.activeElement), 'focus goes to the first problem');
  });

  await test(ctx, 'a day that does not exist is explained, not accepted', async () => {
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    await chooseDate(admin, { day: 31, month: 2, year: nextYear });
    expect(/not on the calendar/.test(await admin.locator('.readout').innerText()), 'readout explains');
    await admin.getByLabel('Which town or city?').fill('Nowhere');
    await admin.getByLabel('No, it is sold out').check();
    await admin.getByRole('button', { name: 'Add to my list' }).click();
    expect(/Please choose the day/.test(await admin.locator('form.item').innerText()), 'still blocked');
  });

  await test(ctx, 'choosing "sold out" hides the ticket link question', async () => {
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    await admin.getByLabel('No, it is sold out').check();
    expect(!(await admin.getByLabel('Web address of the ticket page').isVisible()), 'ticket link hidden');
    await admin.getByLabel('Yes, people can buy tickets').check();
    expect(await admin.getByLabel('Web address of the ticket page').isVisible(), 'ticket link back');
    await admin.getByRole('button', { name: 'Not now' }).click();
    expect(await admin.locator('form.item').count() === 0, 'form closed');
  });

  await test(ctx, 'a link that is not a web address is pointed out as you leave the box', async () => {
    await closeForms(admin);
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    const box = admin.getByLabel('Web address of the ticket page');
    await box.fill('not a link'); await box.blur();
    expect(/does not look like a web address/.test(await admin.locator('.field.bad').first().innerText()), 'message');
    await admin.getByRole('button', { name: 'Not now' }).click();
  });

  await test(ctx, 'a new date starts on this year, and a day that has already gone means next year', async () => {
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    const thisYear = new Date().getFullYear();
    const year = admin.getByLabel('Year', { exact: true });
    same(await year.inputValue(), String(thisYear), 'starts on this year');
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    await admin.getByLabel('Day', { exact: true }).selectOption(String(yesterday.getDate()));
    await admin.getByLabel('Month', { exact: true }).selectOption(String(yesterday.getMonth() + 1));
    same(await year.inputValue(), String(yesterday.getFullYear() === thisYear ? thisYear + 1 : thisYear), 'a day that has gone means next year');
    expect(new RegExp(String(yesterday.getFullYear() === thisYear ? thisYear + 1 : thisYear)).test(await admin.locator('.readout').innerText()), 'the date in words shows the year chosen');
    const soon = new Date(); soon.setDate(soon.getDate() + 40);
    await admin.getByLabel('Day', { exact: true }).selectOption(String(soon.getDate()));
    await admin.getByLabel('Month', { exact: true }).selectOption(String(soon.getMonth() + 1));
    same(await year.inputValue(), String(soon.getFullYear()), 'a day coming up gets its own year, not the one chosen before');
    await year.selectOption(String(thisYear + 2));
    await admin.getByLabel('Month', { exact: true }).selectOption('3');
    same(await year.inputValue(), String(thisYear + 2), 'once she chooses a year herself, we leave it alone');
    await admin.getByRole('button', { name: 'Not now' }).click();
  });

  await test(ctx, 'the ticket question is not marked "if you like", and the link buttons are explained', async () => {
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    same(/if you like/.test(await admin.locator('legend', { hasText: 'Are there tickets?' }).innerText()), false, 'a choice that always has an answer is not "if you like"');
    same(await admin.locator('.tag.needed').first().evaluate((el) => getComputedStyle(el).fontWeight), '700', '"needed" is bold so it stands out');
    expect(await admin.getByText('Your writing here stays safe.').isVisible(), 'the link buttons are explained in words she can see');
    await admin.getByRole('button', { name: 'Not now' }).click();
  });

  await test(ctx, '"Take off" stands apart from "Change"', async () => {
    const change = await admin.getByRole('button', { name: 'Change: Bristol' }).boundingBox();
    const off = await admin.getByRole('button', { name: 'Take off: Bristol' }).boundingBox();
    expect(off.x - (change.x + change.width) > 150, 'a wide gap between them: ' + Math.round(off.x - (change.x + change.width)));
  });

  await test(ctx, 'adding a gathering: written in words, saved, not on the website yet', async () => {
    await addGathering(admin, { city: 'Brighton', venue: 'Concorde 2' });
    const msg = await notice(admin).innerText();
    expect(/Added to your list/.test(msg) && /not on your website yet/i.test(msg), 'the message says it is added, and not live yet: ' + msg);
    expect(await notice(admin).getByRole('button', { name: 'Put it on my website' }).isVisible(), 'the next step is a button inside the message');
    expect(/not on your website yet/i.test(await admin.locator('.panel').first().innerText()), 'panel says waiting');
    const panel = await admin.locator('.panel').first().boundingBox();
    expect(panel.y + panel.height < 900, 'the panel with the big buttons is on the first screen, not below it: ' + Math.round(panel.y + panel.height));
    const card = admin.locator('.card', { hasText: 'Brighton' });
    expect(await card.isVisible(), 'the new card');
    expect((await card.innerText()).includes(longDate(`${nextYear}-11-12`)), 'date in words: ' + await card.innerText());
    same(admin.problems, [], 'no script problems');
  });

  await test(ctx, 'nothing has reached the website yet, but "see how it looks" shows it', async () => {
    await site.goto(PRACTICE + '/'); await site.locator('.dates li').first().waitFor();
    expect(!(await site.locator('.dates').innerText()).includes('Brighton'), 'not on the real page');
    await admin.getByRole('button', { name: 'See how it looks' }).first().click();
    const frame = admin.frameLocator('dialog.look iframe');
    await frame.locator('.dates li', { hasText: 'Brighton' }).waitFor();
    expect(await admin.getByRole('dialog').getByRole('button', { name: 'Close this look' }).isVisible());
    await admin.keyboard.press('Escape');
    expect(await admin.getByRole('dialog').count() === 0, 'preview closed');
  });

  await test(ctx, 'putting it on the website: you see exactly what will change, then say yes', async () => {
    await put(admin).click();
    const dlg = admin.getByRole('dialog');
    expect(await dlg.getByRole('heading', { name: 'Put these changes on your website?' }).isVisible());
    const text = await dlg.innerText();
    expect(text.includes('New: Brighton, ' + longDate(`${nextYear}-11-12`)), 'what will change is listed: ' + text);
    expect(text.includes('Concorde 2') && text.includes('Tickets for sale') && text.includes('example.com/tickets'), 'the place and the ticket link can be checked before saying yes: ' + text);
    expect(/only a practice/i.test(text), 'practice is explained');
    await sayYes(admin);
    await done(admin).waitFor();
    expect(/all up to date|Nothing is waiting/i.test(await admin.locator('.panel').first().innerText()), 'back to calm');
  });

  await test(ctx, 'the website now shows it, and says it is showing practice edits', async () => {
    await site.reload(); await site.locator('.dates li', { hasText: 'Brighton' }).waitFor();
    expect(await site.locator('#emajane-badge').isVisible(), 'practice label on the page');
    expect((await site.locator('.dates li', { hasText: 'Brighton' }).innerText()).includes('Concorde 2'));
  });

  await test(ctx, 'undo puts the first version back', async () => {
    await notice(admin).getByRole('button', { name: 'Undo what I just did' }).click();
    const dlg = admin.getByRole('dialog');
    expect(await dlg.getByRole('heading', { name: 'Undo your last change?' }).isVisible());
    await sayYes(admin);
    await notice(admin).getByText('back to how it was before').waitFor();
    await site.reload(); await site.locator('.dates li').first().waitFor();
    expect(!(await site.locator('.dates').innerText()).includes('Brighton'), 'Brighton gone again');
  });

  await test(ctx, 'a day that has already gone is allowed but explained', async () => {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (y.getFullYear() !== new Date().getFullYear()) return;   // on 1 January there is no earlier day in this year to choose
    await addGathering(admin, { city: 'Oldtown', year: y.getFullYear(), month: y.getMonth() + 1, day: y.getDate() });
    expect(/already gone/.test(await notice(admin).innerText()), 'warning shown');
    expect(await admin.locator('details.past[open] .card', { hasText: 'Oldtown' }).isVisible(), 'shown under days that have gone');
  });

  await test(ctx, 'taking something off asks first, defaults to "keep it", and can be put back', async () => {
    await openPast(admin);
    await admin.getByRole('button', { name: 'Take off: Oldtown' }).click();
    const dlg = admin.getByRole('dialog');
    expect(await dlg.getByRole('button', { name: 'No, keep it' }).evaluate((el) => el === document.activeElement), 'focus starts on the safe answer');
    same(await dlg.getByRole('button').evaluateAll((bs) => bs.map((b) => b.textContent.trim() + (b.classList.contains('primary') ? ' (dark)' : ''))), ['No, keep it (dark)', 'Yes, take it off'], 'the careful answer is first and dark');
    await admin.keyboard.press('Escape');
    expect(await admin.locator('.card', { hasText: 'Oldtown' }).count() === 1, 'Escape keeps it');
    await admin.getByRole('button', { name: 'Take off: Oldtown' }).click();
    await sayYes(admin);
    await admin.locator('.card', { hasText: 'Oldtown' }).waitFor({ state: 'detached' });
    expect(/still on your website/.test(await notice(admin).innerText()), 'it says the website still has it: ' + await notice(admin).innerText());
    await notice(admin).getByRole('button', { name: 'Put it back' }).click();
    await notice(admin).getByText('“Oldtown” is back on your list.').waitFor();
    expect(/Nothing has changed on your website/.test(await notice(admin).innerText()), 'and that the website is untouched');
    await openPast(admin);
    await admin.locator('.card', { hasText: 'Oldtown' }).waitFor();
  });

  await test(ctx, 'changes are saved as you go: leave, come back, they are still there', async () => {
    await admin.goto(ADMIN); await admin.locator('.tile').first().waitFor();
    expect(await admin.locator('.chip.waiting').count() === 1, 'one box says changes waiting');
    expect(/changes waiting/i.test(await admin.locator('.notice').first().innerText()), 'a note on the first page');
    await admin.getByRole('link', { name: /Gatherings/ }).click();
    await admin.locator('details.past').waitFor();
    await openPast(admin);
    await admin.locator('.card', { hasText: 'Oldtown' }).waitFor();
    expect(/Welcome back/.test(await notice(admin).innerText()), 'welcome back message');
  });

  await test(ctx, 'throwing changes away asks first, then everything is as it was', async () => {
    await admin.getByRole('button', { name: 'Throw away my changes' }).click();
    await sayYes(admin);
    await notice(admin).getByText('Your changes are thrown away.').waitFor();
    expect(await admin.locator('.card', { hasText: 'Oldtown' }).count() === 0, 'gone');
    same(await admin.locator('.card').count(), 4, 'the four first gatherings');
  });

  group('Practice mode: the album');
  await test(ctx, 'changing the title, and the songs by keyboard (Enter adds a line)', async () => {
    await admin.goto(ADMIN + '#/album'); await admin.getByLabel('What is the album called?').waitFor();
    const title = admin.getByLabel('What is the album called?');
    await title.fill('Part Two Rising');
    const last = admin.getByRole('textbox', { name: 'The songs, in order, number 8' });
    await last.focus(); await admin.keyboard.press('Enter');
    await admin.keyboard.type('A brand new song');
    same(await admin.getByRole('textbox', { name: /The songs, in order, number/ }).count(), 9, 'nine songs');
    await admin.getByRole('button', { name: 'Move up: The songs, in order, number 9' }).click();
    expect((await admin.getByRole('textbox', { name: 'The songs, in order, number 8' }).inputValue()) === 'A brand new song', 'moved up');
    await admin.getByRole('button', { name: 'Take away: The songs, in order, number 1' }).click();
    same(await admin.getByRole('textbox', { name: /The songs, in order, number/ }).count(), 8, 'one taken away');
  });

  await test(ctx, 'the question never hides its list behind the answers, even on a short screen', async () => {
    const look = () => admin.evaluate(() => {
      const d = document.querySelector('dialog'), body = d.querySelector('.dbody'), ans = d.querySelector('.row.answers');
      const r = (e) => e.getBoundingClientRect(); const lis = [...d.querySelectorAll('li')];
      return { dBottom: r(d).bottom, bodyBottom: r(body).bottom, ansTop: r(ans).top, ansBottom: r(ans).bottom, scrolls: body.scrollHeight > body.clientHeight + 1, vh: innerHeight, lis: lis.length, lastBottom: r(lis[lis.length - 1]).bottom, firstBottom: r(lis[0]).bottom };
    });
    await put(admin).click(); await admin.getByRole('dialog').waitFor();
    let g = await look();
    expect(g.ansTop >= g.bodyBottom - 1 && g.ansBottom <= g.dBottom + 1, 'the answers sit under the words: ' + JSON.stringify(g));
    expect(g.lastBottom <= g.ansTop + 1, 'on a tall screen every line of the list is above the answers: ' + JSON.stringify(g));
    expect(g.dBottom - g.ansBottom <= 4, 'no empty band under the buttons: ' + (g.dBottom - g.ansBottom));
    same(await admin.locator('dialog .scrollhint').isVisible(), false, 'no "more to read" note when everything fits');
    await admin.keyboard.press('Escape'); await admin.locator('dialog').waitFor({ state: 'detached' });
    await admin.setViewportSize({ width: 1100, height: 430 });
    await put(admin).click(); await admin.getByRole('dialog').waitFor();
    g = await look();
    expect(g.scrolls, 'on a short screen the words scroll inside the question: ' + JSON.stringify(g));
    expect(await admin.locator('dialog .scrollhint').isVisible(), 'a note says there is more to read');
    expect(g.ansBottom <= g.vh && g.ansTop >= g.bodyBottom - 1, 'both answers stay on the screen: ' + JSON.stringify(g));
    await admin.keyboard.press('Shift+Tab');                                   // from the first answer, back into the words
    expect(await admin.evaluate(() => document.activeElement.classList.contains('dbody')), 'the words can be reached with the keyboard');
    await admin.keyboard.press('ArrowDown'); await admin.keyboard.press('ArrowDown'); await admin.keyboard.press('PageDown');
    await admin.waitForTimeout(500);                                           // the browser scrolls with a short glide
    expect(await admin.evaluate(() => document.querySelector('dialog .dbody').scrollTop) > 0, 'and scrolled with the keyboard alone: ' + await admin.evaluate(() => document.querySelector('dialog .dbody').scrollTop));
    await admin.evaluate(() => { const b = document.querySelector('dialog .dbody'); b.scrollTop = b.scrollHeight; });
    g = await look();
    expect(g.lastBottom <= g.ansTop + 1, 'the last line can be read after scrolling: ' + JSON.stringify(g));
    await admin.keyboard.press('Escape'); await admin.locator('dialog').waitFor({ state: 'detached' });
    await admin.setViewportSize({ width: 1100, height: 900 });
  });

  await test(ctx, 'the summary names each thing that changed, in her words', async () => {
    await put(admin).click();
    const text = await admin.getByRole('dialog').innerText();
    expect(text.includes('Changed: What is the album called?') && text.includes('Changed: The songs, in order'), text);
    expect(text.includes('Now it says “Part Two Rising”.'), 'the new words are shown so they can be checked: ' + text);
    expect(text.includes('Now there are 8.'), 'the number of songs is shown: ' + text);
    await sayYes(admin); await done(admin).waitFor();
  });

  await test(ctx, 'the website shows the new title (capitals), songs and order', async () => {
    await site.goto(PRACTICE + '/'); await site.locator('h1').waitFor();
    same(await site.locator('h1').innerText(), 'PART TWO RISING', 'hero title');
    const tracks = await site.locator('[data-tracks] li').allInnerTexts();
    same(tracks.length, 8); same(tracks[6], 'A brand new song', 'moved up to 7th: ' + tracks.join());
    same(tracks[0], 'Time', '"In" was taken away');
  });

  group('Practice mode: words, contact, shop');
  await test(ctx, 'words: a line break is kept on the website', async () => {
    await admin.goto(ADMIN + '#/words'); await admin.getByLabel('Your message').waitFor();
    await admin.getByLabel('Your message').fill('First line.\nSecond line.');
    await put(admin).click(); await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('blockquote').waitFor();
    expect((await site.locator('blockquote').evaluate((el) => el.innerText)).includes('First line.\nSecond line.'), 'two lines');
  });

  await test(ctx, 'contact: a wrong email is pointed out; a right one shows Contact and Bookings', async () => {
    await admin.goto(ADMIN + '#/contact'); await admin.getByLabel('Your email address for messages').waitFor();
    const box = admin.getByLabel('Your email address for messages');
    await box.fill('emma at example'); await box.blur();
    expect(/does not look like an email address/.test(await admin.locator('.field.bad').innerText()));
    await box.fill('emma@example.com'); await box.blur();
    expect(await admin.locator('.field.bad').count() === 0, 'error clears');
    await admin.getByLabel('Your email address for bookings').fill('book@example.com');
    await put(admin).click(); await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('.foot').waitFor();
    const links = await site.locator('.foot li:not([hidden])').allInnerTexts();
    expect(links.map((x) => x.trim()).join().includes('BOOKINGS') && links.map((x) => x.trim()).join().includes('CONTACT'), links.join());
    expect((await site.locator('[data-mail="contactEmail"]').getAttribute('href')) === 'mailto:emma@example.com');
    expect((await site.locator('[data-nav-contact]').getAttribute('href')) === 'mailto:emma@example.com');
  });

  await test(ctx, 'contact: leaving Instagram empty removes its place in the footer, not just the words', async () => {
    await admin.goto(ADMIN + '#/contact'); await admin.getByLabel('Your Instagram page').waitFor();
    await admin.getByLabel('Your Instagram page').fill('');
    await put(admin).click(); await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('.foot').waitFor();
    same(await site.locator('.foot .social li:not([hidden])').count(), 1, 'only YouTube is left in the row');
    same((await site.locator('.foot .social li:not([hidden]) a').innerText()).toLowerCase(), 'youtube');
    await admin.goto(ADMIN + '#/contact'); await admin.getByLabel('Your Instagram page').waitFor();
    await admin.getByLabel('Your Instagram page').fill('https://www.instagram.com/emajane.music/');
    await put(admin).click(); await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('.foot').waitFor();
    same(await site.locator('.foot .social li:not([hidden])').count(), 2, 'both come back when it is filled in');
  });

  await test(ctx, 'shop: add an item that is sold out and move it to the top', async () => {
    await admin.goto(ADMIN + '#/shop'); await admin.getByRole('button', { name: 'Add something to sell' }).waitFor();
    await admin.getByRole('button', { name: 'Add something to sell' }).click();
    await admin.getByLabel('What is it called?').fill('Hoodie');
    await admin.getByLabel('How much is it?').fill('£40');
    await admin.getByLabel('No, it is sold out').check();
    expect(!(await admin.getByLabel('Where do people buy it?').isVisible()), 'buy link hidden when sold out');
    await admin.getByLabel('A T-shirt').check();
    await admin.getByRole('button', { name: 'Add to my list' }).click();
    for (let i = 0; i < 3; i++) await admin.getByRole('button', { name: 'Move up: Hoodie' }).click();
    same(await admin.locator('.card h3').first().innerText(), 'Hoodie', 'first in the list');
    await put(admin).click();
    expect((await admin.getByRole('dialog').innerText()).includes('The order has changed') || (await admin.getByRole('dialog').innerText()).includes('New: Hoodie'));
    await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('[data-shop] .good').first().waitFor();
    const first = await site.locator('[data-shop] .good').first().innerText();
    expect(first.includes('Hoodie') && first.includes('£40') && /sold out/i.test(first), first);
  });

  group('Practice mode: pictures');
  await test(ctx, 'a big photo is made the right size, shown, and put on the website', async () => {
    await admin.goto(ADMIN + '#/photos'); await admin.getByRole('button', { name: 'Choose a new picture' }).first().waitFor();
    await giveFile(admin, '#g2-aboutPhoto-file', { width: 4000, height: 3000, name: 'holiday.jpg' });
    await admin.getByText('The picture is ready').waitFor();
    const dims = await admin.locator('.pic img').nth(2).evaluate((img) => new Promise((res) => { const done = () => res([img.naturalWidth, img.naturalHeight]); img.complete ? done() : (img.onload = done); }));
    expect(Math.max(...dims) <= 2000 && Math.max(...dims) > 1000, 'resized to fit: ' + dims);
    expect(await admin.getByRole('button', { name: 'Use the first picture' }).isVisible(), 'a way back to the first picture');
    await put(admin).click(); await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('.earth-img[src^="data:image"]').waitFor();
    const src = await site.locator('.earth-img').getAttribute('src');
    expect(src.startsWith('data:image/jpeg'), 'the photo on the website is the new one: ' + src.slice(0, 30));
  });

  await test(ctx, 'a file that is not a usable picture gets a kind message, nothing breaks', async () => {
    await admin.goto(ADMIN + '#/photos'); await admin.getByRole('button', { name: 'Choose a new picture' }).first().waitFor();
    await giveFile(admin, '#g1-albumCover-file', { type: 'image/gif', name: 'funny.gif', width: 50, height: 50 });
    await admin.getByText('That file cannot be used as a picture.').waitFor();
  });

  await test(ctx, '"use the first picture" brings the original back', async () => {
    await admin.getByRole('button', { name: 'Use the first picture' }).click();
    expect(await admin.locator('.pic img').nth(2).getAttribute('src') === '../assets/photo-leaves.jpg', 'original');
    await admin.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(admin);
    await notice(admin).getByText('Your changes are thrown away.').waitFor();
  });

  group('Practice mode: starting again and clearing');
  await test(ctx, 'use the original words again', async () => {
    await admin.goto(ADMIN + '#/album'); await admin.getByLabel('What is the album called?').waitFor();
    expect(await admin.getByText('Replace the writing here with the words my website began with.').isVisible(), 'each button at the foot says what it does');
    await admin.getByRole('button', { name: 'Use the original words again' }).click();
    await sayYes(admin);
    await notice(admin).getByText('The original words are back').waitFor();
    same(await admin.getByLabel('What is the album called?').inputValue(), 'Time Will Tell a Vision');
    same(await admin.getByRole('textbox', { name: /The songs, in order, number/ }).count(), 8);
    expect(/not on your website yet/i.test(await admin.locator('.panel').first().innerText()), 'still waiting until put live');
  });

  await test(ctx, 'clearing the practice removes everything', async () => {
    await admin.goto(ADMIN); await admin.getByRole('button', { name: 'Clear my practice' }).click();
    await sayYes(admin);
    await notice(admin).getByText('Your practice is cleared.').waitFor();
    same(await admin.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('emajane-') && k !== 'emajane-size')), [], 'nothing left in the browser');
    await site.goto(PRACTICE + '/'); await site.locator('h1').waitFor();
    same(await site.locator('h1').innerText(), 'TIME WILL TELL A VISION', 'website back to the first version');
  });

  group('Practice mode: moving away while a question is open');
  await test(ctx, 'the browser Back button closes an open question and answers "no"', async () => {
    await admin.goto(ADMIN); await admin.getByRole('link', { name: /The album/ }).click();
    await admin.getByLabel('What is the album called?').fill('Temporary title');
    await admin.getByRole('button', { name: 'Throw away my changes' }).click();
    expect(await admin.getByRole('dialog').isVisible(), 'the question is showing');
    await admin.goBack();
    await admin.getByRole('heading', { name: 'What would you like to change?' }).waitFor();
    await admin.locator('dialog').waitFor({ state: 'detached' });
    same(await admin.locator('dialog[open]').count(), 0, 'no question left behind');
    same(await notice(admin).count(), 0, 'nothing was thrown away, so nothing is announced');
    await admin.goForward(); await admin.getByLabel('What is the album called?').waitFor();
    same(await admin.getByLabel('What is the album called?').inputValue(), 'Temporary title', 'the changes are still there');
    await admin.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(admin);
    await notice(admin).getByText('Your changes are thrown away.').waitFor();
  });

  await test(ctx, 'an answer that arrives after leaving the screen cannot repaint it', async () => {
    await admin.goto(ADMIN + '#/album'); await admin.getByLabel('What is the album called?').waitFor();
    await admin.getByLabel('What is the album called?').fill('Late answer');
    await admin.getByRole('button', { name: 'Throw away my changes' }).click();
    await admin.waitForTimeout(450);                    // "yes" is ignored in the first moment
    // answer "yes" and, in the same breath, move to another screen, so the answer arrives after the move
    await admin.evaluate(() => { [...document.querySelectorAll('dialog button')].find((b) => /^Yes/.test(b.textContent.trim())).click(); location.hash = '#/words'; });
    await admin.getByRole('heading', { name: 'My words' }).waitFor();
    await admin.waitForTimeout(400);
    same(await admin.locator('h1').innerText(), 'My words', 'still on the screen that was chosen');
    same(await notice(admin).count(), 0, 'no message from the screen that was left');
    await admin.goto(ADMIN + '#/album'); await admin.getByLabel('What is the album called?').waitFor();
    same(await admin.getByLabel('What is the album called?').inputValue() === 'Late answer', false, 'the answer was still carried out');
  });

  group('Practice mode: pressing twice by accident');
  await test(ctx, 'a "yes" in the first moment is ignored, so a double press cannot say yes by accident', async () => {
    await admin.goto(ADMIN + '#/album'); await admin.getByLabel('What is the album called?').waitFor();
    await admin.getByLabel('What is the album called?').fill('Double pressed');
    await put(admin).dblclick();                                          // the second press lands while the question is opening
    await admin.getByRole('dialog').waitFor();
    await admin.evaluate(() => document.querySelector('dialog .btn.primary').click());   // a "yes" in the first moment
    await admin.waitForTimeout(150);
    expect(await admin.getByRole('dialog').isVisible(), 'the question is still waiting for a real answer');
    same(await notice(admin).count(), 0, 'nothing was put on the website');
    await admin.waitForTimeout(450);
    await admin.getByRole('dialog').getByRole('button', { name: 'Not yet' }).click();
    await admin.locator('dialog').waitFor({ state: 'detached' });
    await admin.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(admin);
    await notice(admin).getByText('Your changes are thrown away.').waitFor();
  });

  group('Practice mode: nothing typed can break the website');
  await test(ctx, 'HTML typed into boxes is shown as plain letters and never runs', async () => {
    await admin.goto(ADMIN + '#/album'); await admin.getByLabel('What is the album called?').waitFor();
    const evil = '<img src=x onerror=window.__pwned=1>';
    await admin.getByLabel('What is the album called?').fill(evil);
    await admin.getByLabel('Tell people about the album').fill(evil + '<script>window.__pwned=2</script><a href="javascript:window.__pwned=3">x</a>');
    await put(admin).click(); await sayYes(admin); await done(admin).waitFor();
    await site.goto(PRACTICE + '/'); await site.locator('h1').waitFor();
    same(await site.evaluate(() => window.__pwned), undefined, 'no script ran on the website');
    expect((await site.locator('h1').innerText()).toLowerCase().includes('<img'), 'shown literally');
    same(await site.locator('h1 img, [data-bind="album.description"] img').count(), 0, 'no image element was made');
    same(await admin.evaluate(() => window.__pwned), undefined, 'no script ran in the admin');
    await admin.goto(ADMIN); await admin.getByRole('button', { name: 'Clear my practice' }).click(); await sayYes(admin);
  });

  group('Practice mode: only the keyboard');
  await test(ctx, 'a whole gathering can be added with the keyboard alone, and the focus ring is thick', async () => {
    await admin.goto(ADMIN + '#/gatherings'); await admin.getByRole('button', { name: 'Add a gathering' }).waitFor();
    await admin.getByRole('button', { name: 'Add a gathering' }).focus();
    const ring = await admin.evaluate(() => { const s = getComputedStyle(document.activeElement); return parseFloat(s.outlineWidth); });
    expect(ring >= 3, 'focus ring is ' + ring + 'px');
    await admin.keyboard.press('Enter');
    await admin.getByLabel('Day', { exact: true }).focus();
    await admin.keyboard.type('2');                       // day
    await admin.keyboard.press('Tab'); await admin.keyboard.type('Dec');   // month
    await admin.keyboard.press('Tab'); await admin.keyboard.type(String(nextYear));   // year
    await admin.keyboard.press('Tab'); await admin.keyboard.type('Keyboardville');
    await admin.keyboard.press('Tab'); await admin.keyboard.press('Tab'); // venue then the tickets choice
    await admin.keyboard.press('Tab'); await admin.keyboard.type('https://example.com/kv');
    await admin.keyboard.press('Enter'); // submits the form
    await admin.locator('.card', { hasText: 'Keyboardville' }).waitFor();
    expect(/Added to your list/.test(await notice(admin).innerText()));
  });

  await test(ctx, 'the "skip" link moves the keyboard without leaving the screen or losing what was typed', async () => {
    await admin.goto(ADMIN + '#/gatherings'); await admin.getByRole('button', { name: 'Add a gathering' }).waitFor();
    await admin.getByRole('button', { name: 'Add a gathering' }).click();
    await admin.getByLabel('Which town or city?').fill('Skipville');
    await admin.locator('.skip').focus(); await admin.keyboard.press('Enter');
    await admin.waitForTimeout(300);
    same(await admin.evaluate(() => location.hash), '#/gatherings', 'still on the same screen');
    same(await admin.evaluate(() => document.activeElement.id), 'main', 'the keyboard is in the main part of the page');
    same(await admin.getByLabel('Which town or city?').inputValue(), 'Skipville', 'what was typed is still there');
    await admin.getByRole('button', { name: 'Not now' }).click();
  });

  await browser.close();
}
