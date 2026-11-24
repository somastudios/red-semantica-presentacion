# Cómo hacer un hitazo — red semántica

Presentación para **Introducción a la IA · Actividad 2: Crear una red semántica**.
Explica la producción de una canción (composición → diseño de sonido → mezcla → masterización → distribución) como una red de 41 conceptos y 54 relaciones con nombre.

Equipo: Robin Jay Aguilar García, Diego Alberto Lopez Navia, José Manuel Toro Villalvazo y Daniel Alejandro Cervantes Guzmán.

## Para presentar

Abre `presentacion.html` en Chrome o Edge. Es un solo archivo y funciona sin internet.

| Tecla | Acción |
| --- | --- |
| → / Espacio | Avanzar (algunas diapositivas tienen pasos internos) |
| ← | Regresar |
| F | Pantalla completa |
| N | Notas para quien expone |
| / | Escribir en el composer (pregúntale a la red) |

Las diapositivas de cada etapa tienen demos de audio (progresión de acordes, síntesis AM/FM, saturación, filtro peine, paneo, fase y limitador). Revisa el volumen del salón antes.

## Pregúntale a la red

La barra de abajo acepta preguntas en español ("¿La saturación cambia el timbre?"). Encuentra los conceptos que mencionas y busca un camino de flechas entre ellos; si no hay camino, responde que no. En modo *Explicar* describe un concepto y sus relaciones. El micrófono usa el dictado del navegador (Chrome, necesita internet) y el botón + carga stems.

## Estudio (bonus)

La diapositiva 13 es un estudio: arrastra stems (voz, bajo, batería, acordes, melodía) o usa la demo, y dale play con Espacio.

- El rol de cada stem se adivina por el nombre del archivo (`vocal`, `bass`, `drums`, `keys`, `lead`…) y se puede cambiar.
- Todas las pistas arrancan en la misma muestra. Hay solo, mute y búsqueda en la línea de tiempo.
- Bajo → escala el anillo · batería → ondas y partículas (onsets detectados offline) · melodía → la línea y la forma del anillo · voz → peso de la tipografía · acordes → color (acorde estimado por croma).
- Medición de la mezcla: LUFS momentáneo, corto e integrado (aprox. BS.1770 con filtro K), LRA, true peak (sobremuestreo 4×), picos, correlación estéreo, espectro y distribución de loudness.
- "Grabar video" exporta el visual con audio a `.webm`.

El tempo y el acorde son estimaciones: funcionan bien con stems limpios y se confunden con mezclas densas.

## Estructura

- `src/index.src.html` — la presentación (HTML, CSS y JS).
- `src/graph.json` — la red: conceptos, etapas y relaciones (sujeto, tipo, etiqueta, objeto).
- `src/layout.json` — posición de cada nodo.
- `vendor/` — GSAP 3.15 (MorphSVG, SplitText, CustomEase) y fuentes (Anton, Instrument Serif, Geist, JetBrains Mono).
- `src/ask.js` — el composer y el motor de preguntas.
- `src/tx.js` — transiciones: fundido, apertura circular y, entre diapositivas de la red, solo movimiento de cámara.
- `src/estudio.js`, `src/estudio.css` — el estudio de stems.
- `build.mjs` — incrusta todo en `presentacion.html`.

```bash
node build.mjs
```
