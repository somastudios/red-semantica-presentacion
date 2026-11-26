// Arma presentacion.html: un solo archivo, sin internet (GSAP, fuentes y datos incrustados).
import { readFileSync, writeFileSync } from 'node:fs';
const r = (p, enc = 'utf8') => readFileSync(new URL(p, import.meta.url), enc);
const b64 = p => readFileSync(new URL(p, import.meta.url)).toString('base64');
const parts = {
  '/*@@STYLE@@*/': r('src/style.css'),
  '/*@@ESTUDIO_CSS@@*/': r('src/estudio.css'),
  '@@FONT_ARCHIVO@@': b64('vendor/archivo-latin-wdth-normal.woff2'),
  '/*@@GSAP@@*/': r('vendor/gsap.min.js'),
  '/*@@MORPH@@*/': r('vendor/MorphSVGPlugin.min.js'),
  '/*@@SPLIT@@*/': r('vendor/SplitText.min.js'),
  '/*@@CUSTOMEASE@@*/': r('vendor/CustomEase.min.js'),
  '/*@@TRAZO@@*/': r('vendor/trazo.js'),
  '/*@@GRAPH@@*/null': JSON.stringify(JSON.parse(r('src/graph.json'))),
  '/*@@LAYOUT@@*/null': r('src/layout.json').trim(),
  '/*@@TX@@*/': r('src/tx.js'),
  '/*@@FX@@*/': r('src/fx.js'),
  '/*@@BUCLES@@*/': r('src/bucles.js'),
  '/*@@ASK@@*/': r('src/ask.js'),
  '/*@@ESTUDIO@@*/': r('src/estudio.js'),
};
let html = r('src/index.src.html');
for (const [k, v] of Object.entries(parts)) {
  if (!html.includes(k)) throw new Error('Falta ' + k);
  html = html.split(k).join(v);
}
writeFileSync(new URL('presentacion.html', import.meta.url), html);
console.log('presentacion.html', (html.length / 1024).toFixed(0) + ' KB');
