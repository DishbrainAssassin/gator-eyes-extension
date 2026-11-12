// Gator Eyes extension: background service worker.
// Fetches the public Gator Eyes data feed (same one gatoreyes.fun uses) and
// answers questions from the content script and the popup. Nothing is sent
// anywhere except the question you type into Ask Quagmire, which goes to the
// Gator Eyes worker's /quag (the same box as on gatoreyes.fun).

const BASE = "https://gator-eyes.nlunn6731.workers.dev";
const TTL = 60e3;       // feed cache, ms (the worker itself refreshes about once a minute)
const SITE = "https://gatoreyes.fun";

const mem = {};         // in-memory cache { key: { at, data } }

async function cached(path) {
  const now = Date.now();
  const m = mem[path];
  if (m && now - m.at < TTL) return m.data;
  // Service workers get killed between events; keep a copy in session storage.
  try {
    const s = await chrome.storage.session.get(path);
    const v = s && s[path];
    if (v && now - v.at < TTL) { mem[path] = v; return v.data; }
  } catch {}
  const r = await fetch(BASE + path, { cache: "no-store" });
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

async function coinInfo(page) {
  const tok = await cached("/tokens");
  const coin = findCoin(tok.coins || [], page);
  let alerts = [];
  if (coin) {
    try {
      const feed = await cached("/feed");
      const cut = Date.now() - 24 * 3600e3;
      alerts = (feed.alerts || []).filter((a) => a.tokenId === coin.id && a.at >= cut).slice(0, 4);
    } catch {}
  }
  return { ok: true, coin, alerts, updatedAt: tok.updatedAt, adaUsd: tok.adaUsd, site: SITE };
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
  const job = msg && msg.type === "coin" ? coinInfo(msg.page || {}) : msg && msg.type === "top" ? topMovers() : msg && msg.type === "ask" ? askQuag(msg.q, msg.prev, msg.tk) : msg && msg.type === "rdcheck" ? checkRaces().then(() => ({ ok: true })) : Promise.resolve({ ok: false, error: "unknown message" });
  job.then(sendResponse, (e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
  return true; // async response
});

// ---- Gator Run Downs: toolbar badge and optional new-race alerts ------------------------------------------------
// Reads only the public /api/now list (cached 15 s by the Run Downs worker, no sign-in). The badge shows how many
// races are open for picks. Alerts are off until the player turns them on in the Run Downs tab.
const RD = "https://gatorrundowns.fun";
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
