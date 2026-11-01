# Chrome Web Store listing: Gator Eyes for Solada & Snek.fun

Copy each block into the matching field in the Chrome Web Store developer dashboard.

## Store listing tab

**Name** (from manifest): Gator Eyes for Solada & Snek.fun

**Summary** (from manifest, max 132 chars): Free, read-only flow panel on Solada.fun and Snek.fun coin pages: 24h volume, net flow, buys vs sells, wallets and alerts.

**Description:**

```
See where the money is moving on any Solada.fun or Snek.fun coin, right on the coin page.

Gator Eyes is a free, automated tracker for Cardano launchpads. This extension adds a small panel to Solada.fun and Snek.fun coin pages with:
• 24h volume and net flow (ADA bought minus sold)
• Trades, unique wallets and 24h price change
• A buys-vs-sells bar and last-hour volume
• Gator Eyes alerts for that coin in the last 24 hours (whale trades, volume spikes, creator sells)
• One-click links to the coin card, holder snapshot and tokens table on gatoreyes.fun

Click the toolbar icon to see the 8 most traded coins across both launchpads in the last 24 hours.

Read-only and private:
• No wallet connection, no sign-up, no trading
• Never reads page contents, what you type, cookies or wallets. It only checks which coin page you're on
• Nothing about you is sent anywhere

Free forever. Gator Eyes will never charge for access.

Not financial advice. Gator Eyes is independent and not affiliated with Solada.fun or Snek.fun.
```

**Category:** Tools
**Language:** English
**Store icon:** `icons/icon128.png`
**Screenshots (1280x800):** `shot-1-mepe.png`, `shot-2-val.png`, `shot-3-popup.png`
**Small promo tile (440x280):** `promo-440x280.png`
**Official URL / Homepage:** https://www.gatoreyes.fun/
**Support URL:** the Gator Eyes Discord invite

## Privacy practices tab

**Single purpose:**

```
Shows a read-only panel of public Gator Eyes market data (volume, net flow, trades and alerts) on Solada.fun and Snek.fun coin pages, plus a toolbar list of the most traded coins.
```

**Permission justification, storage:**

```
Remembers whether the user collapsed the panel, and keeps a copy of the public Gator Eyes data for 60 seconds so it isn't downloaded again on every page.
```

**Permission justification, host permission (gator-eyes.nlunn6731.workers.dev):**

```
Downloads the public Gator Eyes data feed (/tokens and /feed) that the panel and popup display. No user data is sent; requests are plain GETs.
```

**Content script on solada.fun and snek.fun (if asked under host permissions):**

```
Needed to draw the panel on Solada.fun and Snek.fun coin pages. The script only reads the page URL to tell which coin is open. It does not read or change page content.
```

**Remote code:** No, I am not using remote code.

**Data usage:** leave every data-type box unchecked (the extension collects nothing). Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://www.gatoreyes.fun/privacy.html

## Distribution tab

**Visibility:** Public (or Unlisted to test with a link first)
**Regions:** All regions
**Pricing:** Free
