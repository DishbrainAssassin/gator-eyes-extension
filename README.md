# Gator Eyes browser extension

Free, read-only Gator Eyes panel on **Solada.fun** and **Snek.fun** coin pages. Manifest V3, no build step, no dependencies.

## Security

Built to be safe to install next to a Cardano wallet. The full source is in this repo, and what's here is exactly what gets zipped for the Chrome Web Store (see `build.sh`).

> **Store version:** the [Chrome Web Store](https://chromewebstore.google.com/detail/gator-eyes-for-cardano/mbngcmleckdlklnpgiehmbopggapnamp) has **v1.5.3** (published November 17, 2026). It asks for `storage`, `alarms`, optional `notifications`, and access to only the Gator Eyes server and gatorrundowns.fun.
>
> **v1.5.4 (this repo, not yet uploaded):** Gator Run Downs is paused, so the Run Downs tab, race banner, ribbon mode, toolbar badge and race alerts are removed. It now asks for `storage` only and talks only to the Gator Eyes server. To bring Run Downs back, see [RESTORE-RUN-DOWNS.md](RESTORE-RUN-DOWNS.md).

**Never touches your wallet**
- No wallet code at all. It never calls `window.cardano`, never asks to connect, and never asks you to sign anything.
- It can't move funds, approve transactions or see your balances.

**Minimal permissions**
- `storage` only (panel settings, watchlist, short-lived data cache).
- Network access to only one place: the Gator Eyes server (`gator-eyes.nlunn6731.workers.dev`).
- No access to tabs, history, cookies, downloads, clipboard or "all sites."

**What it does on Solada.fun and Snek.fun**
- Reads the page address to tell which coin is open, then adds its own panel and trade ribbon in a sealed-off section of the page (shadow DOM).
- It does not read the page, the trade box, buttons or anything you type, and it does not change Solada's or Snek's own content.

**What it sends**
- Market panel: nothing about you. Only downloads of public Gator Eyes data.
- Ask Quagmire: only the question you type and the ticker of the coin on screen.

**Updates**
- No remote code. Everything that runs ships inside the extension.
- If a future version ever asks for more access, Chrome turns the extension off until you approve the new permissions.

Spotted something off? Open an issue here or ask in the Gator Eyes Discord.

What it does
- On `solada.fun/coin/<id>` and `snek.fun/token/<asset>` it shows a small panel (bottom-right): 24h volume, net flow, trades, wallets, price change, buys-vs-sells bar, last-hour volume, and any Gator Eyes alerts for that coin in the last 24h (size, pace, price 1h / 24h later from `/followup`), with links to the coin card, holders and tokens pages on gatoreyes.fun.
- **Gator Eyes extras** (v1.3.0), things Solada's page doesn't show: launch speed (time to graduate, or % to graduation, and age), creator watch (creator wallet % from `/holders`, locked %, creator sells from `/coin-trades`), next unlock (`/unlocks`, with on-chain verification), liquidity (`/liquidity`: pool ADA, depth vs MC, LP owners; hidden if the endpoint is missing). (The Run Downs race banner was removed in v1.5.4 while the game is paused.)
- **Customize** (v1.4.0): a Customize link in the panel footer opens a checklist of sections (volume/flow stats, buys vs sells, launch, creator, next unlock, liquidity, alerts, Ask Quagmire). Choices are saved in `chrome.storage.local` (`hide`), and turned-off sections skip their downloads.
- **Trade ribbon** (v1.5.0): a strip along the bottom of Solada and Snek.fun pages. Pick what it shows from the ribbon or the toolbar popup: the Gator Eyes trade feed (`/feed` tape) or your watchlist. (The Run Downs picks mode was removed in v1.5.4; a saved `rd` choice falls back to the trade feed.) Star coins with ☆ in the coin panel or import a gatoreyes.fun watchlist link in the popup; the list stays in `chrome.storage.local` (`watch`) and never leaves the browser. `ribbon` stores the choice (`off` hides it). New items swap in at the end of each scroll loop; reduced-motion users get a static, scrollable strip.
- **Ask Quagmire** (v1.2.0): a fold-out box at the bottom of the panel. Quick buttons for the coin on screen (Summary, Holders, Burns, Unlocks) or type any question. "It" / "this coin" means the coin on screen. Same answers as the gatoreyes.fun chat box and `/ask` in Discord (worker `POST /quag`). Answers are cleaned to plain formatting and https links before they're shown. Open/closed is remembered.
- Toolbar popup: the 8 most traded coins in the last 24h across both launchpads.
- Click the panel header to collapse it (remembered).
- **Run Downs tab** (v1.1.0 to v1.5.3): removed in v1.5.4 while Gator Run Downs is paused, along with the toolbar badge and race alerts. The code is parked in `parked/run-downs/`; see RESTORE-RUN-DOWNS.md.

What it does not do
- It never reads page contents, wallets, cookies or anything you type. It only looks at the page URL.
- Market side: only GETs of public data: `/tokens`, `/feed`, `/coin-trades?coin=` (60s cache), `/followup`, `/unlocks`, `/liquidity`, `/holders?coin=` (5 min cache) on the Gator Eyes worker. Nothing about you is sent.
- Ask Quagmire: sends only the question typed (or the quick button pressed), the previous question and the ticker of the coin on screen (v1.5.2, so "when is the next unlock" answers about that coin), to `POST /quag` on the Gator Eyes worker. Never cached. The worker logs questions anonymously for Quagmire's daily review, tagged `extension`, once worker PR #59 is deployed.

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
- `popup.html` / `popup.js` toolbar popup: Movers, ribbon choice and watchlist.
- `ribbon.js` trade ribbon along the bottom of Solada and Snek.fun pages.
- `parked/run-downs/` the Run Downs helpers and store screenshot from v1.5.3, not shipped (see RESTORE-RUN-DOWNS.md).
