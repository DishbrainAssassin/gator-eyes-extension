// Gator Eyes extension: trade ribbon along the bottom of solada.fun and snek.fun pages.
// Pick what it shows: the Gator Eyes trade feed, Gator Run Downs picks, or your watchlist (coins starred in
// the extension). It never reads the page or your wallet; the data comes from the Gator Eyes feed and gatorrundowns.fun.
// Saved settings: "ribbon" ("trades" | "rd" | "watch" | "off") and "watch" ([{ id, tk }]) in chrome.storage.local.
(() => {
  const HOST_ID = "gator-eyes-ribbon-host";
  const MODES = [["trades", "Trade feed"], ["rd", "Run Downs picks"], ["watch", "Watchlist"]];
  const EVERY = { trades: 20e3, rd: 10e3, watch: 30e3 };
  let mode = "trades", watch = [], data = null, pending = null, timer = null, host = null;

  const n = (v, d = 0) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: d });
  const ada = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(Math.abs(v) >= 1e4 ? 1 : 2) + "k" : n(v));
  const pct = (p) => (p == null ? "" : (p > 0 ? "▲" : p < 0 ? "▼" : "") + Math.abs(p).toFixed(1) + "%");
  const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1e3); return s < 60 ? Math.round(s) + "s" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; };
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1e3)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const price = (p) => (p == null ? "" : p >= 1 ? p.toFixed(3) : Number(p).toPrecision(3));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const coinUrl = (it) => (it.src === "snek" ? "https://www.snek.fun/token/" + encodeURIComponent(String(it.id).slice(5).replace(".", "")) : "https://www.solada.fun/coin/" + encodeURIComponent(it.id));
  const img = (it) => (it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : `<span class="ph">${esc(String(it.tk || "?").slice(0, 1))}</span>`);

  const CSS = `
    :host { all: initial; }
    .rb { position: fixed; left: 0; right: 0; bottom: 0; height: 30px; z-index: 2147482999; display: flex; align-items: stretch;
      font: 12.5px/30px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #e6e6e0; background: #0d0f0c; border-top: 1px solid #2a2e26; box-shadow: 0 -6px 18px rgba(0,0,0,.35); }
    .lf { display: flex; align-items: center; gap: 6px; padding: 0 8px; background: #141712; border-right: 1px solid #2a2e26; flex: none; }
    .lf img { width: 18px; height: 18px; border-radius: 50%; }
    select { font: 600 12px/1 inherit; font-family: inherit; color: #c9a227; background: #0d0f0c; border: 1px solid #2a2e26; border-radius: 6px; padding: 3px 4px; cursor: pointer; }
    select:focus { outline: 1px solid #c9a227; }
    .vp { flex: 1; overflow: hidden; position: relative; mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent); }
    .run { display: inline-flex; white-space: nowrap; will-change: transform; }
    .run.go { animation: rb-scroll var(--dur, 60s) linear infinite; }
    .vp:hover .run.go { animation-play-state: paused; }
    @keyframes rb-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .it { display: inline-flex; align-items: center; gap: 6px; padding: 0 14px; border-right: 1px solid #1d201b; color: inherit; text-decoration: none; cursor: pointer; }
    .it:hover { background: #141712; }
    .it img, .it .ph { width: 16px; height: 16px; border-radius: 50%; object-fit: cover; background: #1d201b; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
    .it b { font-weight: 700; }
    .up { color: #7ed48a; } .dn { color: #ee7b6d; } .mu { color: #9a9f93; } .au { color: #c9a227; }
    .tag { font-size: 10px; font-weight: 700; letter-spacing: .05em; padding: 1px 5px; border-radius: 4px; line-height: 14px; }
    .tag.buy { background: #1f3d24; color: #9be08f; } .tag.sell { background: #45201b; color: #f3a093; } .tag.race { background: #c9a227; color: #0d0f0c; }
    .msg { padding: 0 14px; color: #9a9f93; }
    .msg a { color: #c9a227; text-decoration: none; font-weight: 600; }
    .x { flex: none; width: 30px; border: 0; border-left: 1px solid #2a2e26; background: #141712; color: #9a9f93; font: 16px/1 inherit; cursor: pointer; }
    .x:hover { color: #e6e6e0; }
    @media (prefers-reduced-motion: reduce) { .run.go { animation: none; } .vp { overflow-x: auto; mask-image: none; } }
  `;

  function ensure() {
    if (host && document.contains(host)) return host;
    host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      const sh = host.attachShadow({ mode: "open" });
      sh.innerHTML = `<style>${CSS}</style><div class="rb" role="region" aria-label="Gator Eyes ribbon">
        <div class="lf"><img src="${chrome.runtime.getURL("icons/icon32.png")}" alt="Gator Eyes"><select aria-label="What the ribbon shows">${MODES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div class="vp"><div class="run"></div></div>
        <button type="button" class="x" title="Hide the ribbon (turn it back on from the Gator Eyes toolbar button)" aria-label="Hide the ribbon">×</button></div>`;
      sh.querySelector("select").addEventListener("change", (e) => { setMode(e.target.value); try { chrome.storage.local.set({ ribbon: mode }); } catch {} });
      sh.querySelector(".x").addEventListener("click", () => { try { chrome.storage.local.set({ ribbon: "off" }); } catch {} });
      // Swap in fresh items only when a loop finishes, so the strip never jumps mid-read.
      sh.querySelector(".run").addEventListener("animationiteration", () => { if (pending) { const p = pending; pending = null; paint(p); } });
      (document.body || document.documentElement).appendChild(host);
    }
    // Leave room so the strip doesn't cover the bottom of the page.
    if (!document.getElementById(HOST_ID + "-pad")) {
      const st = document.createElement("style"); st.id = HOST_ID + "-pad"; st.textContent = "html body { padding-bottom: 30px !important; }";
      (document.head || document.documentElement).appendChild(st);
    }
    host.shadowRoot.querySelector("select").value = mode;
    return host;
  }
  function remove() {
    clearInterval(timer); timer = null;
    const h = document.getElementById(HOST_ID); if (h) h.remove();
    const p = document.getElementById(HOST_ID + "-pad"); if (p) p.remove();
    host = null; data = null; pending = null;
  }

  function item(it) {
    if (it.t === "trade") {
      return `<a class="it" href="${esc(coinUrl(it))}" title="$${esc(it.tk)} ${esc(it.side)} ${n(it.ada, 1)} ADA, ${ago(it.at)} ago">${img(it)}<b>$${esc(it.tk)}</b><span class="tag ${it.side === "sell" ? "sell" : "buy"}">${it.side === "sell" ? "SELL" : "BUY"}</span><span>${ada(it.ada)} ADA</span><span class="mu" data-ago="${it.at}">${ago(it.at)}</span></a>`;
    }
    if (it.t === "race") {
      const t = it.target || {}, bits = [];
      if (it.buyers != null) bits.push(`<span class="${it.buyers >= t.buyers ? "up" : ""}">${n(it.buyers)}/${n(t.buyers)} buyers</span>`);
      if (it.net != null) bits.push(`<span class="${it.net >= t.netAda ? "up" : ""}">${ada(Math.round(it.net))}/${ada(t.netAda)} net</span>`);
      if (it.quag != null) bits.push(`<span class="mu">Quagmire: <b>${it.quag ? "Lunge" : "No Lunge"}</b></span>`);
      bits.push(it.mine == null ? `<span class="au">Pick now</span>` : `<span>Your pick: <b class="${it.mine ? "up" : "dn"}">${it.mine ? "Lunge" : "No Lunge"}</b></span>`);
      return `<a class="it" href="${esc(data.play)}" title="Pick at Gator Run Downs">${img(it)}<span class="tag race">RACING</span><b>$${esc(it.tk)}</b><span class="au" data-close="${it.closesAt}">${clock(it.closesAt - Date.now())}</span> ${bits.join(" · ")}</a>`;
    }
    if (it.t === "last") {
      return `<a class="it" href="${esc(data.results)}" title="Gator Run Downs results"><span class="mu">Last race</span><b>$${esc(it.tk)}</b><span class="${it.lunge ? "up" : "dn"}">${it.lunge ? "Lunged" : "No Lunge"}</span>${it.at ? `<span class="mu">${ago(it.at)} ago</span>` : ""}</a>`;
    }
    if (it.t === "coin") {
      if (it.missing) return `<span class="it"><span class="au">★</span><b>$${esc(it.tk)}</b><span class="mu">no trades tracked in 24h</span></span>`;
      const bits = [`<span>${price(it.price)} ADA</span>`];
      if (it.ch != null) bits.push(`<span class="${it.ch > 0 ? "up" : it.ch < 0 ? "dn" : "mu"}">${pct(it.ch)}</span>`);
      if (it.net) bits.push(`<span class="mu">net</span><span class="${it.net > 0 ? "up" : "dn"}">${it.net > 0 ? "+" : "−"}${ada(Math.abs(it.net))}</span>`);
      if (it.cs === "graduated") bits.push(`<span class="mu">graduated</span>`); else if (it.prog != null) bits.push(`<span class="mu">${it.prog.toFixed(0)}% to grad</span>`);
      return `<a class="it" href="${esc(coinUrl(it))}">${img(it)}<span class="au">★</span><b>$${esc(it.tk)}</b>${bits.join(" ")}</a>`;
    }
    return "";
  }

  function emptyMsg() {
    if (mode === "rd") return `No races open right now. Picks open on their own when a new Solada coin launches. <a href="https://gatorrundowns.fun/paddock.html" target="_blank" rel="noopener">Paddock</a>`;
    if (mode === "watch") return `Your watchlist is empty. Tap ☆ in the Gator Eyes coin panel to star a coin, or import your gatoreyes.fun list from the toolbar button.`;
    return `No trades on the Gator Eyes tape yet.`;
  }

  function paint(d) {
    data = d;
    const h = ensure(), run = h.shadowRoot.querySelector(".run"), vp = h.shadowRoot.querySelector(".vp");
    const items = (d && d.items) || [];
    const races = items.filter((i) => i.t === "race").length;
    let html = items.map(item).join("");
    if (mode === "rd" && !races) html = `<span class="msg">${emptyMsg()}</span>` + html;
    if (!items.length && mode !== "rd") html = `<span class="msg">${emptyMsg()}</span>`;
    run.classList.remove("go");
    run.innerHTML = html;
    // Scroll only when the content is wider than the strip. Duplicate it so the loop is seamless.
    if (run.scrollWidth > vp.clientWidth && items.length) {
      run.innerHTML = html + html;
      run.style.setProperty("--dur", Math.max(20, Math.round(run.scrollWidth / 2 / 55)) + "s");
      void run.offsetWidth;
      run.classList.add("go");
    }
  }

  function load() {
    if (mode === "off" || document.hidden) return;
    try {
      chrome.runtime.sendMessage({ type: "ribbon", mode, watch }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) { if (!data) paint({ items: [] }); return; }
        if (res.mode !== mode) return;   // the user switched sources while this was loading
        const h = ensure(), run = h.shadowRoot.querySelector(".run");
        // Mid-scroll: queue it for the end of the loop. Otherwise paint now.
        if (data && run.classList.contains("go") && data.mode === res.mode) pending = res; else paint(res);
      });
    } catch { /* extension reloaded; this page's script is orphaned */ clearInterval(timer); }
  }

  function setMode(m) {
    mode = MODES.some(([k]) => k === m) ? m : m === "off" ? "off" : "trades";
    clearInterval(timer); timer = null; pending = null;
    if (mode === "off") return remove();
    ensure(); data = null;
    paint({ mode, items: [], play: "https://gatorrundowns.fun/paddock.html", results: "https://gatorrundowns.fun/track.html" });
    h1().querySelector(".run").innerHTML = `<span class="msg">Loading…</span>`;
    load();
    timer = setInterval(load, EVERY[mode]);
  }
  const h1 = () => ensure().shadowRoot;

  // Countdowns and "x ago" tick every second without a re-fetch.
  setInterval(() => {
    if (!host || mode === "off") return;
    const now = Date.now();
    host.shadowRoot.querySelectorAll("[data-close]").forEach((el) => { const left = Number(el.dataset.close) - now; el.textContent = left > 0 ? clock(left) : "closed"; });
    host.shadowRoot.querySelectorAll("[data-ago]").forEach((el) => { el.textContent = ago(Number(el.dataset.ago)); });
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && mode !== "off") load(); });

  try {
    chrome.storage.local.get(["ribbon", "watch"], (v) => {
      watch = Array.isArray(v && v.watch) ? v.watch : [];
      setMode((v && v.ribbon) || "trades");
    });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "local") return;
      if (ch.watch) { watch = Array.isArray(ch.watch.newValue) ? ch.watch.newValue : []; if (mode === "watch") { pending = null; data = null; load(); } }
      if (ch.ribbon && (ch.ribbon.newValue || "trades") !== mode) setMode(ch.ribbon.newValue || "trades");
    });
  } catch {}
})();
