// Mide cada clip de voz con ffprobe y escribe src/manifest.json (duración + tiempos de palabras si existen).
// Los tiempos de las escenas de Remotion salen de aquí, así que corre esto cada vez que cambies la voz.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const guion = JSON.parse(readFileSync(join(raiz, "guion.json"), "utf8"));

const escenas = guion.escenas.map((e, i) => {
  const nombre = `${String(i + 1).padStart(2, "0")}-${e.id}`;
  const mp3 = join(raiz, "public", "voz", `${nombre}.mp3`);
  if (!existsSync(mp3)) throw new Error(`Falta ${mp3}. Corre "npm run voz" o graba tu voz con ese nombre.`);
  const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3], { encoding: "utf8" }));
  const json = join(raiz, "public", "voz", `${nombre}.json`);
  const palabras = existsSync(json) ? JSON.parse(readFileSync(json, "utf8")) : null;
  return { id: e.id, archivo: `voz/${nombre}.mp3`, duracion: +dur.toFixed(3), palabras };
});

mkdirSync(join(raiz, "src"), { recursive: true });
writeFileSync(join(raiz, "src", "manifest.json"), JSON.stringify({ escenas }, null, 2));
const total = escenas.reduce((s, e) => s + e.duracion, 0);
console.log(`manifest.json listo: ${escenas.length} escenas, ${total.toFixed(1)} s de voz`);
