/* Spoločné nastavenia novej stránky.
   Stránka sama zistí, či beží na ostrej doméne (chillpoint.sk) alebo na testovacej (GitHub, localhost),
   takže pri presune na Websupport sa tu nič nemení. */
(function () {
  "use strict";
  // Ostrá je len chillpoint.sk a www.chillpoint.sk; test.chillpoint.sk, GitHub aj localhost sú testovacie.
  const live = /^(www\.)?chillpoint\.sk$/i.test(location.hostname);

  window.CP_CONFIG = {
    env: live ? "live" : "test",     // rezervácie sa ukladajú do laser/live alebo laser/test

    /* Firebase: rovnaký projekt ako Smeny a Objednávky. Tieto údaje sú verejné, chránia ich pravidlá v Firebase. */
    useFirebase: false,              // zapnúť až keď sú vo Firebase nahraté pravidlá z firebase/laser-rules.json
    firebase: {
      apiKey: "AIzaSyB-2HeoePKrcsdawvI1LCOTQ6vWjibItpU",
      authDomain: "chillpoint-smeny-350c4.firebaseapp.com",
      databaseURL: "https://chillpoint-smeny-350c4-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "chillpoint-smeny-350c4",
      storageBucket: "chillpoint-smeny-350c4.firebasestorage.app",
      messagingSenderId: "251580957782",
      appId: "1:251580957782:web:801f838e4cd65abb4027f7"
    },

    /* Rezervácie laser game. Neskôr sa budú dať meniť v admine (laser/<env>/config). */
    booking: {
      hours: {                       // 0 = nedeľa … 6 = sobota, "24:00" = polnoc
        0: ["13:00", "22:00"], 1: ["15:00", "22:00"], 2: ["15:00", "22:00"], 3: ["15:00", "22:00"],
        4: ["15:00", "22:00"], 5: ["15:00", "24:00"], 6: ["13:00", "24:00"]
      },
      daysOff: [],                   // napr. ["2026-12-24", "2026-12-25"]
      step: 20,                      // ponúkané časy každých 20 minút
      game: 15,                      // dĺžka jednej hry
      change: 5,                     // výmena partií – aréna je po hre zablokovaná ešte toľko minút pre iných
      rest: 40,                      // tá istá partia: ďalšia hra najskôr o toľko minút po začiatku predchádzajúcej
      minPlayers: 2,
      maxPlayers: 16,
      maxGames: 8,                   // najviac hier v jednej rezervácii
      leadMinutes: 15,               // najneskôr toľko minút pred začiatkom sa dá rezervovať
      phone: "0910 836 876",
      privacyUrl: "https://www.chillpoint.sk/ochrana-sukromia/",
      emailToCustomer: false         // zapne sa, keď bude hotové posielanie e-mailov (Firebase Blaze)
    }
  };

  if (!live) {
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex, nofollow";
    document.head.appendChild(m);
  }
})();
