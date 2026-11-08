import manifest from './manifest.json';
import guion from '../guion.json';
import {FPS} from './theme';

export type Spoken = {t: number; d: number; w: string};

export type SceneInfo = {
  id: string;
  index: number;
  /** frame global donde empieza la escena */
  from: number;
  dur: number;
  /** frame (local a la escena) donde arranca la voz */
  voiceFrom: number;
  voiceDur: number;
  voiceSec: number;
  file: string;
  texto: string;
  spoken: Spoken[] | null;
};

/** Aire antes y después de cada locución (lo cubre la cortinilla de transición). */
const HEAD = 11;
const TAIL = 15;

let cursor = 0;
export const scenes: SceneInfo[] = manifest.escenas.map((m, i) => {
  const voiceDur = Math.ceil(m.duracion * FPS);
  const dur = HEAD + voiceDur + TAIL;
  const info: SceneInfo = {
    id: m.id,
    index: i,
    from: cursor,
    dur,
    voiceFrom: HEAD,
    voiceDur,
    voiceSec: m.duracion,
    file: m.archivo,
    texto: guion.escenas[i].texto,
    spoken: (m.palabras as Spoken[] | null) ?? null,
  };
  cursor += dur;
  return info;
});

export const TOTAL = cursor;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

/**
 * Frame (local a la escena) en que se pronuncia una palabra.
 * Si no hay tiempos de palabras (p. ej. voz grabada por ti), cae a una fracción de la locución.
 */
export const cue = (s: SceneInfo, key: string, fallbackFrac = 0, nth = 0): number => {
  if (s.spoken) {
    const k = norm(key);
    const hits = s.spoken.filter((w) => norm(w.w) === k);
    if (hits[nth]) return s.voiceFrom + Math.round(hits[nth].t * FPS);
  }
  return s.voiceFrom + Math.round(fallbackFrac * s.voiceDur);
};

export type CapWord = {w: string; s: number; e: number};

/** Alinea las palabras del texto en pantalla con los tiempos de la voz (segundos desde que arranca la locución). */
export const alignWords = (s: SceneInfo): CapWord[] => {
  const display = s.texto.split(/\s+/).filter(Boolean);
  const total = display.reduce((n, w) => n + w.length + 1, 0);
  const startsFrac: number[] = [];
  let acc = 0;
  for (const w of display) {
    startsFrac.push(acc / total);
    acc += w.length + 1;
  }

  let times: number[];
  if (s.spoken && s.spoken.length) {
    if (s.spoken.length === display.length) {
      times = s.spoken.map((w) => w.t);
    } else {
      const sp = s.spoken;
      const stotal = sp.reduce((n, w) => n + w.w.length + 1, 0);
      const anchors: [number, number][] = [];
      let sacc = 0;
      for (const w of sp) {
        anchors.push([sacc / stotal, w.t]);
        sacc += w.w.length + 1;
      }
      const last = sp[sp.length - 1];
      anchors.push([1, last.t + last.d]);
      times = startsFrac.map((p) => {
        for (let i = 0; i < anchors.length - 1; i++) {
          const [p0, t0] = anchors[i];
          const [p1, t1] = anchors[i + 1];
          if (p >= p0 && p <= p1) return t0 + ((p - p0) / (p1 - p0 || 1)) * (t1 - t0);
        }
        return anchors[anchors.length - 1][1];
      });
    }
  } else {
    const a = 0.12;
    const b = Math.max(a + 0.5, s.voiceSec - 0.2);
    times = startsFrac.map((p) => a + p * (b - a));
  }

  const endAll = s.voiceSec;
  return display.map((w, i) => ({w, s: times[i], e: i < display.length - 1 ? times[i + 1] : endAll}));
};
