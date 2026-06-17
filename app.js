/* ============================================================
   MA… — scroll engine
   • Hero: full-bleed frame-sequence scrub off the garam-masala clip.
     The clip's background is #fafafa, the hero shares it, so the jar
     reads as floating in the page — not a boxed video. Adjacent frames
     are cross-blended so the scrub stays buttery between the 120 stills.
   • Two horizontal pinned sections (range + promise) scrub sideways
     as you scroll past them.
   ============================================================ */
"use strict";

const HERO_FRAMES = 120;
const PAPER = "#fafafa";
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---------- HERO ---------- */
function initHero() {
  const section = document.querySelector(".hero");
  const canvas = document.getElementById("hero-canvas");
  const ctx = canvas.getContext("2d");
  const beats = [...section.querySelectorAll(".hbeat")];
  const stepEls = [...document.querySelectorAll("#hero-steps span")];
  const progressFill = document.getElementById("progress-fill");

  const images = [];
  let loaded = 0;
  for (let i = 1; i <= HERO_FRAMES; i++) {
    const img = new Image();
    img.src = `frames/hero/frame_${String(i).padStart(4, "0")}.jpg`;
    img.onload = () => { loaded++; if (loaded === 1) { lastKey = -1; render(0); } };
    images[i - 1] = img;
  }

  // geometry shared by both blended frames
  let geo = null;
  function computeGeo(img) {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const ir = img.naturalWidth / img.naturalHeight;
    const wide = cw > 860;
    // The #fafafa frame background matches the page, so the jar reads as
    // floating in the layout. On wide screens it sits in the right half,
    // leaving the left clear for the copy; on mobile it drops to the base.
    let dh = ch * (wide ? 0.9 : 0.6), dw = dh * ir;
    const maxW = cw * (wide ? 0.52 : 0.9);
    if (dw > maxW) { dw = maxW; dh = dw / ir; }
    const cx = wide ? cw * 0.71 : cw * 0.5;
    const dx = cx - dw / 2;
    const dy = wide ? (ch - dh) * 0.5 : (ch - dh) * 0.99;
    return { dx, dy, dw, dh };
  }

  function paint(img, alpha) {
    if (!img || !img.complete || !img.naturalWidth) return;
    if (!geo) geo = computeGeo(img);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, geo.dx, geo.dy, geo.dw, geo.dh);
    ctx.globalAlpha = 1;
  }

  let lastKey = -1;
  function render(p) {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const f = p * (HERO_FRAMES - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(HERO_FRAMES - 1, i0 + 1);
    const frac = f - i0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, cw, ch);
    paint(images[i0], 1);
    if (frac > 0.001) paint(images[i1], frac);   // cross-blend → smooth
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    geo = null;
    render(lastP < 0 ? 0 : lastP);
  }

  let lastP = -1;
  function update() {
    const rect = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const scrollable = rect.height - window.innerHeight;
    const p = clamp01(-rect.top / scrollable);
    // redraw on any sub-frame change so the blend is continuous
    const key = Math.round(p * (HERO_FRAMES - 1) * 3);
    if (key !== lastKey) { lastKey = key; render(p); }
    lastP = p;
    if (progressFill) progressFill.style.width = (p * 100).toFixed(2) + "%";
    let active = 0, best = -1;
    beats.forEach((el, i) => {
      const a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out);
      const mid = (a + b) / 2, half = (b - a) / 2;
      let o;
      if (a <= 0) o = clamp01((b - p) / half);
      else if (b >= 1) o = clamp01((p - a) / half);
      else o = clamp01(1 - Math.abs(p - mid) / half);
      const e = o * o * (3 - 2 * o);   // ease so beats breathe in/out
      el.style.opacity = e.toFixed(3);
      el.style.setProperty("--rise", `${((1 - e) * 36).toFixed(1)}px`);
      if (e > best) { best = e; active = i; }
    });
    stepEls.forEach((s, i) => s.classList.toggle("on", i === active));
  }

  window.addEventListener("resize", resize);
  resize();
  return { update };
}

/* ---------- generic horizontal pinned track ---------- */
function initHTrack(sectionSel, trackSel) {
  const section = document.querySelector(sectionSel);
  const track = document.querySelector(trackSel);
  if (!section || !track) return { update() {} };
  let overflow = 0;
  function measure() {
    overflow = Math.max(0, track.scrollWidth - window.innerWidth + window.innerWidth * 0.10);
  }
  function update() {
    const rect = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const scrollable = rect.height - window.innerHeight;
    const p = clamp01(-rect.top / scrollable);
    track.style.transform = `translate3d(${(-p * overflow).toFixed(1)}px,0,0)`;
  }
  window.addEventListener("resize", measure);
  measure();
  return { update };
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const hero = initHero();
  const range = initHTrack(".range", "#range-track");
  const promise = initHTrack(".promise", "#promise-track");
  const nav = document.getElementById("nav");

  const lenis = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.9 });
  window.__lenis = lenis;
  function raf(t) {
    lenis.raf(t);
    hero.update();
    range.update();
    promise.update();
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  function animateCount(el) {
    const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
    const dur = 1400, t0 = performance.now();
    (function step(t) {
      const k = Math.min((t - t0) / dur, 1), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll?.(".stat-num").forEach(animateCount);
      io.unobserve(e.target);
    }
  }, { threshold: 0.22 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  lenis.on("scroll", ({ scroll }) => {
    nav.classList.toggle("scrolled", scroll > 40);
    document.querySelectorAll(".scroll-hint").forEach((h) => (h.style.opacity = scroll > 80 ? "0" : "0.5"));
  });
});
