const ada = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + "k" : Math.round(v).toLocaleString("en-US"));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1e3); return s < 60 ? Math.round(s) + "s" : Math.round(s / 60) + "m"; };
const $ = (id) => document.getElementById(id);

// ---- Movers (unchanged behaviour) ---------------------------------------------------------------------------
chrome.runtime.sendMessage({ type: "top" }, (res) => {
  const el = $("list");
  if (chrome.runtime.lastError || !res || !res.ok) { el.innerHTML = '<div class="note">Couldn\'t reach the Gator Eyes feed right now.</div>'; return; }
  const site = res.site || "https://gatoreyes.fun";
  // Rough dollar value under each ADA figure, from the feed's latest ADA to USDCx rate.
  const rate = Number(res.adaUsd) || 0;
  const ux = (v) => { if (!rate || !v) return ""; const u = Math.abs(v) * rate; return `<small class="usd">~${u >= 1e4 ? ada(u) : Math.round(u).toLocaleString("en-US")} USDCx</small>`; };
  el.innerHTML = "<table>" + res.coins.map((c) => {
    const d = c.w.h24, cls = d.net > 0 ? "up" : d.net < 0 ? "dn" : "mu";
    return `<tr><td><a href="${site}/coincard.html?coin=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">$${esc(c.tk)}</a><span class="src">${c.src === "snek" ? "Snek" : "Solada"}</span></td><td class="n">${ada(d.v)} ADA${ux(d.v)}</td><td class="n ${cls}">${d.net > 0 ? "+" : d.net < 0 ? "−" : ""}${ada(Math.abs(d.net))}${ux(d.net)}</td></tr>`;
  }).join("") + "</table>";
  $("upd").textContent = res.updatedAt ? "updated " + ago(Date.parse(res.updatedAt)) + " ago" : "";
});

// ---- Ribbon and watchlist ----------------------------------------------------------------------------------------
// "ribbon": what the strip on Solada/Snek.fun shows. "watch": starred coins [{ id, tk }], saved in this browser only.
let watch = [];
function paintWatch() {
  $("wlct").textContent = watch.length ? `· ${watch.length}` : "";
  $("wl").innerHTML = watch.length ? watch.map((w) => `<span>$${esc(w.tk || w.id)}<button type="button" data-rm="${esc(w.id)}" title="Remove" aria-label="Remove $${esc(w.tk || w.id)}">×</button></span>`).join("") : '<span class="mu" style="border:0;background:none;padding:0">Nothing starred yet.</span>';
}
chrome.storage.local.get(["ribbon", "watch"], (v) => {
  $("rbmode").value = v && ["trades", "watch", "off"].includes(v.ribbon) ? v.ribbon : "trades";
  watch = Array.isArray(v && v.watch) ? v.watch : [];
  paintWatch();
});
$("rbmode").addEventListener("change", (e) => chrome.storage.local.set({ ribbon: e.target.value }));
$("wl").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]"); if (!b) return;
  watch = watch.filter((w) => w.id !== b.dataset.rm); chrome.storage.local.set({ watch }); paintWatch();
});
// The gatoreyes.fun Watchlist page's "Copy link to this list" gives .../watchlist.html?w=id1,id2. Same id check as the site.
$("wlimp").addEventListener("submit", (e) => {
  e.preventDefault();
  const note = $("wlnote"); let w = "";
  try { w = new URL($("wlurl").value.trim()).searchParams.get("w") || ""; } catch { w = ""; }
  const ok = /^(snek:[0-9a-f]{56}\.[0-9a-f]{0,64}|[A-Za-z0-9_-]{2,80})$/;
  const ids = [...new Set(w.split(",").map((x) => x.trim()).filter((x) => ok.test(x)))].filter((id) => !watch.some((x) => x.id === id));
  if (!w) { note.className = "rs err"; note.textContent = "That doesn't look like a watchlist link. On gatoreyes.fun/watchlist.html, tap Copy link to this list."; return; }
  if (!ids.length) { note.className = "rs ok"; note.textContent = "Those coins are already on your list."; return; }
  chrome.runtime.sendMessage({ type: "ribbon", mode: "watch", watch: ids }, (res) => {
    const names = {}; for (const it of (res && res.items) || []) if (it.t === "coin") names[it.id] = it.tk;
    watch = [...watch, ...ids.map((id) => ({ id, tk: names[id] || id }))].slice(-50);
    chrome.storage.local.set({ watch }); paintWatch();
    $("wlurl").value = ""; note.className = "rs ok"; note.textContent = `Added ${ids.length} coin${ids.length === 1 ? "" : "s"}.`;
  });
});
