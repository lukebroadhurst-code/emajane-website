# EMAJANE website

The website for EMAJANE (Emma Jane Charnley), with a small admin so Emma can change her own words, dates, pictures and links without a developer.

The admin is built so that a young child or an older person can use it without help. That goal drives every choice below, and tests measure it.

```
site/      the website and the admin. Plain HTML, CSS and JavaScript. No build step.
worker/    the Cloudflare Worker (keeps the content, checks the login, checks every save) and all the tests.
```

## How it fits together

| Where | What runs | The admin keeps changes in |
|---|---|---|
| **GitHub Pages** (staging) | `site/` only. Static files. | **Practice mode.** Only the visitor's own browser. Nothing real changes. A notice says so on every screen. |
| **`*.localhost`** (for example `http://staging.localhost:8801`) | `site/` from any static file server. | Practice mode again. Used by the tests. |
| **Local Worker** (`npm run dev` in `worker/`) | Everything, with a simulated database and no login. | **Real mode.** A local test database. |
| **Cloudflare** (production) | `site/` plus the Worker at `/api` and `/media`. | **Real mode.** Cloudflare KV, behind a Cloudflare Access login. |

**Releases to GitHub Pages.** Every push to `main` publishes `site/`. GitHub lets browsers keep a file for ten minutes, so the workflow first runs `tools/stamp.mjs`, which replaces the `?v=dev` on every script, style and module address with the commit id. A visitor therefore never gets a mix of new and old files right after a release. The source keeps `?v=dev`, and `worker/stamp.test.mjs` checks that nothing is missing the mark and that a stamped copy still works. Cloudflare asks the browser to check for a newer file each time, so it needs no stamp.

`site/site.config.js` decides the mode from the address a page is loaded from. Content is stored as small JSON documents, one for each box on the admin's first page. The files in `site/content/` are the starting copy that ships with the site. They are also what the page shows if the Worker cannot be reached, so the page always shows something.

## What Emma can change

Six big boxes on the first page of `/admin/`:

| Box | What is in it |
|---|---|
| Gatherings | Add, change or take off a date. Written as three drop-downs, read back in words. Days that have gone leave the website by themselves. |
| The album | Title, the words around it, the songs (in order), where people listen or buy. |
| My words | The story, the community words, and the line breaks she wants. |
| Shop | Things for sale, sold out, or coming soon. Order can be changed. |
| Pictures | The artwork, the album cover and her photo. Big photos are made the right size by the computer. |
| How to reach me | Email for messages and for bookings, Instagram, YouTube, and the thank-you line at the bottom. |

Every box works the same way: change it, **See how it looks**, then **Put it on my website**. Before anything goes live she is shown a list of exactly what will change, with the new words. The last change can always be undone, and the first version of every box can always be brought back.

The shop checkout, the mailing list and the audio hosting are not here. They belong in a shop platform, a mailing tool and an audio host.

## How the admin is made easy to use

These are the rules the screens follow. Most of them are measured by `npm run test:all` (see below).

- **Light, calm and high contrast.** Dark writing on the Bone colour, checked to the strictest (AAA) contrast level.
- **Three writing sizes**, chosen at the top of every page and remembered. Everything grows with them, and nothing falls off the side of a phone at the biggest size.
- **Big buttons.** Nothing to press is smaller than 44 by 44 pixels. A thick ring shows where the keyboard is, and it is never hidden behind anything.
- **Plain words.** Short sentences, no computer talk ("put it on my website", not "publish"). `worker/reading.test.mjs` checks the reading level and bans jargon.
- **Nothing is lost.** Changes are saved as she types. A mistake can be undone. Every question that could lose something defaults to the safe answer.
- **Nothing disappears while she reads it.** Messages stay until she closes them.
- **Every important answer is plain.** Pop-up questions have two answers, in words, always in view. When "no" is the careful answer (taking something off, throwing changes away) it is the dark button, first. A "yes" is ignored for the first moment, so a double press of the big button cannot confirm by accident. Leaving the screen counts as "no".
- **A message that says "press this" holds the button.** After adding something, the message has the big "Put it on my website" button in it. Every action says what happened, including putting something back.
- **Dates and links are helped.** A date is three drop-downs, read back as "Saturday 12 December 2026". The year starts on this year, or next year if that day has already gone. A web address has Paste and "Try this link" buttons, and tells her when it is not an address.
- **Works with a keyboard, a screen reader, 400% zoom and "reduce motion".**

These measurements do not replace watching a real person use it. The best next step is a short session with Emma, and with one younger and one older helper, using the practice copy.

## Run it and test it

```
cd worker
npm install
npm run dev          # http://localhost:8788  (site)   http://localhost:8788/admin/  (admin)
npm run test:all     # everything below, in one go (about 15 minutes)
```

`worker/.dev.vars` (not committed) sets `DEV_BYPASS=1`, which skips the login on this machine only. It must never be set on Cloudflare.

`npm run test:all` runs these, in order:

| Check | What it proves |
|---|---|
| `schema.test.mjs` | The rules for every box (dates, lengths, links, pictures) and their kind error messages. |
| `reading.test.mjs` | Every sentence in the admin is short, plain and free of computer words. |
| `auth.test.mjs` | The production sign-in check, using our own signing key: good, expired, tampered, unsigned and wrong-application tokens, and what a signed-in person may and may not do. Locally the login is skipped, so this is the only place that path is exercised before Cloudflare. |
| `stamp.test.mjs` | The release stamp covers every file a page loads, and a stamped copy still opens. |
| `e2e` **practice** | A person using the admin on the staging site: adding, changing, undoing, previewing, pictures, the keyboard, and typing nasty text. |
| `e2e` **real** | The admin talking to the real Worker, using three separate browsers: a second person is warned and loses nothing, a sign-in that has run out, no connection, server trouble, pictures stored and served safely. |
| `e2e` **ease** | Every screen, at three writing sizes, on a computer, a phone and the narrowest screen: contrast, text size, button size, sideways scrolling, cut-off words, widened text spacing, focus ring, keyboard, no vanishing messages, reduced motion. |
| `e2e` **api** | The content API itself, including who may save and what a picture may be. |

You can run one at a time, for example `node e2e/run.mjs practice`. The browser tests drive a Chromium-based browser. They look for Brave first, so set `BROWSER=/path/to/chrome` to use another. They use ports 8791 and 8801, so those must be free.

When a browser test fails the report says what was on screen at the time. `TRACE=1 node e2e/run.mjs practice` also prints every click, pop-up and repaint with timings, which is how timing problems are found.

## Go live on Cloudflare

Emma should own the Cloudflare account, with the agency added as a member. Steps:

1. **Create the storage.** `cd worker && npx wrangler login && npx wrangler kv namespace create CONTENT`. Paste the id into `worker/wrangler.toml`.
2. **Deploy.** `npm run deploy`. The site and the API are now at a `*.workers.dev` address.
3. **Protect the admin.** In Cloudflare Zero Trust, add a self-hosted Access application covering `/admin*` and `/api/admin*` on the site's address. Add a policy allowing only Emma's and the agency's email addresses. Sign-in is a code sent by email.
4. **Make the sign-in last.** In the Access application, set the session duration to something long, such as 30 days. A short session means the admin asks her to sign in again in the middle of her work. If it does, she sees "You have been signed out" with a button, and her changes are kept.
5. **Tell the Worker about it.** Copy the team domain (for example `emajane.cloudflareaccess.com`) and the application's Audience tag into `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `worker/wrangler.toml`, then deploy again. Until both are set the Worker refuses every admin request.
6. **Say who to ask.** In `site/site.config.js` set `support` to a short line, for example `Ask Luke on 07… or luke@…`. It appears in the help window as "Stuck? …".
7. **Check it.** Signed out, `/admin/` should ask for a code and `/api/admin/me` should never answer. Signed in, publish a change and reload the homepage.
8. **Domain.** Add `emajane.co.uk` as a custom domain on the Worker. The domain is with Wix today, so this means changing its DNS records or nameservers, which is best done last and with Emma's say-so.
9. **Launch checklist.** Remove `noindex` from `site/index.html`, replace placeholder dates, prices and links, set up the mailing list and shop, and add `robots.txt` blocking `/admin`.

Optional later: deploy from GitHub Actions on merge to `main` (needs a Cloudflare API token stored as a repository secret), and use branch previews for staging.

## Safety notes

- One description of every box, `site/admin/schema.js`, is used by the admin and by the Worker, so they cannot disagree. The Worker rebuilds every saved document from known fields only, checks lengths and dates, accepts links only if they start with `https://`, and accepts pictures only if the first bytes really are a JPEG or PNG.
- Saves must come from the admin page itself: same-origin, a custom header, and JSON.
- A save carries the version the editor was looking at. If someone else has saved since, the Worker refuses with a clear message, so one person's change never silently overwrites another's.
- The previous published version of each box is kept so the last change can be undone.
- The admin and the website put text on the page as text, never as HTML, so nothing typed into a box can run as code. This is tested with hostile text.
- Pictures are stored by a hash of their contents and served with `nosniff` and a sandboxing policy.
- Admin requests are checked against Cloudflare Access's signed token (signature, application, team, dates and kind of signature), on top of Access blocking them at the edge. `auth.test.mjs` tries bad tokens against the real code.

## Known limits and next steps

- **A brief flash of the starting words.** The page loads its saved words a moment after it appears, so a visitor may see the starting words for a split second. On Cloudflare the fix is to have the Worker put the saved content into the page itself (HTMLRewriter), so the first paint is already right.
- **Two people at once are warned, not merged.** The second to publish is told, and keeps their own changes on their screen, but they are not combined automatically.
- **Unpublished changes stay on the device they were typed on.** Starting on a phone and finishing on a laptop means the draft does not follow. What is published is shared by everyone.
- **Only the last change can be undone**, plus going back to the first version. A scheduled export of the content to somewhere safe would add real backups.
- **Not here yet:** the Listening Room audio and player, the mailing list, the shop checkout.
- **iPhone photos in the HEIC format** are converted by Safari but not by every desktop browser. The admin asks for a different picture in that case.

## Placeholder content still to replace

Gig dates and venues, prices and product names in the shop, and links set to `#`. The page is marked `noindex` until then.

Artwork by @janthonizor. Photographs and marks belong to EMAJANE. Fonts (Cormorant Garamond, Marcellus, Inter Tight) are SIL Open Font Licence.

The brand guidelines and the design source live in the separate `emajane-brand` project. The website in this repo is now the source of truth for the site.
