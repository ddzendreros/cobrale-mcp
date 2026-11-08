// QA rápido: renderiza cuadros clave de cada escena a .tmp/stills/ (npm run stills [idEscena] [fracciones,coma]).
// Ej.: npm run stills -- foto 0.3,0.6,0.9
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(raiz, '.tmp', 'stills');
mkdirSync(outDir, {recursive: true});

const solo = process.argv[2];
const fracs = (process.argv[3] || '0.2,0.5,0.85').split(',').map(Number);

const manifest = JSON.parse(readFileSync(join(raiz, 'src', 'manifest.json'), 'utf8'));
const HEAD = 11;
const TAIL = 15;
let cursor = 0;
const escenas = manifest.escenas.map((m) => {
  const voiceDur = Math.ceil(m.duracion * 30);
  const e = {id: m.id, from: cursor, voiceDur};
  cursor += HEAD + voiceDur + TAIL;
  return e;
});

const serveUrl = await bundle({entryPoint: join(raiz, 'src', 'index.ts'), webpackOverride: (c) => c});
const comp = await selectComposition({serveUrl, id: 'Reel'});
console.log('total', comp.durationInFrames, 'frames =', (comp.durationInFrames / 30).toFixed(1), 's');

let n = 0;
for (const e of escenas) {
  if (solo && solo !== 'todas' && e.id !== solo) continue;
  for (const fr of fracs) {
    const frame = Math.min(comp.durationInFrames - 1, e.from + HEAD + Math.round(fr * e.voiceDur));
    const output = join(outDir, `${String(escenas.indexOf(e) + 1).padStart(2, '0')}-${e.id}-${Math.round(fr * 100)}.png`);
    await renderStill({composition: comp, serveUrl, output, frame, imageFormat: 'png'});
    n++;
  }
  console.log('ok', e.id);
}
console.log('stills:', n);
