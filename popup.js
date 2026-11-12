const ada = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + "M" : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + "k" : Math.round(v).toLocaleString("en-US"));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (ms) => { const s = Math.max(0, (Date.now() - ms) / 1e3); return s < 60 ? Math.round(s) + "s" : Math.round(s / 60) + "m"; };
const $ = (id) => document.getElementById(id);

// ---- Tabs ---------------------------------------------------------------------------------------------------
const TABS = { movers: ["t-movers", "p-movers"], rd: ["t-rd", "p-rd"] };
let rdStarted = false;
function show(name) {
  for (const [k, [t, p]] of Object.entries(TABS)) { $(t).setAttribute("aria-selected", String(k === name)); $(p).hidden = k !== name; }
  $("tag").textContent = name === "rd" ? "Gator Run Downs" : "free · read-only";
  chrome.storage.local.set({ popupTab: name });
  if (name === "rd" && !rdStarted) { rdStarted = true; startRunDowns(); }
}
$("t-movers").addEventListener("click", () => show("movers"));
$("t-rd").addEventListener("click", () => show("rd"));

// ---- Movers (unchanged behaviour) ---------------------------------------------------------------------------
chrome.runtime.sendMessage({ type: "top" }, (res) => {
  const el = $("list");
  if (chrome.runtime.lastError || !res || !res.ok) { el.innerHTML = '<div class="note">Couldn\'t reach the Gator Eyes feed right now.</div>'; return; }
  const site = res.site || "https://gatoreyes.fun";
  el.innerHTML = "<table>" + res.coins.map((c) => {
    const d = c.w.h24, cls = d.net > 0 ? "up" : d.net < 0 ? "dn" : "mu";
    return `<tr><td><a href="${site}/coincard.html?coin=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">$${esc(c.tk)}</a><span class="src">${c.src === "snek" ? "Snek" : "Solada"}</span></td><td class="n">${ada(d.v)} ADA</td><td class="n ${cls}">${d.net > 0 ? "+" : d.net < 0 ? "−" : ""}${ada(Math.abs(d.net))}</td></tr>`;
  }).join("") + "</table>";
  $("upd").textContent = res.updatedAt ? "updated " + ago(Date.parse(res.updatedAt)) + " ago" : "";
});

// ---- Run Downs ----------------------------------------------------------------------------------------------
const R = globalThis.GERD;
const GATE = R.RD + "/gate.html";
let me = { signedIn: false }, target = null, coins = [], busy = false;

function renderWho() {
  const w = $("who");
  if (me.signedIn) {
    w.innerHTML = `Picking as <b>${esc(me.username || "you")}</b>${me.weekPoints != null ? ` · ${R.int(me.weekPoints)} pts this week` : ""}<span class="sp"></span><a href="${R.RD}/windows.html" target="_blank" rel="noopener">My Picks</a>`;
    if (me.rulesAgreed === false) w.innerHTML += `<div class="rs err" style="width:100%">Accept the fair-play rules once on the <a href="${R.RD}/paddock.html" target="_blank" rel="noopener">Paddock</a> before picking here.</div>`;
  } else {
    w.innerHTML = `Not signed in<span class="sp"></span><a class="btn" href="${GATE}" target="_blank" rel="noopener">Sign in</a>`;
  }
}

function renderRaces() {
  const box = $("races"), now = Date.now();
  const live = coins.filter((c) => R.closeAt(c) > now - 60e3);   // keep a just-closed card for a minute
  const open = coins.filter((c) => R.closeAt(c) > now).length;
  $("rdct").textContent = open ? String(open) : "";
  if (!live.length) {
    box.innerHTML = `<div class="note"><b>No picks open right now.</b><br>New Solada launches show up here automatically, with 7½ minutes to pick from when each one opens.${me.signedIn ? "" : " Sign in at Gator Run Downs first so you're ready."}<br><a href="${R.RD}/track.html" target="_blank" rel="noopener">See results</a></div>`;
    return;
  }
  box.innerHTML = live.map((c) => R.raceCard(c, me.signedIn, target, now)).join("");
}

// Countdown and points note every second, without a re-fetch.
function tick() {
  const now = Date.now();
  document.querySelectorAll(".race").forEach((el) => {
    const close = Number(el.dataset.close), left = close - now, cd = el.querySelector("[data-cd]");
    if (left > 0) {
      if (cd) cd.textContent = R.clock(left);
      const pay = el.querySelector("[data-pay]"); if (pay) pay.textContent = R.payNote(Number(el.dataset.start), now);
    } else if (!el.classList.contains("shut")) {
      el.classList.add("shut");
      if (cd) cd.textContent = "CLOSED";
      el.querySelectorAll("[data-pick]").forEach((b) => (b.disabled = true));
      const n = el.querySelector("[data-note]"); if (n) n.textContent = "Picks are closed. Results land at the end of the Sprint.";
      const pay = el.querySelector("[data-pay]"); if (pay) pay.remove();
    }
  });
}

async function load() {
  if (busy) return;
  try {
    const [m, pad, now] = await Promise.all([
      R.get("/me").catch(() => ({ signedIn: false })),
      R.get("/paddock"),
      R.get("/now").catch(() => null),
    ]);
    me = m || { signedIn: false };
    if (now && now.target) target = now.target;
    coins = (pad && pad.coins) || [];
    renderWho();
    renderRaces();
  } catch (e) {
    $("races").innerHTML = `<div class="note">Couldn't reach Gator Run Downs right now. <a href="${R.RD}/paddock.html" target="_blank" rel="noopener">Open the Paddock</a></div>`;
  }
}

$("races").addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-pick]");
  if (!b || b.disabled) return;
  const card = b.closest(".race"), coinId = card.dataset.coin, choice = Number(b.dataset.pick), note = card.querySelector("[data-note]");
  const btns = card.querySelectorAll("[data-pick]");
  busy = true;
  btns.forEach((x) => (x.disabled = true));
  note.className = "rs"; note.textContent = "Saving your pick…";
  try {
    await R.pick(coinId, choice);
    const c = coins.find((x) => x.coinId === coinId); if (c) c.mine = choice;
    btns.forEach((x) => { x.setAttribute("aria-pressed", String(Number(x.dataset.pick) === choice)); x.disabled = false; });
    note.className = "rs ok"; note.textContent = `${choice ? "Lunge" : "No Lunge"} saved. Changing it resets the time on your pick.`;
  } catch (e) {
    btns.forEach((x) => (x.disabled = false));
    note.className = "rs err";
    if (e.status === 401) { me = { signedIn: false }; renderWho(); note.innerHTML = `Sign in at <a href="${GATE}" target="_blank" rel="noopener">Gator Run Downs</a> to pick.`; btns.forEach((x) => (x.disabled = true)); }
    else if (e.needAgree || e.status === 428) note.innerHTML = `Accept the fair-play rules once on the <a href="${R.RD}/paddock.html" target="_blank" rel="noopener">Paddock</a> (make any pick there), then picks work here too.`;
    else if (e.status === 409) { note.textContent = "That window is closed."; btns.forEach((x) => (x.disabled = true)); }
    else note.textContent = e.message || "Something went wrong. Try again.";
  } finally { busy = false; }
});

// Alerts toggle: notifications is an optional permission, asked for only when the player turns alerts on.
async function initAlerts() {
  const box = $("alerts");
  const st = await chrome.storage.local.get("rdAlerts");
  const has = await chrome.permissions.contains({ permissions: ["notifications"] });
  box.checked = !!st.rdAlerts && has;
  box.addEventListener("change", async () => {
    if (box.checked) {
      const ok = await chrome.permissions.request({ permissions: ["notifications"] });
      box.checked = ok;
      await chrome.storage.local.set({ rdAlerts: ok });
    } else await chrome.storage.local.set({ rdAlerts: false });
  });
}

function startRunDowns() {
  initAlerts();
  load();
  setInterval(tick, 1000);
  setInterval(load, 10000);
  chrome.runtime.sendMessage({ type: "rdcheck" }, () => void chrome.runtime.lastError);
}

// Open on the last tab used; if races are open and the badge shows a count, go straight to Run Downs.
chrome.action.getBadgeText({}, (txt) => {
  chrome.storage.local.get("popupTab", (st) => show(txt ? "rd" : st.popupTab === "rd" ? "rd" : "movers"));
});
