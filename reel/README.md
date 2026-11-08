# Reel de Cóbrale + Libreta (Remotion)

Video vertical (1080×1920, 30 fps, ~98 s) que presenta **Cóbrale (MCP)** y **Libreta** para el hackathon.
Está **aislado del proyecto**: tiene su propio `package.json` y `node_modules`, no importa nada de `src/` y no toca `data/`.
Para borrarlo basta con eliminar esta carpeta.

```
reel/
  guion.json        ← el texto del video (lo que se dice y lo que se lee en subtítulos). Edita aquí.
  src/              ← composición Remotion (escenas, subtítulos, marca)
  public/shots/     ← capturas reales de Libreta (modo demo) que se ven en los teléfonos
  public/brand/     ← logos oficiales (copiados de docs/brand y public/img)
  public/voz/       ← locución por escena (NN-id.mp3 + tiempos de palabras)
  public/audio/     ← música y efectos (generados por scripts/sonido.mjs)
  scripts/          ← voz.py, medir.mjs, sonido.mjs, stills.mjs
  out/              ← aquí sale el MP4 (ignorado por git)
```

## Usar

```bash
cd reel
npm install            # una sola vez
npm run dev            # Remotion Studio con preview en vivo
npm run render         # → out/cobrale-reel.mp4  (H.264, CRF 17)
```

## Cambiar el guion o la voz

1. Edita `guion.json` (`texto` = subtítulos, `habla` = cómo se pronuncia: "Pei", "Ku Erre", "A-P-I"...).
2. `npm run voz` regenera la locución (voz neuronal `es-MX-JorgeNeural` con `edge-tts`; necesita `pip install edge-tts` e internet; sin API key).
   Para una sola escena: `npm run voz -- gancho`. Otra voz: cambia `voz.nombre` en `guion.json` (`es-MX-DaliaNeural` es la femenina).
3. `npm run medir` recalcula las duraciones (`src/manifest.json`). **Los tiempos de todas las escenas salen de ahí.**
4. `npm run render`.

### Con tu propia voz (lo que mejor suena en una presentación)
Graba cada escena y guárdala con el mismo nombre que ya tiene en `public/voz/` (`01-gancho.mp3`, `02-problema.mp3`, ...; el texto de cada una está en `guion.json`).
Borra los `.json` de esa carpeta (son los tiempos de palabras de la voz sintética) y corre `npm run medir && npm run render`.
Sin esos tiempos, los subtítulos y animaciones se reparten proporcionalmente a la duración del audio.

## Música y efectos
`npm run sonido` genera una cama musical propia (Am–F–C–G, 104 BPM) y los efectos. Para usar otra música, reemplaza `public/audio/musica.wav`.

## Cambiar las capturas
Las capturas de `public/shots/` salen de Libreta en **modo demo** (por eso algunas muestran "CoDi simulado" arriba; los encuadres lo evitan casi siempre).
Si tienes el deploy en vivo, vuelve a capturar con el mismo nombre de archivo (430×932 px a 3x) y se reemplazan solas.

## Revisar sin renderizar todo
`npm run stills` deja cuadros clave de cada escena en `.tmp/stills/` (`npm run stills -- foto 0.3,0.6`).
