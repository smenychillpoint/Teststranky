// Service worker ChillPoint (úvod, Smeny, Objednávky).
// v3 (2026-10-19) – rýchlejšie načítanie:
//  • Firebase knižnice (gstatic.com/firebasejs/…) a Excel knižnica (cdnjs) majú v adrese pevnú verziu → uložia sa
//    do mobilu raz a ďalej sa berú z neho (netreba ich pri každom otvorení sťahovať z internetu).
//  • Stránky appky: vždy sa skúsi najprv internet (nech je vždy aktuálna verzia), ale keď internet neodpovie do
//    2,5 s, ukáže sa uložená kópia (a nová sa medzitým uloží na ďalšie otvorenie). Bez internetu = uložená kópia.
//  • Dáta (Firebase databáza, prihlásenie) service worker NEchytá – idú vždy priamo.
const CACHE = 'cp-smeny-v3';
const SHELL = ['./', './index.html', './smeny.html', './objednavky.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIBS = [
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-database-compat.js'
];
const NET_TIMEOUT = 2500;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([...SHELL, ...LIBS].map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isLib = url => (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) ||
  (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.startsWith('/ajax/libs/xlsx/'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // knižnice s pevnou verziou: najprv z mobilu, inak z internetu (a uložiť)
  if (isLib(url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;   // Firebase databáza, prihlásenie a ostatné externé veci idú priamo

  // stránky appky: internet s časovým limitom, potom uložená kópia
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => {
      fromCache().then(r => { if (!done && r) { done = true; resolve(r); } });
    }, NET_TIMEOUT);
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      clearTimeout(timer);
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  }));
});
