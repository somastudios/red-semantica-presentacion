/* ============================================================
   ESTUDIO · stems → visuales
   Carga stems, los reproduce sincronizados a la muestra, analiza cada uno
   y dibuja un visual que reacciona a ellos. También mide la mezcla:
   LUFS (aprox. BS.1770), true peak, correlación y espectro.
   ============================================================ */
const ROLES = {
  voz:     { name: 'Voz',      color: '#FF6B4A', re: /voz|vocal|vox|voice|acapella|canto|coro/i, node: 'Letra' },
  bateria: { name: 'Batería',  color: '#FFB340', re: /drum|bater|perc|kick|snare|hat|beat|bombo|tambor|loop/i, node: 'Ritmo' },
  bajo:    { name: 'Bajo',     color: '#A98BFF', re: /bajo|bass|808|sub/i, node: 'Rango dinámico' },
  melodia: { name: 'Melodía',  color: '#FF7EB6', re: /melod|lead|hook|arp|line|riff/i, node: 'Melodía' },
  acordes: { name: 'Acordes',  color: '#3DDBC5', re: /acord|chord|keys|piano|pad|guitar|guitarra|synth|rhodes|organ|teclado/i, node: 'Armonía' },
  otro:    { name: 'Otro',     color: '#E5E5EA', re: /$^/, node: '' },
};
const ROLE_ORDER = ['voz', 'bateria', 'bajo', 'melodia', 'acordes'];
const guessRole = n => ROLE_ORDER.find(r => ROLES[r].re.test(n)) || 'otro';
const PCN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const ST = { stems: [], dur: 0, playing: false, t0: 0, off: 0, last: 0, bpm: 0, beats: [], kicks: [], snares: [], rec: null, active: false, loop: false, busy: false };
let SA = null;
function stAudio() {
  if (SA) return SA;
  const c = audio();
  const sink = c.createGain(); sink.gain.value = 0; sink.connect(c.destination);
  const mix = c.createGain(); mix.connect(MASTER);
  const split = c.createChannelSplitter(2); mix.connect(split);
  const an = (n = 2048, sm = 0) => { const a = c.createAnalyser(); a.fftSize = n; a.smoothingTimeConstant = sm; a.connect(sink); return a; };
  const rawL = an(), rawR = an(), kL = an(), kR = an();
  const kw = (ch, dst) => { const hs = c.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 1681.97; hs.gain.value = 4; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38.13; hp.Q.value = .5; split.connect(hs, ch); hs.connect(hp); hp.connect(dst); };
  split.connect(rawL, 0); split.connect(rawR, 1); kw(0, kL); kw(1, kR);
  const spec = an(4096, .72); mix.connect(spec);
  SA = { c, sink, mix, rawL, rawR, kL, kR, spec, tL: new Float32Array(2048), tR: new Float32Array(2048), fd: new Float32Array(2048) };
  return SA;
}

/* ---------- carga ---------- */
function wavePeaks(buf, n) {
  const d = buf.getChannelData(0), d2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d;
  const out = new Float32Array(n), step = d.length / n;
  for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * step), b = Math.floor((i + 1) * step); for (let j = a; j < b; j += 4) { const v = Math.max(Math.abs(d[j]), Math.abs(d2[j])); if (v > m) m = v; } out[i] = m; }
  return out;
}
function stAddStem(name, buf, role) {
  const c = SA.c;
  const g = c.createGain(); const an = c.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = .55;
  g.connect(an); an.connect(SA.sink); g.connect(SA.mix);
  ST.stems.push({ name, role: role || guessRole(name), buf, g, an, src: null, mute: false, solo: false, lvl: 0, rms: 0, peaks: wavePeaks(buf, 900), td: new Float32Array(4096), fd: new Float32Array(2048) });
  ST.dur = Math.max(ST.dur, buf.duration);
}
async function stAddFiles(files) {
  files = [...files].filter(f => /^audio\//.test(f.type) || /\.(wav|mp3|m4a|aac|ogg|flac|aif|aiff)$/i.test(f.name));
  if (!files.length) return;
  stPause(); audio(); stAudio(); stBusy('Leyendo archivos…');
  for (const f of files) {
    try { stAddStem(f.name.replace(/\.[^.]+$/, ''), await SA.c.decodeAudioData(await f.arrayBuffer())); }
    catch (e) { stToast(`No pude leer ${f.name}`); }
  }
  await stAnalyze(); stRenderList(); stBusy(null);
}
async function stLoadDemo() {
  stPause(); audio(); stAudio(); stBusy('Generando la demo…');
  ST.stems.forEach(s => s.g.disconnect()); ST.stems = []; ST.dur = 0; ST.off = 0;
  const stems = await makeDemoStems();
  stems.forEach(s => stAddStem(s.name, s.buf, s.role));
  await stAnalyze(); stRenderList(); stBusy(null);
}

/* ---------- análisis offline: onsets y tempo ---------- */
async function stAnalyze() {
  stBusy('Buscando el beat…'); mtReset();
  const drums = ST.stems.filter(s => s.role === 'bateria' && !s.mute);
  const src = (drums.length ? drums : ST.stems).map(s => s.buf);
  if (!src.length) return;
  const dur = Math.max(...src.map(b => b.duration)), sr = 11025, len = Math.ceil(dur * sr);
  const render = async (type, f) => {
    const oc = new OfflineAudioContext(1, len, sr);
    src.forEach(b => { const s = oc.createBufferSource(); s.buffer = b; const fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; s.connect(fl); fl.connect(oc.destination); s.start(); });
    return (await oc.startRendering()).getChannelData(0);
  };
  const [lo, hi] = await Promise.all([render('lowpass', 140), render('highpass', 2000)]);
  const hop = Math.round(sr * .01);
  const env = x => { const n = Math.floor(x.length / hop) - 1, e = new Float32Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < hop * 2; j++) { const v = x[i * hop + j] || 0; s += v * v; } e[i] = Math.log10(1e-5 + Math.sqrt(s / (hop * 2))); } return e; };
  const flux = e => { const f = new Float32Array(e.length); for (let i = 1; i < e.length; i++) f[i] = Math.max(0, e[i] - e[i - 1]); return f; };
  const pick = (f, gap) => {
    const out = []; let last = -9; const W = 20;
    for (let i = 1; i < f.length - 1; i++) {
      if (!(f[i] >= f[i - 1] && f[i] > f[i + 1])) continue;
      let m = 0, c = 0; for (let k = Math.max(0, i - W); k < Math.min(f.length, i + W); k++) { m += f[k]; c++; } m /= c;
      const t = i * hop / sr; if (f[i] > m * 1.8 + .12 && t - last > gap) { out.push(t); last = t; }
    }
    return out;
  };
  const fl = flux(env(lo)), fh = flux(env(hi));
  ST.kicks = pick(fl, .1); ST.snares = pick(fh, .08);
  const on = fl.map((v, i) => v + .6 * fh[i]);
  const score = lag => { let s = 0; const L = Math.floor(lag); for (let i = 0; i + L < on.length; i++) s += on[i] * on[i + L]; return s * Math.exp(-Math.pow(Math.log2((6000 / lag) / 115), 2) * .9); };
  let best = 0, bl = 60; for (let lag = 33; lag <= 86; lag++) { const s = score(lag); if (s > best) { best = s; bl = lag; } }
  const a = score(bl - 1), b = score(bl), c2 = score(bl + 1), den = a - 2 * b + c2;
  let lagF = bl + (den ? .5 * (a - c2) / den : 0);
  let bpm = 6000 / lagF; if (Math.abs(bpm - Math.round(bpm)) < .6) bpm = Math.round(bpm);
  lagF = 6000 / bpm;
  let bp = 0, bs = -1; for (let p = 0; p < lagF; p++) { let s = 0; for (let t = p; t < on.length; t += lagF) s += on[Math.round(t)] || 0; if (s > bs) { bs = s; bp = p; } }
  ST.bpm = bpm; ST.beats = []; for (let t = bp / 100; t < dur; t += 60 / bpm) ST.beats.push(t);
  stDrawLanes();
}

/* ---------- transporte (todas las pistas arrancan en la misma muestra) ---------- */
const stPos = () => ST.playing ? Math.max(0, Math.min(ST.dur, ST.off + SA.c.currentTime - ST.t0)) : ST.off;
function stGains() {
  const anySolo = ST.stems.some(s => s.solo);
  ST.stems.forEach(s => s.g.gain.setTargetAtTime(s.mute || (anySolo && !s.solo) ? 0 : 1, SA.c.currentTime, .015));
}
function stPlay() {
  if (!ST.stems.length || ST.busy) return;
  const c = audio(); if (ST.off >= ST.dur - .05) ST.off = 0;
  const when = c.currentTime + .06;
  ST.stems.forEach(s => { const src = c.createBufferSource(); src.buffer = s.buf; src.connect(s.g); if (ST.off < s.buf.duration) src.start(when, ST.off); s.src = src; });
  ST.t0 = when; ST.playing = true; ST.last = ST.off; stGains(); stUI();
}
function stPause() {
  if (!ST.playing) return;
  ST.off = stPos(); ST.stems.forEach(s => { try { s.src.stop(); } catch (e) { } s.src = null; });
  ST.playing = false; stUI();
}
function stSeek(t) { const was = ST.playing; stPause(); ST.off = Math.max(0, Math.min(ST.dur, t)); ST.last = ST.off; if (t <= .05) mtReset(); if (was) stPlay(); else stUI(); }
function stToggle() { ST.playing ? stPause() : stPlay(); }

/* ---------- medición ---------- */
const MT = {};
function mtReset() { Object.assign(MT, { frames: [], blocks: [], st: [], lastB: 0, lastLRA: 0, M: -Infinity, S: -Infinity, I: -Infinity, LRA: 0, tp: -Infinity, tpMax: -Infinity, pk: [-90, -90], hold: [[-90, 0], [-90, 0]], corr: 1, crest: 0, bands: new Float32Array(44), caps: new Float32Array(44), disp: { I: -60, M: -60, S: -60, tp: -60 } }); }
mtReset();
const LU = ms => ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity;
const TPF = (() => { const N = 16, rows = []; for (let p = 1; p < 4; p++) { const r = new Float32Array(N); for (let k = 0; k < N; k++) { const x = p / 4 - (k - N / 2 + 1); r[k] = (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * (.5 + .5 * Math.cos(Math.PI * x / (N / 2))); } rows.push(r); } return { N, rows }; })();
function truePeak(x) {
  let mx = 0; const { N, rows } = TPF;
  for (let n = N; n < x.length - N; n++) {
    const a = Math.abs(x[n]); if (a > mx) mx = a;
    for (const r of rows) { let y = 0; for (let k = 0; k < N; k++) y += x[n + k - N / 2 + 1] * r[k]; y = Math.abs(y); if (y > mx) mx = y; }
  }
  return mx;
}
function meterFrame(now, dt, pos) {
  const { kL, kR, rawL, rawR, tL, tR, spec, fd } = SA;
  if (ST.playing) {
    kL.getFloatTimeDomainData(tL); kR.getFloatTimeDomainData(tR);
    let a = 0, b = 0; for (let i = 0; i < 2048; i++) { a += tL[i] * tL[i]; b += tR[i] * tR[i]; }
    MT.frames.push([now, (a + b) / 2048]);
    while (MT.frames.length && now - MT.frames[0][0] > 3) MT.frames.shift();
    const avg = w => { let s = 0, c = 0; for (const [t, v] of MT.frames) if (now - t <= w) { s += v; c++; } return c ? s / c : 0; };
    const mM = avg(.4); MT.M = LU(mM); MT.S = LU(avg(3));
    if (now - MT.lastB >= .1) {
      MT.lastB = now;
      if (MT.M > -70) MT.blocks.push(mM);
      if (MT.S > -70) MT.st.push({ t: pos, v: MT.S });
      if (MT.blocks.length) { const m1 = MT.blocks.reduce((x, y) => x + y, 0) / MT.blocks.length, rel = LU(m1) - 10; const g = MT.blocks.filter(v => LU(v) > rel); MT.I = LU(g.reduce((x, y) => x + y, 0) / g.length); }
      if (now - MT.lastLRA > .5 && MT.st.length > 10) { MT.lastLRA = now; const v = MT.st.map(s => s.v).filter(v => v > MT.I - 20).sort((x, y) => x - y); if (v.length > 5) MT.LRA = v[Math.floor(v.length * .95) - 1] - v[Math.floor(v.length * .1)]; }
    }
    rawL.getFloatTimeDomainData(tL); rawR.getFloatTimeDomainData(tR);
    let pl = 0, pr = 0, lr = 0, ll = 0, rr = 0;
    for (let i = 0; i < 2048; i++) { const l = tL[i], r = tR[i]; if (Math.abs(l) > pl) pl = Math.abs(l); if (Math.abs(r) > pr) pr = Math.abs(r); lr += l * r; ll += l * l; rr += r * r; }
    const c = ll > 1e-7 && rr > 1e-7 ? lr / Math.sqrt(ll * rr) : 1; MT.corr += (c - MT.corr) * Math.min(1, dt * 6);
    const tp = 20 * Math.log10(Math.max(truePeak(tL), truePeak(tR), 1e-6)); MT.tp = tp; if (tp > MT.tpMax) MT.tpMax = tp;
    [pl, pr].forEach((p, i) => { const db = 20 * Math.log10(Math.max(p, 1e-5)); MT.pk[i] = Math.max(db, MT.pk[i] - 26 * dt); if (db >= MT.hold[i][0] || now - MT.hold[i][1] > 1.5) MT.hold[i] = [db, now]; });
    MT.crest = Math.max(0, 20 * Math.log10(Math.max(pl, pr, 1e-5)) - 10 * Math.log10((ll + rr) / 4096 + 1e-9));
  } else { MT.pk = MT.pk.map(v => Math.max(-90, v - 30 * dt)); }
  spec.getFloatFrequencyData(fd);
  const hz = SA.c.sampleRate / 4096;
  for (let b = 0; b < 44; b++) {
    const f0 = 30 * Math.pow(16000 / 30, b / 44), f1 = 30 * Math.pow(16000 / 30, (b + 1) / 44);
    let m = -140; for (let k = Math.floor(f0 / hz); k <= Math.ceil(f1 / hz); k++) if (fd[k] > m) m = fd[k];
    const v = ST.playing ? Math.max(0, Math.min(1, (m + 92) / 78)) : 0;
    MT.bands[b] += (v - MT.bands[b]) * (v > MT.bands[b] ? .6 : .12);
    MT.caps[b] = Math.max(MT.bands[b], MT.caps[b] - dt * .5);
  }
  const L = (k, v) => { if (isFinite(v)) MT.disp[k] += (v - MT.disp[k]) * Math.min(1, dt * 8); };
  L('I', MT.I); L('M', MT.M); L('S', MT.S); L('tp', MT.tp);
}

/* ---------- rasgos por stem ---------- */
const FX = { voz: 0, bateria: 0, bajo: 0, melodia: 0, acordes: 0, pitch: 0, pitchOn: false, chroma: new Float32Array(12), chord: '', chordConf: 0, chordPc: 0, minor: false };
function stemFeatures(dt) {
  const roleE = { voz: 0, bateria: 0, bajo: 0, melodia: 0, acordes: 0, otro: 0 };
  const hz = SA.c.sampleRate / 4096;
  let pitchSrc = null, chordSrc = null;
  for (const s of ST.stems) {
    let r = 0;
    if (ST.playing && s.g.gain.value > .01) { s.an.getFloatTimeDomainData(s.td); for (let i = 0; i < 4096; i += 2) r += s.td[i] * s.td[i]; r = Math.sqrt(r / 2048); }
    const n = Math.max(0, Math.min(1, (20 * Math.log10(r + 1e-6) + 48) / 40));
    s.lvl += (n - s.lvl) * (n > s.lvl ? .5 : .1);
    roleE[s.role] = Math.max(roleE[s.role], s.lvl);
    if (s.role === 'melodia' && s.lvl > .15) pitchSrc = s; else if (s.role === 'voz' && s.lvl > .15 && !pitchSrc) pitchSrc = s;
    if (s.role === 'acordes' && s.lvl > .1) chordSrc = s;
  }
  for (const k in FX) if (k in roleE) FX[k] += (roleE[k] - FX[k]) * Math.min(1, dt * 14);
  FX.pitchOn = false;
  if (pitchSrc) {
    pitchSrc.an.getFloatFrequencyData(pitchSrc.fd);
    let mi = -1, mv = -200; for (let k = Math.floor(90 / hz); k < 1400 / hz; k++) if (pitchSrc.fd[k] > mv) { mv = pitchSrc.fd[k]; mi = k; }
    if (mi > 0 && mv > -75) { const a = pitchSrc.fd[mi - 1], b = mv, c = pitchSrc.fd[mi + 1]; const p = .5 * (a - c) / (a - 2 * b + c || 1); const midi = 69 + 12 * Math.log2((mi + p) * hz / 440); FX.pitch += (Math.max(0, Math.min(1, (midi - 45) / 40)) - FX.pitch) * .35; FX.pitchOn = true; }
  }
  const src = chordSrc || (ST.playing ? null : null);
  const fd = src ? (src.an.getFloatFrequencyData(src.fd), src.fd) : (ST.playing ? SA.fd : null);
  if (fd) {
    const ch = new Float32Array(12);
    for (let k = Math.floor(110 / hz); k < 2000 / hz; k++) { const p = Math.pow(10, fd[k] / 10); const pc = ((Math.round(12 * Math.log2(k * hz / 440)) + 69) % 12 + 12) % 12; ch[pc] += p; }
    const mx = Math.max(...ch) || 1; for (let i = 0; i < 12; i++) FX.chroma[i] += (ch[i] / mx - FX.chroma[i]) * .25;
    let best = -1, bi = 0, bm = false;
    for (let r = 0; r < 12; r++) for (const m of [false, true]) { const s = FX.chroma[r] + FX.chroma[(r + (m ? 3 : 4)) % 12] + FX.chroma[(r + 7) % 12] - .35 * (FX.chroma.reduce((a, b) => a + b, 0) / 4); if (s > best) { best = s; bi = r; bm = m; } }
    const name = PCN[bi] + (bm ? 'm' : '');
    if (name === FX._cand) FX._ct += dt; else { FX._cand = name; FX._ct = 0; }
    if (FX._ct > .18 && best > .9) { FX.chord = name; FX.chordPc = bi; FX.minor = bm; FX.chordConf = Math.min(1, best / 2.2); }
  }
  FX.chordConf *= Math.pow(.6, dt);
}

/* ---------- visual ---------- */
const VS = { kick: 0, snare: 0, beat: 0, beatN: 0, ab: 0, shock: [], parts: [], mel: [], hue: 30, hueT: 30, kH: 4, seed: 1, seedT: 0, ring: 1 };
let stCv, sx, tlCv, tx2, mtCv, mx, laneCache, grainTile;
function stInitCanvas() {
  const mk = (id, w, h) => { const c = $(id); c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px'; const x = c.getContext('2d'); x.scale(2, 2); return [c, x]; };
  [stCv, sx] = mk('#stCanvas', 990, 500); [tlCv, tx2] = mk('#stTimeline', 990, 100); [mtCv, mx] = mk('#stMeters', 990, 136);
  grainTile = document.createElement('canvas'); grainTile.width = grainTile.height = 160; const g = grainTile.getContext('2d'); const id = g.createImageData(160, 160);
  for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 26; } g.putImageData(id, 0, 0);
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const jit = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
function drawScene(now, dt, pos) {
  const W = 990, H = 500, x = sx;
  VS.seedT += dt; if (VS.seedT > .083) { VS.seedT = 0; VS.seed = (VS.seed % 6) + 1; }
  // disparadores sincronizados con la línea de tiempo
  if (ST.playing) {
    const a = ST.last, b = pos;
    if (b >= a && b - a < .5) {
      ST.kicks.forEach(t => { if (t > a && t <= b) { VS.kick = 1; VS.ab = 1; VS.shock.push({ r: 0, a: 1 }); } });
      ST.snares.forEach(t => { if (t > a && t <= b) { VS.snare = 1; for (let i = 0; i < 18; i++) { const an = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 320; VS.parts.push({ x: W / 2, y: H * .44, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, life: 1, s: 1.5 + Math.random() * 3 }); } } });
      ST.beats.forEach(t => { if (t > a && t <= b) { VS.beat = 1; VS.beatN = Math.round(t * ST.bpm / 60); } });
    }
    ST.last = b;
  }
  VS.kick *= Math.pow(.004, dt); VS.snare *= Math.pow(.01, dt); VS.beat *= Math.pow(.02, dt); VS.ab *= Math.pow(.0005, dt);
  const fifths = (FX.chordPc * 7) % 12; VS.hueT = (fifths * 30 + 20) % 360;
  let dh = ((VS.hueT - VS.hue + 540) % 360) - 180; VS.hue = (VS.hue + dh * Math.min(1, dt * 2.5) + 360) % 360;
  const h = VS.hue, light = FX.minor ? 46 : 58;
  const loud = Math.max(0, Math.min(1, (MT.disp.S + 40) / 32));

  // fondo: malla de gradientes según el acorde
  x.fillStyle = '#050505'; x.fillRect(0, 0, W, H);
  const blobs = [[.22 + .05 * Math.sin(now * .3), .3, h], [.78, .65 + .06 * Math.cos(now * .25), (h + 40) % 360], [.5 + .1 * Math.sin(now * .2), .95, (h + 320) % 360]];
  for (const [bx, by, bh] of blobs) { const g = x.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, W * .55); g.addColorStop(0, hsl(bh, 70, light, .22 + loud * .25)); g.addColorStop(1, hsl(bh, 70, light, 0)); x.fillStyle = g; x.fillRect(0, 0, W, H); }

  // espectro en semitono
  const cols = 62, rows = 22, sp = W / cols;
  x.fillStyle = hsl(h, 40, 88, .55);
  for (let c = 0; c < cols; c++) {
    const v = MT.bands[Math.floor(c / cols * 44)] || 0;
    for (let r = 0; r < rows; r++) { const k = v * 1.25 - r / rows; if (k <= 0) break; const rad = Math.min(5.2, .6 + k * 7); x.beginPath(); x.arc(c * sp + sp / 2, H - 8 - r * sp, rad, 0, 6.283); x.fill(); }
  }

  // ondas expansivas del bombo
  VS.shock = VS.shock.filter(s => (s.r += dt * 900, s.a -= dt * 1.6, s.a > 0));
  const cx = W / 2, cy = H * .44;
  const R = 70 + FX.bajo * 95 + VS.kick * 22;
  for (const s of VS.shock) { x.strokeStyle = hsl(h, 80, 80, s.a * .6); x.lineWidth = 1 + 5 * s.a; x.beginPath(); x.arc(cx, cy, R + s.r, 0, 6.283); x.stroke(); }

  // anillo central: el bajo lo escala, la melodía lo deforma
  VS.kH += ((3 + FX.pitch * 7) - VS.kH) * Math.min(1, dt * 3);
  const k0 = Math.floor(VS.kH), kf = VS.kH - k0;
  const ringPts = (rad, amp, rot) => { const pts = []; for (let i = 0; i <= 160; i++) { const an = i / 160 * 6.2832 + rot; const w = (1 - kf) * Math.sin(k0 * an + now * 1.3) + kf * Math.sin((k0 + 1) * an + now * 1.3); const rr = rad + amp * w + jit(i, VS.seed) * 1.8; pts.push([cx + Math.cos(an) * rr, cy + Math.sin(an) * rr]); } return pts; };
  const amp = 6 + FX.bajo * 18 + FX.melodia * 12;
  [[1, 1, 2.6], [.78, .55, 1.6], [.58, .3, 1.1]].forEach(([sc, al, lw], i) => {
    const pts = ringPts(R * sc, amp * sc, now * (.12 + i * .05) * (i % 2 ? -1 : 1));
    x.beginPath(); pts.forEach(([px, py], j) => j ? x.lineTo(px, py) : x.moveTo(px, py));
    if (i === 0) { const g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2); g.addColorStop(0, hsl(h, 75, 60, .05 + FX.bajo * .3)); g.addColorStop(1, hsl(h, 75, 60, 0)); x.fillStyle = g; x.fill(); }
    x.strokeStyle = hsl((h + i * 25) % 360, 70, 82, al); x.lineWidth = lw; x.stroke();
  });

  // partículas de la tarola
  VS.parts = VS.parts.filter(p => (p.x += p.vx * dt, p.y += p.vy * dt, p.vx *= .96, p.vy *= .96, p.life -= dt * 1.3, p.life > 0));
  x.fillStyle = '#FFB340'; for (const p of VS.parts) { x.globalAlpha = p.life; x.fillRect(p.x, p.y, p.s, p.s); } x.globalAlpha = 1;

  // línea de la melodía
  VS.mel.push({ t: now, y: FX.pitchOn ? FX.pitch : null, a: FX.melodia || FX.voz });
  while (VS.mel.length && now - VS.mel[0].t > 4) VS.mel.shift();
  x.strokeStyle = '#FF7EB6'; x.lineCap = 'round'; x.lineJoin = 'round';
  let pen = false; x.beginPath();
  VS.mel.forEach((m, i) => { if (m.y == null || m.a < .12) { pen = false; return; } const px = W - 30 - (now - m.t) / 4 * (W - 60), py = H * .82 - m.y * H * .62 + jit(i, VS.seed) * 1.5; pen ? x.lineTo(px, py) : x.moveTo(px, py); pen = true; });
  x.lineWidth = 2.5 + FX.melodia * 4; x.globalAlpha = .9; x.stroke(); x.globalAlpha = 1;

  // tipografía que respira con la voz
  const title = ($('#stTitle').value || 'hitazo').slice(0, 14);
  const v = Math.max(FX.voz, ST.stems.some(s => s.role === 'voz') ? 0 : FX.melodia * .7);
  const fs = 96 + v * 18, wt = Math.round(220 + v * 660 + VS.kick * 60), track = 2 + v * 16;
  x.font = `${wt} ${fs}px Geist`; x.textBaseline = 'alphabetic';
  const ws = [...title].map(ch => x.measureText(ch).width); const tw = ws.reduce((a, b) => a + b, 0) + track * (title.length - 1);
  let px = W / 2 - tw / 2; const by = H * .84;
  [...title].forEach((ch, i) => {
    const dy = Math.sin(now * 7 + i * .9) * v * 8 + jit(i, VS.seed) * v * 2;
    x.fillStyle = '#F5F5F7'; x.fillText(ch, px, by + dy); px += ws[i] + track;
  });

  // la red escuchando
  const corrW = Math.max(0, Math.min(1, 1 - MT.corr));
  const chips = [['Ritmo', Math.max(VS.kick, VS.snare * .8, FX.bateria * .5), '#FFB340'], ['Armonía', Math.max(FX.acordes * .7, FX.chordConf), '#3DDBC5'], ['Melodía', FX.melodia, '#FF7EB6'], ['Letra', FX.voz, '#FF6B4A'], ['Rango dinámico', Math.min(1, MT.crest / 20) * (ST.playing ? 1 : 0), '#A98BFF'], ['Imagen estéreo', corrW * 2.2 * (ST.playing ? 1 : 0), '#E5E5EA'], ['Loudness', loud * (ST.playing ? 1 : 0), '#F5F5F7']];
  x.font = '400 10.5px Mono'; x.fillStyle = 'rgba(245,245,247,.5)'; x.fillText('LA RED, ESCUCHANDO', 22, 28);
  let chx = 22; x.font = '500 13px Geist';
  chips.forEach(([n, g, col]) => {
    g = Math.max(0, Math.min(1, g)); const w = x.measureText(n).width + 24;
    x.globalAlpha = .25 + g * .75; x.strokeStyle = col; x.lineWidth = 1.2; x.beginPath(); x.roundRect(chx, 40, w, 26, 13); x.stroke();
    if (g > .05) { x.fillStyle = col; x.globalAlpha = g * .9; x.fill(); }
    x.globalAlpha = 1; x.fillStyle = g > .5 ? '#050505' : '#F5F5F7'; x.fillText(n, chx + 12, 57.5); chx += w + 8;
  });
  // acorde, tempo y pulso
  x.textAlign = 'right'; x.font = '400 56px Anton'; x.fillStyle = '#F5F5F7'; x.globalAlpha = .4 + FX.chordConf * .6; x.fillText(FX.chord || '—', W - 24, 64); x.globalAlpha = 1;
  x.font = '400 10.5px Mono'; x.fillStyle = 'rgba(245,245,247,.55)'; x.fillText('ACORDE ESTIMADO', W - 24, 84);
  x.fillText(ST.bpm ? `${ST.bpm} BPM` : '', W - 24, 100); x.textAlign = 'left';
  for (let i = 0; i < 4; i++) { const on = ST.playing && (((VS.beatN % 4) + 4) % 4) === i; x.fillStyle = on ? hsl(h, 80, 75, .5 + VS.beat * .5) : 'rgba(245,245,247,.15)'; x.beginPath(); x.arc(28 + i * 16, H - 22, on ? 5 + VS.beat * 2 : 4, 0, 6.283); x.fill(); }
  if (!ST.stems.length) { x.textAlign = 'center'; x.font = '400 15px Geist'; x.fillStyle = 'rgba(245,245,247,.7)'; x.fillText('Carga tus stems o usa la demo para empezar.', W / 2, H * .44 + 5); x.textAlign = 'left'; }
  // grano de película
  x.globalAlpha = .9; const gx = -Math.random() * 160, gy = -Math.random() * 160; for (let yy = gy; yy < H; yy += 160) for (let xx = gx; xx < W; xx += 160) x.drawImage(grainTile, xx, yy); x.globalAlpha = 1;
}

/* ---------- línea de tiempo multipista ---------- */
function stDrawLanes() {
  laneCache = document.createElement('canvas'); laneCache.width = 1980; laneCache.height = 200; const c = laneCache.getContext('2d'); c.scale(2, 2);
  const n = Math.max(1, ST.stems.length), lh = (100 - 8) / n;
  ST.stems.forEach((s, i) => {
    const y0 = 4 + i * lh, mid = y0 + lh / 2, col = ROLES[s.role].color; c.fillStyle = col; c.globalAlpha = .75;
    const frac = s.buf.duration / ST.dur, N = s.peaks.length;
    for (let k = 0; k < N; k++) { const xx = k / N * 990 * frac, hh = Math.max(.6, s.peaks[k] * (lh - 2) / 2); c.fillRect(xx, mid - hh, Math.max(1, 990 * frac / N), hh * 2); }
  });
}
function drawTimeline(pos) {
  const x = tx2, W = 990, H = 100; x.clearRect(0, 0, W, H);
  x.fillStyle = 'rgba(28,28,30,.8)'; x.beginPath(); x.roundRect(0, 0, W, H, 12); x.fill();
  if (!ST.stems.length) { x.fillStyle = 'rgba(245,245,247,.35)'; x.font = '400 12px Mono'; x.fillText('LÍNEA DE TIEMPO', 16, 54); return; }
  if (ST.beats.length) { ST.beats.forEach((t, i) => { const bx = t / ST.dur * W; x.fillStyle = i % 4 === 0 ? 'rgba(245,245,247,.16)' : 'rgba(245,245,247,.05)'; x.fillRect(bx, 0, 1, H); }); }
  if (laneCache) x.drawImage(laneCache, 0, 0, W, H);
  ST.stems.forEach((s, i) => { if (s.mute || (ST.stems.some(q => q.solo) && !s.solo)) { const lh = (H - 8) / ST.stems.length; x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(0, 4 + i * lh, W, lh); } });
  if (MT.st.length > 1) { x.strokeStyle = 'rgba(245,245,247,.85)'; x.lineWidth = 1.5; x.beginPath(); MT.st.forEach((p, i) => { const px = p.t / ST.dur * W, py = H - 6 - Math.max(0, Math.min(1, (p.v + 40) / 36)) * (H - 12); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
  const px = pos / ST.dur * W; x.fillStyle = '#F5F5F7'; x.fillRect(px - 1, 0, 2, H);
  x.beginPath(); x.moveTo(px - 6, 0); x.lineTo(px + 6, 0); x.lineTo(px, 8); x.fill();
}

/* ---------- medidores ---------- */
function drawMeters(now) {
  const x = mx, W = 990, H = 136; x.clearRect(0, 0, W, H);
  const card = (x0, w, label) => { x.fillStyle = 'rgba(28,28,30,.8)'; x.beginPath(); x.roundRect(x0, 0, w, H, 12); x.fill(); x.fillStyle = 'rgba(245,245,247,.45)'; x.font = '400 10px Mono'; x.fillText(label, x0 + 14, 18); };
  const f = v => isFinite(v) && v > -69 ? v.toFixed(1).replace('-', '−') : '—';
  // LUFS
  card(0, 262, 'LOUDNESS · LUFS (APROX.)');
  x.fillStyle = '#F5F5F7'; x.font = '400 50px Serif'; x.fillText(f(MT.I > -70 ? MT.disp.I : -Infinity), 14, 66);
  x.font = '400 10px Mono'; x.fillStyle = 'rgba(245,245,247,.5)'; x.fillText('INTEGRADO', 16, 82);
  [['M', MT.M > -70 ? MT.disp.M : -Infinity], ['S', MT.S > -70 ? MT.disp.S : -Infinity], ['LRA', MT.LRA || -Infinity], ['TP', MT.tpMax]].forEach(([k, v], i) => {
    x.fillStyle = 'rgba(245,245,247,.45)'; x.fillText(k, 140, 34 + i * 15); x.fillStyle = k === 'TP' && MT.tpMax > -1 ? '#FF6B4A' : '#F5F5F7'; x.textAlign = 'right'; x.fillText(k === 'LRA' ? (MT.LRA ? MT.LRA.toFixed(1) + ' LU' : '—') : f(v) + (k === 'TP' ? ' dBTP' : ''), 250, 34 + i * 15); x.textAlign = 'left';
  });
  const bx = 14, bw = 234, by = 104; x.fillStyle = 'rgba(245,245,247,.1)'; x.fillRect(bx, by, bw, 6);
  const sv = Math.max(0, Math.min(1, (MT.disp.S + 40) / 40)); const g = x.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#3DDBC5'); g.addColorStop(.7, '#FFB340'); g.addColorStop(1, '#FF6B4A'); x.fillStyle = g; x.fillRect(bx, by, bw * (MT.S > -70 ? sv : 0), 6);
  const tg = bx + bw * (26 / 40); x.fillStyle = '#A98BFF'; x.fillRect(tg - 1, by - 4, 2, 14); x.font = '400 9px Mono'; x.fillStyle = 'rgba(163,147,245,.9)'; x.fillText('−14 SPOTIFY', tg - 28, by + 24);
  // espectro
  card(272, 380, 'ESPECTRO');
  const sx0 = 286, sw = 352, sh = 92, sy = 120; const bwid = sw / 44;
  for (let b = 0; b < 44; b++) { const v = MT.bands[b]; const gg = x.createLinearGradient(0, sy - sh, 0, sy); gg.addColorStop(0, '#FF6B4A'); gg.addColorStop(.5, '#FFB340'); gg.addColorStop(1, '#3DDBC5'); x.fillStyle = gg; x.fillRect(sx0 + b * bwid, sy - v * sh, bwid - 2, v * sh); x.fillStyle = '#F5F5F7'; x.fillRect(sx0 + b * bwid, sy - MT.caps[b] * sh - 2, bwid - 2, 1.5); }
  x.fillStyle = 'rgba(245,245,247,.35)'; x.font = '400 9px Mono'; [[100, '100'], [1000, '1k'], [10000, '10k']].forEach(([hz, l]) => { const p = Math.log(hz / 30) / Math.log(16000 / 30); x.fillText(l, sx0 + p * sw - 6, 132); });
  // picos L/R
  card(662, 136, 'PICO');
  const mH = 96, my = 112; const dbY = db => my - Math.max(0, Math.min(1, (db + 48) / 48)) * mH;
  [0, 1].forEach(i => { const mxx = 690 + i * 26; x.fillStyle = 'rgba(245,245,247,.1)'; x.fillRect(mxx, my - mH, 14, mH); const top = dbY(MT.pk[i]); const gg = x.createLinearGradient(0, my - mH, 0, my); gg.addColorStop(0, '#FF6B4A'); gg.addColorStop(.25, '#FFB340'); gg.addColorStop(1, '#3DDBC5'); x.fillStyle = gg; x.fillRect(mxx, top, 14, my - top); x.fillStyle = '#F5F5F7'; x.fillRect(mxx, dbY(MT.hold[i][0]) - 1, 14, 2); x.fillStyle = 'rgba(245,245,247,.5)'; x.fillText(i ? 'R' : 'L', mxx + 4, 128); });
  x.font = '400 9px Mono'; [0, -6, -12, -24, -48].forEach(db => { x.fillStyle = 'rgba(245,245,247,.35)'; x.fillText(String(db).replace('-', '−'), 750, dbY(db) + 3); });
  // correlación + distribución de loudness
  card(808, 182, 'CORRELACIÓN · DISTRIBUCIÓN');
  const cx0 = 822, cw = 154, cy0 = 38; x.fillStyle = 'rgba(245,245,247,.1)'; x.fillRect(cx0, cy0, cw, 4);
  const cp = cx0 + (MT.corr + 1) / 2 * cw; x.fillStyle = MT.corr < 0 ? '#FF6B4A' : '#3DDBC5'; x.beginPath(); x.arc(cp, cy0 + 2, 6, 0, 6.283); x.fill();
  x.fillStyle = 'rgba(245,245,247,.4)'; x.fillText('−1', cx0 - 2, cy0 + 18); x.fillText('0', cx0 + cw / 2 - 3, cy0 + 18); x.fillText('+1', cx0 + cw - 10, cy0 + 18);
  const bins = new Array(30).fill(0); MT.st.forEach(p => { const b = Math.floor((p.v + 40) / 40 * 30); if (b >= 0 && b < 30) bins[b]++; }); const bm = Math.max(1, ...bins);
  bins.forEach((v, i) => { const hh = v / bm * 56; x.fillStyle = 'rgba(163,147,245,.8)'; x.fillRect(cx0 + i * (cw / 30), 124 - hh, cw / 30 - 1, hh); });
}

/* ---------- interfaz ---------- */
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function stBusy(msg) { ST.busy = !!msg; $('#stInfo').textContent = msg || stInfoText(); }
function stInfoText() { return ST.stems.length ? `${ST.stems.length} stems · ${fmtT(ST.dur)}${ST.bpm ? ' · ' + ST.bpm + ' BPM' : ''}` : 'Sin cargar'; }
function stToast(m) { $('#stInfo').textContent = m; setTimeout(() => $('#stInfo').textContent = stInfoText(), 2600); }
function stUI() {
  const b = $('#stPlay'); b.classList.toggle('on', ST.playing); b.querySelector('.t').textContent = ST.playing ? 'Pausa' : 'Reproducir';
  const r = $('#stRec'); r.classList.toggle('on', !!ST.rec); r.querySelector('.t').textContent = ST.rec ? 'Detener grabación' : 'Grabar video';
  $('#stBpm').textContent = ST.bpm ? `${ST.bpm} BPM` : '— BPM';
}
function stRenderList() {
  const box = $('#stList'); box.innerHTML = '';
  $('#stDrop').classList.toggle('compact', ST.stems.length > 0);
  ST.stems.forEach((s, i) => {
    const row = document.createElement('div'); row.className = 'st-row'; row.style.setProperty('--c', ROLES[s.role].color);
    row.innerHTML = `<span class="st-dot"></span><div class="st-name"><b title="${s.name}">${s.name}</b><select>${Object.keys(ROLES).map(r => `<option value="${r}" ${r === s.role ? 'selected' : ''}>${ROLES[r].name}</option>`).join('')}</select></div><div class="st-lvl"><i></i></div><button class="st-sm ${s.solo ? 'on' : ''}" data-k="solo" title="Solo">S</button><button class="st-sm ${s.mute ? 'on' : ''}" data-k="mute" title="Silenciar">M</button><button class="st-x" title="Quitar">×</button>`;
    row.querySelector('select').onchange = e => { const wasDrums = s.role === 'bateria' || e.target.value === 'bateria'; s.role = e.target.value; row.style.setProperty('--c', ROLES[s.role].color); stDrawLanes(); if (wasDrums) stAnalyze().then(() => stBusy(null)); };
    row.querySelectorAll('.st-sm').forEach(btn => btn.onclick = () => { s[btn.dataset.k] = !s[btn.dataset.k]; btn.classList.toggle('on', s[btn.dataset.k]); stGains(); });
    row.querySelector('.st-x').onclick = () => { stPause(); s.g.disconnect(); ST.stems.splice(ST.stems.indexOf(s), 1); ST.dur = Math.max(0, ...ST.stems.map(q => q.buf.duration)); ST.off = Math.min(ST.off, ST.dur); stRenderList(); stAnalyze().then(() => stBusy(null)); };
    s.row = row; box.appendChild(row);
    gsap.fromTo(row, { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: .6, delay: i * .06, ease: 'expo.out' });
  });
  stDrawLanes(); stUI(); $('#stInfo').textContent = stInfoText();
}

/* ---------- grabación del visual ---------- */
function stRecord() {
  if (ST.rec) { ST.rec.stop(); return; }
  if (!ST.stems.length) return stToast('Primero carga stems.');
  if (!window.MediaRecorder) return stToast('Este navegador no puede grabar.');
  stAudio(); if (!SA.dest) { SA.dest = SA.c.createMediaStreamDestination(); SA.mix.connect(SA.dest); }
  const stream = new MediaStream([...stCv.captureStream(30).getVideoTracks(), ...SA.dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }); const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })); a.download = ($('#stTitle').value || 'hitazo') + '.webm'; a.click(); ST.rec = null; stUI(); };
  stSeek(0); rec.start(250); ST.rec = rec; stPlay(); stUI();
}

/* ---------- bucle ---------- */
let stRaf = 0, stPrev = 0;
function stLoop(ts) {
  const now = ts / 1000, dt = Math.min(.05, stPrev ? now - stPrev : .016); stPrev = now;
  if (SA) {
    const pos = stPos();
    if (ST.playing && pos >= ST.dur - .01) { stPause(); ST.off = 0; ST.last = 0; if (ST.rec) ST.rec.stop(); }
    meterFrame(now, dt, pos); stemFeatures(dt);
    ST.stems.forEach(s => { if (s.row) s.row.querySelector('.st-lvl i').style.transform = `scaleY(${s.lvl.toFixed(3)})`; });
    $('#stTime').textContent = `${fmtT(pos)} / ${fmtT(ST.dur)}`;
    $('#stChord').textContent = FX.chord ? `Acorde ${FX.chord}` : 'Acorde —';
    drawScene(now, dt, pos); drawTimeline(pos);
  } else drawScene(now, dt, 0), drawTimeline(0);
  drawMeters(now);
  if (ST.active || ST.rec) stRaf = requestAnimationFrame(stLoop); else stRaf = 0;
}
function stEnter() { ST.active = true; if (!stRaf) { stPrev = 0; stRaf = requestAnimationFrame(stLoop); } }
function stLeave() { ST.active = false; if (!ST.rec) stPause(); }

/* ---------- demo: cinco stems sintetizados ---------- */
async function makeDemoStems() {
  const sr = 44100, bpm = 100, beat = 60 / bpm, s16 = beat / 4, bar = beat * 4, bars = 16, len = Math.ceil((bars * bar + 2) * sr);
  const CH = [[36, [60, 64, 67]], [31, [59, 62, 67]], [33, [60, 64, 69]], [29, [60, 65, 69]]];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const render = async fn => {
    const c = new OfflineAudioContext(2, len, sr); const out = c.createGain(); out.gain.value = .5; out.connect(c.destination);
    const noise = c.createBuffer(1, sr, sr); const nd = noise.getChannelData(0); for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
    const env = (g, t, a, p, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d); };
    const K = {
      c, out, env,
      kick(t, v = 1) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); env(g, t, .002, v, .42); o.connect(g); g.connect(out); o.start(t); o.stop(t + .45); },
      noise(t, hp, v, d, pan = 0) { const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = c.createGain(); env(g, t, .002, v, d); const p = c.createStereoPanner(); p.pan.value = pan; s.connect(f); f.connect(g); g.connect(p); p.connect(out); s.start(t, Math.random() * .5); s.stop(t + d + .05); },
      tone(t, type, f, v, d, cut, a = .005, pan = 0, det = 0) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; const lp = c.createBiquadFilter(); lp.frequency.value = cut; const g = c.createGain(); env(g, t, a, v, d); const p = c.createStereoPanner(); p.pan.value = pan; o.connect(lp); lp.connect(g); g.connect(p); p.connect(out); o.start(t); o.stop(t + d + .05); },
      voice(t, m, d, vw) { const F = { a: [800, 1150, 2900], o: [450, 800, 2830], e: [400, 1700, 2600], u: [350, 700, 2500] }[vw]; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); const l = c.createOscillator(); l.frequency.value = 5.4; const lg = c.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(14, t + .4); l.connect(lg); lg.connect(o.detune); const g = c.createGain(); env(g, t, .06, 1.6, d); g.gain.setValueAtTime(1.6, t + d * .7); o.connect(g); F.forEach((fq, i) => { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = 9; const bg = c.createGain(); bg.gain.value = [1.4, .9, .35][i]; g.connect(b); b.connect(bg); bg.connect(out); }); o.start(t); l.start(t); o.stop(t + d + .1); l.stop(t + d + .1); },
    };
    fn(K); return c.startRendering();
  };
  const drums = await render(K => { for (let b = 0; b < bars; b++) { const t0 = .1 + b * bar; for (let s = 0; s < 16; s++) { const t = t0 + s * s16; const full = b >= 2 && b < 14;
    if (full ? [0, 6, 8, 10].includes(s) : s % 8 === 0) K.kick(t, .95);
    if (full && (s === 4 || s === 12)) { K.noise(t, 1300, .5, .2); K.tone(t, 'triangle', 190, .25, .12, 3000); }
    if ((b === 7 || b === 13) && s >= 12) K.noise(t, 1300, .35 + (s - 12) * .06, .15);
    if (b >= 1 && s % 2 === 0) K.noise(t, 7500, s % 4 ? .1 : .16, s === 14 ? .22 : .05, .35); } } });
  const bass = await render(K => { for (let b = 2; b < 15; b++) { const t0 = .1 + b * bar, r = CH[b % 4][0]; [[0, r], [3, r], [4, r + 12], [6, r + 7]].forEach(([e, m]) => K.tone(t0 + e * beat / 2, 'sawtooth', mtof(m), .42, beat / 2 * .95, 420, .004)); } });
  const chords = await render(K => { for (let b = 0; b < bars; b++) { const t0 = .1 + b * bar, chorus = b >= 8 && b < 12; CH[b % 4][1].forEach(m => { K.tone(t0, 'sawtooth', mtof(m), .07, bar * .98, chorus ? 2600 : 1400, .08, -.6, 8); K.tone(t0, 'sawtooth', mtof(m), .07, bar * .98, chorus ? 2600 : 1400, .08, .6, -8); }); } });
  const MEL = [76, 0, 76, 74, 72, 0, 72, 74, 74, 0, 74, 72, 71, 0, 67, 0, 72, 0, 72, 74, 76, 0, 79, 76, 77, 0, 76, 74, 72, 0, 0, 0];
  const lead = await render(K => { [4, 12].forEach(sb => MEL.forEach((m, i) => { if (m) K.tone(.1 + sb * bar + i * beat / 2, 'square', mtof(m), .11, beat / 2 * .9, 2800); })); });
  const VOX = [[8, 0, 76, 1.1, 'a'], [8, 2, 74, 1.1, 'o'], [9, 0, 74, 1.1, 'e'], [9, 2, 71, 1.1, 'a'], [10, 0, 72, 1.1, 'a'], [10, 2, 76, 1.1, 'o'], [11, 0, 77, 2.2, 'a'], [14, 0, 72, 2.2, 'o'], [15, 0, 69, 2.2, 'u']];
  const vox = await render(K => VOX.forEach(([b, bt, m, d, v]) => K.voice(.1 + b * bar + bt * beat, m, d, v)));
  return [{ name: 'Voz (demo)', role: 'voz', buf: vox }, { name: 'Batería (demo)', role: 'bateria', buf: drums }, { name: 'Bajo (demo)', role: 'bajo', buf: bass }, { name: 'Melodía (demo)', role: 'melodia', buf: lead }, { name: 'Acordes (demo)', role: 'acordes', buf: chords }];
}

/* ---------- arranque ---------- */
(function stBoot() {
  stInitCanvas();
  $('#stPick').onclick = () => $('#stFile').click();
  $('#stFile').onchange = e => { stAddFiles(e.target.files); e.target.value = ''; };
  $('#stDemo').onclick = () => stLoadDemo();
  $('#stPlay').onclick = () => stToggle();
  $('#stRec').onclick = () => stRecord();
  const drop = $('.st-stems');
  addEventListener('dragover', e => { if (!ST.active) return; e.preventDefault(); drop.classList.add('over'); });
  addEventListener('dragleave', e => { if (e.target === document.documentElement || !e.relatedTarget) drop.classList.remove('over'); });
  addEventListener('drop', e => { if (!ST.active) return; e.preventDefault(); drop.classList.remove('over'); stAddFiles(e.dataTransfer.files); });
  let drag = false, was = false; const at = e => { const r = tlCv.getBoundingClientRect(); return Math.max(0, Math.min(ST.dur, (e.clientX - r.left) / r.width * ST.dur)); };
  tlCv.addEventListener('pointerdown', e => { if (!ST.dur) return; drag = true; was = ST.playing; stPause(); tlCv.setPointerCapture(e.pointerId); ST.off = ST.last = at(e); });
  tlCv.addEventListener('pointermove', e => { if (drag) ST.off = ST.last = at(e); });
  tlCv.addEventListener('pointerup', () => { if (!drag) return; drag = false; if (ST.off < .05) mtReset(); if (was) stPlay(); });
})();
