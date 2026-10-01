/* Kiebitz — Experience der Startseite.
   Eine Three.js-Bühne liegt fest hinter dem Dokument; GSAP und ScrollTrigger
   führen die Kamera durch sieben Bilder: das Brett über der Schulter, Partien
   strömen ein, Stockfish tastet ab, das Brett wird zur Fehlerlandschaft, eine
   Kuppel schließt sich über den Daten, und am Ende heben die Züge als Schwarm
   Kiebitze ab — Zug um Zugvogel.

   Alles hier ist Kulisse. Inhalt, Links und Formulare stehen vollständig im
   HTML; ohne WebGL 2, bei reduzierter Bewegung oder wenn etwas scheitert,
   bleibt die ruhige Fassung stehen. Bibliotheken liegen selbst gehostet unter
   assets/vendor/, es gibt keine Anfrage an fremde Server. */

const root = document.documentElement;
const RTL = root.getAttribute("dir") === "rtl";
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
let introLoop = null;

if (root.classList.contains("xp")) {
  boot().catch((error) => {
    console.warn("[kiebitz] experience disabled:", error);
    abandon();
  });
}

function abandon() {
  if (introLoop) introLoop.stop();
  root.classList.remove("xp", "xp-live");
  root.classList.add("xp-ready", "xp-intro-done");
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url.href;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`could not load ${url.pathname}`));
    document.head.appendChild(script);
  });
}

/* ── Ladelinie: läuft schon, bevor GSAP da ist ──────────────────────────────── */
function introCounter() {
  const bar = $("[data-xp-bar]");
  const state = { v: 0 };
  let target = 0.12;
  let frame = 0;
  const paint = () => {
    if (bar) bar.style.transform = `scaleX(${state.v})`;
  };
  const loop = () => {
    state.v += (target - state.v) * 0.07;
    paint();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return {
    state,
    paint,
    bump(value) { target = Math.max(target, value); },
    stop() { cancelAnimationFrame(frame); }
  };
}

async function boot() {
  const counter = introCounter();
  introLoop = counter;
  const vendor = new URL("./vendor/", import.meta.url);
  const threeReady = import("./vendor/three.min.js").then((module) => {
    counter.bump(0.72);
    return module;
  });
  await loadScript(new URL("gsap.min.js", vendor));
  counter.bump(0.34);
  await loadScript(new URL("ScrollTrigger.min.js", vendor));
  const THREE = await threeReady;
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) throw new Error("GSAP missing");
  gsap.registerPlugin(ScrollTrigger);

  const canvas = $("[data-xp-canvas]");
  const stage = createStage(THREE, canvas);
  counter.bump(0.9);

  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  }

  const words = splitHeadings();
  choreograph(gsap, ScrollTrigger, stage);
  gsap.ticker.add((time, delta) => stage.frame(time, Math.min(delta, 64) / 1000));
  // Nur zum Prüfen einzelner Bilder: ?xp-debug stellt die Bühne bereit.
  if (new URLSearchParams(location.search).has("xp-debug")) window.__xp = { stage, gsap, ScrollTrigger };
  playIntro(gsap, ScrollTrigger, counter, stage, words.hero);
}

/* ── Überschriften wortweise maskieren ──────────────────────────────────────── */
// Zerlegt nur Textknoten und lässt Elemente wie .flight stehen. Chinesisch
// kennt keine Leerzeichen und wird zeichenweise gesetzt; Arabisch und Hindi
// bleiben als ganze Wörter zusammen, damit Ligaturen und Verbindungen halten.
function splitHeadings() {
  const result = { hero: [], all: [] };
  const cjk = root.getAttribute("data-lang") === "zh";
  for (const heading of $$("[data-xp-split]")) {
    const inner = [];
    const walk = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent;
          if (!text.trim()) continue;
          const parts = cjk ? Array.from(text.replace(/\s+/g, "")) : text.split(/(\s+)/);
          const fragment = document.createDocumentFragment();
          if (!cjk && /^\s/.test(text)) fragment.appendChild(document.createTextNode(" "));
          for (const part of parts) {
            if (!part) continue;
            if (/^\s+$/.test(part)) {
              fragment.appendChild(document.createTextNode(" "));
              continue;
            }
            const outer = document.createElement("span");
            outer.className = "xp-w";
            const word = document.createElement("span");
            word.textContent = part;
            outer.appendChild(word);
            fragment.appendChild(outer);
            inner.push(word);
          }
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };
    walk(heading);
    heading.setAttribute("data-xp-words", "");
    if (heading.classList.contains("xp-title")) result.hero = inner;
    result.all.push({ heading, words: inner });
  }
  return result;
}

/* ── Intro ──────────────────────────────────────────────────────────────────── */
function playIntro(gsap, ScrollTrigger, counter, stage, heroWords) {
  const intro = $(".xp-intro");
  const heroBits = $$(".xp-hero [data-xp-intro]");
  const heroFoot = $(".xp-hero-foot");
  // Wer von einer anderen Kiebitz-Seite kommt (etwa nach dem Sprachwechsel),
  // bekommt den kurzen Vorhang. Dafür wird nichts im Browser gespeichert.
  let seen = false;
  try { seen = Boolean(document.referrer) && new URL(document.referrer).origin === location.origin; } catch (e) { /* egal */ }
  // Nach 6,5 s hat der CSS-Notausgang den Vorhang schon weggenommen.
  const late = performance.now() > 6500;
  const deep = late || window.scrollY > window.innerHeight * 0.4 || Boolean(location.hash);

  counter.stop();
  root.classList.add("xp-ready");

  if (deep) {
    // Mitten in der Seite gelandet: kein Vorhang, keine Kamerafahrt.
    root.classList.add("xp-live", "xp-intro-done");
    stage.snap();
    return;
  }

  gsap.set(heroWords, { yPercent: 112 });
  gsap.set(heroBits, { opacity: 0, y: 26 });
  gsap.set(heroFoot, { opacity: 0 });
  gsap.set(intro, { clipPath: "inset(0% 0% 0% 0%)" });
  stage.intro.k = 1;

  const tl = gsap.timeline({
    defaults: { ease: "expo.out" },
    onComplete: () => {
      root.classList.add("xp-intro-done");
      gsap.set([heroBits, heroFoot], { clearProps: "transform" });
    }
  });
  tl.to(counter.state, { v: 1, duration: seen ? 0.25 : 0.7, ease: "power2.out", onUpdate: counter.paint })
    .add(() => root.classList.add("xp-live"))
    .to(".xp-intro-mark", { yPercent: -36, opacity: 0, duration: 0.7, ease: "power3.in" }, seen ? "+=0" : "+=0.15")
    .to(".xp-intro-meta, .xp-intro-line", { opacity: 0, duration: 0.4, ease: "power1.out" }, "<")
    .to(intro, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.15, ease: "expo.inOut" }, "-=0.35")
    .to(stage.intro, { k: 0, duration: 3.2, ease: "expo.out" }, "-=0.95")
    .to(heroWords, { yPercent: 0, duration: 1.3, stagger: 0.05 }, "-=2.75")
    .to(heroBits, { opacity: 1, y: 0, duration: 1, stagger: 0.09, ease: "power3.out" }, "-=1.2")
    .to(heroFoot, { opacity: 1, duration: 0.9, ease: "power2.out" }, "-=0.6")
    .add(() => ScrollTrigger.refresh(), "-=0.4");
  // Ohne Bildwiederholung (Hintergrund-Tab, gedrosseltes Fenster) bliebe der
  // Vorhang stehen; ein Timer läuft trotzdem und springt ans Ende.
  setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, 9000);
}

/* ── Choreografie: Scroll steuert Bühne und Text ────────────────────────────── */
function choreograph(gsap, ScrollTrigger, stage) {
  const fine = window.matchMedia("(pointer: fine)").matches;

  // Szenenmarken: jedes Element mit data-xp-scene ist ein Bild der Bühne.
  const markers = $$("[data-xp-scene]");
  const offsets = new Array(markers.length).fill(0);
  const measure = () => {
    markers.forEach((marker, index) => {
      offsets[index] = marker.getBoundingClientRect().top + window.scrollY;
    });
  };
  ScrollTrigger.addEventListener("refresh", measure);
  measure();
  stage.scroll = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;
    let t = 0;
    for (const top of offsets) t += Math.min(1, Math.max(0, (y + vh - top) / (vh * 0.75)));
    return t;
  };

  // Kopfzeile wird fest, sobald die Bühne nicht mehr frei steht.
  const header = $(".top");
  ScrollTrigger.create({
    start: 40,
    onToggle: (self) => header && header.classList.toggle("xp-solid", self.isActive)
  });

  // Kapitelanzeige
  const hud = new Map($$("[data-xp-hud]").map((link) => [link.getAttribute("data-xp-hud"), link]));
  const order = ["top", "import", "analyze", "understand", "features", "local", "pricing", "download", "feedback"];
  stage.onChapter = (index) => {
    const id = order[Math.max(0, Math.min(order.length - 1, index))];
    hud.forEach((link, key) => link.classList.toggle("is-on", key === id));
  };

  // Der Hero weicht beim Scrollen zurück.
  gsap.fromTo(".xp-hero-in", { yPercent: 0, opacity: 1 }, {
    yPercent: -14,
    opacity: 0,
    ease: "none",
    immediateRender: false,
    scrollTrigger: { trigger: ".xp-hero", start: "top top", end: "bottom 10%", scrub: true }
  });
  gsap.fromTo(".xp-hero-foot > *", { opacity: 1 }, {
    opacity: 0,
    ease: "none",
    immediateRender: false,
    scrollTrigger: { trigger: ".xp-hero", start: "top top", end: "30% top", scrub: true }
  });

  // Überschriften steigen wortweise aus ihrer Maske.
  for (const heading of $$("[data-xp-words]")) {
    if (heading.classList.contains("xp-title")) continue;
    const words = $$(".xp-w > span", heading);
    if (heading.getBoundingClientRect().top < window.innerHeight) continue;
    gsap.set(words, { yPercent: 112 });
    ScrollTrigger.create({
      trigger: heading,
      start: "top 86%",
      once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.25, stagger: 0.045, ease: "expo.out" })
    });
  }

  // Kapitelkarten blenden ein, solange ihr Kapitel die Bühne hat.
  for (const chapter of $$(".xp-chapter")) {
    const bits = Array.from($("[data-xp-card]", chapter).children);
    gsap.set(bits, { opacity: 0, y: 44 });
    const show = () => gsap.to(bits, { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: "expo.out", overwrite: true });
    const hide = (up) => gsap.to(bits, { opacity: 0, y: up ? -34 : 44, duration: 0.5, stagger: 0.03, ease: "power2.in", overwrite: true });
    const trigger = ScrollTrigger.create({
      trigger: chapter,
      start: "top 62%",
      end: "bottom 78%",
      onEnter: show,
      onEnterBack: show,
      onLeave: () => hide(true),
      onLeaveBack: () => hide(false)
    });
    if (trigger.isActive) show();
  }

  // Alles Übrige: sanft herein, sobald es den unteren Rand erreicht.
  const reveal = $$([
    ".xp-how-head .eyebrow",
    ".xp-features-head .eyebrow",
    ".xp-local .eyebrow", ".xp-local .lede", ".xp-local-link",
    ".xp-pricing .eyebrow", ".xp-pricing .lede", ".xp-pricing .plan",
    ".xp-download .eyebrow", ".xp-download .dl-card", ".xp-download .small",
    ".feedback-copy .eyebrow", ".feedback-copy .lede", ".feedback-notes > p", ".feedback-package"
  ].join(",")).filter((el) => el.getBoundingClientRect().top > window.innerHeight);
  gsap.set(reveal, { opacity: 0, y: 40 });
  ScrollTrigger.batch(reveal, {
    start: "top 90%",
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, stagger: 0.08, ease: "expo.out", overwrite: true })
  });

  // Funktionen: auf breiten Bildschirmen eine angeheftete, horizontale Bahn.
  const mm = gsap.matchMedia();
  mm.add("(min-width: 960px)", () => {
    const pin = $(".xp-pin");
    const track = $(".xp-track");
    const bar = $(".xp-rail-bar i");
    const number = $("[data-xp-panel-n]");
    const panels = $$(".xp-panel", track);
    $$("img", track).forEach((img) => { img.loading = "eager"; });
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const slide = gsap.to(track, {
      x: () => (RTL ? 1 : -1) * distance(),
      ease: "none",
      scrollTrigger: {
        trigger: pin,
        pin: true,
        start: "top top",
        // Die Bahn läuft doppelt so schnell wie der Scroll: sechs Tafeln ohne
        // sechs Bildschirmhöhen Fingerarbeit.
        end: () => `+=${distance() * 0.5}`,
        scrub: 0.9,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          if (bar) bar.style.transform = `scaleX(${self.progress})`;
          if (number) number.textContent = `0${1 + Math.round(self.progress * (panels.length - 1))}`;
        }
      }
    });
    for (const panel of panels.slice(1)) {
      const visual = $(".shot, .sync-viz, .more", panel);
      const text = $(".feature-text", panel);
      const scroll = RTL
        ? { start: "right 2%", end: "right 55%" }
        : { start: "left 98%", end: "left 45%" };
      gsap.fromTo(visual,
        { rotateY: RTL ? 24 : -24, xPercent: RTL ? -10 : 10, transformPerspective: 1400, transformOrigin: RTL ? "right center" : "left center" },
        { rotateY: 0, xPercent: 0, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: slide, scrub: true, ...scroll } });
      gsap.fromTo(text,
        { opacity: 0.15, x: RTL ? -60 : 60 },
        { opacity: 1, x: 0, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: slide, scrub: true, ...scroll } });
    }
    return () => gsap.set(track, { clearProps: "transform" });
  });

  // Aufklappen des Feedback-Formulars verschiebt alles darunter.
  const pack = $(".feedback-package");
  if (pack) pack.addEventListener("toggle", () => ScrollTrigger.refresh());

  if (fine) {
    // Magnetische Knöpfe im Hero
    for (const button of $$("[data-xp-magnet]")) {
      const toX = gsap.quickTo(button, "x", { duration: 0.6, ease: "power3.out" });
      const toY = gsap.quickTo(button, "y", { duration: 0.6, ease: "power3.out" });
      button.addEventListener("pointermove", (event) => {
        const box = button.getBoundingClientRect();
        toX((event.clientX - box.left - box.width / 2) * 0.28);
        toY((event.clientY - box.top - box.height / 2) * 0.38);
      });
      button.addEventListener("pointerleave", () => { toX(0); toY(0); });
    }
    // Karten und Screenshots neigen sich zum Zeiger.
    for (const card of $$(".xp-pricing .plan, .xp-download .dl-card, .xp-track .shot")) {
      const rx = gsap.quickTo(card, "rotateX", { duration: 0.8, ease: "power3.out" });
      const ry = gsap.quickTo(card, "rotateY", { duration: 0.8, ease: "power3.out" });
      gsap.set(card, { transformPerspective: 1100 });
      card.addEventListener("pointermove", (event) => {
        const box = card.getBoundingClientRect();
        const px = (event.clientX - box.left) / box.width - 0.5;
        const py = (event.clientY - box.top) / box.height - 0.5;
        ry(px * 7);
        rx(-py * 6);
      });
      card.addEventListener("pointerleave", () => { rx(0); ry(0); });
    }
  }

  window.addEventListener("pointermove", (event) => {
    stage.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    stage.pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener("resize", () => stage.resize());

  // Trigger unterhalb der angehefteten Bahn entstanden vor ihr und kennen ihre
  // Scrollstrecke noch nicht: nach Lage sortieren und alles neu vermessen.
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  // Mit Sprungmarke geladen: nach dem Anheften neu ausrichten. "instant", weil
  // "auto" dem weichen Scrollen aus style.css folgt und dann quer durch alle
  // Szenen fährt.
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "instant", block: "start" });
        stage.snap();
      });
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Bühne
   ══════════════════════════════════════════════════════════════════════════════ */

// Bilder der Kamerafahrt, in der Reihenfolge der Szenenmarken im HTML.
// r/el/az: Abstand, Höhe und Richtung der Kamera um den Blickpunkt t*.
// shift schiebt das Bild zur Seite, damit links (RTL: rechts) Platz für Text bleibt.
const KEYS = [
  // 00 Hero: über die Schulter von Weiß
  { r: 19, el: 22, az: -30, tx: 0.2, ty: 0.3, tz: 0.4, fov: 32, shift: 0.35, side: 1, pieces: 1, tour: 1 },
  // 01 Importieren: Partien strömen aus drei Quellen ein
  { r: 20, el: 40, az: 16, tx: 0, ty: 0.6, tz: -1.6, fov: 34, shift: 0.26, side: 1, pieces: 1, streams: 1 },
  // 02 Analysieren: Stockfish tastet das Brett ab
  { r: 16, el: 30, az: 50, tx: -0.6, ty: 0.7, tz: 0.2, fov: 32, shift: 0.29, side: 1, pieces: 1, streams: 0.1, scan: 1 },
  // 03 Verstehen: das Brett wird zur Fehlerlandschaft
  { r: 19.5, el: 33, az: 140, tx: 0, ty: 0.9, tz: 0, fov: 34, shift: 0.26, side: 1, terrain: 1 },
  // 04 Funktionen: Aufsicht, die Bühne tritt zurück
  { r: 25, el: 60, az: 196, tx: 0, ty: 0, tz: 0, fov: 34, shift: 0, side: 0, veil: 0.52, terrain: 0.35 },
  // 05 Local-first: die Kuppel schließt sich
  { r: 22, el: 22, az: 252, tx: 0, ty: 2.1, tz: 0, fov: 34, shift: 0.25, side: 1, pieces: 1, dome: 1, orbit: 1, glow: 1 },
  // 06 Preise: ruhige Draufsicht
  { r: 18, el: 76, az: 300, tx: 0, ty: 0, tz: 0, fov: 34, shift: 0, side: 0, veil: 0.74, pieces: 1, dome: 0.12, orbit: 0.25 },
  // 07 Download: die Züge heben ab
  { r: 17, el: 5, az: 372, tx: 0, ty: 8.2, tz: -8, fov: 42, shift: 0, side: 0, veil: 0.12, flock: 1 },
  // 08 Feedback: der Schwarm zieht weiter
  { r: 17, el: 2, az: 396, tx: 0, ty: 10.5, tz: -13, fov: 44, shift: 0, side: 0, veil: 0.8, flock: 1 }
];
const CHANNELS = ["r", "el", "az", "tx", "ty", "tz", "fov", "shift", "side", "veil", "pieces", "tour", "streams", "scan", "terrain", "dome", "orbit", "glow", "flock"];
for (const key of KEYS) for (const channel of CHANNELS) if (key[channel] === undefined) key[channel] = 0;

const COLORS = {
  bg: 0x0e0e0d,
  accent: 0x22c08a,
  red: 0xe66767,
  gold: 0xd9a028,
  ink: 0xf2f1ec,
  violet: 0x9085e9,
  chesscom: 0x81b64c
};

// Mittelspiel aus einer Spanischen Partie; Weiß unten, die Kamera schaut über seine Schulter.
const FEN = "r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1";
// Im Hero zieht immer wieder eine zufällige Figur eine kurze, regelgerechte
// Rundreise über freie Felder und landet wieder auf ihrem Ausgangsfeld, damit
// die Stellung erhalten bleibt. Bauern fehlen: Sie können nicht zurück.
const STEPS = {
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  n: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
};
STEPS.q = STEPS.r.concat(STEPS.b);
STEPS.k = STEPS.q;
const SLIDES = { r: true, b: true, q: true };
const GLYPHS = { k: ["♔", "♚"], q: ["♕", "♛"], r: ["♖", "♜"], b: ["♗", "♝"], n: ["♘", "♞"] };
const squareName = (file, rank) => String.fromCharCode(97 + file) + (rank + 1);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);
const ease = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const fract = (v) => v - Math.floor(v);
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const squareX = (file) => file - 3.5;
const squareZ = (rank) => 3.5 - rank;
const parseSquare = (name) => [name.charCodeAt(0) - 97, Number(name[1]) - 1];

function createStage(THREE, canvas) {
  const lowPower = window.matchMedia("(pointer: coarse)").matches
    || Math.min(window.innerWidth, window.innerHeight) < 640
    || (navigator.hardwareConcurrency || 8) <= 4;
  const random = rng(1979);

  /* ── Renderer, Szene, Kamera ─────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: "high-performance" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);
  scene.fog = new THREE.Fog(COLORS.bg, 24, 74);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 240);

  let composer = null;
  let bloom = null;
  if (!lowPower) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.5, 1.35);
    composer.addPass(bloom);
    composer.addPass(new THREE.OutputPass());
  }

  /* ── Licht ───────────────────────────────────────────────────────────────── */
  scene.add(new THREE.HemisphereLight(0xe6eee8, 0x0a0a09, 0.5));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.1);
  key.position.set(-7, 13, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 2, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(COLORS.accent, 0.6);
  rim.position.set(8, 3, -11);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.35);
  fill.position.set(10, 4, 6);
  scene.add(fill);
  const heart = new THREE.PointLight(COLORS.accent, 0, 16, 1.6);
  heart.position.set(0, 2.6, 0);
  scene.add(heart);

  /* ── Boden und Schimmer ──────────────────────────────────────────────────── */
  // Der Boden läuft zum Rand hin in den Hintergrund aus: Bei flacher Kamera
  // (Schwarm) gibt es so keine Horizontkante.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(80, 64),
    new THREE.MeshStandardMaterial({ color: 0x10100f, roughness: 0.96, metalness: 0, transparent: true, alphaMap: groundFade(THREE) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.36;
  ground.receiveShadow = true;
  scene.add(ground);

  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: radialTexture(THREE), color: COLORS.accent, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.35;
  scene.add(halo);

  /* ── Brett: 64 Felder als Instanzen, die zu Säulen wachsen können ─────────── */
  const squareGeometry = new THREE.BoxGeometry(0.985, 1, 0.985);
  squareGeometry.translate(0, 0.5, 0);
  const squares = new THREE.InstancedMesh(
    squareGeometry,
    new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0 }),
    64
  );
  squares.castShadow = true;
  squares.receiveShadow = true;
  scene.add(squares);

  const LIGHT_SQUARE = new THREE.Color(0x3c3b37);
  const DARK_SQUARE = new THREE.Color(0x1a1a19);
  const C_ACCENT = new THREE.Color(COLORS.accent);
  const C_RED = new THREE.Color(COLORS.red);
  const C_LOW = new THREE.Color(0x15463a);
  const cells = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      // Fehlerlandschaft: niedrig in der Eröffnung, hoch im Mittelspiel,
      // mittel im Endspiel — dieselben Werte wie die Balken im Kapitel.
      const phase = rank < 3 ? 0.42 : rank < 6 ? 1.9 : 0.92;
      const wobble = 0.55 + 0.45 * random() + 0.18 * Math.sin(file * 1.7 + rank * 0.9);
      cells.push({
        file,
        rank,
        x: squareX(file),
        z: squareZ(rank),
        base: (file + rank) % 2 === 1 ? LIGHT_SQUARE : DARK_SQUARE,
        height: phase * wobble * 1.35,
        delay: rank / 7 * 0.55 + random() * 0.12,
        glow: 0
      });
    }
  }
  const maxHeight = Math.max(...cells.map((cell) => cell.height));

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(9.1, 0.34, 9.1),
    new THREE.MeshStandardMaterial({ color: 0x151514, roughness: 0.45, metalness: 0.08 })
  );
  frame.position.y = -0.19;
  frame.castShadow = true;
  frame.receiveShadow = true;
  scene.add(frame);
  const edge = lineLoop(THREE, 4.02, 0.002, COLORS.accent, 0.5);
  scene.add(edge);
  const outerEdge = lineLoop(THREE, 4.55, -0.018, COLORS.accent, 0.16);
  scene.add(outerEdge);
  const labels = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    labels.add(labelSprite(THREE, String.fromCharCode(97 + i), squareX(i), 4.28));
    labels.add(labelSprite(THREE, String(i + 1), -4.28, squareZ(i)));
  }
  scene.add(labels);

  /* ── Figuren ─────────────────────────────────────────────────────────────── */
  // Farben wie im Figurenset der App: helles Elfenbein, warmes Ebenholz.
  const whiteMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xdcd6c6, roughness: 0.46, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.38, sheen: 0.4, sheenRoughness: 0.6, sheenColor: 0xfff6e4
  });
  const blackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1f1d1a, roughness: 0.34, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.22
  });
  const shapes = pieceGeometries(THREE);
  const pieces = [];
  FEN.split("/").forEach((row, index) => {
    const rank = 7 - index;
    let file = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        file += Number(char);
        continue;
      }
      const white = char === char.toUpperCase();
      const type = char.toLowerCase();
      const group = new THREE.Group();
      for (const geometry of shapes[type]) {
        const mesh = new THREE.Mesh(geometry, white ? whiteMaterial : blackMaterial);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      // Springer schauen schräg zum Gegner, damit die Kamera über Weiß' Schulter
      // ihr Profil sieht. Könige zeigen ihr Kreuz.
      if (type === "n") group.rotation.y = white ? Math.PI * 0.75 : -0.42;
      else if (type === "k") group.rotation.y = 0.35;
      else group.rotation.y = random() * Math.PI;
      group.position.set(squareX(file), 0, squareZ(rank));
      scene.add(group);
      pieces.push({ group, type, white, file, rank, delay: random(), lift: 0 });
      file += 1;
    }
  });
  const occupied = new Set(pieces.map((piece) => piece.file * 8 + piece.rank));

  /* ── Markierungen: letzter Zug, Blunder, bester Zug ──────────────────────── */
  const markFrom = squareMark(THREE, COLORS.accent);
  const markTo = squareMark(THREE, COLORS.accent);
  const markBlunder = squareMark(THREE, COLORS.red);
  [markFrom, markTo, markBlunder].forEach((mark) => scene.add(mark));
  const [bf, br] = parseSquare("f3");
  markBlunder.position.set(squareX(bf), 0.006, squareZ(br));
  const arrow = moveArrow(THREE, parseSquare("b3"), parseSquare("f7"), COLORS.accent);
  scene.add(arrow);

  /* ── Bewertungsbalken ────────────────────────────────────────────────────── */
  const evalBar = new THREE.Group();
  evalBar.position.set(-4.92, -0.02, 0);
  const evalShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 3.2, 0.22).translate(0, 1.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.4, metalness: 0.2 })
  );
  const evalFill = new THREE.Mesh(
    new THREE.BoxGeometry(0.235, 1, 0.235).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: COLORS.ink, emissive: COLORS.ink, emissiveIntensity: 0.15, roughness: 0.3 })
  );
  const evalTick = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.02, 0.4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.accent).multiplyScalar(2.2) })
  );
  evalTick.position.y = 1.6;
  evalBar.add(evalShell, evalFill, evalTick);
  evalBar.visible = false;
  scene.add(evalBar);

  /* ── Stockfish-Abtastung: ein Lichtvorhang wandert über die Reihen ───────── */
  const scanMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(COLORS.accent) }, uAmount: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform vec3 uColor; uniform float uAmount; varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        float body = pow(1.0 - vUv.y, 3.0) * 0.5;
        float line = smoothstep(0.05, 0.0, vUv.y) * 2.4;
        float a = (body + line) * edge * uAmount;
        gl_FragColor = vec4(uColor * (1.0 + line), a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const scanGeometry = new THREE.PlaneGeometry(8.6, 1.5);
  scanGeometry.translate(0, 0.75, 0);
  const scan = new THREE.Mesh(scanGeometry, scanMaterial);
  scan.visible = false;
  scene.add(scan);

  /* ── Kuppel: was hier drin ist, bleibt hier drin ─────────────────────────── */
  const DOME_RADIUS = 6.5;
  const domeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(COLORS.accent) },
      uReveal: { value: 0 },
      uAmount: { value: 0 },
      uTime: { value: 0 },
      uRadius: { value: DOME_RADIUS }
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vV = -mv.xyz;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uReveal; uniform float uAmount; uniform float uTime; uniform float uRadius;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec2 vUv;
      void main() {
        float h = clamp(vW.y / uRadius, 0.0, 1.0);
        if (h > uReveal + 0.001) discard;
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.6);
        vec2 g = vec2(vUv.x * 32.0, vUv.y * 10.0);
        vec2 d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
        float grid = 1.0 - min(min(d.x, d.y), 1.0);
        float front = smoothstep(uReveal - 0.07, uReveal, h) * step(uReveal, 0.995);
        float ripple = 0.5 + 0.5 * sin(h * 26.0 - uTime * 1.6);
        float a = (fres * 0.55 + grid * 0.13 + front * 1.2 + ripple * fres * 0.14) * uAmount;
        gl_FragColor = vec4(uColor * (1.0 + front * 1.5), a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2), domeMaterial);
  dome.position.y = -0.02;
  dome.visible = false;
  scene.add(dome);
  const domeRing = new THREE.Mesh(
    new THREE.RingGeometry(DOME_RADIUS - 0.04, DOME_RADIUS + 0.04, 160),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.accent).multiplyScalar(1.8), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  domeRing.rotation.x = -Math.PI / 2;
  domeRing.position.y = -0.34;
  scene.add(domeRing);

  /* ── Partien als Lichtteilchen: drei Quellen, ein Brett ──────────────────── */
  const SOURCES = [
    { at: new THREE.Vector3(-15, 5, -7), color: new THREE.Color(COLORS.chesscom).multiplyScalar(2.2) },
    { at: new THREE.Vector3(15, 6.5, -5), color: new THREE.Color(COLORS.ink).multiplyScalar(1.6) },
    { at: new THREE.Vector3(1, 11, -17), color: new THREE.Color(COLORS.gold).multiplyScalar(2.2) }
  ];
  const motesCount = lowPower ? 240 : 460;
  const motes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    motesCount
  );
  motes.frustumCulled = false;
  const moteData = [];
  for (let i = 0; i < motesCount; i++) {
    const source = SOURCES[i % 3];
    const cell = cells[Math.floor(random() * 64)];
    const orbitRadius = 1.2 + random() * 4.4;
    const orbitHeight = 0.5 + random() * Math.sqrt(Math.max(0.2, 34 - orbitRadius * orbitRadius)) * 0.85;
    moteData.push({
      source,
      cell,
      offset: random(),
      speed: 0.12 + random() * 0.16,
      lift: 2.5 + random() * 4,
      size: 0.6 + random() * 0.9,
      orbitRadius,
      orbitHeight,
      orbitAngle: random() * Math.PI * 2,
      orbitSpeed: (0.15 + random() * 0.35) * (random() < 0.5 ? -1 : 1),
      spin: random() * Math.PI
    });
    motes.setColorAt(i, source.color);
  }
  motes.visible = false;
  scene.add(motes);

  /* ── Staub in der Luft ───────────────────────────────────────────────────── */
  const dustCount = lowPower ? 260 : 520;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (random() - 0.5) * 46;
    dustPositions[i * 3 + 1] = random() * 18 - 1;
    dustPositions[i * 3 + 2] = (random() - 0.5) * 46;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: 0xb9b8ae, size: 0.055, transparent: true, opacity: 0.42, depthWrite: false, sizeAttenuation: true
  }));
  scene.add(dust);

  /* ── Kiebitze ────────────────────────────────────────────────────────────── */
  const birdCount = lowPower ? 90 : 170;
  const birdGeometry = lapwingGeometry(THREE);
  const phases = new Float32Array(birdCount);
  for (let i = 0; i < birdCount; i++) phases[i] = random() * Math.PI * 2;
  birdGeometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
  const birdMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAccent: { value: new THREE.Color(COLORS.accent) },
      uViolet: { value: new THREE.Color(COLORS.violet) },
      uFog: { value: new THREE.Color(COLORS.bg) }
    },
    vertexShader: `
      attribute float aWing; attribute float aTone; attribute float aPhase;
      uniform float uTime;
      varying float vTone; varying vec3 vWorld;
      void main() {
        vec3 p = position;
        if (aWing > 0.0) {
          float side = sign(p.x);
          float beat = sin(uTime * 9.0 + aPhase);
          float ang = (beat * 0.78 + 0.12) * side * (0.75 + 0.5 * aWing);
          float rx = p.x - side * 0.05;
          float c = cos(ang); float s = sin(ang);
          p.x = side * 0.05 + rx * c - p.y * s;
          p.y = rx * s + p.y * c;
        }
        vTone = aTone;
        vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uAccent; uniform vec3 uViolet; uniform vec3 uFog;
      varying float vTone; varying vec3 vWorld;
      void main() {
        vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        float diff = abs(dot(n, normalize(vec3(-0.35, 1.0, 0.45))));
        float tone = vTone < 0.0 ? (gl_FrontFacing ? 0.0 : 0.62) : vTone;
        vec3 sheen = mix(uAccent, uViolet, 0.22 + 0.22 * sin(vWorld.x * 0.6 + vWorld.z * 0.4 + uTime * 0.7));
        vec3 dark = vec3(0.025, 0.035, 0.032) + sheen * (0.12 + 0.5 * pow(diff, 3.0));
        vec3 light = vec3(0.86, 0.85, 0.8) * (0.32 + 0.68 * diff);
        vec3 col = mix(dark, light, tone);
        float fog = smoothstep(26.0, 74.0, length(vWorld - cameraPosition));
        gl_FragColor = vec4(mix(col, uFog, fog * 0.9), 1.0);
      }`,
    side: THREE.DoubleSide
  });
  const birds = new THREE.InstancedMesh(birdGeometry, birdMaterial, birdCount);
  birds.frustumCulled = false;
  birds.visible = false;
  scene.add(birds);
  const birdData = [];
  for (let i = 0; i < birdCount; i++) {
    // Die ersten Vögel starten dort, wo Figuren stehen; der Rest von freien Feldern.
    const piece = pieces[i % pieces.length];
    const cell = i < pieces.length ? null : cells[Math.floor(random() * 64)];
    birdData.push({
      piece: cell ? null : piece,
      cell,
      delay: random(),
      angle: random() * Math.PI * 2,
      radius: 5 + random() * 8,
      height: (random() - 0.5) * 6,
      speed: 0.16 + random() * 0.1,
      bob: random() * Math.PI * 2,
      size: 0.85 + random() * 0.5,
      prev: new THREE.Vector3(),
      dir: new THREE.Vector3(0, 0, 1),
      started: false
    });
  }

  /* ── Zustand ─────────────────────────────────────────────────────────────── */
  const state = Object.assign({}, KEYS[0]);
  const pointer = { x: 0, y: 0 };
  const lagPointer = { x: 0, y: 0 };
  const intro = { k: 0 };
  let t = 0;
  let tSmooth = 0;
  let snapNext = true;
  let lastChapter = -1;
  const hop = { piece: null, x: 0, z: 0, y: 0 };
  let tourTimeline = null;
  let lastMover = null;
  const veil = document.querySelector(".xp-veil");
  const routeLabel = document.querySelector("[data-xp-route]");

  const dummy = new THREE.Object3D();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const color = new THREE.Color();
  const ramp = new THREE.Color();
  const target = new THREE.Vector3();
  const flockCenter = new THREE.Vector3(0, 10, -16);

  function sample(value) {
    const max = KEYS.length - 1;
    const v = Math.min(max, Math.max(0, value));
    const i = Math.min(max - 1, Math.floor(v));
    const f = smooth(v - i);
    const a = KEYS[i];
    const b = KEYS[i + 1];
    for (const channel of CHANNELS) state[channel] = a[channel] + (b[channel] - a[channel]) * f;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    if (composer) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();

  /* ── Zugketten im Hero (GSAP) ───────────────────────────────────────────── */
  // Ziele eines Zuges über freie Felder; das Ausgangsfeld der Rundreise gilt
  // als frei, weil die Figur es gerade verlassen hat.
  function targets(type, file, rank, home) {
    const free = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8 && (!occupied.has(f * 8 + r) || f * 8 + r === home);
    const out = [];
    for (const [df, dr] of STEPS[type]) {
      let f = file + df;
      let r = rank + dr;
      while (free(f, r)) {
        out.push([f, r]);
        if (!SLIDES[type]) break;
        f += df;
        r += dr;
      }
    }
    return out;
  }

  // Sucht per Tiefensuche in zufälliger Reihenfolge eine Rundreise aus
  // 3 bis 6 Zügen, die kein Feld doppelt betritt.
  function findTour(piece) {
    const home = piece.file * 8 + piece.rank;
    const length = 3 + Math.floor(Math.random() * 4);
    const path = [[piece.file, piece.rank]];
    const seen = new Set([home]);
    let budget = 3000;
    const walk = () => {
      if (--budget < 0) return false;
      const [f, r] = path[path.length - 1];
      const next = targets(piece.type, f, r, home);
      if (path.length === length) return next.some(([nf, nr]) => nf * 8 + nr === home);
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      for (const square of next) {
        const key = square[0] * 8 + square[1];
        if (seen.has(key)) continue;
        seen.add(key);
        path.push(square);
        if (walk()) return true;
        path.pop();
        seen.delete(key);
      }
      return false;
    };
    if (!walk()) return null;
    path.push([piece.file, piece.rank]);
    return path;
  }

  function chooseTour() {
    const shuffled = (list) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    const movers = pieces.filter((piece) => piece.type !== "p" && piece !== lastMover);
    // Weiß steht vorn zur Kamera und ist zu zwei Dritteln am Zug.
    const white = shuffled(movers.filter((piece) => piece.white));
    const black = shuffled(movers.filter((piece) => !piece.white));
    const order = Math.random() < 0.66 ? white.concat(black) : black.concat(white);
    for (const piece of order) {
      const path = findTour(piece);
      if (path) return { piece, path };
    }
    return null;
  }

  function playTour() {
    const gsap = window.gsap;
    const tour = chooseTour();
    if (!tour) return;
    const { piece, path } = tour;
    lastMover = piece;
    hop.piece = piece;
    hop.x = squareX(piece.file);
    hop.z = squareZ(piece.rank);
    hop.y = 0;
    const glyph = GLYPHS[piece.type][piece.white ? 0 : 1];
    tourTimeline = gsap.timeline({
      delay: 0.9,
      onComplete: () => {
        piece.group.position.x = squareX(piece.file);
        piece.group.position.z = squareZ(piece.rank);
        hop.piece = null;
        playTour();
      }
    });
    for (let i = 1; i < path.length; i++) {
      const [ff, fr] = path[i - 1];
      const [file, rank] = path[i];
      const distance = Math.hypot(file - ff, rank - fr);
      // Springer springen im Bogen, alle anderen gleiten knapp über dem Brett.
      const jump = piece.type === "n" ? 0.95 : 0.22;
      const duration = piece.type === "n" ? 0.62 : 0.42 + 0.09 * distance;
      tourTimeline
        .add(() => {
          markFrom.position.set(squareX(ff), 0.006, squareZ(fr));
          markTo.position.set(squareX(file), 0.006, squareZ(rank));
          markTo.userData.flash = 1;
          if (routeLabel) routeLabel.textContent = `${glyph} ${squareName(ff, fr)} → ${squareName(file, rank)}`;
        })
        .to(hop, { x: squareX(file), z: squareZ(rank), duration, ease: "power2.inOut" })
        .to(hop, { y: jump, duration: duration / 2, ease: "power2.out" }, "<")
        .to(hop, { y: 0, duration: duration / 2, ease: "power2.in" }, ">")
        .to({}, { duration: 1.1 });
    }
  }

  /* ── Bild für Bild ───────────────────────────────────────────────────────── */
  function frameStep(time, dt) {
    if (!tourTimeline && window.gsap) playTour();

    t = stage.pin !== null ? stage.pin : stage.scroll ? stage.scroll() : 0;
    if (snapNext) {
      tSmooth = t;
      snapNext = false;
    } else {
      tSmooth += (t - tSmooth) * (1 - Math.exp(-dt * 3.2));
    }
    sample(tSmooth);
    const chapter = Math.round(t);
    if (chapter !== lastChapter && stage.onChapter) {
      lastChapter = chapter;
      stage.onChapter(chapter);
    }

    // Zugketten laufen nur, solange der Hero die Bühne hat.
    if (tourTimeline) {
      if (state.tour > 0.5 && tourTimeline.paused()) tourTimeline.resume();
      if (state.tour < 0.5 && !tourTimeline.paused() && hop.y === 0) tourTimeline.pause();
    }

    lagPointer.x += (pointer.x - lagPointer.x) * (1 - Math.exp(-dt * 2.5));
    lagPointer.y += (pointer.y - lagPointer.y) * (1 - Math.exp(-dt * 2.5));

    updateCamera(time);
    updateBoard(time, dt);
    updatePieces(time);
    updateMotes(time);
    updateAnalysis(time);
    updateDome(time);
    updateBirds(time, dt);

    dust.rotation.y = time * 0.012;
    dust.position.y = Math.sin(time * 0.2) * 0.3;
    halo.material.opacity = 0.07 + state.glow * 0.1 + state.scan * 0.04;
    heart.intensity = state.glow * 14 + state.scan * 3;

    if (veil) {
      veil.style.setProperty("--veil", state.veil.toFixed(3));
      veil.style.setProperty("--side", state.side.toFixed(3));
    }

    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
    watchPerformance(dt);
  }

  function updateCamera(time) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const narrow = width < 820;
    let r = state.r + intro.k * 10;
    let el = state.el + intro.k * 16 - lagPointer.y * 1.6;
    let az = state.az - intro.k * 34 + lagPointer.x * 3.2 + Math.sin(time * 0.11) * 1.6;
    if (aspect < 1.3) r *= 1 + (1.3 - aspect) * 0.95;
    el = Math.max(1, Math.min(88, el));
    const elR = (el * Math.PI) / 180;
    const azR = (az * Math.PI) / 180;
    target.set(state.tx, state.ty, state.tz);
    camera.position.set(
      target.x + Math.sin(azR) * Math.cos(elR) * r,
      target.y + Math.sin(elR) * r,
      target.z + Math.cos(azR) * Math.cos(elR) * r
    );
    camera.lookAt(target);
    camera.fov = state.fov;
    const shiftX = narrow ? 0 : state.shift * (RTL ? 1 : -1);
    const shiftY = narrow ? 0.16 * state.side : 0;
    camera.setViewOffset(width, height, shiftX * width, shiftY * height, width, height);
    camera.updateProjectionMatrix();
  }

  function updateBoard(time, dt) {
    const terrain = state.terrain;
    const scanZ = 4.3 - 8.6 * fract(time * 0.22);
    scan.position.z = scanZ;
    const decay = Math.exp(-dt * 4.5);
    for (let i = 0; i < 64; i++) {
      const cell = cells[i];
      const rise = ease(clamp01(terrain * 1.45 - cell.delay));
      const height = cell.height * rise;
      dummy.position.set(cell.x, -0.25, cell.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 0.25 + height, 1);
      dummy.updateMatrix();
      squares.setMatrixAt(i, dummy.matrix);

      cell.glow *= decay;
      const scanGlow = state.scan * Math.exp(-Math.pow((cell.z - scanZ) / 0.5, 2)) * 0.7;
      const glow = Math.min(1, cell.glow + scanGlow);
      color.copy(cell.base);
      if (rise > 0) {
        const heat = height / maxHeight;
        if (heat < 0.55) ramp.lerpColors(C_LOW, C_ACCENT, heat / 0.55);
        else ramp.lerpColors(C_ACCENT, C_RED, (heat - 0.55) / 0.45);
        color.lerp(ramp.multiplyScalar(0.72), Math.min(1, rise * 1.2));
      }
      color.lerp(C_ACCENT, glow * 0.75);
      squares.setColorAt(i, color);
    }
    squares.instanceMatrix.needsUpdate = true;
    squares.instanceColor.needsUpdate = true;

    const flat = 1 - Math.min(1, terrain * 2);
    edge.material.opacity = 0.5 * flat + state.glow * 0.4;
    labels.visible = flat > 0.05;
    labels.children.forEach((label) => { label.material.opacity = 0.55 * flat; });
  }

  function updatePieces(time) {
    if (hop.piece) hop.piece.group.position.set(hop.x, 0, hop.z);
    for (const piece of pieces) {
      const amount = smooth(clamp01(state.pieces * 1.5 - piece.delay * 0.5));
      const visible = amount > 0.002;
      piece.group.visible = visible;
      if (!visible) continue;
      piece.group.scale.setScalar(amount);
      const baseY = piece === hop.piece ? hop.y : 0;
      piece.group.position.y = baseY - (1 - amount) * 0.4;
    }
    const hero = state.tour;
    markFrom.material.opacity = 0.16 * hero;
    markTo.userData.flash = (markTo.userData.flash || 0) * 0.97;
    markTo.material.opacity = (0.24 + 0.3 * markTo.userData.flash) * hero;
    markFrom.visible = markTo.visible = hero > 0.01;
  }

  function updateMotes(time) {
    const streams = state.streams;
    const orbit = state.orbit;
    const active = streams > 0.004 || orbit > 0.004;
    motes.visible = active;
    if (!active) return;
    for (let i = 0; i < motesCount; i++) {
      const m = moteData[i];
      const u = fract(time * m.speed + m.offset);
      // Strom: quadratische Bahn von der Quelle zum Zielfeld
      const s = m.source.at;
      const cx = (s.x + m.cell.x) * 0.5;
      const cy = Math.max(s.y, 0) + m.lift;
      const cz = (s.z + m.cell.z) * 0.5;
      const iu = 1 - u;
      v1.set(
        iu * iu * s.x + 2 * iu * u * cx + u * u * m.cell.x,
        iu * iu * s.y + 2 * iu * u * cy + u * u * 0.05,
        iu * iu * s.z + 2 * iu * u * cz + u * u * m.cell.z
      );
      // Kreisbahn unter der Kuppel
      const a = m.orbitAngle + time * m.orbitSpeed;
      v2.set(Math.cos(a) * m.orbitRadius, m.orbitHeight + Math.sin(time * 0.8 + m.offset * 6) * 0.25, Math.sin(a) * m.orbitRadius);
      v1.lerp(v2, smooth(orbit));
      const streamScale = streams * smooth(clamp01(u / 0.08)) * smooth(clamp01((1 - u) / 0.1));
      const scale = m.size * Math.max(streamScale * (1 - orbit), orbit * 0.55);
      dummy.position.copy(v1);
      dummy.rotation.set(m.spin + time, m.spin * 2 + time * 0.7, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      motes.setMatrixAt(i, dummy.matrix);
      const cycle = Math.floor(time * m.speed + m.offset);
      if (cycle !== m.cycle) {
        if (m.cycle !== undefined && streams > 0.2) m.cell.glow = Math.max(m.cell.glow, 0.55 * streams);
        m.cycle = cycle;
      }
    }
    motes.instanceMatrix.needsUpdate = true;
  }

  function updateAnalysis(time) {
    const amount = state.scan;
    scan.visible = amount > 0.004;
    scanMaterial.uniforms.uAmount.value = amount;
    evalBar.visible = amount > 0.004;
    evalBar.scale.set(1, Math.max(0.001, smooth(amount)), 1);
    // Eine Partie in sechs Sekunden: ausgeglichen, leichter Vorteil, dann der Blunder.
    const cycle = fract(time / 6);
    const blunder = smooth(clamp01((cycle - 0.62) / 0.06)) * (1 - smooth(clamp01((cycle - 0.94) / 0.06)));
    const evalValue = 0.53 + 0.05 * Math.sin(time * 1.3) - 0.33 * blunder;
    evalFill.scale.y = 3.2 * evalValue;
    markBlunder.visible = amount > 0.004;
    markBlunder.material.opacity = amount * (0.12 + 0.55 * blunder * (0.75 + 0.25 * Math.sin(time * 14)));
    arrow.visible = amount > 0.004;
    arrow.children[0].material.opacity = amount * 0.85 * smooth(clamp01((cycle - 0.7) / 0.08)) * (1 - smooth(clamp01((cycle - 0.94) / 0.06)));
  }

  function updateDome(time) {
    const amount = state.dome;
    dome.visible = amount > 0.004;
    domeMaterial.uniforms.uReveal.value = ease(clamp01(amount * 1.15));
    domeMaterial.uniforms.uAmount.value = Math.min(1, amount * 1.6);
    domeMaterial.uniforms.uTime.value = time;
    domeRing.material.opacity = Math.min(1, amount * 2) * 0.8;
  }

  function updateBirds(time, dt) {
    const flock = state.flock;
    birds.visible = flock > 0.002;
    if (!birds.visible) {
      for (const bird of birdData) bird.started = false;
      return;
    }
    birdMaterial.uniforms.uTime.value = time;
    for (let i = 0; i < birdCount; i++) {
      const b = birdData[i];
      const p = clamp01((flock * 1.45 - b.delay * 0.45));
      if (p <= 0) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        birds.setMatrixAt(i, dummy.matrix);
        b.started = false;
        continue;
      }
      // Start: das Feld der Figur, aus der dieser Vogel wird.
      if (b.piece) v1.set(b.piece.group.position.x, 0.35, b.piece.group.position.z);
      else v1.set(b.cell.x, 0.35, b.cell.z);
      // Ziel: eine weite, atmende Schleife über dem Brett.
      const a = b.angle + time * b.speed;
      v2.set(
        flockCenter.x + Math.cos(a) * b.radius,
        flockCenter.y + b.height + Math.sin(time * 0.6 + b.bob) * 0.9 + Math.sin(a * 2 + time * 0.35) * 1.6,
        flockCenter.z + Math.sin(a) * b.radius * 0.6
      );
      const e = ease(p);
      // kubische Bahn: steil hoch, dann in die Schleife einschwenken
      const p0 = v1, p3 = v2;
      v3.set(p0.x, p0.y + 4.5, p0.z);
      const c2x = (p0.x + p3.x) * 0.5, c2y = p3.y - 1.5, c2z = (p0.z + p3.z) * 0.5 + 3;
      const ie = 1 - e;
      const x = ie * ie * ie * p0.x + 3 * ie * ie * e * v3.x + 3 * ie * e * e * c2x + e * e * e * p3.x;
      const y = ie * ie * ie * p0.y + 3 * ie * ie * e * v3.y + 3 * ie * e * e * c2y + e * e * e * p3.y;
      const z = ie * ie * ie * p0.z + 3 * ie * ie * e * v3.z + 3 * ie * e * e * c2z + e * e * e * p3.z;
      dummy.position.set(x, y, z);
      if (!b.started) {
        b.prev.copy(dummy.position).add(v3.set(0, -0.1, 0));
        b.dir.set(0, 1, 0.3).normalize();
        b.started = true;
      }
      v3.copy(dummy.position).sub(b.prev);
      if (v3.lengthSq() > 1e-7) b.dir.lerp(v3.normalize(), 1 - Math.exp(-dt * 6)).normalize();
      b.prev.copy(dummy.position);
      dummy.lookAt(v3.copy(dummy.position).add(b.dir));
      dummy.scale.setScalar(b.size * smooth(clamp01(p / 0.06)) * 1.1);
      dummy.updateMatrix();
      birds.setMatrixAt(i, dummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
  }

  // Wenn die Bildrate dauerhaft einbricht: erst Bloom, dann Auflösung opfern.
  let perfTime = 0;
  let perfFrames = 0;
  let perfStage = 0;
  function watchPerformance(dt) {
    if (perfStage > 1 || !root.classList.contains("xp-intro-done")) return;
    perfTime += dt;
    perfFrames += 1;
    if (perfTime < 2.5) return;
    const average = perfTime / perfFrames;
    perfTime = 0;
    perfFrames = 0;
    if (average < 0.026) return;
    if (perfStage === 0 && composer) {
      composer = null;
    } else {
      pixelRatio = Math.max(1, pixelRatio * 0.7);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
    perfStage += 1;
  }

  const stage = {
    pointer,
    intro,
    scroll: null,
    pin: null,
    onChapter: null,
    frame: frameStep,
    resize,
    snap() { snapNext = true; },
    debug: { scene, camera, renderer, get composer() { return composer; }, set composer(v) { composer = v; } }
  };
  return stage;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Formen
   ══════════════════════════════════════════════════════════════════════════════ */

// Drehprofil aus Stützpunkten [Radius, Höhe, Kante?]. Zwischen den Punkten
// läuft ein Catmull-Rom-Bogen; ein Punkt mit Kante bricht den Bogen und wird
// verdoppelt, damit LatheGeometry dort eine scharfe Schattenkante setzt.
function lathe(THREE, spec, steps = 6) {
  const out = [];
  const push = (r, y) => out.push(new THREE.Vector2(Math.max(0, r), y));
  let run = [];
  const flush = () => {
    for (let i = 0; i < run.length - 1; i++) {
      const p0 = run[Math.max(0, i - 1)], p1 = run[i], p2 = run[i + 1], p3 = run[Math.min(run.length - 1, i + 2)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        push(cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]));
      }
    }
  };
  spec.forEach((point, index) => {
    run.push(point);
    const last = index === spec.length - 1;
    if ((point[2] || last) && run.length > 1) {
      // Der nächste Bogen beginnt wieder mit diesem Punkt: so liegt er doppelt.
      flush();
      push(point[0], point[1]);
      run = [point];
    } else if (point[2] && index === 0) {
      run = [point];
    }
  });
  return new THREE.LatheGeometry(out, 56);
}

// Kreisbogen als Stützpunkte, für Köpfe und Knäufe.
function arc(cx, cy, radius, from, to, count = 7) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const a = ((from + (to - from) * (i / count)) * Math.PI) / 180;
    points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  return points;
}

// Gemeinsamer Fuß: runde Standplatte, Kehle, Wulst. s skaliert den Radius.
function foot(s = 1) {
  return [[0, 0, 1], [0.3 * s, 0, 1], [0.306 * s, 0.017], [0.3 * s, 0.038], [0.274 * s, 0.056], [0.248 * s, 0.066, 1],
    [0.252 * s, 0.077], [0.256 * s, 0.09], [0.24 * s, 0.103], [0.212 * s, 0.11, 1]];
}

// Figuren in Feldeinheiten: schlanke, weich gedrehte Staunton-Formen.
function pieceGeometries(THREE) {
  const pawn = lathe(THREE, [...foot(0.87),
    [0.155, 0.122], [0.123, 0.165], [0.1, 0.235], [0.09, 0.295], [0.092, 0.33, 1],
    [0.148, 0.338], [0.156, 0.351], [0.148, 0.364, 1], [0.096, 0.372, 1],
    [0.077, 0.384], ...arc(0, 0.476, 0.118, -52, 90), [0, 0.594, 1]]);

  const rook = lathe(THREE, [...foot(1.03),
    [0.2, 0.13], [0.18, 0.2], [0.17, 0.32], [0.172, 0.42], [0.186, 0.48], [0.205, 0.51, 1],
    [0.238, 0.519], [0.246, 0.534], [0.238, 0.549, 1], [0.214, 0.558, 1],
    [0.228, 0.575], [0.244, 0.6], [0.25, 0.628, 1], [0.25, 0.662, 1], [0.174, 0.662, 1], [0.174, 0.642, 1], [0, 0.642, 1]]);
  const rookParts = [rook];
  const merlonShape = (a0, a1) => {
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a0) * 0.25, Math.sin(a0) * 0.25);
    shape.absarc(0, 0, 0.25, a0, a1, false);
    shape.lineTo(Math.cos(a1) * 0.174, Math.sin(a1) * 0.174);
    shape.absarc(0, 0, 0.174, a1, a0, true);
    shape.closePath();
    return shape;
  };
  for (let i = 0; i < 6; i++) {
    const center = (i / 6) * Math.PI * 2;
    const half = (Math.PI / 6) * 0.62;
    const merlon = new THREE.ExtrudeGeometry(merlonShape(center - half, center + half), {
      depth: 0.07, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8
    });
    merlon.rotateX(-Math.PI / 2);
    merlon.translate(0, 0.662 + 0.006, 0);
    rookParts.push(merlon);
  }

  const bishop = lathe(THREE, [...foot(0.96),
    [0.19, 0.125], [0.15, 0.17], [0.12, 0.26], [0.1, 0.36], [0.095, 0.43], [0.1, 0.46, 1],
    [0.162, 0.469], [0.17, 0.482], [0.162, 0.495, 1], [0.128, 0.5, 1],
    [0.152, 0.507], [0.158, 0.517], [0.148, 0.527, 1], [0.088, 0.534, 1],
    [0.1, 0.552], [0.134, 0.6], [0.151, 0.66], [0.144, 0.72], [0.114, 0.78], [0.07, 0.828], [0.034, 0.852, 1],
    ...arc(0, 0.889, 0.042, -56, 90, 6), [0, 0.931, 1]]);

  const queen = lathe(THREE, [...foot(1.02),
    [0.205, 0.125], [0.16, 0.17], [0.125, 0.28], [0.106, 0.4], [0.1, 0.5], [0.105, 0.58], [0.12, 0.62, 1],
    [0.192, 0.629], [0.2, 0.644], [0.19, 0.659, 1], [0.14, 0.667, 1],
    [0.168, 0.675], [0.174, 0.687], [0.164, 0.697, 1], [0.118, 0.704, 1],
    [0.134, 0.73], [0.164, 0.79], [0.198, 0.85], [0.214, 0.876, 1], [0.198, 0.886, 1],
    [0.168, 0.886], [0.12, 0.9], [0.072, 0.928], [0.048, 0.955, 1],
    ...arc(0, 0.993, 0.044, -58, 90, 6), [0, 1.037, 1]]);
  const queenParts = [queen];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    queenParts.push(new THREE.SphereGeometry(0.03, 14, 10).translate(Math.cos(a) * 0.196, 0.893, Math.sin(a) * 0.196));
  }

  const king = lathe(THREE, [...foot(1.05),
    [0.21, 0.125], [0.165, 0.17], [0.13, 0.29], [0.11, 0.42], [0.105, 0.52], [0.11, 0.6], [0.125, 0.64, 1],
    [0.202, 0.649], [0.21, 0.664], [0.2, 0.679, 1], [0.15, 0.687, 1],
    [0.178, 0.695], [0.184, 0.707], [0.174, 0.717, 1], [0.124, 0.724, 1],
    [0.14, 0.75], [0.17, 0.81], [0.2, 0.87], [0.212, 0.894, 1], [0.198, 0.904, 1],
    [0.17, 0.91], [0.12, 0.928], [0.07, 0.952], [0.04, 0.966, 1], [0, 0.968, 1]]);
  const cross = new THREE.Shape();
  const w = 0.026;
  cross.moveTo(-w, 0.955);
  cross.lineTo(w, 0.955);
  cross.lineTo(w, 1.05);
  cross.lineTo(0.075, 1.05);
  cross.lineTo(0.075, 1.098);
  cross.lineTo(w, 1.098);
  cross.lineTo(w, 1.17);
  cross.lineTo(-w, 1.17);
  cross.lineTo(-w, 1.098);
  cross.lineTo(-0.075, 1.098);
  cross.lineTo(-0.075, 1.05);
  cross.lineTo(-w, 1.05);
  cross.closePath();
  const kingCross = new THREE.ExtrudeGeometry(cross, {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3, curveSegments: 4
  });
  kingCross.translate(0, 0, -0.015);

  // Springer: klassischer Pferdekopf im Profil auf dem gemeinsamen Fuß, dazu
  // ein schmalerer Mähnenkamm, der hinten über den Hals steht.
  // Blickrichtung +x, Mitte bei z = 0.
  const knightBase = lathe(THREE, [...foot(1.0), [0.21, 0.122], [0.2, 0.15, 1], [0, 0.15, 1]]);
  const head = new THREE.Shape();
  head.moveTo(-0.165, 0.13);
  head.lineTo(0.165, 0.13);
  head.bezierCurveTo(0.215, 0.23, 0.2, 0.33, 0.12, 0.4);
  head.bezierCurveTo(0.08, 0.43, 0.08, 0.48, 0.13, 0.5);
  head.lineTo(0.25, 0.515);
  head.bezierCurveTo(0.305, 0.522, 0.315, 0.58, 0.29, 0.605);
  head.bezierCurveTo(0.24, 0.65, 0.17, 0.7, 0.11, 0.735);
  head.lineTo(0.085, 0.81);
  head.lineTo(0.06, 0.875);
  head.lineTo(0.03, 0.82);
  head.bezierCurveTo(-0.03, 0.8, -0.11, 0.74, -0.14, 0.64);
  head.bezierCurveTo(-0.17, 0.52, -0.215, 0.32, -0.165, 0.13);
  const knightHead = new THREE.ExtrudeGeometry(head, {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: 6, curveSegments: 18
  });
  knightHead.translate(0, 0, -0.05);
  const mane = new THREE.Shape();
  mane.moveTo(0.0, 0.76);
  mane.bezierCurveTo(-0.02, 0.82, -0.04, 0.83, -0.05, 0.82);
  mane.bezierCurveTo(-0.15, 0.78, -0.2, 0.68, -0.205, 0.6);
  mane.bezierCurveTo(-0.225, 0.48, -0.25, 0.32, -0.2, 0.15);
  mane.lineTo(-0.12, 0.15);
  mane.bezierCurveTo(-0.15, 0.32, -0.12, 0.48, -0.1, 0.6);
  mane.bezierCurveTo(-0.08, 0.68, -0.04, 0.73, 0.0, 0.76);
  const knightMane = new THREE.ExtrudeGeometry(mane, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 4, curveSegments: 14
  });
  knightMane.translate(0, 0, -0.025);

  return {
    p: [pawn],
    r: rookParts,
    b: [bishop],
    q: queenParts,
    k: [king, kingCross],
    n: [knightBase, knightHead, knightMane]
  };
}

// Ein Kiebitz in Feldgröße: Rumpf, Federhaube, breite runde Flügel.
// aWing: Gewicht für den Flügelschlag (0 = Rumpf), aTone: 0 dunkel, 1 hell,
// −1 = Flügel, oben dunkel schillernd, unten heller.
function lapwingGeometry(THREE) {
  const positions = [];
  const wings = [];
  const tones = [];
  const push = (points, wing, tone, faceUp) => {
    let [a, b, c] = points;
    if (faceUp) {
      const ux = b[0] - a[0], uz = b[2] - a[2];
      const vx = c[0] - a[0], vz = c[2] - a[2];
      const ny = uz * vx - ux * vz;
      if (ny < 0) [b, c] = [c, b];
    }
    for (const p of [a, b, c]) {
      positions.push(p[0], p[1], p[2]);
      wings.push(wing(p));
      tones.push(tone);
    }
  };
  const none = () => 0;
  const nose = [0, 0.01, 0.3], tail = [0, 0.0, -0.24], top = [0, 0.065, 0.03], belly = [0, -0.07, 0.03];
  const left = [-0.07, 0, 0.04], right = [0.07, 0, 0.04];
  push([nose, left, top], none, 0);
  push([nose, top, right], none, 0);
  push([tail, top, left], none, 0);
  push([tail, right, top], none, 0);
  push([nose, belly, left], none, 1);
  push([nose, right, belly], none, 1);
  push([tail, left, belly], none, 0.85);
  push([tail, belly, right], none, 0.85);
  // Federhaube, typisch Kiebitz
  push([[0, 0.05, 0.17], [0, 0.19, -0.02], [0, 0.065, 0.08]], none, 0);
  // Schwanzfächer
  push([[-0.085, 0, -0.34], [0.085, 0, -0.34], [0, 0.005, -0.2]], none, 0.7);
  // Flügel: runder Umriss, Fächer von der Wurzel aus
  const wingOutline = [[0.05, 0, 0.1], [0.2, 0.01, 0.12], [0.33, 0.02, 0.07], [0.43, 0.02, -0.02],
    [0.44, 0.02, -0.1], [0.34, 0.01, -0.15], [0.18, 0, -0.12], [0.05, 0, -0.09]];
  for (const side of [-1, 1]) {
    const pts = wingOutline.map(([x, y, z]) => [x * side, y, z]);
    const hub = [0.06 * side, 0, 0];
    const weight = (p) => Math.min(1, Math.abs(p[0]) / 0.44 + 0.001);
    for (let i = 0; i < pts.length - 1; i++) push([hub, pts[i], pts[i + 1]], weight, -1, true);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aWing", new THREE.Float32BufferAttribute(wings, 1));
  geometry.setAttribute("aTone", new THREE.Float32BufferAttribute(tones, 1));
  return geometry;
}

function radialTexture(THREE) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Graustufen-Verlauf für alphaMap (liest den Grünkanal): innen voll, außen nichts.
function groundFade(THREE) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.16, "#fff");
  gradient.addColorStop(0.42, "#5a5a5a");
  gradient.addColorStop(0.75, "#000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function lineLoop(THREE, half, y, hex, opacity) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-half, y, -half), new THREE.Vector3(half, y, -half),
    new THREE.Vector3(half, y, half), new THREE.Vector3(-half, y, half)
  ]);
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity }));
}

function labelSprite(THREE, text, x, z) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8b8a82";
  ctx.font = "500 38px ui-monospace, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 32, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.55, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, -0.015, z);
  return mesh;
}

function squareMark(THREE, hex) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.985, 0.985),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.006;
  mesh.visible = false;
  return mesh;
}

function moveArrow(THREE, from, to, hex) {
  const fx = squareX(from[0]), fz = squareZ(from[1]);
  const tx = squareX(to[0]), tz = squareZ(to[1]);
  const dx = tx - fx, dz = tz - fz;
  const length = Math.hypot(dx, dz);
  const shape = new THREE.Shape();
  const shaft = 0.075, head = 0.24, headLength = 0.42, start = 0.18, end = length - 0.12;
  shape.moveTo(start, -shaft);
  shape.lineTo(end - headLength, -shaft);
  shape.lineTo(end - headLength, -head);
  shape.lineTo(end, 0);
  shape.lineTo(end - headLength, head);
  shape.lineTo(end - headLength, shaft);
  shape.lineTo(start, shaft);
  shape.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(fx, 0.03, fz);
  group.rotation.y = Math.atan2(-dz, dx);
  group.visible = false;
  return group;
}
