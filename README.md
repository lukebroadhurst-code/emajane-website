# EMAJANE website

The website for EMAJANE (Emma Jane Charnley), with a small custom admin so Emma can update her own content without a developer.

```
site/      the website and the admin. Plain HTML, CSS and JavaScript. No build step.
worker/    the Cloudflare Worker: stores content, checks the login, validates every save.
```

## How it fits together

| Where | What runs | Admin saves to |
|---|---|---|
| **GitHub Pages** (staging, this repo) | `site/` only. Static files. | Demo mode: the visitor's own browser. Nothing real changes. |
| **Local** (`npm run dev` in `worker/`) | The full thing, with a simulated database. No Cloudflare account needed. | A local test database. |
| **Cloudflare** (production) | `site/` plus the Worker at `/api`. | Cloudflare KV, behind a Cloudflare Access login. |

`site/site.config.js` decides which mode a page is in from the address it is loaded from.

Content is stored as small JSON documents. `site/content/gatherings.json` is the starting copy shipped with the site and is the fallback if the API is unreachable, so the page always shows something.

## What Emma can edit today

- **Gatherings** at `/admin/`: add, edit and remove dates, city, venue, ticket link and sold-out status. Preview before publishing. Bring back the previous version. Past dates leave the website by themselves.

Planned next, one screen at a time: Music and About text, Photos, Listening Room audio. The shop stays in a shop platform and the mailing list in a mailing tool.

## Run it locally

```
cd worker
npm install
npm run dev        # http://localhost:8788  (site)   http://localhost:8788/admin/  (admin)
npm test           # in another terminal: 16 checks on the API
```

`worker/.dev.vars` (not committed) sets `DEV_BYPASS=1`, which skips the login on this machine only. It must never be set on Cloudflare.

## Go live on Cloudflare

Emma should own the Cloudflare account, with the agency added as a member. Steps:

1. **Create the storage.** `cd worker && npx wrangler login && npx wrangler kv namespace create CONTENT`. Paste the id into `worker/wrangler.toml`.
2. **Deploy.** `npm run deploy`. The site and the API are now at a `*.workers.dev` address.
3. **Protect the admin.** In Cloudflare Zero Trust, add a self-hosted Access application covering `/admin*` and `/api/admin*` on the site's address. Add a policy allowing only Emma's and the agency's email addresses. Sign-in is a code sent by email.
4. **Tell the Worker about it.** Copy the team domain (for example `emajane.cloudflareaccess.com`) and the application's Audience tag into `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `worker/wrangler.toml`, then deploy again. Until both are set the Worker refuses every admin request.
5. **Check it.** Signed out, `/admin/` should ask for a code and `/api/admin/me` should never answer. Signed in, publish a change and reload the homepage.
6. **Domain.** Add `emajane.co.uk` as a custom domain on the Worker. The domain is with Wix today, so this means changing its DNS records or nameservers, which is best done last and with Emma's say-so.
7. **Launch checklist.** Remove `noindex` from `site/index.html`, replace placeholder dates, prices and links, set up the mailing list and shop, and add `robots.txt` blocking `/admin`.

Optional later: deploy from GitHub Actions on merge to `main` (needs a Cloudflare API token stored as a repository secret), and use branch previews for staging.

## Safety notes

- The Worker rebuilds every saved document from known fields only, checks dates and lengths, and accepts ticket links only if they start with `https://`.
- Saves must come from the same site (origin check) and be JSON.
- The admin builds pages with text nodes, never raw HTML, so a stray character cannot break or inject into the page.
- Admin requests are verified against Cloudflare Access's signed token, on top of Access blocking them at the edge.
- The previous published version is kept so a mistake can be undone.

## Placeholder content still to replace

Gig dates and venues, prices and product names in the shop, the tee shape, and links set to `#`. The page is marked `noindex` until then.

Artwork by @janthonizor. Photographs and marks belong to EMAJANE. Fonts (Cormorant Garamond, Marcellus, Inter Tight) are SIL Open Font Licence.

The brand guidelines and the design source live in the separate `emajane-brand` project. The website in this repo is now the source of truth for the site.
