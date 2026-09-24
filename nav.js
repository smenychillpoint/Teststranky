/* ---------- menu na mobile ---------- */
const burger = document.getElementById("burger"), menu = document.getElementById("menu");
burger.onclick = () => burger.setAttribute("aria-expanded", menu.classList.toggle("open"));
menu.addEventListener("click", e => { if (e.target.tagName === "A") { menu.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); } });
