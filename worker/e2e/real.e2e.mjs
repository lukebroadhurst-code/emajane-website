/* Real mode: the admin talking to the real back end (the Worker), as it will on Cloudflare.
   Three separate browsers stand for three people:
     A  Emma, using the admin          B  a second device (or person) using the admin
     V  a visitor to the website, who has never seen the admin                              */
import { REAL, group, expect, same, giveFile, nextYear, put, notice, done, sayYes, calmTest, addGathering } from './lib.mjs';

const ADMIN = REAL + '/admin/';
const LOGIN = 'https://emajane.cloudflareaccess.com/cdn-cgi/access/login/emajane.test';
const titleBox = (page) => page.getByLabel('What is the album called?');
const published = (page, name) => page.evaluate((n) => fetch('/api/content/' + n, { cache: 'reload' }).then((r) => (r.ok ? r.json() : null)), name);

export async function run(ctx) {
  const ctxA = await ctx.context();
  const ctxB = await ctx.context();
  const ctxV = await ctx.context();
  const A = await ctx.page(ctxA);
  const B = await ctx.page(ctxB);
  const V = await ctx.page(ctxV);
  const test = calmTest(A);
  const testB = calmTest(B);

  group('Real mode: the first page, before anything has been published');
  await test(ctx, 'it says who is signed in, and has none of the practice words', async () => {
    await A.goto(ADMIN);
    await A.getByRole('heading', { name: 'What would you like to change?' }).waitFor();
    await A.getByText('Signed in as local-test@emajane.local').waitFor();
    same(await A.getByText('This is a practice copy').count(), 0, 'no practice notice');
    same(await A.getByRole('button', { name: 'Clear my practice' }).count(), 0, 'no clear-practice button');
    same(await A.locator('.tile').count(), 6, 'six boxes');
    same(await A.locator('.chip.waiting').count(), 0, 'nothing waiting');
    same(A.problems, [], 'no script problems and no failed requests');
  });

  await test(ctx, 'the website shows its starting words, with no practice label', async () => {
    await V.goto(REAL + '/'); await V.locator('h1').waitFor();
    same(await V.locator('h1').innerText(), 'TIME WILL TELL A VISION');
    same(await V.locator('#emajane-badge').count(), 0, 'no practice label for visitors');
    same(await V.evaluate(() => fetch('/api/content').then((r) => r.json())), {}, 'nothing has been published yet');
    same(V.problems, [], 'no problems');
  });

  group('Real mode: publishing is for everyone');
  await test(ctx, 'a gathering put on the website is seen by a visitor in another browser', async () => {
    await A.goto(ADMIN + '#/gatherings'); await A.getByRole('button', { name: 'Add a gathering' }).waitFor();
    await addGathering(A, { city: 'Realtown', venue: 'The Hall', month: 11, day: 12 });
    await put(A).click();
    const ask = await A.getByRole('dialog').innerText();
    expect(/Everyone who visits your website will see them/.test(ask) && !/practice/i.test(ask), 'the question says everyone will see it: ' + ask.slice(0, 200));
    await sayYes(A); await done(A).waitFor();
    await V.goto(REAL + '/');
    const row = V.locator('.dates li', { hasText: 'Realtown' });
    await row.waitFor();
    expect((await row.innerText()).includes('The Hall'), 'venue shown');
    same(await V.locator('#emajane-badge').count(), 0, 'visitors never see a practice label');
  });

  await test(ctx, '"Look at my website" opens the real page and shows the change', async () => {
    const [popup] = await Promise.all([ctxA.waitForEvent('page'), notice(A).getByRole('button', { name: 'Look at my website' }).click()]);
    await popup.waitForLoadState();
    expect(popup.url().startsWith(REAL + '/'), 'opened the website: ' + popup.url());
    await popup.locator('.dates li', { hasText: 'Realtown' }).waitFor();
    await popup.close();
  });

  await test(ctx, 'the first page now says that part was changed, and nothing is waiting', async () => {
    await A.goto(ADMIN); await A.locator('.tile').first().waitFor();
    expect(/Last changed/.test(await A.locator('.tile', { hasText: 'Gatherings' }).innerText()), 'says when');
    same(await A.locator('.chip.waiting').count(), 0, 'nothing waiting');
  });

  group('Real mode: two people at once');
  await test(ctx, 'the second person to publish is warned, and loses nothing', async () => {
    await A.goto(ADMIN + '#/album'); await titleBox(A).waitFor();
    await B.goto(ADMIN + '#/album'); await titleBox(B).waitFor();            // B is now looking at the old version
    await titleBox(A).fill('Editor A');
    await put(A).click(); await sayYes(A); await done(A).waitFor();
    await titleBox(B).fill('Editor B');
    await put(B).click(); await sayYes(B);
    await notice(B).getByText('Someone else changed this part of your website').waitFor();
    expect(await notice(B).getByRole('button', { name: 'Refresh the page' }).isVisible(), 'a clear next step');
    same((await published(V, 'album')).title, 'Editor A', 'the first person\'s change was not overwritten');
  });

  await testB(ctx, 'after refreshing, their own words are still there, and they can go on', async () => {
    await notice(B).getByRole('button', { name: 'Refresh the page' }).click();
    await titleBox(B).waitFor();
    same(await titleBox(B).inputValue(), 'Editor B', 'their changes survived');
    await B.getByText('Welcome back').waitFor();
    await put(B).click();
    const summary = await B.getByRole('dialog').innerText();
    expect(summary.includes('Editor B'), 'the list of changes names the new title: ' + summary.slice(0, 300));
    await sayYes(B); await done(B).waitFor();
    same((await published(V, 'album')).title, 'Editor B', 'now it is theirs');
  });

  await testB(ctx, '"Undo what I just did" puts the version before back on the real website', async () => {
    await notice(B).getByRole('button', { name: 'Undo what I just did' }).click();
    await sayYes(B);
    await notice(B).getByText('back to how it was before').waitFor();
    same((await published(V, 'album')).title, 'Editor A', 'back to the one before');
  });

  await test(ctx, 'after a reload, "Undo my last change on the website" is still offered', async () => {
    await A.goto(ADMIN + '#/album'); await titleBox(A).waitFor();
    await A.reload(); await titleBox(A).waitFor();
    expect(await A.getByRole('button', { name: 'Undo my last change on the website' }).isVisible(), 'the older version is kept by the server');
  });

  group('Real mode: pictures');
  await test(ctx, 'a picture is kept by the server and shown to visitors', async () => {
    await A.goto(ADMIN + '#/photos'); await A.getByRole('button', { name: 'Choose a new picture' }).first().waitFor();
    await giveFile(A, '#g2-aboutPhoto-file', { width: 3000, height: 2000, name: 'real.jpg' });
    await A.getByText('The picture is ready').waitFor();
    await put(A).click(); await sayYes(A); await done(A).waitFor();
    await V.goto(REAL + '/'); await V.locator('.earth-img[src^="/media/"]').waitFor();   // the page starts with the old photo, then swaps
    const src = await V.locator('.earth-img').getAttribute('src');
    expect(/^\/media\/[a-f0-9]{32}$/.test(src), 'the website points at the stored picture: ' + src);
    const got = await V.evaluate(async (s) => {
      const r = await fetch(s);
      return { status: r.status, type: r.headers.get('content-type'), nosniff: r.headers.get('x-content-type-options'), csp: r.headers.get('content-security-policy'), cache: r.headers.get('cache-control') };
    }, src);
    same(got.status, 200, 'it can be fetched');
    same(got.type, 'image/jpeg');
    same(got.nosniff, 'nosniff');
    expect(/sandbox/.test(got.csp || ''), 'it cannot run as a page: ' + got.csp);
    expect(/immutable/.test(got.cache || ''), 'it can be kept by browsers');
    await V.waitForFunction(() => { const i = document.querySelector('.earth-img'); return i && i.complete && i.naturalWidth > 0; });
  });

  group('Real mode: when something goes wrong, nothing is lost');
  const WORDS = '**/api/admin/content/words';
  const aboutBox = () => A.locator('#view textarea, #view input[type="text"]').first();
  const startEdit = async () => {
    await A.goto(ADMIN + '#/words'); await aboutBox().waitFor();
    await aboutBox().fill('A change that must not be lost');
    await A.waitForTimeout(350);                               // typing is saved a moment after the last key
  };
  const draftKept = () => A.evaluate(() => (localStorage.getItem('emajane-draft:words') || '').includes('A change that must not be lost'));

  await test(ctx, 'when the sign-in has run out, it says so and offers to sign in again', async () => {
    await startEdit();
    await A.route(WORDS, (r) => r.fulfill({ status: 302, headers: { location: LOGIN } }));
    await put(A).click(); await sayYes(A);
    await notice(A).getByText('You have been signed out').waitFor();
    expect(await notice(A).getByRole('button', { name: 'Sign in again' }).isVisible(), 'a button to sign in');
    expect(await draftKept(), 'the words are still saved');
    await A.unroute(WORDS);
  });

  await test(ctx, 'with no connection, it says so, and the words are kept', async () => {
    await A.route(WORDS, (r) => r.abort('failed'));
    await put(A).click(); await sayYes(A);
    await notice(A).getByText('We could not reach your website').waitFor();
    expect(await draftKept(), 'the words are still saved');
    await A.unroute(WORDS);
  });

  await test(ctx, 'when the back end refuses, its message is shown in plain words', async () => {
    await A.route(WORDS, (r) => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'The first box is too long.' }) }));
    await put(A).click(); await sayYes(A);
    await notice(A).getByText('The first box is too long.').waitFor();
    await A.unroute(WORDS);
  });

  await test(ctx, 'when the back end breaks, the message is kind and does not show anything technical', async () => {
    await A.route(WORDS, (r) => r.fulfill({ status: 500, contentType: 'text/html', body: '<h1>Internal Server Error</h1><pre>at line 12</pre>' }));
    await put(A).click(); await sayYes(A);
    await notice(A).getByText('Sorry, that did not work. Your changes are safe.').waitFor();
    expect(!/Internal|line 12|500/.test(await notice(A).innerText()), 'nothing technical on screen');
    await A.unroute(WORDS);
  });

  await test(ctx, 'once the problem has passed, the same words go live with one more press', async () => {
    await put(A).click(); await sayYes(A); await done(A).waitFor();
    expect(JSON.stringify(await published(V, 'words')).includes('A change that must not be lost'), 'it is on the website');
  });

  group('Real mode: seeing how it looks');
  await test(ctx, '"See how it looks" shows the change to Emma only, and nothing changes for visitors', async () => {
    await A.goto(ADMIN + '#/album'); await titleBox(A).waitFor();
    await titleBox(A).fill('Only a look');
    await A.getByRole('button', { name: 'See how it looks' }).first().click();
    const frame = A.frameLocator('dialog iframe');
    await frame.locator('h1').filter({ hasText: 'ONLY A LOOK' }).waitFor();
    same((await published(V, 'album')).title, 'Editor A', 'visitors still see the real title');
    await A.getByRole('button', { name: 'Close this look' }).click();
    await A.getByRole('button', { name: 'Throw away my changes' }).click(); await sayYes(A);
    await notice(A).getByText('Your changes are thrown away.').waitFor();
  });

  group('Real mode: the public page and the back end agree');
  await test(ctx, 'nothing the website asked for failed, in any of the browsers', async () => {
    for (const [who, page] of [['visitor', V], ['second editor', B]]) {
      const bad = page.problems.filter((p) => !/Failed to load resource|401|409/.test(p));
      same(bad, [], who + ' saw no script problems');
    }
  });
}
