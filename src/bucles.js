/* ============================================================
   Bucles de trazo vivo (skill soma-animation)

   Inferencia · guion: el punto nace en un concepto, sigue una flecha,
   sigue otra y llega a un concepto que nadie conectó directo. La red
   lo encierra y dibuja la flecha deducida.

   Estudio · guion: tres pistas se dibujan una tras otra y el punto
   brinca al ritmo encima de ellas; cada vez que cae, las pistas se
   sacuden, la de abajo un poco tarde.
   ============================================================ */
(() => {
  const { P, T, G, monta, tramo, suave, frena, rebota, salto, golpe, brinco, mezcla, pon, traza, ve, punto, agita } = Trazo;

  /* ---------- inferencia ---------- */
  const A = [34, 76], B = [80, 38], C = [127, 72], R = 13;
  const nodo = (n, [x, y]) => G(n, T(P.circ(x + 5, y + 5, R, 18), { cls: 'blq' }) + T(P.circ(x, y, R, 18), { cls: 'ln tapa' }));
  const flecha = (n, a, b) => {
    const an = Math.atan2(b[1] - a[1], b[0] - a[0]), ux = Math.cos(an), uy = Math.sin(an), px = -uy, py = ux;
    const x1 = a[0] + ux * (R + 5), y1 = a[1] + uy * (R + 5), x2 = b[0] - ux * (R + 5), y2 = b[1] - uy * (R + 5), h = 6;
    return T(P.linea(x1, y1, x2, y2, 4), { cls: 'ln fino tz', n }) +
      T(P.poli([[x2 - ux * h + px * h * .75, y2 - uy * h + py * h * .75], [x2, y2], [x2 - ux * h - px * h * .75, y2 - uy * h - py * h * .75]]), { cls: 'ln fino tz', n: n + 'h', amp: .3 });
  };
  monta($('#bInfer'), {
    dur: 6.2,
    cartel: 4.8,
    svg: () =>
      G('lineas',
        T(P.curva(A[0] + 4, A[1] + R + 7, 58, 113, 104, 113, C[0] - 2, C[1] + R + 7), { cls: 'ln fino ln-azul tz', n: 'deduce', amp: .6 }) +
        flecha('ab', A, B) + flecha('bc', B, C)) +
      nodo('na', A) + nodo('nb', B) + nodo('nc', C) +
      G('cerco', T(P.circ(C[0], C[1], R + 6, 18), { cls: 'ln fino ln-azul tz', n: 'cer', amp: .5 })) +
      punto(4.6),
    paso(q, t) {
      traza(q('ab'), suave(tramo(t, .55, 1.05))); traza(q('abh'), tramo(t, 1.0, 1.15));
      traza(q('bc'), suave(tramo(t, 1.95, 2.45))); traza(q('bch'), tramo(t, 2.4, 2.55));
      // el punto toma vuelo (se aplasta), brinca a B, toma vuelo otra vez y brinca a C
      const nace = rebota(tramo(t, .1, .45));
      let x = A[0], y = A[1], sx = nace, sy = nace;
      const p1 = tramo(t, 1.3, 1.8), p2 = tramo(t, 2.75, 3.25);
      if (t < 1.3) { const v = salto(tramo(t, 1.1, 1.32)); sx *= 1 + .28 * v; sy *= 1 - .28 * v; }
      else if (t < 2.75) {
        const b = brinco(p1, 17); x = mezcla(A[0], B[0], suave(p1)); y = mezcla(A[1], B[1], suave(p1)) + b.dy; sx = b.sx; sy = b.sy;
        const v = salto(tramo(t, 2.55, 2.77)); sx *= 1 + .28 * v; sy *= 1 - .28 * v;
      } else { const b = brinco(p2, 17); x = mezcla(B[0], C[0], suave(p2)); y = mezcla(B[1], C[1], suave(p2)) + b.dy; sx = b.sx; sy = b.sy; }
      const fuera = tramo(t, 5.5, 6.0);
      pon(q('pt'), { x, y, sx, sy, o: 1 - fuera });
      // cada nodo recibe el golpe del punto
      const gA = golpe(t, 1.3, .25), gB = golpe(t, 1.8, .3) + golpe(t, 2.75, .25), gC = golpe(t, 3.25, .35);
      [['na', A, gA], ['nb', B, gB], ['nc', C, gC]].forEach(([n, [ox, oy], g]) => pon(q(n), { ox, oy, sx: 1 + .14 * g, sy: 1 - .14 * g }));
      // la red encierra el concepto nuevo y dibuja la flecha deducida; lo resuelto se calma
      traza(q('cer'), frena(tramo(t, 3.35, 3.85)));
      traza(q('deduce'), suave(tramo(t, 3.8, 4.6)));
      agita(q('cer'), 2.2 - 1.6 * tramo(t, 3.9, 4.6));
      ve(q('lineas'), 1 - fuera); ve(q('cerco'), 1 - fuera);
    },
  });

  /* ---------- estudio ---------- */
  const PISTAS = [34, 58, 82];
  const onda = (k, y) => P.poli(Array.from({ length: 23 }, (_, i) => {
    const x = 36 + i * 4, env = Math.sin(Math.PI * i / 22);
    return [x, y + 7 + env * (3.6 + k) * Math.sin(i * (1.3 + k * .55))];
  }));
  monta($('#bStudio'), {
    dur: 5.2,
    cartel: 3.6,
    svg: () =>
      PISTAS.map((y, k) => G('p' + k, T(P.rect(31, y + 5, 104, 14, 7), { cls: 'blq' }) + T(P.rect(26, y, 104, 14, 7), { cls: 'ln tapa' }) +
        T(onda(k, y), { cls: 'ln fino tz', n: 'o' + k, amp: .3 }))).join('') +
      punto(4.4),
    paso(q, t) {
      PISTAS.forEach((y, k) => traza(q('o' + k), suave(tramo(t, .25 + k * .35, .85 + k * .35))));
      // cuatro brincos al ritmo sobre la pista de arriba
      const nace = rebota(tramo(t, 1.45, 1.75)), LAD = [44, 70, 96, 122];
      let x = LAD[0], dy = 0, sx = nace, sy = nace, caida = [];
      for (let i = 0; i < 3; i++) {
        const a = 1.9 + i * .5, p = tramo(t, a, a + .42);
        caida.push(a + .42);
        if (p > 0) { const b = brinco(p, 15); x = mezcla(LAD[i], LAD[i + 1], suave(p)); dy = b.dy; sx = b.sx; sy = b.sy; }
      }
      const fuera = tramo(t, 4.6, 5.1);
      pon(q('pt'), { x, y: PISTAS[0] - 5 + dy + 4.4 * (1 - sy), sx, sy, o: 1 - fuera });
      // las pistas se sacuden al caer el punto; la de abajo llega tarde
      PISTAS.forEach((y, k) => {
        const g = caida.reduce((s, c) => s + golpe(t, c + k * .05, .22), 0);
        pon(q('p' + k), { ox: 78, oy: y + 7, sx: 1 + .03 * g, sy: 1 - .16 * g });
        ve(q('o' + k), 1 - fuera);
      });
    },
  });
})();
