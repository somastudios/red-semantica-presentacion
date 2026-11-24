/* ============================================================
   Transiciones entre escenas (sobrias)
   fade → fundido a fondo y regreso
   iris → círculo limpio que cubre desde un punto y se abre de nuevo
   none → entre diapositivas de la red solo se mueve la cámara
   Todas llaman a peak() cuando la escena se puede cambiar.
   ============================================================ */
const TX = (() => {
  const veil = $('#txVeil'), iris = $('#txIris'), ring = $('#txRing');
  let live = null;
  const finish = () => { if (live) { live.progress(1); live = null; } };

  function fade(_, peak) {
    finish();
    const tl = gsap.timeline({ onComplete: () => { live = null; } });
    tl.fromTo(veil, { autoAlpha: 0 }, { autoAlpha: 1, duration: .38, ease: 'power2.inOut' })
      .call(peak)
      .to(veil, { autoAlpha: 0, duration: .75, ease: 'power2.out' }, '+=.04');
    live = tl; return tl;
  }

  function circle({ cx = 800, cy = 450 }, peak) {
    finish();
    const R = Math.hypot(Math.max(cx, 1600 - cx), Math.max(cy, 900 - cy)) + 20;
    const o = { c: 0, h: 0 };
    const upd = () => {
      iris.style.setProperty('--c', o.c + 'px'); iris.style.setProperty('--h', o.h + 'px');
      gsap.set(ring, { width: o.h * 2, height: o.h * 2, x: cx - o.h, y: cy - o.h, opacity: o.h > 0 ? .5 * (1 - o.h / R) : 0 });
    };
    iris.style.setProperty('--x', cx + 'px'); iris.style.setProperty('--y', cy + 'px');
    gsap.set([iris, ring], { autoAlpha: 1 }); upd();
    const tl = gsap.timeline({ onUpdate: upd, onComplete: () => { gsap.set([iris, ring], { autoAlpha: 0 }); live = null; } });
    tl.to(o, { c: R, duration: .55, ease: 'power3.in' })
      .call(peak)
      .to(o, { h: R, duration: 1, ease: 'expo.out' }, '+=.05');
    live = tl; return tl;
  }

  return { fade, circle, none: (_, peak) => { finish(); peak(); }, finish };
})();

/* qué transición lleva cada escena */
const TXMAP = {
  hero: ['fade'], que: ['circle', { cx: 470, cy: 470 }], rels: ['fade'],
  paso1: ['circle'], paso2: ['fade'], paso3: ['circle'],
  comp: ['circle'], diseno: ['circle'], mezcla: ['circle'], master: ['circle'],
  infer: ['circle'], cierre: ['fade'], estudio: ['circle'], fin: ['fade'],
};
const GRAPH_SLIDES = new Set(['paso1', 'paso3', 'comp', 'diseno', 'mezcla', 'master', 'infer']);
function runTx(id, prevId, peak) {
  if (GRAPH_SLIDES.has(id) && GRAPH_SLIDES.has(prevId)) return TX.none(null, peak);
  const [type, opts = {}] = TXMAP[id] || ['fade'];
  TX[type](opts, peak);
}
