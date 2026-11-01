# Gator Eyes browser extension (private, not released)

Free, read-only Gator Eyes panel on **Solada.fun** and **Snek.fun** coin pages. Manifest V3, no build step, no dependencies.

What it does
- On `solada.fun/coin/<id>` and `snek.fun/token/<asset>` it shows a small panel (bottom-right): 24h volume, net flow, trades, wallets, price change, buys-vs-sells bar, last-hour volume, and any Gator Eyes alerts for that coin in the last 24h, with links to the coin card, holders and tokens pages on gatoreyes.fun.
- Toolbar popup: the 8 most traded coins in the last 24h across both launchpads.
- Click the panel header to collapse it (remembered).

What it does not do
- It never reads page contents, wallets, cookies or anything you type. It only looks at the page URL.
- Only network calls: GET `/tokens` and `/feed` on the Gator Eyes worker (cached 60s). Nothing is sent anywhere.

Install (unpacked, Chrome / Brave / Edge)
1. Download this repo (Code → Download ZIP) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. **Load unpacked** → pick the unzipped folder (the one with `manifest.json`).
4. Open any coin page on solada.fun or snek.fun.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → pick `manifest.json` (works until Firefox restarts; a signed build is needed for permanent install).

Before any public release
- Nick's rule: tell Sousa before shipping anything that sits on top of Solada's pages.
- The worker's `/tokens` and `/feed` are rate limited (60/min per IP, shared with the site). The extension caches 60s, so one user is 2 requests a minute at most.
- Chrome Web Store would need: a privacy policy URL (gatoreyes.fun/about is fine), 128px icon (included), screenshots, and the $5 developer fee.

Files
- `manifest.json` MV3 manifest. Content script on solada.fun + snek.fun; host permission only for the Gator Eyes worker.
- `background.js` service worker: fetches + caches the feed, matches the page's coin to `/tokens`.
- `content.js` panel (shadow DOM, isolated styles), watches SPA navigation.
- `popup.html` / `popup.js` toolbar popup.
