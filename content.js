// Gator Eyes extension: content script for solada.fun and snek.fun.
// Shows a small, read-only flow panel on coin pages. It only reads the page
// URL (never the page contents or your wallet) and asks the background
// worker for the Gator Eyes numbers for that coin. The Ask Quagmire box sends
// only the question typed into it.
(() => {
  const HOST_ID = "gator-eyes-panel-host";
  let current = null;     // last page key rendered
  let timer = null;
  let collapsed = false;
  let askOpen = false;    // Ask Quagmire section open (remembered)
  let askTk = "";         // ticker of the coin on screen, for the quick questions
  let askEl = null;       // the Ask Quagmire section; kept across the 60 s refreshes so answers and typing survive
  let askPrev = "";       // last question asked, sent as context for follow-ups

  const n = (v, d = 0) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: d });
  const ada = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + "k" : n(v));
  const pct = (p) => (p == null ? "–" : (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(1) + "%");
  const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1e3); return s < 60 ? Math.round(s) + "s" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KIND = { big: "Whale trade", spike: "Volume spike", dev: "Creator sell", launch: "Fast Lunge", hatch: "Hatchling", watch: "Watch", gaey: "$GAEY" };
  const dur = (ms) => { const m = Math.max(0, Math.round(ms / 6e4)); return m < 60 ? m + "m" : m < 1440 ? Math.floor(m / 60) + "h " + (m % 60) + "m" : Math.floor(m / 1440) + "d " + Math.floor((m % 1440) / 60) + "h"; };
  const until = (ms) => { const d = ms - Date.now(); return d < 3600e3 ? "in " + Math.max(1, Math.round(d / 6e4)) + "m" : d < 86400e3 ? "in " + Math.round(d / 3600e3) + "h" : "in " + Math.round(d / 86400e3) + "d"; };
  const day = (ms) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const sp = (p) => (p == null ? "–" : p > 0 && p < 0.01 ? "<0.01%" : (p >= 10 ? p.toFixed(1) : p.toFixed(2)) + "%");

  function pageOf(href) {
    const u = new URL(href);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "solada.fun") {
      const m = /^\/coin\/([^/?#]+)/.exec(u.pathname);
      if (m) return { src: "solada", key: decodeURIComponent(m[1]) };
      // Markets page: /markets?token=<policy id + hex asset name>, also repeated as #/token/<unit>.
      if (/^\/markets\/?$/.test(u.pathname)) {
        const hm = /^#\/token\/([0-9a-fA-F]{56,})/.exec(u.hash);
        const t = (hm && hm[1]) || u.searchParams.get("token") || "";
        return /^[0-9a-fA-F]{56,}$/.test(t) ? { src: "solada", key: t.toLowerCase() } : null;
      }
      return null;
    }
    if (h === "snek.fun") { const m = /^\/token\/([^/?#]+)/.exec(u.pathname); return m ? { src: "snek", key: decodeURIComponent(m[1]) } : null; }
    return null;
  }

  const CSS = `
    :host { all: initial; }
    .ge { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 300px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow-y: auto;
      font: 13px/1.4 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #e6e6e0;
      background: #0d0f0c; border: 1px solid #2a2e26; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.5); overflow: hidden; }
    .hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #141712; border-bottom: 1px solid #2a2e26; cursor: pointer; user-select: none; }
    .hd img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; background: #222; }
    .hd b { font-size: 14px; }
    .hd .src { font-size: 10px; letter-spacing: .06em; text-transform: uppercase; color: #c9a227; border: 1px solid #4a3f14; border-radius: 999px; padding: 1px 7px; }
    .hd .sp { flex: 1; }
    .hd .tg { color: #9a9f93; font-size: 12px; }
    .bd { padding: 10px 12px; }
    .g { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; }
    .k { color: #9a9f93; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
    .v { font: 600 15px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin-top: 2px; }
    .up { color: #7ed48a; } .dn { color: #ee7b6d; } .mu { color: #9a9f93; }
    .bar { height: 6px; border-radius: 3px; background: #ee7b6d; overflow: hidden; margin: 10px 0 4px; }
    .bar i { display: block; height: 100%; background: #7ed48a; }
    .sub { color: #9a9f93; font-size: 11.5px; }
    .al { margin-top: 10px; border-top: 1px solid #2a2e26; padding-top: 8px; }
    .al div { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .al .t { color: #9a9f93; }
    .ft { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid #2a2e26; background: #101310; font-size: 12px; }
    a { color: #c9a227; text-decoration: none; font-weight: 600; } a:hover { text-decoration: underline; }
    .note { padding: 12px; color: #9a9f93; }
    .al .r { display: block; padding: 3px 0; }
    .al .r .l { display: flex; justify-content: space-between; gap: 8px; }
    .al .r .m { color: #9a9f93; font-size: 11.5px; }
    .ex { margin-top: 10px; border-top: 1px solid #2a2e26; padding-top: 8px; display: grid; gap: 5px; }
    .ex .row { display: grid; grid-template-columns: 74px 1fr; gap: 8px; font-size: 12px; }
    .ex .row .k { padding-top: 1px; font-size: 10.5px; }
    .ex .ok { color: #7ed48a; }
    .race { display: flex; align-items: center; gap: 8px; margin: -10px -12px 10px; padding: 8px 12px; background: #1d2a16; border-bottom: 1px solid #2f4a22; font-size: 12px; }
    .race b { color: #9be08f; }
    .race .sp { flex: 1; }
    .race a { background: #c9a227; color: #0d0f0c; border-radius: 6px; padding: 4px 9px; }
    .race a:hover { text-decoration: none; filter: brightness(1.08); }
    .ge.min .bd, .ge.min .ft, .ge.min .ask { display: none; }
    .ask { border-top: 1px solid #2a2e26; }
    .ask .tgl { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px; background: none; border: 0; color: #c9a227;
      font: 600 12px/1.2 inherit; font-family: inherit; cursor: pointer; text-align: left; }
    .ask .tgl:hover { background: #141712; }
    .ask .tgl span { margin-left: auto; color: #9a9f93; font-weight: 400; }
    .ask .in { display: none; padding: 0 12px 10px; }
    .ask.open .in { display: block; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .chips button { font: 12px/1 inherit; font-family: inherit; color: #e6e6e0; background: #1a1e17; border: 1px solid #2a2e26; border-radius: 999px; padding: 5px 9px; cursor: pointer; }
    .chips button:hover { border-color: #c9a227; }
    form { display: flex; gap: 6px; }
    input { flex: 1; min-width: 0; font: 13px/1.2 inherit; font-family: inherit; color: #e6e6e0; background: #0a0c09; border: 1px solid #2a2e26; border-radius: 8px; padding: 7px 9px; outline: none; }
    input:focus { border-color: #c9a227; }
    form button { font: 600 12px/1 inherit; font-family: inherit; color: #0d0f0c; background: #c9a227; border: 0; border-radius: 8px; padding: 0 11px; cursor: pointer; }
    form button:disabled { opacity: .6; cursor: default; }
    .ans { margin-top: 8px; max-height: 220px; overflow: auto; font-size: 12.5px; line-height: 1.45; }
    .ans:empty { display: none; }
    .ans .q { color: #9a9f93; font-size: 11.5px; margin-bottom: 4px; }
    .ans ul, .ans ol { margin: 4px 0; padding-left: 18px; }
    .ans .nfa { color: #9a9f93; font-size: 11px; margin-top: 6px; }
  `;

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = HOST_ID;
    const sh = host.attachShadow({ mode: "open" });
    const st = document.createElement("style"); st.textContent = CSS; sh.appendChild(st);
    const box = document.createElement("div"); box.className = "ge"; sh.appendChild(box);
    const main = document.createElement("div"); main.className = "main"; box.appendChild(main);
    box.appendChild(askSection());
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function render(html) {
    const host = ensureHost();
    const box = host.shadowRoot.querySelector(".ge");
    box.className = "ge" + (collapsed ? " min" : "");
    const main = box.querySelector(".main");
    main.innerHTML = html;
    updateChips();
    const hd = main.querySelector(".hd");
    if (hd) hd.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      collapsed = !collapsed; box.classList.toggle("min", collapsed);
      try { chrome.storage.local.set({ collapsed }); } catch {}
      const tg = box.querySelector(".tg"); if (tg) tg.textContent = collapsed ? "▴" : "▾";
    });
  }

  // ---- Ask Quagmire ------------------------------------------------------------------------------------------------
  // The same Quagmire as the gatoreyes.fun chat box and /ask in Discord. Only the typed question leaves the browser.
  const ALLOWED = new Set(["STRONG", "B", "EM", "I", "UL", "OL", "LI", "BR", "P", "SPAN", "CODE", "A"]);
  function clean(html) {
    // Quagmire answers are small HTML from our own worker; still, keep only plain formatting and https links.
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const out = document.createElement("div");
    const walk = (src, dst) => {
      for (const node of src.childNodes) {
        if (node.nodeType === 3) { dst.appendChild(document.createTextNode(node.nodeValue)); continue; }
        if (node.nodeType !== 1) continue;
        if (!ALLOWED.has(node.tagName)) { walk(node, dst); continue; }
        const el = document.createElement(node.tagName.toLowerCase());
        if (node.tagName === "A") {
          const href = node.getAttribute("href") || "";
          if (!/^https:\/\//i.test(href)) { walk(node, dst); continue; }
          el.href = href; el.target = "_blank"; el.rel = "noopener noreferrer";
        }
        walk(node, el);
        dst.appendChild(el);
      }
    };
    walk(doc.body.firstChild || doc.body, out);
    return out;
  }

  function askSection() {
    if (askEl) return askEl;
    const sec = document.createElement("div");
    sec.className = "ask" + (askOpen ? " open" : "");
    sec.innerHTML = `<button type="button" class="tgl">Ask Quagmire<span>${askOpen ? "▾" : "▸"}</span></button>
      <div class="in"><div class="chips"></div>
        <form><input type="text" maxlength="200" placeholder="Ask about this coin…" aria-label="Ask Quagmire"><button type="submit">Ask</button></form>
        <div class="ans" aria-live="polite"></div></div>`;
    const tgl = sec.querySelector(".tgl");
    tgl.addEventListener("click", () => {
      askOpen = !askOpen; sec.classList.toggle("open", askOpen);
      tgl.querySelector("span").textContent = askOpen ? "▾" : "▸";
      try { chrome.storage.local.set({ askOpen }); } catch {}
      if (askOpen) sec.querySelector("input").focus();
    });
    // Keep the host page's keyboard shortcuts from firing while typing here.
    for (const ev of ["keydown", "keyup", "keypress"]) sec.addEventListener(ev, (e) => e.stopPropagation());
    sec.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = sec.querySelector("input");
      const q = inp.value.trim();
      if (q) { inp.value = ""; ask(q); }
    });
    sec.querySelector(".chips").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-q]");
      if (b) ask(b.dataset.q);
    });
    askEl = sec;
    return sec;
  }

  function updateChips() {
    if (!askEl) return;
    const box = askEl.querySelector(".chips");
    const tk = askTk;
    const want = tk ? [["Summary", `$${tk}`], ["Holders", `$${tk} holders`], ["Burns", `$${tk} burns`], ["Unlocks", `$${tk} unlocks`]]
      : [["Most traded today", "most traded today"], ["Close to graduating", "what's close to graduating"]];
    const sig = want.map((w) => w[1]).join("|");
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = want.map(([l, q]) => `<button type="button" data-q="${esc(q)}">${esc(l)}</button>`).join("");
    askEl.querySelector("input").placeholder = tk ? `Ask about $${tk}…` : "Ask Quagmire…";
  }

  function ask(q) {
    if (!askEl) return;
    const ans = askEl.querySelector(".ans");
    const btn = askEl.querySelector("form button");
    // Plain follow-ups ("holders?", "any burns") lean on the coin on screen when nothing else is named.
    const prev = askPrev || (askTk ? `$${askTk}` : "");
    // "is it graduating?" / "who holds this coin" -> name the coin on screen, unless a ticker is already given.
    let sendQ = q;
    if (askTk && !/\$[a-z0-9]/i.test(q)) {
      const r = sendQ.replace(/\b(this coin|this token|this one|this|it)\b/i, `$${askTk}`);
      sendQ = r !== sendQ ? r : sendQ;
    }
    btn.disabled = true;
    ans.innerHTML = `<div class="q">${esc(q)}</div><div class="mu">Quagmire is crunching…</div>`;
    chrome.runtime.sendMessage({ type: "ask", q: sendQ, prev, tk: askTk }, (res) => {
      btn.disabled = false;
      askPrev = q;
      ans.innerHTML = `<div class="q">${esc(q)}</div>`;
      if (chrome.runtime.lastError || !res || !res.ok) {
        ans.insertAdjacentHTML("beforeend", `<div class="mu">Couldn't reach Quagmire right now. Try again in a minute.</div>`);
        return;
      }
      ans.appendChild(clean(res.html));
      ans.insertAdjacentHTML("beforeend", `<div class="nfa">Live Gator Eyes data. Not financial advice.</div>`);
      ans.scrollTop = 0;
    });
  }

  function header(coin, page) {
    const img = coin && coin.img ? `<img src="${esc(coin.img)}" alt="">` : `<img src="${chrome.runtime.getURL("icons/icon32.png")}" alt="">`;
    const tk = coin ? "$" + esc(coin.tk) : "Gator Eyes";
    return `<div class="hd">${img}<b>${tk}</b><span class="src">${page.src === "snek" ? "Snek.fun" : "Solada"}</span><span class="sp"></span><span class="sub">Gator Eyes</span><span class="tg">${collapsed ? "▴" : "▾"}</span></div>`;
  }

  function view(res, page) {
    const site = res.site || "https://gatoreyes.fun";
    const coin = res.coin;
    if (!coin) {
      return header(null, page) + `<div class="note">Gator Eyes hasn't seen trades for this coin in the last 24 h, or it isn't in the tracked set yet. Coins show up here after their first tracked trade.</div>
        <div class="ft"><a href="${site}/tokens.html" target="_blank" rel="noopener">Open gatoreyes.fun</a><span class="sub">read-only</span></div>`;
    }
    const w = coin.w || {}, d = w.h24 || { v: 0, n: 0, b: 0, s: 0, net: 0, wal: 0, ch: null }, h = w.h1;
    const buyShare = d.v > 0 ? Math.round((d.b / d.v) * 100) : 50;
    const netCls = d.net > 0 ? "up" : d.net < 0 ? "dn" : "mu";
    const chCls = d.ch > 0 ? "up" : d.ch < 0 ? "dn" : "mu";
    const q = encodeURIComponent(coin.tk || "");
    const cid = encodeURIComponent(coin.id || "");
    const ch = (v) => (v == null ? "" : `<span class="${v > 0 ? "up" : v < 0 ? "dn" : "mu"}">${pct(v)}</span>`);
    const alerts = (res.alerts || []).map((a) => {
      const bits = [];
      if (a.ada) bits.push(ada(a.ada) + " ADA" + (a.side && a.kind !== "spike" ? " " + a.side : ""));
      if (a.kind === "spike" && a.pace) bits.push(a.pace + "x normal pace");
      if (a.kind === "launch" && a.wallets) bits.push(a.wallets + " wallets");
      if (a.kind === "big" && a.creator) bits.push("creator wallet");
      const after = a.h1 != null || a.h24 != null ? `Price after: 1h ${a.h1 != null ? ch(a.h1) : "–"}${a.h24 != null ? " · 24h " + ch(a.h24) : ""}` : "";
      return `<div class="r"><div class="l"><span>${esc(KIND[a.kind] || a.kind)}</span><span class="t">${ago(a.at)} ago</span></div>${bits.length || after ? `<div class="m">${esc(bits.join(" · "))}${bits.length && after ? " · " : ""}${after}</div>` : ""}</div>`;
    }).join("");
    const x = res.extra || {};
    const rows = [];
    // Launch speed and age
    if (coin.born) {
      const age = dur(Date.now() - coin.born);
      if (coin.cs === "graduated" && coin.gAt) rows.push(["Launch", `Graduated in ${dur(coin.gAt - coin.born)} · ${age} old`]);
      else if (coin.prog != null && coin.kind === "curve") rows.push(["Launch", `${(coin.prog / 100).toFixed(1)}% to graduation · ${age} old`]);
      else rows.push(["Launch", `${age} old`]);
    }
    // Creator wallet
    if (x.creator) {
      const c = x.creator;
      const held = c.pct != null ? `Holds ${sp(c.pct)}` : c.under != null ? `Holds under ${sp(c.under)}` : "";
      const lk = c.locked > 0 ? `${sp(c.locked)} locked` : "";
      const sold = c.sold > 0 ? `<span class="dn">sold ${ada(c.sold)} ADA</span>${c.last ? " " + ago(c.last) + " ago" : ""}` : (c.full ? `<span class="ok">no sells in 24h</span>` : "no sells in recent trades");
      rows.push(["Creator", [esc(held), esc(lk), sold].filter(Boolean).join(" · ")]);
    }
    // Next unlock
    if (x.unlock && x.unlock.next) {
      const u = x.unlock.next;
      rows.push(["Next unlock", `${sp(u.pct)}${u.dev ? " (creator)" : ""} · ${esc(day(u.at))}, ${until(u.at)}${u.ver === "script" ? ` · <span class="ok" title="Lock script checked on the chain">✓ on-chain</span>` : ""}${x.unlock.more ? ` · +${x.unlock.more} more` : ""}`]);
    } else if (x.unlock && x.unlock.lockedPct > 0) rows.push(["Unlocks", `${sp(x.unlock.lockedPct)} locked, no upcoming date found`]);
    // Liquidity (shows once the liquidity tracker is live)
    if (x.liq) {
      const sh = x.liq.share, parts = [];
      if (sh.solada) parts.push(`Solada ${Math.round(sh.solada)}%`);
      if (sh.creator) parts.push(`creator ${Math.round(sh.creator)}%`);
      if (sh.burned) parts.push(`burned ${Math.round(sh.burned)}%`);
      if (sh.other) parts.push(`others ${Math.round(sh.other)}%`);
      rows.push(["Liquidity", `${ada(x.liq.ada)} ADA in pool${x.liq.depth != null ? ` (${x.liq.depth.toFixed(1)}% of MC)` : ""}${parts.length ? " · LP: " + esc(parts.join(", ")) : ""}${x.liq.ch24 ? " · 24h " + ch(x.liq.ch24) : ""}`]);
    }
    const extras = rows.length ? `<div class="ex">${rows.map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${v}</span></div>`).join("")}</div>` : "";
    const race = x.race ? `<div class="race"><span><b>Racing in Gator Run Downs</b> · picks close ${until(x.race.closesAt)}${x.race.buyers != null ? ` · ${n(x.race.buyers)} buyers` : ""}</span><span class="sp"></span><a href="${esc(x.race.play)}" target="_blank" rel="noopener">Pick</a></div>` : "";
    return header(coin, page) + `
      <div class="bd">${race}
        <div class="g">
          <div><div class="k">24h volume</div><div class="v">${ada(d.v)} ADA</div></div>
          <div><div class="k">Net flow 24h</div><div class="v ${netCls}">${d.net > 0 ? "+" : d.net < 0 ? "−" : ""}${ada(Math.abs(d.net))}</div></div>
          <div><div class="k">Trades · wallets</div><div class="v">${n(d.n)} · ${n(d.wal)}</div></div>
          <div><div class="k">Price 24h</div><div class="v ${chCls}">${pct(d.ch)}</div></div>
        </div>
        <div class="bar" title="buys vs sells, 24h"><i style="width:${buyShare}%"></i></div>
        <div class="sub">Buys ${ada(d.b)} · Sells ${ada(d.s)} ADA${h ? ` · last hour ${ada(h.v)} ADA (${pct(h.ch)})` : ""}${coin.mc ? ` · MC ${ada(coin.mc)} ADA` : ""}</div>
        ${extras}
        ${alerts ? `<div class="al"><div class="k">Gator Eyes alerts, last 24h</div>${alerts}</div>` : ""}
      </div>
      <div class="ft">
        <span><a href="${site}/coincard.html?coin=${cid}" target="_blank" rel="noopener">Coin card</a> · <a href="${site}/holders.html?coin=${cid}" target="_blank" rel="noopener">Holders</a> · <a href="${site}/tokens.html?q=${q}" target="_blank" rel="noopener">Tokens</a></span>
        <span class="sub" title="${esc(res.updatedAt || "")}">${res.updatedAt ? ago(Date.parse(res.updatedAt)) + " ago" : ""}</span>
      </div>`;
  }

  function refresh(page) {
    chrome.runtime.sendMessage({ type: "coin", page }, (res) => {
      if (chrome.runtime.lastError || !res || !res.ok) {
        askTk = "";
        render(header(null, page) + `<div class="note">Couldn't reach the Gator Eyes feed right now.</div>`);
        return;
      }
      askTk = res.coin && res.coin.tk ? String(res.coin.tk) : "";
      render(view(res, page));
    });
  }

  function tick() {
    const page = pageOf(location.href);
    const key = page ? page.src + ":" + page.key : null;
    if (key !== current) {
      current = key;
      clearInterval(timer); timer = null;
      const host = document.getElementById(HOST_ID);
      if (!page) { if (host) host.remove(); return; }
      askPrev = "";
      if (askEl) { askEl.querySelector(".ans").innerHTML = ""; }
      refresh(page);
      timer = setInterval(() => refresh(page), 60e3);
    }
  }

  try { chrome.storage.local.get(["collapsed", "askOpen"], (v) => { collapsed = !!(v && v.collapsed); askOpen = !!(v && v.askOpen); tick(); }); } catch { tick(); }
  // Both sites are single-page apps: watch for in-app navigation.
  setInterval(tick, 1000);
  window.addEventListener("popstate", tick);
})();
