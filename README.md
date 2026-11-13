# Gator Eyes browser extension

Free, read-only Gator Eyes panel on **Solada.fun** and **Snek.fun** coin pages. Manifest V3, no build step, no dependencies.

What it does
- On `solada.fun/coin/<id>` and `snek.fun/token/<asset>` it shows a small panel (bottom-right): 24h volume, net flow, trades, wallets, price change, buys-vs-sells bar, last-hour volume, and any Gator Eyes alerts for that coin in the last 24h (size, pace, price 1h / 24h later from `/followup`), with links to the coin card, holders and tokens pages on gatoreyes.fun.
- **Gator Eyes extras** (v1.3.0), things Solada's page doesn't show: launch speed (time to graduate, or % to graduation, and age), creator watch (creator wallet % from `/holders`, locked %, creator sells from `/coin-trades`), next unlock (`/unlocks`, with on-chain verification), liquidity (`/liquidity`: pool ADA, depth vs MC, LP owners; hidden if the endpoint is missing), and a Run Downs banner with a Pick link when the coin has an open race (`gatorrundowns.fun/api/now`).
- **Customize** (v1.4.0): a Customize link in the panel footer opens a checklist of sections (volume/flow stats, buys vs sells, race banner, launch, creator, next unlock, liquidity, alerts, Ask Quagmire). Choices are saved in `chrome.storage.local` (`hide`), and turned-off sections skip their downloads.
- **Trade ribbon** (v1.5.0): a strip along the bottom of Solada and Snek.fun pages. Pick what it shows from the ribbon or the toolbar popup: the Gator Eyes trade feed (`/feed` tape), Gator Run Downs picks (open races with countdown, Fast Lunge progress, Quagmire's call and your own pick when signed in at gatorrundowns.fun), or your watchlist. Star coins with ☆ in the coin panel or import a gatoreyes.fun watchlist link in the popup; the list stays in `chrome.storage.local` (`watch`) and never leaves the browser. `ribbon` stores the choice (`off` hides it). New items swap in at the end of each scroll loop; reduced-motion users get a static, scrollable strip.
- **Ask Quagmire** (v1.2.0): a fold-out box at the bottom of the panel. Quick buttons for the coin on screen (Summary, Holders, Burns, Unlocks) or type any question. "It" / "this coin" means the coin on screen. Same answers as the gatoreyes.fun chat box and `/ask` in Discord (worker `POST /quag`). Answers are cleaned to plain formatting and https links before they're shown. Open/closed is remembered.
- Toolbar popup: the 8 most traded coins in the last 24h across both launchpads.
- Click the panel header to collapse it (remembered).
- **Run Downs tab** (v1.1.0): open Gator Run Downs races with the countdown, buyers / net ADA against the Fast Lunge target, Quagmire's call, and Lunge / No Lunge buttons. The toolbar badge shows how many races are open; optional "Alert me when a race opens" desktop notifications.

What it does not do
- It never reads page contents, wallets, cookies or anything you type. It only looks at the page URL.
- Market side: only GETs of public data: `/tokens`, `/feed`, `/coin-trades?coin=` (60s cache), `/followup`, `/unlocks`, `/liquidity`, `/holders?coin=` (5 min cache) on the Gator Eyes worker, and `/api/now` on gatorrundowns.fun (15s). Nothing about you is sent.
- Ask Quagmire: sends only the question typed (or the quick button pressed), the previous question and the ticker of the coin on screen (v1.5.2, so "when is the next unlock" answers about that coin), to `POST /quag` on the Gator Eyes worker. Never cached. The worker logs questions anonymously for Quagmire's daily review, tagged `extension`, once worker PR #59 is deployed.
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
- The worker's `/tokens` and `/feed` are rate limited (60/min per IP, shared with the site). The extension caches 60s, so one user is 2 requests a minute at most. Coin pages add `/coin-trades` (once a minute, limit 150/min) and `/holders` (once per 5 min, limit 10/min).

Files
- `manifest.json` MV3 manifest. Content script on solada.fun + snek.fun; host permission only for the Gator Eyes worker.
- `background.js` service worker: fetches + caches the feed, matches the page's coin to `/tokens`.
- `content.js` panel (shadow DOM, isolated styles), watches SPA navigation.
- `popup.html` / `popup.js` toolbar popup with Movers and Run Downs tabs.
- `rundowns.js` Run Downs helpers (race card, pick clock and points note mirrored from the site, API calls).
