// Gator Run Downs tab: shared helpers for the popup (and tests).
// Talks only to gatorrundowns.fun, the same API the site uses. Picks go through the site's own checks
// (signed in, fair-play rules agreed, window open, creator-sell lock, Stewards). The extension never reads
// or stores the sign-in cookie; Chrome attaches it to gatorrundowns.fun requests like the site does.
(function (root) {
  const RD = "https://gatorrundowns.fun";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const int = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1e3)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  // Mirrors pickWeight in the Run Downs worker: full points for 2 minutes, sliding to half at the 7.5-minute close,
  // counted from when the race opened in the Paddock (opensAt; launch time on older races).
  const weight = (startAt, now = Date.now()) => { const m = (now - startAt) / 6e4; return m <= 2 ? 1 : m >= 7.5 ? 0.5 : 1 - 0.5 * ((m - 2) / 5.5); };
  const payNote = (startAt, now = Date.now()) => { const w = weight(startAt, now); return w >= 1 ? "Full points if you pick now" : `A right pick now earns ${Math.round(w * 100)}% of full points`; };
  // Picks close at the 7½-minute mark, or earlier at the creator-sell lock / call.
  const closeAt = (c) => Math.min(Number(c.closesAt), (c.facts && c.facts.calledAt) || Infinity);

  function need(v, goal, unit) {
    if (v == null) return `<span class="mu">${int(goal)} ${unit}</span>`;
    return v >= goal ? `<span class="up">${int(v)}/${int(goal)} ${unit} ✓</span>` : `<span>${int(v)}/${int(goal)} ${unit}</span>`;
  }

  // One race card. target: { buyers, netAda } from /api/now.
  function raceCard(c, signedIn, target, now = Date.now()) {
    const f = c.facts || {}, sold = !!f.devSellAt, called = !!f.calledAt, left = closeAt(c) - now, shut = left <= 0;
    const tk = esc(c.ticker || c.name || "Unnamed"), t = target || { buyers: 15, netAda: 1000 };
    const status = shut
      ? (c.mineLate ? `Your pick came in after the ${sold ? "creator sold" : "call"}, so it's void.` : sold ? (c.mine != null ? "Creator sold. Picks locked; your pick stands." : "Creator sold. Picks are locked.") : c.mine != null ? "Picks closed. Your pick is locked in." : "Picks are closed for this one.")
      : !signedIn ? "Sign in at Gator Run Downs to pick."
      : c.mine != null ? "Pick saved. Changing it resets the time on your pick." : "Free pick. A wrong call costs no points.";
    const q = c.quagmire == null ? "" : `<div class="rq">Quagmire says <b>${c.quagmire ? "Lunge" : "No Lunge"}</b></div>`;
    const dis = shut || !signedIn ? " disabled" : "";
    return `<div class="race${shut ? " shut" : ""}" data-coin="${esc(c.coinId)}" data-close="${closeAt(c)}" data-start="${Number(c.opensAt || c.liveAt)}">
      <div class="rh">${c.img ? `<img src="${esc(c.img)}" alt="">` : `<span class="ri">${tk.slice(0, 1)}</span>`}<b>$${tk}</b><span class="sp"></span><span class="cd" data-cd>${shut ? (sold ? "LOCKED" : called ? "CALLED" : "CLOSED") : clock(left)}</span></div>
      <div class="rt">Fast Lunge? ${need(f.buyers, t.buyers, "buyers")} · ${need(f.net == null ? null : Math.round(f.net), t.netAda, "net ADA")}</div>
      ${q}
      <div class="rb"><button class="pk yes" data-pick="1" aria-pressed="${c.mine === 1}"${dis}>Lunge</button><button class="pk no" data-pick="0" aria-pressed="${c.mine === 0}"${dis}>No Lunge</button></div>
      <div class="rs" role="status" data-note>${esc(status)}</div>
      ${!shut && signedIn ? `<div class="rp" data-pay>${payNote(c.opensAt || c.liveAt, now)}</div>` : ""}
    </div>`;
  }

  async function get(path) {
    const r = await fetch(RD + "/api" + path, { credentials: "include", cache: "no-store" });
    let j = {};
    try { j = await r.json(); } catch (_) {}
    if (!r.ok) { const e = new Error(j.error || "HTTP " + r.status); e.status = r.status; throw e; }
    return j;
  }
  async function pick(coinId, choice) {
    const r = await fetch(RD + "/api/pick", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ coinId, type: "sprint", choice }) });
    let j = {};
    try { j = await r.json(); } catch (_) {}
    if (!r.ok) { const e = new Error(j.error || "Something went wrong."); e.status = r.status; e.needAgree = !!j.needAgree; throw e; }
    return j;
  }

  root.GERD = { RD, esc, int, clock, weight, payNote, closeAt, raceCard, get, pick };
})(typeof globalThis !== "undefined" ? globalThis : this);
