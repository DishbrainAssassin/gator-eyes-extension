# Chrome Web Store listing: Gator Eyes for Cardano

v1.5.4: Run Downs removed while the game is paused. To bring it back, see `RESTORE-RUN-DOWNS.md` and the v1.5.3 version of this file.

Copy each block into the matching field in the Chrome Web Store developer dashboard.

## Store listing tab

**Name** (from manifest): Gator Eyes for Cardano

**Summary** (from manifest, max 132 chars): Free Gator Eyes flow panel, trade ribbon, watchlist and Ask Quagmire on Solada.fun and Snek.fun coin pages. Read-only, no wallet.

**Description:**

```
See where the money is moving on any Solada.fun or Snek.fun coin, right on the coin page.

Gator Eyes is a free, automated tracker for Cardano launchpads. This extension adds a small panel to Solada.fun and Snek.fun coin pages, including graduated coins on the Markets page, with:
• 24h volume and net flow (ADA bought minus sold), with the USDCx value
• Solana pool 24h volume in USDC for Solada coins that also trade on Solana
• Trades, unique wallets and 24h price change
• A buys-vs-sells bar and last-hour volume
• Gator Eyes alerts for that coin in the last 24 hours (whale trades, volume spikes, creator sells) with their size, pace and what the price did 1 hour and 24 hours later
• Launch speed: how fast the coin graduated (or how close it is) and how old it is
• Creator watch: the creator wallet's holdings, locked supply and any creator sells
• Next unlock: the next locked-supply release, its date and whether the lock was checked on-chain
• Liquidity: pool size, depth next to market cap and who holds the LP tokens (graduated coins)
• Customize: pick which sections the panel shows
• Watchlist: star coins with ☆ and follow them in the ribbon
• One-click links to the coin card, holder snapshot and tokens table on gatoreyes.fun
• Ask Quagmire right in the panel: holders, burns, unlocks or any question about the coin, answered from live Gator Eyes data

Trade ribbon along the bottom of Solada.fun and Snek.fun pages: pick the live Gator Eyes trade feed or your watchlist, or turn it off.

Click the toolbar icon to see the 8 most traded coins across both launchpads in the last 24 hours.

Security and privacy:
• Never touches your wallet: no connecting, no signing, can't move funds or see balances
• Permission: storage only
• Talks only to the Gator Eyes server. No tabs, history, cookies or other sites
• On coin pages it only reads which coin is open, never the page or what you type
• Sends only your Ask Quagmire question (plus the coin's ticker)
• No trading. No remote code. Open source: github.com/DishbrainAssassin/gator-eyes-extension

Free forever. Gator Eyes will never charge for access.

Not financial advice. Gator Eyes is independent and not affiliated with Solada.fun or Snek.fun.
```

**Category:** Tools
**Language:** English
**Store icon:** `icons/icon128.png`
**Screenshots (1280x800):** `shot-6-solana-ribbon.png` (v1.5.1 panel with Solana volume and trade ribbon), `shot-5-extras.png` (v1.3.0 panel), `shot-1-mepe.png`, `shot-2-val.png`, `shot-3-popup.png`. Delete the old Run Downs screenshot (`shot-4-run-downs.png`) from the dashboard; it is parked in `parked/run-downs/`.
**Small promo tile (440x280):** `promo-440x280.png`
**Official URL / Homepage:** https://www.gatoreyes.fun/
**Support URL:** the Gator Eyes Discord invite

## Privacy practices tab

**Single purpose:**

```
Gator Eyes companion for Cardano launchpads: public Gator Eyes market data (volume, net flow, trades and alerts) on Solada.fun and Snek.fun coin pages and in the toolbar, with a trade ribbon, a watchlist kept in the browser and Ask Quagmire answers from live Gator Eyes data.
```

**Permission justification, storage:**

```
Remembers whether the user collapsed the panel or opened the Ask Quagmire box and which panel sections they chose to show, what the trade ribbon shows, and the coins they starred for their watchlist (kept only in the browser), and keeps a short-lived copy of the public Gator Eyes data (15 seconds to 5 minutes) so it isn't downloaded again on every page.
```

**Removed in v1.5.4:** the `alarms` and optional `notifications` permissions and the `gatorrundowns.fun` host permission. They were only used by the Run Downs tab, badge and race alerts. If the dashboard still shows justification boxes for them, clear them.

**Permission justification, host permission (gator-eyes.nlunn6731.workers.dev):**

```
Downloads the public Gator Eyes data the panel and popup display (/tokens, /feed, /followup, /unlocks, /liquidity, and /holders and /coin-trades for the coin on screen), and sends questions the user types into the Ask Quagmire box, with the ticker of the coin on screen (POST /quag), to get Quagmire's answer. No other user data is sent.
```

**Content script on solada.fun and snek.fun (if asked under host permissions):**

```
Needed to draw the panel on Solada.fun and Snek.fun coin pages. The script only reads the page URL to tell which coin is open. It does not read or change page content.
```

**Remote code:** No, I am not using remote code.

**Data usage:** untick **Authentication information** and **User activity** (both were only for Run Downs sign-in and picks). Leave every data-type box unchecked. Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://www.gatoreyes.fun/privacy.html

## Distribution tab

**Visibility:** Public (or Unlisted to test with a link first)
**Regions:** All regions
**Pricing:** Free
