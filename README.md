# Gator Eyes browser extension

Free, read-only Gator Eyes panel on **Solada.fun** and **Snek.fun** coin pages. Manifest V3, no build step, no dependencies.

What it does
- On `solada.fun/coin/<id>` and `snek.fun/token/<asset>` it shows a small panel (bottom-right): 24h volume, net flow, trades, wallets, price change, buys-vs-sells bar, last-hour volume, and any Gator Eyes alerts for that coin in the last 24h, with links to the coin card, holders and tokens pages on gatoreyes.fun.
- Toolbar popup: the 8 most traded coins in the last 24h across both launchpads.
- Click the panel header to collapse it (remembered).
- **Run Downs tab** (v1.1.0): open Gator Run Downs races with the countdown, buyers / net ADA against the Fast Lunge target, Quagmire's call, and Lunge / No Lunge buttons. The toolbar badge shows how many races are open; optional "Alert me when a race opens" desktop notifications.

What it does not do
- It never reads page contents, wallets, cookies or anything you type. It only looks at the page URL.
- Market side: only GET `/tokens` and `/feed` on the Gator Eyes worker (cached 60s). Nothing about you is sent.
- Run Downs tab: talks only to gatorrundowns.fun, the same API the site uses (`/api/now`, `/api/me`, `/api/paddock`, `POST /api/pick`). Sign-in happens on the site; Chrome attaches that sign-in to the tab's requests, and the extension never reads or stores it. Picks go through the site's own checks (signed in, fair-play rules accepted, pick window, creator-sell lock, Stewards' hedging and creator checks).
- The Run Downs worker accepts `POST /api/pick` (and only that) from a `chrome-extension://` origin; see `src/api.js` `extensionOrigin` in gator-run-downs. `EXTENSION_ORIGINS` there can pin it to the store id once known.

Fair play
- A pick from the tab is the account's one pick for that race, the same row a site pick writes; switching on either side updates it.
- The Stewards' device signature is IP + user agent + language. The extension's requests come from the same browser, so they match the site on the same computer. No new "device" is created.

Install (unpacked, Chrome / Brave / Edge)
1. Download this repo (Code → Download ZIP) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. **Load unpacked** → pick the unzipped folder (the one with `manifest.json`).
4. Open any coin page on solada.fun or snek.fun.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json` (works until Firefox restarts; a signed build is needed for permanent install).

Chrome Web Store release
- Upload `gator-eyes-extension-<version>.zip` (built by `./build.sh`, contains only the extension files).
- Listing text, permission answers and image assets are in `store/` (see `store/LISTING.md`).
- Privacy policy: https://www.gatoreyes.fun/privacy.html
- The worker's `/tokens` and `/feed` are rate limited (60/min per IP, shared with the site). The extension caches 60s, so one user is 2 requests a minute at most.

Files
- `manifest.json` MV3 manifest. Content script on solada.fun + snek.fun; host permission only for the Gator Eyes worker.
- `background.js` service worker: fetches + caches the feed, matches the page's coin to `/tokens`.
- `content.js` panel (shadow DOM, isolated styles), watches SPA navigation.
- `popup.html` / `popup.js` toolbar popup with Movers and Run Downs tabs.
- `rundowns.js` Run Downs helpers (race card, pick clock and points note mirrored from the site, API calls).
