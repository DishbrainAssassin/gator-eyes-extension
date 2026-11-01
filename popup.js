const ada = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + "k" : Math.round(v).toLocaleString("en-US"));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1e3); return s < 60 ? Math.round(s) + "s" : Math.round(s / 60) + "m"; };
chrome.runtime.sendMessage({ type: "top" }, (res) => {
  const el = document.getElementById("list");
  if (chrome.runtime.lastError || !res || !res.ok) { el.innerHTML = '<div class="note">Couldn\'t reach the Gator Eyes feed right now.</div>'; return; }
  const site = res.site || "https://gatoreyes.fun";
  el.innerHTML = "<table>" + res.coins.map((c) => {
    const d = c.w.h24, cls = d.net > 0 ? "up" : d.net < 0 ? "dn" : "mu";
    return `<tr><td><a href="${site}/coincard.html?coin=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">$${esc(c.tk)}</a><span class="src">${c.src === "snek" ? "Snek" : "Solada"}</span></td><td class="n">${ada(d.v)} ADA</td><td class="n ${cls}">${d.net > 0 ? "+" : d.net < 0 ? "−" : ""}${ada(Math.abs(d.net))}</td></tr>`;
  }).join("") + "</table>";
  document.getElementById("upd").textContent = res.updatedAt ? "updated " + ago(Date.parse(res.updatedAt)) + " ago" : "";
});
