/* Rezervácia laser game.
   Kroky: 1) počet hráčov, 2) deň v kalendári (2 mesiace) a časy, 3) kontaktné údaje, 4) potvrdenie.
   - Po výbere času sa tej istej partii zablokujú časy počas oddychu (rest), iným partiám ostávajú voľné.
   - Obsadené časy (od iných) sú červené a nedajú sa kliknúť.
   - Úložisko: Firebase (laser/<env>/…), alebo testovací režim v tomto prehliadači. */
(function () {
  "use strict";

  const root = document.getElementById("rz");
  if (!root) return;

  const CFG = window.CP_CONFIG || {};
  const B = Object.assign({
    hours: {}, daysOff: [], step: 20, game: 15, change: 5, rest: 40,
    minPlayers: 2, maxPlayers: 16, maxGames: 8, leadMinutes: 15,
    offer: { minPlayers: 8, paid: 3, free: 1 },   // ponuka 3+1; false = vypnutá
    phone: "", privacyUrl: "#", emailToCustomer: false
  }, CFG.booking || {});
  let BLOCK = B.game + B.change;            // na koľko minút hra zablokuje arénu pre iné partie

  /* Nastavenia, ktoré vedúci mení v internej appke (laser/<env>/config vo Firebase), prepíšu tie z WordPressu. */
  const REMOTE_KEYS = ["hours", "daysOff", "step", "game", "change", "rest", "minPlayers", "maxPlayers", "maxGames", "leadMinutes", "offer"];
  function applyRemoteConfig(c) {
    if (!c || typeof c !== "object") return;
    REMOTE_KEYS.forEach(k => { if (c[k] !== undefined && c[k] !== null) B[k] = c[k]; });
    if (!Array.isArray(B.daysOff)) B.daysOff = Object.values(B.daysOff || {});
    BLOCK = B.game + B.change;
  }

  /* ============ POMOCNÉ ============ */
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseYmd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const toTime = m => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  const DAY_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  const dayLabel = s => { const d = parseYmd(s); return DAY_SHORT[d.getDay()] + " " + d.getDate() + ". " + (d.getMonth() + 1) + "."; };
  const itemLabel = it => dayLabel(it.date) + " o " + it.time;
  const games = n => n + (n === 1 ? " hra" : n < 5 ? " hry" : " hier");
  const players = n => n + (n < 5 ? " hráči" : " hráčov");

  /* ============ ÚLOŽISKO ============ */
  /* watch(from, to, cb) → cb({ "2026-10-24": Set{"18:00", …} }) pri každej zmene; vracia funkciu na zrušenie.
     book(items, data) → uloží rezerváciu; ak je niektorý čas medzitým obsadený, hodí chybu s code "taken". */

  function localStore() {
    const KEY = "cp_laser_test";
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { slots: {}, bookings: {} }; } catch (e) { return { slots: {}, bookings: {} }; } };
    const listeners = new Set();
    const notify = () => listeners.forEach(fn => fn());
    window.addEventListener("storage", e => { if (e.key === KEY) notify(); });
    return {
      mode: "test",
      watch(from, to, cb) {
        const run = () => {
          const all = read().slots, out = {};
          Object.keys(all).filter(d => d >= from && d <= to).forEach(d => { out[d] = new Set(Object.keys(all[d]).map(k => k.slice(0, 2) + ":" + k.slice(2))); });
          cb(out);
        };
        listeners.add(run); run();
        return () => listeners.delete(run);
      },
      async book(items, data) {
        const db = read();
        if (items.some(it => db.slots[it.date] && db.slots[it.date][it.time.replace(":", "")])) {
          const err = new Error("taken"); err.code = "taken"; throw err;
        }
        const id = "t" + Date.now().toString(36);
        db.bookings[id] = Object.assign({}, data, { createdAt: Date.now() });
        items.forEach(it => { (db.slots[it.date] = db.slots[it.date] || {})[it.time.replace(":", "")] = id; });
        localStorage.setItem(KEY, JSON.stringify(db));
        notify();
        return id;
      },
      reset() { localStorage.removeItem(KEY); notify(); }
    };
  }

  async function firebaseStore(cfg, env) {
    const base = "https://www.gstatic.com/firebasejs/10.12.2/";
    const [{ initializeApp }, fb] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-database.js")]);
    const db = fb.getDatabase(initializeApp(cfg, "cp-rezervacie"));
    const path = "laser/" + env;
    return {
      mode: "firebase",
      async config() {
        try { return (await fb.get(fb.ref(db, path + "/config"))).val(); }
        catch (e) { console.warn("[rezervácia] nastavenia z Firebase", e); return null; }
      },
      watch(from, to, cb, onError) {
        const q = fb.query(fb.ref(db, path + "/slots"), fb.orderByKey(), fb.startAt(from), fb.endAt(to));
        return fb.onValue(q, snap => {
          const out = {};
          snap.forEach(d => { out[d.key] = new Set(Object.keys(d.val() || {}).map(k => k.slice(0, 2) + ":" + k.slice(2))); });
          cb(out);
        }, onError);
      },
      /* Rezervácia aj obsadenie časov v jednom zápise: buď prejde celé, alebo nič.
         Pravidlá Firebase nedovolia zapísať čas, ktorý už niekto má. */
      async book(items, data) {
        const id = fb.push(fb.ref(db, path + "/bookings")).key;
        const u = {};
        u[path + "/bookings/" + id] = Object.assign({}, data, { createdAt: fb.serverTimestamp(), status: "new" });
        items.forEach(it => { u[path + "/slots/" + it.date + "/" + it.time.replace(":", "")] = id; });
        try { await fb.update(fb.ref(db), u); }
        catch (e) {
          if (String(e.code || e.message).toUpperCase().includes("PERMISSION")) { const err = new Error("taken"); err.code = "taken"; throw err; }
          throw e;
        }
        return id;
      }
    };
  }

  /* ============ STAV ============ */
  const state = {
    step: 1,
    players: B.minPlayers,
    day: null,                   // vybraný deň "2026-10-24"
    busy: {},                    // obsadené časy od iných: { date: Set }
    loaded: false,
    selected: new Map(),         // "2026-10-24 18:00" -> { date, time }
    notice: "",
    error: "",
    sending: false,
    done: null,
    offerModal: null,            // deň, pre ktorý ukazujeme okno „vyberte si 4. hru zadarmo“
    offerShown: new Set()        // dni, pre ktoré sme okno už ukázali (neotravovať opakovane)
  };
  let store = null, unwatch = null, focusKey = null;

  /* ============ ČASY A DNI ============ */
  const now = () => new Date();
  const earliest = () => { const d = new Date(Date.now() + B.leadMinutes * 60000); return ymd(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };

  function hoursFor(date) {
    if ((B.daysOff || []).includes(date)) return null;
    const h = B.hours[parseYmd(date).getDay()];
    return h && h[0] && h[1] ? [toMin(h[0]), toMin(h[1]) || 1440] : null;
  }

  /* Všetky začiatky hier v daný deň (bez tých, čo už prešli). */
  function timesFor(date) {
    const h = hoursFor(date);
    if (!h) return [];
    const out = [], min = earliest();
    for (let m = h[0]; m + B.game <= h[1]; m += B.step) {
      const t = toTime(m);
      if (date + " " + t >= min) out.push(t);
    }
    return out;
  }

  /* Čas je obsadený inou partiou, ak sa jej hra (s výmenou) prekrýva s touto. */
  function takenByOthers(date, time) {
    const set = state.busy[date];
    if (!set || !set.size) return false;
    const t = toMin(time);
    for (const s of set) if (Math.abs(toMin(s) - t) < BLOCK) return true;
    return false;
  }

  /* Tá istá partia potrebuje oddych: časy bližšie ako `rest` k vybranému sú pre ňu zablokované. */
  function restConflict(date, time) {
    const t = toMin(time);
    for (const it of state.selected.values())
      if (it.date === date && it.time !== time && Math.abs(toMin(it.time) - t) < B.rest) return it;
    return null;
  }

  function statusOf(date, time) {
    if (state.selected.has(date + " " + time)) return "picked";
    if (takenByOthers(date, time)) return "busy";
    if (restConflict(date, time)) return "rest";
    return "free";
  }

  const freeCount = date => timesFor(date).filter(t => !takenByOthers(date, t)).length;
  const sortedItems = () => [...state.selected.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  /* ============ PONUKA 3+1 ============ */
  /* Partia aspoň 8 hráčov, ktorá si v jeden deň vyberie 3 hry, dostane 4. hru zadarmo. */
  const offerOn = () => !!(B.offer && B.offer.minPlayers && B.offer.paid);
  const bundle = () => B.offer.paid + (B.offer.free || 1);
  const offerEnough = () => offerOn() && state.players >= B.offer.minPlayers;
  function gamesPerDay() {
    const m = {};
    for (const it of state.selected.values()) m[it.date] = (m[it.date] || 0) + 1;
    return m;
  }
  /* Ktoré vybrané hry sú zadarmo: v každom dni každá štvrtá (pri 3+1). */
  function freeKeys() {
    const out = new Set();
    if (!offerEnough()) return out;
    const byDay = {};
    sortedItems().forEach(it => { (byDay[it.date] = byDay[it.date] || []).push(it); });
    Object.values(byDay).forEach(list => list.forEach((it, i) => { if ((i + 1) % bundle() === 0) out.add(it.date + " " + it.time); }));
    return out;
  }
  const friends = n => n + (n === 1 ? " kamaráta" : " kamarátov");
  const offerName = () => B.offer.paid + "+" + (B.offer.free || 1);

  function offerHints() {
    if (!offerOn()) return "";
    const counts = gamesPerDay(), days = Object.keys(counts).sort(), out = [];
    if (offerEnough()) {
      days.filter(d => counts[d] >= bundle()).forEach(d => out.push(`🎁 ${dayLabel(d)}: ${bundle()}. hra je od nás zadarmo (ponuka ${offerName()}).`));
      days.filter(d => counts[d] % bundle() === B.offer.paid).forEach(d =>
        out.push(`🎁 ${dayLabel(d)}: vyberte si ešte jednu hru, máte ju od nás zadarmo (ponuka ${offerName()}).`));
    } else if (days.some(d => counts[d] >= B.offer.paid)) {
      const miss = B.offer.minPlayers - state.players;
      out.push(`🎁 Zavolajte ešte ${friends(miss)} (spolu aspoň ${B.offer.minPlayers} hráčov) na všetky ${B.offer.paid} hry a ${bundle()}. hru máte zadarmo (ponuka ${offerName()}).`);
    }
    return out.map(t => `<p class="rz-offer">${t}</p>`).join("");
  }

  /* Deň, kde má partia presne toľko hier, že by ďalšia bola zadarmo (napr. 3 pri 3+1). */
  function offerDay() {
    if (!offerOn()) return null;
    const counts = gamesPerDay();
    return Object.keys(counts).sort().find(d => counts[d] % bundle() === B.offer.paid) || null;
  }

  /* Okno s ponukou: "pick" = po výbere 3. hry, "continue" = pri Pokračovať, "friends" = málo hráčov. */
  function offerModal() {
    const m = state.offerModal;
    if (!m) return "";
    const friendsCase = m.kind === "friends";
    const miss = B.offer.minPlayers - state.players;
    const text = friendsCase
      ? `Na ${dayLabel(m.date)} máte vybrané ${games(B.offer.paid)}. Zavolajte ešte <b>${friends(miss)}</b> (spolu aspoň ${B.offer.minPlayers} hráčov) a ${bundle()}. hru máte od nás <b>zadarmo</b> (ponuka ${offerName()}).`
      : `Ste partia aspoň ${B.offer.minPlayers} hráčov a na ${dayLabel(m.date)} máte vybrané ${games(B.offer.paid)}. Vyberte si ešte jednu hru, tú máte od nás <b>zadarmo</b> (ponuka ${offerName()}).`;
    const noLabel = m.kind === "pick" ? "Nie, ďakujem" : "Pokračovať bez ponuky";
    const yes = friendsCase
      ? `<button type="button" class="rz-btn" data-act="offer-players">Zmeniť počet hráčov</button>`
      : `<button type="button" class="rz-btn" data-act="offer-yes">Vybrať ${bundle()}. hru</button>`;
    return `
      <div class="rz-modal" role="dialog" aria-modal="true" aria-labelledby="rz-offer-title">
        <div class="rz-modal-box">
          <div class="rz-modal-icon" aria-hidden="true">🎁</div>
          <h3 id="rz-offer-title">${friendsCase ? `${bundle()}. hra môže byť zadarmo!` : `Máte ${bundle()}. hru zadarmo!`}</h3>
          <p>${text}</p>
          <div class="rz-nav"><button type="button" class="rz-btn ghost" data-act="offer-no">${noLabel}</button>${yes}</div>
        </div>
      </div>`;
  }

  /* Zobrazujeme aktuálny a nasledujúci mesiac. */
  function monthsShown() {
    const d = now(), a = new Date(d.getFullYear(), d.getMonth(), 1), b = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return [a, b];
  }
  function range() {
    const [, b] = monthsShown();
    const last = new Date(b.getFullYear(), b.getMonth() + 1, 0);
    return [ymd(now()), ymd(last)];
  }

  /* ============ NAČÍTANIE ============ */
  async function init() {
    render();
    if (CFG.useFirebase && CFG.firebase && CFG.firebase.apiKey) {
      try { store = await firebaseStore(CFG.firebase, CFG.env || "test"); }
      catch (e) { console.error("[rezervácia]", e); }
    }
    if (!store) store = localStore();
    if (store.config) {
      applyRemoteConfig(await store.config());
      state.players = Math.min(B.maxPlayers, Math.max(B.minPlayers, state.players));
      render();
    }
    const [from, to] = range();
    unwatch = store.watch(from, to, busy => {
      state.busy = busy;
      state.loaded = true;
      dropTaken();
      if (state.step === 2 || state.step === 1) render();
    }, err => {
      console.error("[rezervácia]", err);
      state.error = "Voľné časy sa nepodarilo načítať. Skúste obnoviť stránku alebo nám zavolajte na " + B.phone + ".";
      render();
    });
  }

  /* Ak si vybraný čas medzitým rezervoval niekto iný, odoberieme ho. */
  function dropTaken() {
    const lost = [];
    for (const [key, it] of state.selected) if (takenByOthers(it.date, it.time)) { state.selected.delete(key); lost.push(it); }
    if (lost.length) state.notice = "Čas " + lost.map(itemLabel).join(", ") + " si medzitým rezervoval niekto iný, odobrali sme ho z výberu.";
  }

  /* ============ VYKRESLENIE ============ */
  function stepsBar() {
    const names = ["Počet hráčov", "Termín", "Vaše údaje"];
    return '<ol class="rz-steps">' + names.map((n, i) => {
      const s = i + 1, cls = s < state.step ? "done" : s === state.step ? "current" : "";
      return `<li class="${cls}"${s === state.step ? ' aria-current="step"' : ""}><em>${s}</em><span>${n}</span></li>`;
    }).join("") + "</ol>";
  }

  function viewPlayers() {
    return `
      <h2>Koľko vás bude?</h2>
      <p class="rz-sub">Počet hráčov vrátane vás (${B.minPlayers}–${B.maxPlayers}).</p>
      <div class="rz-stepper">
        <button type="button" data-act="minus" aria-label="Menej hráčov"${state.players <= B.minPlayers ? " disabled" : ""}>−</button>
        <output aria-live="polite">${state.players}</output>
        <button type="button" data-act="plus" aria-label="Viac hráčov"${state.players >= B.maxPlayers ? " disabled" : ""}>+</button>
      </div>
      <div class="rz-nav"><span></span><button type="button" class="rz-btn" data-act="to2">Pokračovať</button></div>`;
  }

  function viewMonth(first) {
    const y = first.getFullYear(), m = first.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;          // pondelok = prvý stĺpec
    const today = ymd(now());
    let cells = "";
    for (let i = 0; i < lead; i++) cells += '<span class="rz-day empty" aria-hidden="true"></span>';
    for (let d = 1; d <= days; d++) {
      const date = y + "-" + pad(m + 1) + "-" + pad(d);
      const closed = !hoursFor(date), past = date < today || (!closed && !timesFor(date).length);
      const free = past || closed ? 0 : freeCount(date);
      const picked = sortedItems().filter(it => it.date === date).length;
      let cls = "rz-day", label = d + ". " + MONTHS[m], dis = false;
      if (past) { cls += " past"; dis = true; }
      else if (closed) { cls += " closed"; label += ", zatvorené"; dis = true; }
      else if (state.loaded && !free && !picked) { cls += " full"; label += ", obsadené"; dis = true; }
      if (date === state.day) cls += " active";
      if (date === today) cls += " today";
      if (picked) { cls += " has"; label += ", vybrané " + games(picked); }
      cells += `<button type="button" class="${cls}" data-act="day" data-date="${date}" aria-label="${label}" aria-pressed="${date === state.day}"${dis ? " disabled" : ""}>${d}${picked ? `<i>${picked}</i>` : ""}</button>`;
    }
    return `
      <div class="rz-month">
        <h3>${MONTHS[m]} ${y}</h3>
        <div class="rz-week" aria-hidden="true"><span>Po</span><span>Ut</span><span>St</span><span>Št</span><span>Pi</span><span>So</span><span>Ne</span></div>
        <div class="rz-grid">${cells}</div>
      </div>`;
  }

  function viewTimes() {
    if (!state.day) return '<p class="rz-hint">Vyberte deň v kalendári a ukážu sa voľné časy.</p>';
    if (!state.loaded) return '<p class="rz-hint">Načítavam voľné časy…</p>';
    const times = timesFor(state.day);
    if (!times.length) return `<p class="rz-hint">${hoursFor(state.day) ? "V tento deň už nie je voľný čas." : "V tento deň je zatvorené."}</p>`;
    const label = { free: "voľné", picked: "vybrané", busy: "obsadené", rest: "pauza" };
    const slots = times.map(t => {
      const st = statusOf(state.day, t), key = state.day + " " + t;
      const dis = st === "busy" || st === "rest";
      return `<button type="button" class="rz-slot ${st}" data-act="slot" data-key="${key}" aria-pressed="${st === "picked"}" aria-label="${t}, ${label[st]}"${dis ? " disabled" : ""}><b>${t}</b><small>${label[st]}</small></button>`;
    }).join("");
    return `
      <h3 class="rz-dayname" id="rz-times">${dayLabel(state.day)}</h3>
      <div class="rz-legend"><span class="free">voľné</span><span class="picked">vybrané</span><span class="busy">obsadené / pauza medzi vašimi hrami</span></div>
      <div class="rz-slots">${slots}</div>`;
  }

  function viewTerm() {
    const items = sortedItems(), free = freeKeys();
    return `
      <h2>Vyberte deň a čas</h2>
      <p class="rz-sub">Jedna hra trvá ${B.game} minút. Môžete si vybrať aj viac hier, medzi nimi máte vždy pauzu na oddych.</p>
      <div class="rz-months">${monthsShown().map(viewMonth).join("")}</div>
      <div class="rz-times">${viewTimes()}</div>
      ${state.notice ? `<p class="rz-status warn" role="status">${esc(state.notice)}</p>` : ""}
      ${state.error ? `<p class="rz-status err" role="alert">${esc(state.error)}</p>` : ""}
      <div class="rz-picked">
        <h3>Vaše hry${items.length ? " (" + games(items.length) + ")" : ""}</h3>
        ${items.length
          ? "<ul>" + items.map(it => `<li><span>${itemLabel(it)}${free.has(it.date + " " + it.time) ? ' <em class="rz-free">zadarmo</em>' : ""}</span><button type="button" class="rz-link" data-act="remove" data-key="${it.date} ${it.time}">odstrániť</button></li>`).join("") + "</ul>"
          : '<p class="rz-hint">Zatiaľ nemáte vybraný žiadny čas.</p>'}
        ${offerHints()}
      </div>
      <div class="rz-nav"><button type="button" class="rz-btn ghost" data-act="to1">Späť</button><button type="button" class="rz-btn" data-act="to3"${items.length ? "" : " disabled"}>Pokračovať</button></div>`;
  }

  function viewForm() {
    const items = sortedItems();
    return `
      <h2>Vaše údaje</h2>
      <ul class="rz-summary">
        <li><span>Počet hráčov</span><b>${state.players}</b></li>
        <li><span>${items.length > 1 ? "Hry" : "Hra"}</span><b>${items.map(it => itemLabel(it) + (freeKeys().has(it.date + " " + it.time) ? " (zadarmo)" : "")).join("<br>")}</b></li>
        ${freeKeys().size ? `<li><span>Ponuka ${offerName()}</span><b>${games(freeKeys().size)} zadarmo</b></li>` : ""}
        <li><span>Platba</span><b>na mieste</b></li>
      </ul>
      ${offerHints()}
      <form class="rz-form" novalidate>
        <label>Meno a priezvisko<input name="name" required minlength="3" maxlength="80" autocomplete="name"></label>
        <div class="rz-row">
          <label>Telefón<input name="phone" type="tel" required maxlength="30" autocomplete="tel" placeholder="0910 123 456"></label>
          <label>E-mail<input name="email" type="email" required maxlength="100" autocomplete="email"></label>
        </div>
        <label class="rz-check"><input type="checkbox" name="consent" required>
          <span>Súhlasím so <a href="${esc(B.privacyUrl)}" target="_blank" rel="noopener">spracovaním osobných údajov</a> na účely rezervácie.</span></label>
        <p class="rz-status" role="status" aria-live="polite"></p>
        <div class="rz-nav"><button type="button" class="rz-btn ghost" data-act="to2">Späť</button><button type="submit" class="rz-btn">Dokončiť rezerváciu</button></div>
      </form>`;
  }

  function viewDone() {
    const d = state.done;
    return `
      <div class="rz-done">
        <div class="rz-done-icon" aria-hidden="true">✓</div>
        <h2>Rezervácia je potvrdená</h2>
        <p>${players(d.players)}</p>
        <ul>${d.items.map(it => "<li>" + itemLabel(it) + "</li>").join("")}</ul>
        <p class="rz-sub">${d.mailed
          ? "Potvrdenie sme poslali na <b>" + esc(d.email) + "</b>. Ak ho nevidíte, pozrite aj priečinok spam."
          : "Tešíme sa na vás. Ak potrebujete niečo zmeniť, zavolajte nám na " + esc(B.phone) + "."}</p>
        <button type="button" class="rz-btn ghost" data-act="again">Nová rezervácia</button>
      </div>`;
  }

  function testBanner() {
    if (!store || store.mode !== "test") return "";
    return `<p class="rz-test">Testovací režim: rezervácie sa ukladajú len v tomto prehliadači. <button type="button" class="rz-link" data-act="reset">Vymazať testovacie rezervácie</button></p>`;
  }

  function render() {
    let body;
    if (state.step === 4) body = viewDone();
    else body = stepsBar() + (state.step === 1 ? viewPlayers() : state.step === 2 ? viewTerm() : viewForm());
    root.innerHTML = testBanner() + `<div class="rz-card">${body}</div>` + (state.step === 2 ? offerModal() : "");
    if (state.step === 2 && state.offerModal) {
      const yes = root.querySelector('[data-act="offer-yes"]');
      if (yes) yes.focus({ preventScroll: true });
      focusKey = null;
    }
    if (focusKey) {
      const el = root.querySelector(`[data-key="${focusKey}"]`) || root.querySelector(`[data-date="${focusKey}"]`);
      if (el) el.focus({ preventScroll: true });
      focusKey = null;
    }
  }

  function goStep(n) {
    state.step = n;
    state.notice = "";
    render();
    if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ============ OVLÁDANIE ============ */
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act;

    if (act === "minus" || act === "plus") {
      state.players = Math.min(B.maxPlayers, Math.max(B.minPlayers, state.players + (act === "plus" ? 1 : -1)));
      render();
    } else if (act === "to1") goStep(1);
    else if (act === "to2") goStep(2);
    else if (act === "to3") {
      // Pri Pokračovať pripomenúť ponuku 3+1, ak má partia v niektorý deň 3 hry
      const day = offerDay();
      if (day) { state.offerModal = { date: day, kind: offerEnough() ? "continue" : "friends" }; render(); }
      else goStep(3);
    }
    else if (act === "day") {
      state.day = b.dataset.date;
      state.notice = "";
      focusKey = state.day;
      render();
      const times = document.getElementById("rz-times");
      if (times && times.getBoundingClientRect().top > window.innerHeight - 120) times.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (act === "slot") {
      const key = b.dataset.key, [date, time] = key.split(" ");
      state.notice = "";
      if (state.selected.has(key)) state.selected.delete(key);
      else if (state.selected.size >= B.maxGames) state.notice = "V jednej rezervácii môžete mať najviac " + games(B.maxGames) + ". Pre viac nám zavolajte na " + B.phone + ".";
      else {
        state.selected.set(key, { date, time });
        // 3 hry v jeden deň a aspoň 8 hráčov → ponúknuť 4. hru zadarmo (raz pre daný deň)
        if (offerEnough() && gamesPerDay()[date] === B.offer.paid && !state.offerShown.has(date)) {
          state.offerShown.add(date);
          state.offerModal = { date, kind: "pick" };
        }
      }
      focusKey = key;
      render();
    } else if (act === "offer-yes" || act === "offer-no" || act === "offer-players") {
      const m = state.offerModal;
      state.offerModal = null;
      if (act === "offer-players") { goStep(1); return; }
      if (act === "offer-no" && m && m.kind !== "pick") { goStep(3); return; }   // pri Pokračovať: ísť ďalej bez ponuky
      if (act === "offer-yes" && m) state.day = m.date;
      render();
      if (act === "offer-yes") {
        const el = document.getElementById("rz-times");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (act === "remove") { state.selected.delete(b.dataset.key); render(); }
    else if (act === "again") { state.done = null; state.selected.clear(); state.offerShown.clear(); state.day = null; goStep(1); }
    else if (act === "reset" && store && store.reset) { store.reset(); state.selected.clear(); render(); }
  });

  root.addEventListener("submit", e => { e.preventDefault(); submit(e.target); });

  function normalizePhone(p) {
    p = p.replace(/[\s\-/()]/g, "");
    if (p.startsWith("00")) return "+" + p.slice(2);
    if (p.startsWith("0")) return "+421" + p.slice(1);
    return p;
  }

  /* Potvrdzovací e-mail pošle WordPress (admin-ajax.php, akcia cpr_mail). Rezervácia je už uložená,
     takže keď e-mail zlyhá, len to zákazníkovi nepovieme – rezerváciu to neruší. */
  async function sendMail(id, data) {
    const body = new FormData();
    body.append("action", "cpr_mail");
    body.append("id", id);
    body.append("email", data.email);
    body.append("name", data.name);
    body.append("players", String(data.players));
    Object.keys(data.games).forEach(g => body.append("games[]", g));
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(CFG.mailUrl, { method: "POST", body, credentials: "same-origin", signal: ctrl ? ctrl.signal : undefined });
      const json = await res.json().catch(() => null);
      return !!(res.ok && json && json.success);
    } catch (e) { console.error("[rezervácia] e-mail", e); return false; }
    finally { if (timer) clearTimeout(timer); }
  }

  async function submit(form) {
    if (state.sending) return;
    const status = form.querySelector(".rz-status");
    const say = (text, type) => { status.textContent = text; status.className = "rz-status" + (type ? " " + type : ""); };
    if (!form.reportValidity()) return;

    const f = new FormData(form);
    const c = { name: f.get("name").trim(), email: f.get("email").trim(), phone: normalizePhone(f.get("phone").trim()) };
    if (!/^\+?\d{9,15}$/.test(c.phone)) { say("Skontrolujte prosím telefónne číslo.", "err"); form.phone.focus(); return; }

    const items = sortedItems(), btn = form.querySelector('[type="submit"]');
    if (items.some(it => takenByOthers(it.date, it.time))) { dropTaken(); goStep(2); return; }

    const gamesMap = {};
    items.forEach(it => { gamesMap[it.date + "_" + it.time.replace(":", "")] = true; });
    const data = { name: c.name, phone: c.phone, email: c.email, players: state.players, games: gamesMap, consent: true };

    state.sending = true; btn.disabled = true; say("Odosielam rezerváciu…");
    try {
      const id = await store.book(items, data);
      let mailed = false;
      if (B.emailToCustomer && CFG.mailUrl && store.mode === "firebase") { say("Posielam potvrdenie na e-mail…"); mailed = await sendMail(id, data); }
      state.done = { items, email: c.email, players: state.players, mailed };
      state.selected.clear();
      goStep(4);
    } catch (err) {
      console.error("[rezervácia]", err);
      if (err.code === "taken") say("Niektorý z vybraných časov si medzitým rezervoval niekto iný. Vráťte sa späť a vyberte iný čas.", "err");
      else say("Rezerváciu sa nepodarilo odoslať. Skúste to znova alebo nám zavolajte na " + B.phone + ".", "err");
    } finally {
      state.sending = false;
      if (btn.isConnected) btn.disabled = false;
    }
  }

  init();
})();
