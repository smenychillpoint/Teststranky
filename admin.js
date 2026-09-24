/* Správa obsahu: prihlásenie + úprava textov, fotiek a cenníka. Ukladá sa do Firebase (Firestore + Storage). */

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

const SCHEMA = [
  { page: "Úvodná stránka", fields: [
    { key: "index.hero.title", label: "Hero – nadpis", type: "text" },
    { key: "index.hero.subtitle", label: "Hero – podnadpis", type: "textarea" },
    { key: "index.about.title", label: "O nás – nadpis", type: "text" },
    { key: "index.about.p1", label: "O nás – text", type: "textarea" },
    { key: "index.about.img", label: "O nás – fotka", type: "image" },
    { key: "index.laserteaser.title", label: "Laser game blok – nadpis", type: "text" },
    { key: "index.laserteaser.p1", label: "Laser game blok – text", type: "textarea" },
    { key: "index.laserteaser.img", label: "Laser game blok – fotka", type: "image" },
    { key: "index.tile-oslavy.title", label: "Dlaždica Oslavy – nadpis", type: "text" },
    { key: "index.tile-oslavy.p", label: "Dlaždica Oslavy – text", type: "textarea" },
    { key: "index.tile-oslavy.img", label: "Dlaždica Oslavy – fotka", type: "image" },
    { key: "index.tile-team.title", label: "Dlaždica Teambuilding – nadpis", type: "text" },
    { key: "index.tile-team.p", label: "Dlaždica Teambuilding – text", type: "textarea" },
    { key: "index.tile-team.img", label: "Dlaždica Teambuilding – fotka", type: "image" },
    { key: "index.quote.text", label: "Citát – text", type: "textarea" },
    { key: "index.quote.author", label: "Citát – autor", type: "text" },
    { key: "index.gallery.1", label: "Galéria – fotka 1", type: "image" },
    { key: "index.gallery.2", label: "Galéria – fotka 2", type: "image" },
    { key: "index.gallery.3", label: "Galéria – fotka 3", type: "image" },
    { key: "index.gallery.4", label: "Galéria – fotka 4", type: "image" },
    { key: "index.gallery.5", label: "Galéria – fotka 5", type: "image" },
    { key: "index.gallery.6", label: "Galéria – fotka 6", type: "image" }
  ]},
  { page: "Laser game", fields: [
    { key: "lasergame.hero.title", label: "Hero – nadpis", type: "text" },
    { key: "lasergame.hero.subtitle", label: "Hero – podnadpis", type: "textarea" },
    { key: "lasergame.hero.bg", label: "Hero – pozadie (fotka)", type: "image" },
    { key: "lasergame.main.title", label: "Hlavný text – nadpis", type: "text" },
    { key: "lasergame.main.p1", label: "Hlavný text – odsek", type: "textarea" },
    { key: "lasergame.main.img", label: "Hlavný text – fotka", type: "image" }
  ]},
  { page: "Chill zóna", fields: [
    { key: "chillzona.hero.title", label: "Hero – nadpis", type: "text" },
    { key: "chillzona.hero.subtitle", label: "Hero – podnadpis", type: "textarea" },
    { key: "chillzona.hero.bg", label: "Hero – pozadie (fotka)", type: "image" },
    { key: "chillzona.tile1.title", label: "Dlaždica 1 – nadpis", type: "text" },
    { key: "chillzona.tile1.p", label: "Dlaždica 1 – text", type: "textarea" },
    { key: "chillzona.tile1.img", label: "Dlaždica 1 – fotka", type: "image" },
    { key: "chillzona.tile2.title", label: "Dlaždica 2 – nadpis", type: "text" },
    { key: "chillzona.tile2.p", label: "Dlaždica 2 – text", type: "textarea" },
    { key: "chillzona.tile2.img", label: "Dlaždica 2 – fotka", type: "image" },
    { key: "chillzona.tile3.title", label: "Dlaždica 3 – nadpis", type: "text" },
    { key: "chillzona.tile3.p", label: "Dlaždica 3 – text", type: "textarea" },
    { key: "chillzona.tile3.img", label: "Dlaždica 3 – fotka", type: "image" },
    { key: "chillzona.bar.title", label: "Chill Bar – nadpis", type: "text" },
    { key: "chillzona.bar.p1", label: "Chill Bar – odsek 1", type: "textarea" },
    { key: "chillzona.bar.p2", label: "Chill Bar – odsek 2", type: "textarea" },
    { key: "chillzona.bar.img", label: "Chill Bar – fotka", type: "image" }
  ]},
  { page: "Teambuilding", fields: [
    { key: "teambuilding.hero.title", label: "Hero – nadpis", type: "text" },
    { key: "teambuilding.hero.subtitle", label: "Hero – podnadpis", type: "textarea" },
    { key: "teambuilding.hero.bg", label: "Hero – pozadie (fotka)", type: "image" },
    { key: "teambuilding.main.title", label: "Hlavný text – nadpis", type: "text" },
    { key: "teambuilding.main.p1", label: "Hlavný text – odsek", type: "textarea" },
    { key: "teambuilding.main.img", label: "Hlavný text – fotka", type: "image" },
    { key: "teambuilding.menu1.title", label: "Menu 1 – nadpis", type: "text" },
    { key: "teambuilding.menu1.p", label: "Menu 1 – text", type: "textarea" },
    { key: "teambuilding.menu1.img", label: "Menu 1 – fotka", type: "image" },
    { key: "teambuilding.menu2.title", label: "Menu 2 – nadpis", type: "text" },
    { key: "teambuilding.menu2.p", label: "Menu 2 – text", type: "textarea" },
    { key: "teambuilding.menu2.img", label: "Menu 2 – fotka", type: "image" },
    { key: "teambuilding.menu3.title", label: "Menu 3 – nadpis", type: "text" },
    { key: "teambuilding.menu3.p", label: "Menu 3 – text", type: "textarea" },
    { key: "teambuilding.menu3.img", label: "Menu 3 – fotka", type: "image" },
    { key: "teambuilding.menu4.title", label: "Menu 4 – nadpis", type: "text" },
    { key: "teambuilding.menu4.p", label: "Menu 4 – text", type: "textarea" },
    { key: "teambuilding.menu4.img", label: "Menu 4 – fotka", type: "image" },
    { key: "teambuilding.quote.text", label: "Citát – text", type: "textarea" },
    { key: "teambuilding.quote.author", label: "Citát – autor", type: "text" }
  ]},
  { page: "Oslavy", fields: [
    { key: "oslavy.hero.title", label: "Hero – nadpis", type: "text" },
    { key: "oslavy.hero.subtitle", label: "Hero – podnadpis", type: "textarea" },
    { key: "oslavy.hero.bg", label: "Hero – pozadie (fotka)", type: "image" },
    { key: "oslavy.split1.title", label: "Rozlúčky – nadpis", type: "text" },
    { key: "oslavy.split1.p1", label: "Rozlúčky – text", type: "textarea" },
    { key: "oslavy.split1.img", label: "Rozlúčky – fotka", type: "image" },
    { key: "oslavy.split2.title", label: "Pre maminy – nadpis", type: "text" },
    { key: "oslavy.split2.p1", label: "Pre maminy – odsek 1", type: "textarea" },
    { key: "oslavy.split2.p2", label: "Pre maminy – odsek 2", type: "textarea" },
    { key: "oslavy.split2.img", label: "Pre maminy – fotka", type: "image" },
    { key: "oslavy.menu1.title", label: "Menu 1 – nadpis", type: "text" },
    { key: "oslavy.menu1.p", label: "Menu 1 – text", type: "textarea" },
    { key: "oslavy.menu1.img", label: "Menu 1 – fotka", type: "image" },
    { key: "oslavy.menu2.title", label: "Menu 2 – nadpis", type: "text" },
    { key: "oslavy.menu2.p", label: "Menu 2 – text", type: "textarea" },
    { key: "oslavy.menu2.img", label: "Menu 2 – fotka", type: "image" },
    { key: "oslavy.menu3.title", label: "Menu 3 – nadpis", type: "text" },
    { key: "oslavy.menu3.p", label: "Menu 3 – text", type: "textarea" },
    { key: "oslavy.menu3.img", label: "Menu 3 – fotka", type: "image" },
    { key: "oslavy.menu4.title", label: "Menu 4 – nadpis", type: "text" },
    { key: "oslavy.menu4.p", label: "Menu 4 – text", type: "textarea" },
    { key: "oslavy.menu4.img", label: "Menu 4 – fotka", type: "image" },
    { key: "oslavy.quote.text", label: "Citát – text", type: "textarea" },
    { key: "oslavy.quote.author", label: "Citát – autor", type: "text" }
  ]},
  { page: "Kontakt", fields: [
    { key: "kontakt.hero.title", label: "Hero – nadpis", type: "text" },
    { key: "kontakt.hero.subtitle", label: "Hero – podnadpis", type: "textarea" }
  ]}
];

const DEFAULT_CENNIK = window.DEFAULT_CENNIK || [];

const $ = id => document.getElementById(id);
let db, auth, storage, fs, authMod, storageMod, currentUser = null;
let texts = {}, images = {}, cennik = [];
let storageAvailable = false;

function say(id, msg, type) {
  const el = $(id);
  el.textContent = msg || "";
  el.className = "status" + (type ? " " + type : "");
}

async function initFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).startsWith("VLOZ")) {
    say("loginStatus", "Firebase nie je nastavený. Vyplňte najprv firebase-config.js.", "err");
    $("loginBtn").disabled = true;
    return false;
  }
  const [{ initializeApp }, fsMod, aMod, sMod] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-firestore.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-storage.js")
  ]);
  const app = initializeApp(cfg);
  fs = fsMod; authMod = aMod; storageMod = sMod;
  db = fsMod.getFirestore(app);
  auth = aMod.getAuth(app);
  try { storage = sMod.getStorage(app); storageAvailable = true; }
  catch (e) { storage = null; storageAvailable = false; console.warn("Storage nie je dostupný, nahrávanie súborov bude vypnuté.", e); }
  aMod.onAuthStateChanged(auth, user => {
    currentUser = user;
    $("loginView").hidden = !!user;
    $("editorView").hidden = !user;
    if (user) { $("whoami").textContent = user.email; loadDoc(); }
  });
  return true;
}

async function loadDoc() {
  say("editorStatus", "Načítavam obsah…");
  try {
    const snap = await fs.getDoc(fs.doc(db, "content", "site"));
    const data = snap.exists() ? snap.data() : {};
    texts = data.texts || {};
    images = data.images || {};
    cennik = (data.cennik && data.cennik.length) ? JSON.parse(JSON.stringify(data.cennik)) : JSON.parse(JSON.stringify(DEFAULT_CENNIK));
    renderForm();
    say("editorStatus", "");
  } catch (e) {
    console.error(e);
    say("editorStatus", "Obsah sa nepodarilo načítať: " + e.message, "err");
  }
}

function renderForm() {
  const wrap = $("fields");
  wrap.innerHTML = "";
  for (const group of SCHEMA) {
    const fs_ = document.createElement("fieldset");
    fs_.innerHTML = `<legend>${group.page}</legend>`;
    for (const f of group.fields) {
      const row = document.createElement("div");
      row.className = "field-row";
      if (f.type === "image") {
        const cur = images[f.key] || "";
        row.innerHTML = `
          <label>${f.label}
            <div class="img-edit">
              ${cur ? `<img class="thumb" src="${cur}" alt="">` : `<span class="thumb empty">bez fotky</span>`}
              <input type="text" data-img="${f.key}" value="${cur.replace(/"/g, "&quot;")}" placeholder="URL fotky">
              ${storageAvailable ? `<input type="file" accept="image/*" data-upload="${f.key}">` : ""}
            </div>
          </label>`;
      } else {
        const cur = texts[f.key] || "";
        const tag = f.type === "textarea" ? "textarea rows=\"3\"" : "input type=\"text\"";
        row.innerHTML = `<label>${f.label}<${tag} data-text="${f.key}">${f.type === "textarea" ? cur : ""}</${f.type === "textarea" ? "textarea" : "input"}>${f.type === "text" ? "" : ""}</label>`;
        if (f.type !== "textarea") row.querySelector("input").value = cur;
      }
      fs_.appendChild(row);
    }
    wrap.appendChild(fs_);
  }
  wrap.querySelectorAll("[data-upload]").forEach(inp => {
    inp.addEventListener("change", () => uploadImage(inp));
  });
  renderCennikEditor();
}

async function uploadImage(inp) {
  const key = inp.dataset.upload;
  const file = inp.files[0];
  if (!file) return;
  say("editorStatus", "Nahrávam fotku…");
  try {
    const path = "images/" + key.replace(/[^a-zA-Z0-9._-]/g, "_") + "-" + Date.now();
    const ref = storageMod.ref(storage, path);
    await storageMod.uploadBytes(ref, file);
    const url = await storageMod.getDownloadURL(ref);
    images[key] = url;
    const row = inp.closest(".img-edit");
    row.querySelector('[data-img]').value = url;
    let thumb = row.querySelector(".thumb");
    if (!thumb.tagName || thumb.tagName === "SPAN") { thumb.outerHTML = `<img class="thumb" src="${url}" alt="">`; }
    else thumb.src = url;
    say("editorStatus", "Fotka nahraná. Nezabudnite stlačiť Uložiť.", "ok");
  } catch (e) {
    console.error(e);
    say("editorStatus", "Nahrávanie fotky zlyhalo: " + e.message, "err");
  }
}

function renderCennikEditor() {
  const wrap = $("cennikEdit");
  wrap.innerHTML = "";
  cennik.forEach((g, gi) => {
    const box = document.createElement("div");
    box.className = "cennik-group";
    box.innerHTML = `
      <div class="cennik-group-head">
        <input type="text" class="group-name" value="${(g.group || "").replace(/"/g, "&quot;")}" placeholder="Názov skupiny">
        <button type="button" class="link-btn" data-rmgroup="${gi}">Odstrániť skupinu</button>
      </div>
      <div class="cennik-rows"></div>
      <button type="button" class="btn ghost sm" data-addrow="${gi}">+ Pridať položku</button>`;
    box.querySelector(".group-name").addEventListener("input", e => g.group = e.target.value);
    box.querySelector("[data-rmgroup]").addEventListener("click", () => { cennik.splice(gi, 1); renderCennikEditor(); });
    const rows = box.querySelector(".cennik-rows");
    g.rows.forEach((r, ri) => rows.appendChild(cennikRow(g, r, ri, gi)));
    box.querySelector("[data-addrow]").addEventListener("click", () => {
      g.rows.push({ name: "", desc: "", price: "" }); renderCennikEditor();
    });
    wrap.appendChild(box);
  });
  const addGroupBtn = $("addGroupBtn");
  addGroupBtn.onclick = () => { cennik.push({ group: "Nová skupina", rows: [{ name: "", desc: "", price: "" }] }); renderCennikEditor(); };
}

function cennikRow(g, r, ri) {
  const div = document.createElement("div");
  div.className = "cennik-row-edit";
  div.innerHTML = `
    <input type="text" placeholder="Názov" value="${(r.name || "").replace(/"/g, "&quot;")}">
    <input type="text" placeholder="Popis (napr. 15 minút | 1 osoba)" value="${(r.desc || "").replace(/"/g, "&quot;")}">
    <input type="text" placeholder="Cena" value="${(r.price || "").replace(/"/g, "&quot;")}">
    <button type="button" class="link-btn">Zmazať</button>`;
  const [nameI, descI, priceI] = div.querySelectorAll("input");
  nameI.addEventListener("input", e => r.name = e.target.value);
  descI.addEventListener("input", e => r.desc = e.target.value);
  priceI.addEventListener("input", e => r.price = e.target.value);
  div.querySelector("button").addEventListener("click", () => { g.rows.splice(ri, 1); renderCennikEditor(); });
  return div;
}

function collectTexts() {
  document.querySelectorAll("[data-text]").forEach(el => { texts[el.dataset.text] = el.value.trim(); });
  document.querySelectorAll("[data-img]").forEach(el => { images[el.dataset.img] = el.value.trim(); });
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  say("loginStatus", "Prihlasujem…");
  try {
    await authMod.signInWithEmailAndPassword(auth, f.get("email"), f.get("password"));
  } catch (err) {
    say("loginStatus", "Prihlásenie zlyhalo: skontrolujte e-mail a heslo.", "err");
  }
});

$("logoutBtn").addEventListener("click", () => authMod.signOut(auth));

$("saveBtn").addEventListener("click", async () => {
  collectTexts();
  say("editorStatus", "Ukladám…");
  try {
    await fs.setDoc(fs.doc(db, "content", "site"), { texts, images, cennik, updatedAt: fs.serverTimestamp() });
    say("editorStatus", "Uložené. Zmeny sú od teraz vidieť na stránke.", "ok");
  } catch (e) {
    console.error(e);
    say("editorStatus", "Uloženie zlyhalo: " + e.message, "err");
  }
});

initFirebase();
