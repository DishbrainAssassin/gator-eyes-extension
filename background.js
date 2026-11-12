// Gator Eyes extension: background service worker.
// Fetches the public Gator Eyes data feed (same one gatoreyes.fun uses) and
// answers questions from the content script and the popup. Nothing is sent
// anywhere except the question you type into Ask Quagmire, which goes to the
// Gator Eyes worker's /quag (the same box as on gatoreyes.fun).

const BASE = "https://gator-eyes.nlunn6731.workers.dev";
const TTL = 60e3;       // feed cache, ms (the worker itself refreshes about once a minute)
const SITE = "https://gatoreyes.fun";
const RD = "https://gatorrundowns.fun";

const mem = {};         // in-memory cache { key: { at, data } }

async function cached(path, ttl = TTL) {
  const now = Date.now();
  const m = mem[path];
  if (m && now - m.at < ttl) return m.data;
  // Service workers get killed between events; keep a copy in session storage.
  try {
    const s = await chrome.storage.session.get(path);
    const v = s && s[path];
    if (v && now - v.at < ttl) { mem[path] = v; return v.data; }
  } catch {}
  const r = await fetch(path.startsWith("https://") ? path : BASE + path, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  mem[path] = { at: now, data };
  try { await chrome.storage.session.set({ [path]: mem[path] }); } catch {}
  return data;
}

// Match the coin a page is showing against the /tokens list.
//   Solada: https://www.solada.fun/coin/<id>          -> c.id === id  (or c.slug === id)
//           https://www.solada.fun/markets?token=<unit> -> c.unit === unit (policy id + hex asset name)
//   Snek:   https://www.snek.fun/token/<policy+hex>   -> c.slug === asset or c.id === "snek:<policy>.<hex>"
function findCoin(coins, page) {
  const key = String(page.key || "").trim();
  if (!key) return null;
  const lk = key.toLowerCase();
  if (page.src === "snek") {
    return coins.find((c) => c.src === "snek" && (String(c.slug || "").toLowerCase() === lk || String(c.id || "").slice(5).replace(".", "").toLowerCase() === lk)) || null;
  }
  return coins.find((c) => c.src === "solada" && (String(c.id || "").toLowerCase() === lk || String(c.slug || "").toLowerCase() === lk || String(c.unit || "") === lk))
    // A Markets-page unit that isn't a Solada coin may still be a Snek.fun coin (its slug is the same unit).
    || (/^[0-9a-f]{56,}$/.test(lk) ? coins.find((c) => c.src === "snek" && String(c.slug || "").toLowerCase() === lk) : null) || null;
}

async function coinInfo(page, hide = []) {
  const off = new Set(Array.isArray(hide) ? hide : []);   // sections the user turned off: skip their downloads
  const tok = await cached("/tokens");
  const coin = findCoin(tok.coins || [], page);
  let alerts = [], extra = {};
  if (coin) {
    const now = Date.now();
    const [feed, fu, unl, liq, rd, hold, trades] = await Promise.all([
      cached("/feed").catch(() => null),
      off.has("alerts") ? null : cached("/followup", 5 * 60e3).catch(() => null),
      coin.src === "solada" && !off.has("unlock") ? cached("/unlocks", 5 * 60e3).catch(() => null) : null,
      off.has("liq") ? null : cached("/liquidity", 5 * 60e3).catch(() => null),          // 404 until the liquidity tracker is live; the row stays hidden
      off.has("race") ? null : cached(RD + "/api/now", 15e3).catch(() => null),
      coin.src === "solada" && !off.has("creator") ? cached("/holders?coin=" + encodeURIComponent(coin.id), 5 * 60e3).catch(() => null) : null,
      coin.src === "solada" && !off.has("creator") ? cached("/coin-trades?coin=" + encodeURIComponent(coin.id)).catch(() => null) : null,
    ]);
    const cut = now - 24 * 3600e3;
    // Alerts with their size, pace and what the price did 1 h / 24 h later (Alert follow-up).
    const fuRows = (fu && fu.alerts || []).filter((r) => r[2] === coin.id);
    alerts = (feed && feed.alerts || []).filter((a) => a.tokenId === coin.id && a.at >= cut).slice(0, 4).map((a) => {
      const f = fuRows.find((r) => Math.abs(r[0] - a.at) < 90e3 && r[1] === a.kind);
      const x = /About \*\*([\d.]+)x\*\*/.exec(a.desc || "");
      const w = /bought by \*\*(\d+) wallets\*\*/.exec(a.desc || "");
      const chg = (p1) => (f && f[6] && p1 ? (p1 / f[6] - 1) * 100 : null);
      return { at: a.at, kind: a.kind, ada: a.ada, side: a.side, pace: x ? Number(x[1]) : null, wallets: w ? Number(w[1]) : null,
        creator: /creator wallet/i.test(a.desc || ""), h1: f ? chg(f[7]) : null, h24: f ? chg(f[8]) : null };
    });
    // Next unlock, checked on the chain (Unlock calendar).
    const uc = unl && (unl.coins || []).find((c) => c.id === coin.id);
    if (uc) {
      const open = (uc.locks || []).filter((l) => l.untilMs > now).sort((a, b) => a.untilMs - b.untilMs);
      extra.unlock = { lockedPct: uc.lockedPct, next: open[0] ? { pct: open[0].pct, at: open[0].untilMs, dev: !!open[0].dev, ver: open[0].ver } : null,
        more: Math.max(0, open.length - 1), devLocked: open.filter((l) => l.dev).reduce((t, l) => t + (l.pct || 0), 0) };
    }
    // Creator wallet: what it holds (holder snapshot) and any sells in recent trades or creator-sell alerts.
    const launcher = hold && hold.coin && hold.coin.launcher;
    if (launcher) {
      const sup = Number(hold.coin.supply || 0), list = hold.holders || [];
      const me = list.find((h) => h.addr === launcher);
      let pct = me && sup ? Number(me.qty) / sup * 100 : null, under = null;
      if (pct == null && sup) {
        // Not in the list: zero if the list is every holder, else below the smallest listed balance.
        if (coin.hold && list.length >= coin.hold) pct = 0;
        else if (list.length) under = Math.min(...list.map((h) => Number(h.qty))) / sup * 100;
      }
      const tl = (trades && trades.trades || []);
      const sells = tl.filter((t) => t.trader === launcher && t.side === "sell" && t.at >= cut);
      const full = !trades || !trades.more || (tl.length && tl[tl.length - 1].at < cut);
      let sold = sells.reduce((t, x) => t + (x.ada || 0), 0), last = sells.length ? sells[0].at : null;
      const devAl = alerts.filter((a) => a.kind === "dev" || a.creator);
      if (!sold && devAl.length) { sold = devAl.reduce((t, a) => t + (a.ada || 0), 0); last = devAl[0].at; }
      extra.creator = { pct, under, sold, last, full, locked: extra.unlock ? extra.unlock.devLocked : 0, addr: launcher };
    }
    // Liquidity tracker: pool depth and who holds the LP.
    const lc = liq && (liq.coins || []).find((c) => c.id === coin.id);
    if (lc) extra.liq = { ada: lc.ada, depth: lc.depth, share: lc.share || {}, ch24: lc.ch24 };
    // Gator Run Downs: is this coin racing right now?
    const race = rd && (rd.open || []).find((x) => x.coinId === coin.id && !x.called && Number(x.closesAt) > now);
    if (race) extra.race = { closesAt: Number(race.closesAt), buyers: race.buyers, net: race.net, target: rd.target || null, play: rd.play || RD + "/paddock.html" };
  }
  return { ok: true, coin, alerts, extra, updatedAt: tok.updatedAt, adaUsd: tok.adaUsd, site: SITE };
}

async function topMovers() {
  const tok = await cached("/tokens");
  const coins = (tok.coins || []).filter((c) => c.w && c.w.h24 && c.w.h24.v > 0);
  coins.sort((a, b) => b.w.h24.v - a.w.h24.v);
  return { ok: true, coins: coins.slice(0, 8), updatedAt: tok.updatedAt, adaUsd: tok.adaUsd, site: SITE };
}

// Ask Quagmire: the same POST /quag the gatoreyes.fun chat box uses (same answers as /ask in Discord).
// Sends only the question typed into the panel (and the previous one, for follow-ups). Never cached.
async function askQuag(q, prev, tk) {
  q = String(q || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!q) return { ok: false, error: "empty" };
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 10e3);
  try {
    const r = await fetch(BASE + "/quag", { method: "POST", cache: "no-store", headers: { "content-type": "text/plain" },
      body: JSON.stringify({ q, prev: String(prev || "").slice(0, 200), pg: "extension" }), signal: ctl.signal });
    if (r.status === 429) return { ok: true, html: "Slow down a little, I'm still crunching. Try again in a minute." };
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    // A plain question Quagmire couldn't place ("holders?") gets one retry naming the coin on screen.
    if (j.fb && tk && !/\$[a-z0-9]/i.test(q)) {
      const r2 = await fetch(BASE + "/quag", { method: "POST", cache: "no-store", headers: { "content-type": "text/plain" },
        body: JSON.stringify({ q: `$${tk} ${q}`.slice(0, 200), prev: "", pg: "extension" }), signal: ctl.signal }).catch(() => null);
      const j2 = r2 && r2.ok ? await r2.json().catch(() => null) : null;
      if (j2 && !j2.fb) return { ok: true, html: String(j2.html || ""), fb: false };
    }
    return { ok: true, html: String(j.html || ""), fb: !!j.fb };
  } finally { clearTimeout(tm); }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const job = msg && msg.type === "coin" ? coinInfo(msg.page || {}, msg.hide) : msg && msg.type === "top" ? topMovers() : msg && msg.type === "ask" ? askQuag(msg.q, msg.prev, msg.tk) : msg && msg.type === "rdcheck" ? checkRaces().then(() => ({ ok: true })) : Promise.resolve({ ok: false, error: "unknown message" });
  job.then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
  return true; // async response
});

// ---- Gator Run Downs: toolbar badge and optional new-race alerts ------------------------------------------------
// Reads only the public /api/now list (cached 15 s by the Run Downs worker, no sign-in). The badge shows how many
// races are open for picks. Alerts are off until the player turns them on in the Run Downs tab.
const ALARM = "rd-now";

function ensureAlarm() {
  chrome.alarms.get(ALARM, (a) => { if (!a) chrome.alarms.create(ALARM, { periodInMinutes: 0.5, delayInMinutes: 0.1 }); });
}
chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); checkRaces(); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); checkRaces(); });
ensureAlarm();

async function checkRaces() {
  let d;
  try {
    const r = await fetch(RD + "/api/now", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    d = await r.json();
  } catch { return; }
  const now = Date.now();
  const open = (d.open || []).filter((x) => !x.called && Number(x.closesAt) > now);
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#2f7d3a" });
    await chrome.action.setBadgeText({ text: open.length ? String(open.length) : "" });
    await chrome.action.setTitle({ title: open.length ? `Gator Eyes · ${open.length} Run Downs race${open.length === 1 ? "" : "s"} open for picks` : "Gator Eyes" });
  } catch {}
  const st = await chrome.storage.local.get(["rdAlerts", "rdSeen"]);
  const seen = new Set(st.rdSeen || []);
  const fresh = open.filter((x) => !seen.has(x.coinId));
  for (const x of open) seen.add(x.coinId);
  await chrome.storage.local.set({ rdSeen: [...seen].slice(-200) });
  if (!st.rdAlerts || !fresh.length || !chrome.notifications) return;
  for (const x of fresh.slice(0, 3)) {
    const left = Math.max(0, Math.round((Number(x.closesAt) - now) / 6e4));
    chrome.notifications.create("rd:" + x.coinId, {
      type: "basic", iconUrl: "icons/icon128.png", title: `New race: $${x.ticker || x.name || "coin"}`,
      message: `Picks open at Gator Run Downs · about ${left} min to pick. Click the Gator Eyes icon to pick.`, priority: 1,
    });
  }
}
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) checkRaces(); });
// notifications is an optional permission: wire the click handler now if it is granted, or as soon as it is.
let clicksWired = false;
function wireClicks() {
  if (clicksWired || !chrome.notifications || !chrome.notifications.onClicked) return;
  clicksWired = true;
  chrome.notifications.onClicked.addListener((id) => {
    if (!id.startsWith("rd:")) return;
    chrome.notifications.clear(id);
    const tab = () => chrome.tabs.create({ url: RD + "/paddock.html" });
    if (chrome.action.openPopup) chrome.action.openPopup().catch(tab); else tab();
  });
}
wireClicks();
if (chrome.permissions && chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(wireClicks);
