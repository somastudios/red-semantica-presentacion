/* ============================================================
   Composer: pregúntale a la red
   Lee la pregunta, encuentra los conceptos que menciona y responde
   siguiendo las flechas (búsqueda en anchura sobre la red).
   ============================================================ */
const ART = { produccion: 'la', composicion: 'la', melodia: 'la', gancho: 'el', armonia: 'la', progresion: 'la', ritmo: 'el', letra: 'la', estructura: 'la', coro: 'el', diseno: 'el', sintesis: 'la', fm: 'la síntesis', am: 'la síntesis', filtro: 'el', peine: 'el', distorsion: 'la', saturacion: 'la', tiempo: 'los', reverb: 'la', delay: 'el', armonicos: 'los', timbre: 'el', profundidad: 'la', mezcla: 'la', estatica: 'la', dinamica: 'la', niveles: 'los', paneo: 'el', automatizacion: 'la', eq: 'la', compresion: 'la', rango: 'el', midside: 'el', fase: 'la', estereo: 'la', master: 'la', limitador: 'el', loudness: 'el', distribucion: 'la', normalizacion: 'la' };
const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const nm = id => byId[id].label.split(' ').map(w => /^\(?[A-Z]{2,}\)?$/.test(w) ? w : w.toLowerCase()).join(' ');
const withArt = id => `${ART[id] || ''} ${nm(id)}`.trim().replace(/^de el /, 'del ');
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const contr = t => t.replace(/\b([Aa]) el /g, "$1l ").replace(/\b([Dd])e el /g, "$1el ");
const ALIAS = {};
nodes.forEach(n => { ALIAS[norm(n.label)] = n.id; });
Object.assign(ALIAS, {
  'cancion': 'composicion', 'canciones': 'composicion', 'hit': 'composicion', 'hitazo': 'composicion', 'componer': 'composicion',
  'master': 'master', 'masterizar': 'master', 'mastering': 'master', 'eq': 'eq', 'ecualizar': 'eq', 'ecualizador': 'eq',
  'compresor': 'compresion', 'comprimir': 'compresion', 'dinamica': 'rango', 'dinamicas': 'rango',
  'mezclar': 'mezcla', 'saturar': 'saturacion', 'distorsionar': 'distorsion', 'reverberacion': 'reverb', 'eco': 'delay',
  'volumen': 'loudness', 'lufs': 'loudness', 'loudness': 'loudness', 'panear': 'paneo', 'estereo': 'estereo', 'peine': 'peine', 'comb': 'peine',
  'filtros': 'filtro', 'filtrar': 'filtro', 'sintetizador': 'sintesis', 'synth': 'sintesis', 'armonico': 'armonicos',
  'acordes': 'progresion', 'acorde': 'progresion', 'hook': 'gancho', 'spotify': 'normalizacion', 'plataformas': 'normalizacion', 'normalizar': 'normalizacion',
  'distribuir': 'distribucion', 'publicar': 'distribucion', 'sonido': 'timbre', 'espacio': 'profundidad', 'automatizar': 'automatizacion',
  'nivel': 'niveles', 'limitar': 'limitador', 'diseno': 'diseno', 'efecto de tiempo': 'tiempo', 'mid side': 'midside', 'bateria': 'ritmo', 'beat': 'ritmo',
});
const ALIAS_KEYS = Object.keys(ALIAS).sort((a, b) => b.length - a.length);
function findConcepts(text) {
  const t = ' ' + norm(text) + ' ', used = new Array(t.length).fill(false), found = [];
  for (const k of ALIAS_KEYS) {
    let i = t.indexOf(' ' + k + ' ');
    while (i >= 0) {
      if (!used.slice(i + 1, i + 1 + k.length).some(Boolean)) { found.push({ id: ALIAS[k], pos: i }); for (let j = i + 1; j <= i + k.length; j++) used[j] = true; }
      i = t.indexOf(' ' + k + ' ', i + 1);
    }
  }
  return [...new Set(found.sort((a, b) => a.pos - b.pos).map(f => f.id))];
}
function bfs(a, b) {
  const prev = { [a]: null }, q = [a];
  while (q.length) { const c = q.shift(); if (c === b) break; for (const e of edges) if (e.s === c && !(e.t in prev)) { prev[e.t] = e; q.push(e.t); } }
  if (!(b in prev)) return null;
  const path = []; for (let c = b; prev[c]; c = prev[c].s) path.unshift(prev[c]);
  return path;
}
function reach(a) { const seen = new Set([a]), es = new Set(), q = [a]; while (q.length) { const c = q.shift(); edges.forEach(e => { if (e.s === c) { es.add(e.i); if (!seen.has(e.t)) { seen.add(e.t); q.push(e.t); } } }); } return { seen, es }; }
const phrase = e => e.type === 'es_un' ? `${withArt(e.s)} ${e.label} ${nm(e.t)}` : `${withArt(e.s)} ${e.type === 'parte_de' ? 'es parte de' : e.label} ${withArt(e.t)}`.replace(/ de el /g, ' del ');
const sentence = path => { const p = path.map(phrase); return cap(p.length > 1 ? p.slice(0, -1).join(', ') + ' y ' + p[p.length - 1] : p[0]) + '.'; };

let askMode = 'razonar', pendingQ = null;
function answer(text) {
  const ids = findConcepts(text);
  if (!ids.length) return { kind: 'empty', text };
  if (askMode === 'explicar' || ids.length === 1) return { kind: 'explain', id: ids[0], text };
  const [a, b] = ids, p = bfs(a, b);
  if (p && p.length) return { kind: 'path', path: p, a, b, text };
  return { kind: 'none', a, b, rev: bfs(b, a), text };
}

const pill = id => `<span class="pill" style="--c:${STAGE_COLOR(byId[id].stage)}">${byId[id].label}</span>`;
function showResult(r) {
  inferSel = 'q';
  const chain = $('#chain'), at = $('#ansTxt'); chain.innerHTML = '';
  $$('.q').forEach(b => b.classList.toggle('on', b.dataset.q === r.text));
  nodes.forEach(n => gsap.to(n.el, { scale: 1, duration: .4 }));
  if (r.kind === 'empty') {
    at.innerHTML = 'No encontré conceptos de la red en tu pregunta, deberías probar con otra palabra.';
    baseEmphasis(.4); inferSel = null; camTo('infer', 1.2);
  } else if (r.kind === 'path') {
    const lit = new Set([r.path[0].s, ...r.path.map(e => e.t)]), es = new Set(r.path.map(e => e.i));
    chain.innerHTML = pill(r.path[0].s) + r.path.map(e => `<span class="arr">${e.label}</span>${pill(e.t)}`).join('');
    at.innerHTML = `<b>Sí.</b>${contr(sentence(r.path))}`;
    emphasize({ nodeOp: n => lit.has(n.id) ? 1 : .08, edgeOp: e => es.has(e.i) ? 1 : .03, labelOp: e => es.has(e.i) ? 1 : 0, hot: es, trail: es, dur: .5 });
    [...lit].forEach((id, k) => gsap.fromTo(byId[id].el, { scale: .85 }, { scale: 1.08, duration: .8, delay: .5 + k * .12, ease: 'expo.out' }));
    const B = bbox([...lit].map(id => byId[id])); B.x -= 70; B.y -= 60; B.w += 140; B.h += 120;
    camTo(fitCam(B, { x: 480, y: 50, w: 1060, h: 630 }, 1.75), 1.3);
  } else if (r.kind === 'none') {
    const { seen, es } = reach(r.a);
    chain.innerHTML = pill(r.a) + '<span class="arr no">sin camino</span>' + pill(r.b);
    at.innerHTML = contr(`<b>No.</b>Desde ${withArt(r.a)} ninguna flecha llega a ${withArt(r.b)}.` + (r.rev ? ` Al revés sí: ${sentence(r.rev).replace(/^./, c => c.toLowerCase())}` : ''));
    emphasize({ nodeOp: n => n.id === r.b ? .5 : seen.has(n.id) ? 1 : .06, edgeOp: e => es.has(e.i) ? .9 : .03, labelOp: () => 0, hot: es, dur: .5 });
    camTo('infer', 1.3);
  } else {
    const n = byId[r.id], out = edges.filter(e => e.s === n.id), inc = edges.filter(e => e.t === n.id);
    const lit = new Set([n.id, ...out.map(e => e.t), ...inc.map(e => e.s)]), es = new Set([...out, ...inc].map(e => e.i));
    chain.innerHTML = pill(n.id) + out.slice(0, 3).map(e => `<span class="arr">${e.label}</span>${pill(e.t)}`).join('');
    at.innerHTML = `<b>${n.label}.</b>${n.desc}`;
    emphasize({ nodeOp: m => lit.has(m.id) ? 1 : .08, edgeOp: e => es.has(e.i) ? 1 : .03, labelOp: e => es.has(e.i) ? 1 : 0, hot: es, dur: .5 });
    const B = bbox([...lit].map(id => byId[id])); B.x -= 60; B.y -= 50; B.w += 120; B.h += 100;
    camTo(fitCam(B, { x: 480, y: 50, w: 1060, h: 630 }, 1.6), 1.3);
  }
  gsap.fromTo(chain.children, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, stagger: .1, duration: .6, ease: 'expo.out' });
  gsap.fromTo(at, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .7, delay: .25, ease: 'expo.out' });
}
function runQuery(text) {
  text = text.trim(); if (!text) return;
  const r = answer(text);
  if (curSlideId() === 'infer') showResult(r);
  else { pendingQ = r; go(slides.findIndex(s => s.dataset.id === 'infer'), 1); }
}
function inferEnter(k) {
  inferSel = null;
  applyGraph({ visible: true, layout: 'net', edges: true, cam: 'infer', mode: 'infer' });
  if (pendingQ) { const r = pendingQ; pendingQ = null; setTimeout(() => showResult(r), 1300); }
  else if (k) setTimeout(() => ask(k - 1), 1300); else resetAnswer();
}

/* ---------- interfaz del composer ---------- */
const CMP = $('#composer'), CIN = $('#cInput'), CSEND = $('#cSend');
const syncSend = () => { CSEND.disabled = !CIN.value.trim(); };
CIN.addEventListener('input', syncSend);
CIN.addEventListener('focus', () => CMP.classList.add('focus'));
CIN.addEventListener('blur', () => CMP.classList.remove('focus'));
CIN.addEventListener('keydown', e => { if (e.key === 'Escape') CIN.blur(); });
CMP.addEventListener('submit', e => {
  e.preventDefault(); const t = CIN.value; if (!t.trim()) return;
  runQuery(t); CIN.value = ''; syncSend(); CIN.placeholder = 'Pregunta otra cosa';
  gsap.fromTo(CSEND, { scale: .82 }, { scale: 1, duration: .6, ease: 'back.out(3)' });
});
let typing = null;
function composerType(text) {
  clearInterval(typing); CIN.value = ''; let i = 0; CMP.classList.add('focus');
  typing = setInterval(() => { CIN.value = text.slice(0, ++i); syncSend(); if (i >= text.length) { clearInterval(typing); setTimeout(() => { CMP.classList.remove('focus'); CMP.requestSubmit(); }, 260); } }, 16);
}
$('#cMode').onclick = () => {
  askMode = askMode === 'razonar' ? 'explicar' : 'razonar';
  $('#cModeT').textContent = askMode === 'razonar' ? 'Razonar' : 'Explicar';
  CIN.placeholder = askMode === 'razonar' ? 'Pregúntale algo a la red' : 'Escribe un concepto para explicarlo';
  gsap.fromTo('#cModeT', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: .4, ease: 'expo.out' });
};
$('#cAttach').onclick = () => { $('#stFile').click(); const i = slides.findIndex(s => s.dataset.id === 'estudio'); if (cur !== i) go(i, 1); };
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#cMic');
  if (!SR) { mic.disabled = true; mic.title = 'Este navegador no tiene dictado'; return; }
  let rec = null;
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'es-MX'; rec.interimResults = true;
    mic.classList.add('rec'); CIN.placeholder = 'Te escucho…';
    rec.onresult = e => { CIN.value = [...e.results].map(r => r[0].transcript).join(''); syncSend(); };
    rec.onerror = e => { CIN.placeholder = e.error === 'network' ? 'El dictado necesita internet.' : 'No te escuché bien, inténtalo de nuevo.'; };
    rec.onend = () => { mic.classList.remove('rec'); rec = null; if (CIN.value.trim()) CMP.requestSubmit(); };
    rec.start();
  };
})();
addEventListener('keydown', e => { if (e.key === '/' && !(e.target.closest && e.target.closest('input,select,textarea'))) { e.preventDefault(); CIN.focus(); } });
