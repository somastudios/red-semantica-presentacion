/* ============================================================
   Transiciones entre escenas
   iris  → anillos concéntricos que nacen de un punto y abren un hueco
   slash → paneles diagonales tipo cómic + tipografía cinética
   liquid → cortina líquida (metaballs con filtro goo)
   Todas llaman a peak() cuando la pantalla está cubierta: ahí se cambia la escena.
   ============================================================ */
const TX = (() => {
  const gI = $('#txIris'), gL = $('#txLiquid'), lab = $('#txLabel');
  const kSub = lab.querySelector('.k-sub'), kMain = lab.querySelector('.k-main');
  let live = null;
  const finish = () => { if (live) { live.progress(1); live = null; } };

  function kinetic(tl, { sub, main, dir = 1, at, out, color = '#141210' }) {
    if (!main) return;
    if (kMain._split) { kMain._split.revert(); kMain._split = null; }
    kSub.textContent = sub || ''; kMain.textContent = main; lab.style.color = color;
    kMain._split = SplitText.create(kMain, { type: 'chars' });
    tl.set(lab, { autoAlpha: 1, x: 0, skewX: 0, scale: 1, filter: 'blur(0px)' }, at);
    tl.fromTo(kMain._split.chars, { x: 160 * dir, skewX: -28 * dir, opacity: 0, yPercent: 20 },
      { x: 0, skewX: 0, opacity: 1, yPercent: 0, duration: .55, ease: 'expo.out', stagger: { each: .016, from: dir > 0 ? 'start' : 'end' } }, at);
    tl.fromTo(kSub, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'expo.out' }, at + .06);
    tl.fromTo(kMain, { textShadow: '-16px 0 rgba(255,40,90,.8), 16px 0 rgba(40,210,255,.8)' },
      { textShadow: '0px 0 rgba(255,40,90,0), 0px 0 rgba(40,210,255,0)', duration: .7, ease: 'power2.out' }, at);
    tl.to(lab, { x: 1100 * dir, skewX: -34 * dir, opacity: 0, filter: 'blur(18px)', duration: .5, ease: 'expo.in' }, out);
    tl.set(lab, { autoAlpha: 0 });
  }

  /* ---- iris: anillos que nacen de un punto ---- */
  function iris({ cx = 800, cy = 450, colors, sub, main }, peak) {
    finish();
    const R = Math.hypot(Math.max(cx, 1600 - cx), Math.max(cy, 900 - cy)) + 90, k = R / 92;
    gsap.set(gI, { autoAlpha: 1 });
    const L = [0, 1, 2].map(i => ({ p: $('#iri' + i), h: $('#irh' + i), o: { s: 0, h: 0, r: 0 } }));
    L.forEach((l, i) => { const d = ringPath(100, 5 + i, 6 + i * 3, i * 1.3); l.p.setAttribute('d', d); l.h.setAttribute('d', ringPath(100, 7, 5 + i * 2, i)); l.p.style.fill = colors[i]; });
    const upd = () => L.forEach(l => {
      l.p.setAttribute('transform', `translate(${cx},${cy}) rotate(${l.o.r}) scale(${l.o.s})`);
      l.h.setAttribute('transform', `translate(${cx},${cy}) rotate(${-l.o.r * 1.4}) scale(${l.o.h})`);
    });
    const tl = gsap.timeline({ onUpdate: upd, onComplete: () => { gsap.set(gI, { autoAlpha: 0 }); live = null; } });
    L.forEach((l, i) => tl.fromTo(l.o, { s: 0, h: 0, r: -30 }, { s: k, r: 30, duration: .5, ease: 'power3.in' }, i * .075));
    tl.call(peak, null, .66);
    kinetic(tl, { sub, main, at: .52, out: .98, color: '#141210' });
    [...L].reverse().forEach((l, j) => tl.to(l.o, { h: k * 1.05, r: 90, duration: .9, ease: 'expo.out' }, (main ? 1.02 : .7) + j * .1));
    live = tl; return tl;
  }

  /* ---- slash: paneles diagonales (capas HTML con clip-path) ---- */
  const hS = $('#txSlashH');
  function slash({ color, sub, main, dir = 1 }, peak) {
    finish();
    hS.innerHTML = ''; gsap.set(hS, { autoAlpha: 1, scaleX: dir > 0 ? 1 : -1, transformOrigin: '50% 50%' });
    const sl = 330;
    const P = [[150, 'var(--ink)'], [560, '#0B0A09'], [2450, color, true], [90, 'var(--ink)'], [30, color]].map(([w, bg, dots]) => {
      const d = document.createElement('div'); d.className = 'tx-panel' + (dots ? ' dots' : '');
      d.style.cssText = `width:${w + sl}px;background-color:${bg};clip-path:polygon(${sl}px 0,${w + sl}px 0,${w}px 100%,0 100%)`;
      hS.appendChild(d); gsap.set(d, { x: -(w + sl) - 30 }); return d;
    });
    const [A, B, C, D, E] = P;
    const tl = gsap.timeline({ onComplete: () => { gsap.set(hS, { autoAlpha: 0 }); hS.innerHTML = ''; live = null; } });
    tl.to(A, { x: 380, duration: .42, ease: 'power3.in' }, 0)
      .to(B, { x: -40, duration: .44, ease: 'power3.in' }, .05)
      .to(C, { x: -430, duration: .46, ease: 'expo.in' }, .1)
      .call(peak, null, .58);
    kinetic(tl, { sub, main, dir, at: .5, out: .98, color: '#141210' });
    tl.to(C, { x: 1700, duration: .62, ease: 'expo.inOut' }, 1.0)
      .to([A, B], { autoAlpha: 0, duration: .01 }, 1.0)
      .to(D, { x: 1700, duration: .62, ease: 'power3.inOut' }, 1.16)
      .to(E, { x: 1700, duration: .58, ease: 'power3.inOut' }, 1.24);
    live = tl; return tl;
  }

  /* ---- liquid: cortina de metaballs ---- */
  function liquid({ color, sub, main, dir = 1 }, peak) {
    finish();
    gL.innerHTML = ''; gsap.set(gL, { autoAlpha: 1 });
    gL.setAttribute('transform', dir > 0 ? '' : 'translate(0,900) scale(1,-1)');
    const H = 1150;
    const rect = svgEl('rect', { x: -200, width: 2000, height: H, y: 1000 }, gL); rect.style.fill = color;
    const n = 17;
    const cs = [...Array(n)].map((_, i) => { const c = svgEl('circle', { cx: -50 + i * (1700 / (n - 1)) + (Math.random() - .5) * 60, r: 0 }, gL); c.style.fill = color; return { c, base: 70 + Math.random() * 120, ph: Math.random() * 6, sp: 4 + Math.random() * 4 }; });
    const o = { y: 1000, amp: 0, t: 0, bottom: false };
    const upd = () => {
      rect.setAttribute('y', o.y);
      cs.forEach(k => { k.c.setAttribute('cy', o.bottom ? o.y + H : o.y); k.c.setAttribute('r', Math.max(0, k.base * o.amp * (.65 + .35 * Math.sin(o.t * k.sp + k.ph)))); });
    };
    const tl = gsap.timeline({ onUpdate: upd, onComplete: () => { gsap.set(gL, { autoAlpha: 0 }); gL.innerHTML = ''; live = null; } });
    tl.to(o, { y: -120, amp: 1, t: 1.2, duration: .62, ease: 'power3.in' }, 0)
      .call(peak, null, .62)
      .set(o, { bottom: true, y: -120 }, .63);
    kinetic(tl, { sub, main, dir: 1, at: .5, out: .95, color: '#141210' });
    tl.to(o, { y: -1400, t: 3.4, duration: .95, ease: 'power3.inOut' }, main ? .98 : .7)
      .to(o, { amp: .2, duration: .5, ease: 'power2.in' }, main ? 1.4 : 1.1);
    live = tl; return tl;
  }

  return { iris, slash, liquid, finish };
})();

/* qué transición lleva cada escena */
const TXMAP = {
  hero:    () => ['iris',   { colors: ['var(--master)', 'var(--diseno)', 'var(--comp)'] }],
  que:     () => ['iris',   { cx: 470, cy: 470, colors: ['var(--master)', 'var(--diseno)', 'var(--comp)'], sub: 'Antes de empezar', main: '¿Qué es una red?' }],
  rels:    () => ['slash',  { color: 'var(--ink)', sub: 'Las flechas', main: 'Cinco relaciones' }],
  paso1:   () => ['liquid', { color: 'var(--comp)', sub: 'Paso 1 de 3', main: 'Conceptos' }],
  paso2:   () => ['slash',  { color: 'var(--diseno)', sub: 'Paso 2 de 3', main: 'Relaciones' }],
  paso3:   () => ['iris',   { colors: ['var(--diseno)', 'var(--comp)', 'var(--mezcla)'], sub: 'Paso 3 de 3', main: 'La red' }],
  comp:    () => ['slash',  { color: 'var(--comp)', sub: 'Etapa 01', main: 'Composición' }],
  diseno:  () => ['slash',  { color: 'var(--diseno)', sub: 'Etapa 02', main: 'Diseño de sonido' }],
  mezcla:  () => ['slash',  { color: 'var(--mezcla)', sub: 'Etapa 03', main: 'Mezcla' }],
  master:  () => ['slash',  { color: 'var(--master)', sub: 'Etapa 04', main: 'Masterización' }],
  infer:   () => ['iris',   { cx: 1440, cy: 370, colors: ['var(--mezcla)', 'var(--diseno)', 'var(--master)'], sub: 'Para qué sirve', main: 'Inferencia' }],
  cierre:  () => ['liquid', { color: 'var(--ink)', sub: 'En resumen', main: 'Lo que aprendimos' }],
  estudio: () => ['iris',   { colors: ['var(--master)', 'var(--mezcla)', 'var(--diseno)'], sub: 'Bonus', main: 'Estudio' }],
  fin:     () => ['iris',   { colors: ['var(--diseno)', 'var(--comp)', 'var(--ink)'] }],
};
function runTx(id, dir, peak) {
  const m = TXMAP[id]; if (!m) return peak();
  const [type, opts] = m(); TX[type]({ ...opts, dir }, peak);
}
