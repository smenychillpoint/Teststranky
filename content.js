/* Načíta upravený obsah (texty, fotky, cenník) z Firebase a premietne ho do stránky.
   Ak Firebase nie je nastavený alebo ešte nie je uložený žiadny obsah, zostáva pôvodný text zo šablóny. */

window.DEFAULT_CENNIK = [
  { group: "Laser game", rows: [
    { name: "Dospelý", desc: "15 minút | 1 osoba", price: "6 €" },
    { name: "Študent", desc: "15 minút | 1 osoba", price: "5,50 €" },
    { name: "Dieťa do 15 rokov", desc: "15 minút | 1 osoba", price: "5 €" },
    { name: "ZŤP", desc: "15 minút | 1 osoba", price: "5 €" }
  ]},
  { group: "Virtuálna realita", rows: [
    { name: "HTC VIVE PRO", desc: "30 minút | zariadenie", price: "12 €" },
    { name: "HTC VIVE PRO", desc: "60 minút | zariadenie", price: "20 €" }
  ]},
  { group: "Ostatné", rows: [
    { name: "XBOX Kinect", desc: "60 minút | zariadenie", price: "6 €" },
    { name: "XBOX Konzola", desc: "60 minút | zariadenie", price: "6 €" },
    { name: "PlayStation 5", desc: "60 minút | zariadenie", price: "6 €" },
    { name: "Biliard", desc: "60 minút | zariadenie", price: "6 €" },
    { name: "Air hockey", desc: "5 minút | zariadenie", price: "0,50 €" },
    { name: "Stolný tenis", desc: "60 minút | zariadenie", price: "6 €" },
    { name: "Šípky", desc: "60 minút | zariadenie", price: "4 €" }
  ]}
];

function ckEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function applyContent(data) {
  const texts = (data && data.texts) || {};
  document.querySelectorAll("[data-ck]").forEach(el => {
    const v = texts[el.dataset.ck];
    if (v) el.textContent = v;
  });
  const images = (data && data.images) || {};
  document.querySelectorAll("[data-cimg]").forEach(el => {
    const v = images[el.dataset.cimg];
    if (v) el.src = v;
  });
  document.querySelectorAll("[data-cimg-bg]").forEach(el => {
    const v = images[el.dataset.cimgBg];
    if (v) el.style.setProperty("--hero", "url('" + v + "')");
  });
}

function renderCennik(data) {
  const el = document.getElementById("priceList");
  if (!el) return;
  const groups = (data && data.cennik && data.cennik.length) ? data.cennik : window.DEFAULT_CENNIK;
  el.innerHTML = groups.map(g => `
    <section class="price-group"><h2>${ckEscape(g.group)}</h2><ul class="price-list">
      ${g.rows.map(r => `<li class="price-row"><div><strong>${ckEscape(r.name)}</strong><span class="muted">${ckEscape(r.desc)}</span></div><b class="price">${ckEscape(r.price)}</b></li>`).join("")}
    </ul></section>`).join("");
}

async function loadContent() {
  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && cfg.apiKey && !String(cfg.apiKey).startsWith("VLOZ");
  let data = null;
  if (configured) {
    try {
      const base = "https://www.gstatic.com/firebasejs/10.12.2/";
      const [{ initializeApp }, fs] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js")]);
      const db = fs.getFirestore(initializeApp(cfg));
      const snap = await fs.getDoc(fs.doc(db, "content", "site"));
      if (snap.exists()) data = snap.data();
    } catch (e) { console.error("content.js:", e); }
  }
  applyContent(data);
  renderCennik(data);
}

loadContent();
