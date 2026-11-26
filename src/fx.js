/* ============================================================
   Capa After Effects
   - Campo de ruido con dominio deformado, pasado por un mapa de gradiente
     del color de la escena (un solo color, como pide ui-soma).
   - Semitono que sale del mismo campo, en modo de fusión screen.
   - Grano de película que cambia a 12 cuadros por segundo.
   - Parallax por capas con el cursor.
   - Desplazamiento líquido, desenfoque direccional y una separación de
     canales mínima, solo mientras dura una transición.
   ============================================================ */
const FXL = (() => {
  const W = 168, H = 98, HW = 840, HH = 490;
  const bg = $('#bgfx'), ht = $('#htfx'), scene = $('#scene');
  bg.width = W; bg.height = H; ht.width = HW; ht.height = HH;
  const bx = bg.getContext('2d'), hx = ht.getContext('2d'), img = bx.createImageData(W, H);
  const field = new Float32Array(W * H);
  const S = { r: 63, g: 131, b: 255, x: .72, y: .45 };
  const BG = [12, 12, 15];
  let last = 0, lastH = 0;

  function setScene(hex, gx, gy, dur = 1.6) {
    const n = parseInt(hex.slice(1), 16);
    gsap.to(S, { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, x: parseFloat(gx) / 100, y: parseFloat(gy) / 100, duration: dur, ease: 'power2.inOut', overwrite: true });
    document.documentElement.style.setProperty('--ring', hex);
  }
  function field_(t) {
    const d = img.data;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const wx = u * 3.1 + Math.sin(v * 4.3 + t * .13) * .6, wy = v * 3.4 + Math.sin(u * 3.7 - t * .11) * .6;
      let n = Math.sin(wx * 2.1 + t * .17) * Math.sin(wy * 2.3 - t * .14) + .5 * Math.sin((wx + wy) * 3.3 + t * .09);
      n = n * .33 + .5;
      const dx = (u - S.x) * 1.7, dy = v - S.y;
      const f = Math.max(0, Math.min(1, n * (.3 + .95 * Math.exp(-(dx * dx + dy * dy) * 3.2))));
      field[j * W + i] = f;
      const k = f * f * .5, p = (j * W + i) * 4;
      d[p] = BG[0] + (S.r * .5 - BG[0]) * k; d[p + 1] = BG[1] + (S.g * .5 - BG[1]) * k; d[p + 2] = BG[2] + (S.b * .5 - BG[2]) * k; d[p + 3] = 255;
    }
    bx.putImageData(img, 0, 0);
  }
  function halftone() {
    hx.clearRect(0, 0, HW, HH);
    hx.fillStyle = `rgba(${S.r | 0},${S.g | 0},${S.b | 0},.2)`;
    hx.beginPath();
    const s = 10;
    for (let y = s / 2, row = 0; y < HH; y += s, row++) for (let x = s / 2 + (row % 2) * s / 2; x < HW; x += s) {
      const f = field[Math.min(H - 1, (y / HH * H) | 0) * W + Math.min(W - 1, (x / HW * W) | 0)];
      const r = (f - .52) * 7; if (r > .45) { hx.moveTo(x + r, y); hx.arc(x, y, r, 0, 6.2832); }
    }
    hx.fill();
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (REDUCED && last) return;
    if (ts - last < 40) return; last = ts;
    field_(ts / 1000);
    if (ts - lastH > 110) { lastH = ts; halftone(); }
  }
  requestAnimationFrame(frame);

  /* grano de película: se mueve a saltos, como en el cine */
  const grain = $('.grain');
  if (!REDUCED) setInterval(() => { grain.style.transform = `translate(${(Math.random() * 8 - 4).toFixed(1)}%,${(Math.random() * 8 - 4).toFixed(1)}%)`; }, 83);

  /* parallax por capas */
  const LAY = [[bg, -22], [ht, -30], [$('#fx'), 12], [$('.slides'), 5], [$('#graph'), 2.5]].map(([el, f]) => ({ el, f, x: 0, y: 0 }));
  const P = { x: 0, y: 0, kx: 0 };
  addEventListener('pointermove', e => { P.x = e.clientX / innerWidth - .5; P.y = e.clientY / innerHeight - .5; });
  if (!REDUCED) gsap.ticker.add(() => {
    LAY.forEach(l => {
      l.x += (P.x * l.f + P.kx * l.f * 2 - l.x) * .08; l.y += (P.y * l.f * .6 - l.y) * .08;
      l.el.style.transform = `translate(${l.x.toFixed(2)}px,${l.y.toFixed(2)}px)`;
    });
  });

  /* pulso líquido de las transiciones */
  const D = $('#lqD'), B = $('#lqB'), R = $('#lqR'), Gc = $('#lqG'), T = $('#lqT');
  let tw = null;
  function pulse(dir = 1, dur = 1.1, amp = 1) {
    if (REDUCED) return;
    tw?.kill(); const o = { p: 0 };
    scene.style.filter = 'url(#liquid)';
    gsap.fromTo(P, { kx: 0 }, { kx: -dir * .5, duration: dur / 2, yoyo: true, repeat: 1, ease: 'sine.inOut', overwrite: true });
    tw = gsap.to(o, {
      p: 1, duration: dur / 2, yoyo: true, repeat: 1, ease: 'sine.inOut',
      onUpdate: () => {
        D.setAttribute('scale', (44 * o.p * amp).toFixed(1));
        B.setAttribute('stdDeviation', `${(9 * o.p * amp).toFixed(1)} 0`);
        R.setAttribute('dx', (-2.6 * o.p * dir * amp).toFixed(2));
        Gc.setAttribute('dx', (2.6 * o.p * dir * amp).toFixed(2));
        T.setAttribute('baseFrequency', `${(.0035 + .002 * o.p).toFixed(4)} ${(.008 + .004 * o.p).toFixed(4)}`);
      },
      onComplete: () => { scene.style.filter = ''; },
    });
  }
  return { setScene, pulse };
})();
