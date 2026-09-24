/* Rezervačný sprievodca: 1) počet osôb, 2) čo chcú hrať, 3) termín(y), 4) kontaktné údaje.
   - Ak je vyplnený firebase-config.js, termíny sa ukladajú do Firebase Firestore (naozajstná rezervácia).
   - Inak beží testovací režim: údaje sa ukladajú len do tohto prehliadača (localStorage). */

/* ============ NASTAVENIE ============ */
const SLOT_MINUTES = 30;   // dĺžka jedného políčka
const DAYS_AHEAD   = 14;   // koľko dní dopredu sa dá rezervovať
const HOURS = { 0:[13,22], 1:[15,22], 2:[15,22], 3:[15,22], 4:[15,22], 5:[15,24], 6:[13,24] }; // 0 = nedeľa
const FIREBASE_VERSION = "10.12.2";

const PACKAGES = {
  hry:     { label: "Len hry", hint: "Vyberte toľko termínov, koľko potrebujete." },
  "3plus1":{ label: "Ponuka 3+1", hint: "Odporúčame vybrať 4 termíny laser game (3 platené + 1 zadarmo)." },
  monster: { label: "Monster Chill balíček (185 €, 8–12 ľudí)", hint: "Odporúčame vybrať 3 termíny laser game podľa balíčka Monster Chill." },
  bigbang: { label: "Big Bang Chill balíček (330 €, 18–26 ľudí)", hint: "Odporúčame vybrať 6 termínov laser game podľa balíčka Big Bang Chill." }
};

/* ============ POMOCNÉ ============ */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => new Date(s + "T12:00:00");
const dayNames = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
const slotId = (date, time) => date + "_" + time.replace(":", "");

function timesFor(date) {
  const [from, to] = HOURS[date.getDay()], out = [];
  for (let m = from * 60; m + SLOT_MINUTES <= to * 60; m += SLOT_MINUTES)
    out.push(pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60));
  return out;
}

function say(text, type) {
  const el = $("status");
  if (!el) return;
  el.textContent = text || "";
  el.className = "status" + (type ? " " + type : "");
}

/* ============ ÚLOŽISKO ============ */
let store = null;

function localStore() {
  const KEY = "chillpoint_test_bookings";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const listeners = new Set();
  const notify = () => listeners.forEach(fn => fn());
  window.addEventListener("storage", e => { if (e.key === KEY) notify(); });
  return {
    mode: "test",
    watch(dateStr, cb) {
      const run = () => cb(new Set(read().filter(b => b.date === dateStr).map(b => b.time)));
      listeners.add(run); run();
      return () => listeners.delete(run);
    },
    async book(items, customer) {
      const all = read();
      if (items.some(i => all.some(b => b.date === i.date && b.time === i.time))) {
        const err = new Error("taken"); err.code = "taken"; throw err;
      }
      items.forEach(i => all.push({ ...i, ...customer, createdAt: new Date().toISOString() }));
      localStorage.setItem(KEY, JSON.stringify(all));
      notify();
    },
    reset() { localStorage.removeItem(KEY); notify(); }
  };
}

async function firebaseStore(cfg) {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
  const [{ initializeApp }, fs] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js")]);
  const db = fs.getFirestore(initializeApp(cfg));
  return {
    mode: "firebase",
    watch(dateStr, cb, onError) {
      const q = fs.query(fs.collection(db, "slots"), fs.where("date", "==", dateStr));
      return fs.onSnapshot(q, snap => cb(new Set(snap.docs.map(d => d.data().time))), onError);
    },
    async book(items, c) {
      const batch = fs.writeBatch(db);
      for (const it of items) {
        const id = slotId(it.date, it.time);
        batch.set(fs.doc(db, "slots", id), { date: it.date, time: it.time, createdAt: fs.serverTimestamp() });
        batch.set(fs.doc(db, "bookings", id), {
          date: it.date, time: it.time, name: c.name, phone: c.phone, email: c.email,
          players: c.players, package: c.package, note: c.note, createdAt: fs.serverTimestamp()
        });
      }
      try { await batch.commit(); }
      catch (e) {
        if (e.code === "permission-denied") { const err = new Error("taken"); err.code = "taken"; throw err; }
        throw e;
      }
    }
  };
}

async function initStore() {
  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && cfg.apiKey && !String(cfg.apiKey).startsWith("VLOZ");
  if (configured) {
    try { store = await firebaseStore(cfg); }
    catch (e) { console.error(e); say("Nepodarilo sa pripojiť k Firebase, beží testovací režim.", "err"); }
  }
  if (!store) store = localStore();
  const modeEl = $("mode");
  if (modeEl) modeEl.textContent = store.mode === "firebase"
    ? "Pripojené k Firebase: rezervácie sa ukladajú do databázy."
    : "Testovací režim: rezervácie sa ukladajú len v tomto prehliadači.";
  if (store.mode === "test" && $("resetTest")) $("resetTest").hidden = false;
}

/* ============ STAV SPRIEVODCU ============ */
const wizard = { players: 2, pkg: null };
const selected = new Map();          // "2026-09-25 15:30" -> {date, time}
let currentDate = null, unwatch = null, calendarBuilt = false;

function goStep(n) {
  document.querySelectorAll(".wz-panel").forEach(p => p.hidden = Number(p.dataset.panel) !== n);
  document.querySelectorAll(".wz-step").forEach(s => {
    const step = Number(s.dataset.step);
    s.classList.toggle("done", step < n);
    s.classList.toggle("current", step === n);
  });
  if (n === 3 && !calendarBuilt) { calendarBuilt = true; buildDays(); }
  if (n === 4) renderSummary();
}

/* --- krok 1: počet osôb --- */
$("toStep2").addEventListener("click", () => {
  const v = parseInt($("playersInput").value, 10);
  if (!v || v < 2 || v > 30) { $("playersInput").focus(); return; }
  wizard.players = v;
  goStep(2);
});

/* --- krok 2: balíček --- */
document.querySelectorAll(".wz-opt").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".wz-opt").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    wizard.pkg = btn.dataset.pkg;
    $("toStep3").disabled = false;
  });
});
$("toStep3").addEventListener("click", () => {
  $("pkgHint").textContent = (PACKAGES[wizard.pkg] || {}).hint || "";
  goStep(3);
});

/* --- krok 3: kalendár --- */
function buildDays() {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const b = document.createElement("button");
    b.type = "button"; b.className = "day"; b.dataset.date = fmt(d);
    b.innerHTML = `<small>${dayNames[d.getDay()]}</small><strong>${d.getDate()}.${d.getMonth() + 1}.</strong><span class="count"></span>`;
    b.onclick = () => showDay(fmt(d));
    $("days").appendChild(b);
  }
  showDay(fmt(today));
}

function showDay(dateStr) {
  currentDate = dateStr;
  document.querySelectorAll(".day").forEach(b => b.setAttribute("aria-pressed", b.dataset.date === dateStr));
  if (unwatch) unwatch();
  $("slots").innerHTML = '<p class="empty">Načítavam termíny…</p>';
  unwatch = store.watch(dateStr,
    busy => { if (currentDate === dateStr) renderSlots(dateStr, busy); },
    err => { console.error(err); say("Termíny sa nepodarilo načítať. Skontrolujte pripojenie a pravidlá databázy.", "err"); });
}

function renderSlots(dateStr, busy) {
  for (const t of busy) {
    const key = dateStr + " " + t;
    if (selected.delete(key)) { renderPicked(); }
  }
  const now = new Date(), isToday = dateStr === fmt(now);
  const wrap = $("slots"); wrap.innerHTML = "";
  for (const t of timesFor(parse(dateStr))) {
    const key = dateStr + " " + t, b = document.createElement("button");
    b.type = "button"; b.textContent = t;
    const past = isToday && t <= pad(now.getHours()) + ":" + pad(now.getMinutes());
    if (past) {
      b.className = "slot past"; b.disabled = true; b.setAttribute("aria-label", t + ", uplynulé");
    } else if (busy.has(t)) {
      b.className = "slot busy"; b.disabled = true; b.setAttribute("aria-label", t + ", obsadené");
    } else {
      b.className = "slot free" + (selected.has(key) ? " selected" : "");
      b.setAttribute("aria-pressed", selected.has(key));
      b.onclick = () => toggle(dateStr, t, b);
    }
    wrap.appendChild(b);
  }
}

function toggle(date, time, btn) {
  const key = date + " " + time;
  selected.has(key) ? selected.delete(key) : selected.set(key, { date, time });
  btn.classList.toggle("selected", selected.has(key));
  btn.setAttribute("aria-pressed", selected.has(key));
  renderPicked();
}

function sortedItems() {
  return [...selected.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
const label = it => { const d = parse(it.date); return `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}. o ${it.time}`; };

function renderPicked() {
  const list = $("list");
  const items = sortedItems();
  list.innerHTML = items.length ? "" : '<li class="empty">Zatiaľ nie je vybraný žiadny termín.</li>';
  for (const it of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${label(it)}</span>`;
    const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "odstrániť";
    rm.onclick = () => { selected.delete(it.date + " " + it.time); renderPicked(); showDay(currentDate); };
    li.appendChild(rm); list.appendChild(li);
  }
  document.querySelectorAll(".day").forEach(b => {
    const n = items.filter(i => i.date === b.dataset.date).length;
    b.querySelector(".count").textContent = n ? "✓ " + n : "";
  });
  $("toStep4").disabled = !items.length;
}

$("toStep4").addEventListener("click", () => goStep(4));

/* --- krok 4: súhrn + kontakt --- */
function renderSummary() {
  const items = sortedItems();
  const pkg = PACKAGES[wizard.pkg] || { label: wizard.pkg };
  $("summary").innerHTML = `
    <ul class="wz-summary-list">
      <li><span>Počet osôb</span><b>${wizard.players}</b></li>
      <li><span>Vybraná možnosť</span><b>${pkg.label}</b></li>
      <li><span>Termíny</span><b>${items.map(label).join(", ")}</b></li>
    </ul>`;
}

document.querySelectorAll("[data-back]").forEach(btn => {
  btn.addEventListener("click", () => goStep(Number(btn.dataset.back)));
});

$("resetTest") && $("resetTest").addEventListener("click", () => {
  store.reset(); say("Testovacie rezervácie boli vymazané.", "ok");
});

$("bookForm").addEventListener("submit", async e => {
  e.preventDefault();
  const items = sortedItems();
  if (!items.length) { say("Najprv vyberte aspoň jeden termín.", "err"); return; }
  const form = e.target;
  if (!form.reportValidity()) return;
  const f = new FormData(form);
  const customer = {
    name: (f.get("firstname").trim() + " " + f.get("lastname").trim()).trim(),
    phone: f.get("phone").trim(), email: f.get("email").trim(),
    players: wizard.players, package: wizard.pkg, note: (f.get("note") || "").trim()
  };
  $("submit").disabled = true; say("Odosielam rezerváciu…");
  try {
    await store.book(items, customer);
    say("Rezervácia je uložená: " + items.map(label).join(", ") + ".", "ok");
    selected.clear(); form.reset();
    $("submit").disabled = false;
  } catch (err) {
    if (err.code === "taken") {
      say("Niektorý z termínov medzitým niekto obsadil. Vráťte sa na výber termínu a skúste znova.", "err");
    } else {
      console.error(err); say("Rezerváciu sa nepodarilo uložiť. Skúste to prosím znova.", "err");
    }
    $("submit").disabled = false;
  }
});

initStore();
