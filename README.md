# Cómo hacer un hitazo — red semántica

Presentación para **Introducción a la IA · Actividad 2: Crear una red semántica**.
Explica la producción de una canción (composición → diseño de sonido → mezcla → masterización → distribución) como una red de 41 conceptos y 54 relaciones con nombre.

## Para presentar

Abre `presentacion.html` en Chrome o Edge. Es un solo archivo y funciona sin internet.

| Tecla | Acción |
| --- | --- |
| → / Espacio | Avanzar (algunas diapositivas tienen pasos internos) |
| ← | Regresar |
| F | Pantalla completa |
| N | Notas para quien expone |

Las diapositivas de cada etapa tienen demos de audio (progresión de acordes, síntesis AM/FM, saturación, filtro peine, paneo, fase y limitador). Revisa el volumen del salón antes.

**Nombres del equipo:** edita la constante `EQUIPO` en `src/index.src.html` y vuelve a generar el archivo (o búscala directo en `presentacion.html`).

## Estructura

- `src/index.src.html` — la presentación (HTML, CSS y JS).
- `src/graph.json` — la red: conceptos, etapas y relaciones (sujeto, tipo, etiqueta, objeto).
- `src/layout.json` — posición de cada nodo.
- `vendor/` — GSAP 3.15 (MorphSVG, SplitText) y fuentes (Instrument Serif, Geist, JetBrains Mono).
- `build.mjs` — incrusta todo en `presentacion.html`.

```bash
node build.mjs
```
