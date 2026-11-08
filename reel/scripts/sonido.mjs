// Genera efectos de sonido y una cama musical propia (sin derechos de autor, sin descargas) en public/audio/.
// npm run sonido
// ¿Quieres otra música? Reemplaza public/audio/musica.wav (o .mp3 y cambia el nombre en src/Reel.tsx).
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SR = 44100;
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(raiz, 'public', 'audio');
mkdirSync(out, {recursive: true});

const TAU = Math.PI * 2;
const buf = (sec) => new Float32Array(Math.ceil(sec * SR));

const wav = (name, data, peak = 0.9) => {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  const pcm = Buffer.alloc(44 + data.length * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + data.length * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.max(-1, Math.min(1, data[i] * g)) * 32767, 44 + i * 2);
  writeFileSync(join(out, name), pcm);
  console.log('✔', name, (data.length / SR).toFixed(2) + 's');
};

// ruido determinista
let seed = 1234567;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 - 0.5;
};

/* ------------------------------------------------------------ efectos */

const pop = () => {
  const b = buf(0.22);
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const f = 420 + 520 * Math.exp(-t * 28);
    ph += (TAU * f) / SR;
    b[i] = Math.sin(ph) * Math.exp(-t * 20) * 0.9 + Math.sin(ph * 2) * Math.exp(-t * 34) * 0.18;
  }
  return b;
};

const sweep = (dur, lo, hi, q = 0.12, amp = 0.8) => {
  const b = buf(dur);
  let y = 0;
  let y2 = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / b.length;
    const fc = lo + (hi - lo) * Math.sin(Math.PI * t) ** 1.4;
    const a = Math.min(0.95, (TAU * fc) / SR);
    y += a * (rnd() * 2 - y);
    y2 += a * (y - y2);
    b[i] = (y - y2) * 6 * Math.sin(Math.PI * t) ** 1.6 * amp * (1 + q);
  }
  return b;
};

const bell = (freqs, dur, decay) => {
  const b = buf(dur);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let v = 0;
    freqs.forEach((f, k) => {
      v += Math.sin(TAU * f * t) * Math.exp(-t * decay * (1 + k * 0.7)) * (1 / (1 + k * 0.9));
    });
    b[i] = v * Math.min(1, t * 400);
  }
  return b;
};

const chaching = () => {
  const b = buf(1.5);
  const hit = (t0, base, amp) => {
    const s = Math.floor(t0 * SR);
    for (let i = 0; s + i < b.length && i < SR * 0.7; i++) {
      const t = i / SR;
      let v = 0;
      [1, 1.5, 2.01, 2.76].forEach((m, k) => {
        v += Math.sin(TAU * base * m * t) * Math.exp(-t * (9 + k * 5)) / (1 + k * 0.6);
      });
      b[s + i] += v * amp * Math.min(1, t * 500);
    }
  };
  hit(0, 2093, 0.7);
  hit(0.085, 3136, 0.85);
  const ring = bell([1568, 2349, 3136, 4699], 1.3, 3.2);
  const s = Math.floor(0.14 * SR);
  for (let i = 0; i < ring.length && s + i < b.length; i++) b[s + i] += ring[i] * 0.5;
  return b;
};

const key = () => {
  const b = buf(0.2);
  const click = (t0, amp) => {
    const s = Math.floor(t0 * SR);
    for (let i = 0; s + i < b.length && i < SR * 0.05; i++) {
      const t = i / SR;
      b[s + i] += (rnd() * 1.6 + Math.sin(TAU * 2300 * t) * 0.6) * Math.exp(-t * 130) * amp;
    }
  };
  click(0, 0.9);
  click(0.07, 0.6);
  return b;
};

wav('pop.wav', pop(), 0.8);
wav('whoosh.wav', sweep(0.62, 300, 5200, 0.1, 1), 0.7);
wav('swish.wav', sweep(0.36, 900, 7000, 0.1, 1), 0.55);
wav('ding.wav', bell([1318.5, 1975.5, 2637], 1.0, 4.2), 0.7);
wav('chaching.wav', chaching(), 0.85);
wav('key.wav', key(), 0.8);

/* ------------------------------------------------------------ música */

const BPM = 104;
const BEAT = 60 / BPM;
const SECONDS = 110;
const music = buf(SECONDS);
const pluckBus = buf(SECONDS);
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

// Am - F - C - G (cada compás = 1 acorde)
const CHORDS = [
  {root: 33, notes: [57, 60, 64, 69]},
  {root: 29, notes: [53, 57, 60, 65]},
  {root: 36, notes: [60, 64, 67, 72]},
  {root: 31, notes: [55, 59, 62, 67]},
];
const PATTERN = [0, 1, 2, 3, 2, 1, 2, 1];
const bars = Math.floor(SECONDS / (BEAT * 4));

for (let bar = 0; bar < bars; bar++) {
  const t0 = bar * BEAT * 4;
  const ch = CHORDS[bar % 4];
  const energy = bar < 2 ? 0.4 : 1;

  // bajo
  {
    const s = Math.floor(t0 * SR);
    const len = Math.floor(BEAT * 3.6 * SR);
    for (let i = 0; i < len && s + i < music.length; i++) {
      const t = i / SR;
      const f = hz(ch.root);
      music[s + i] += (Math.sin(TAU * f * t) * 0.55 + Math.sin(TAU * f * 2 * t) * 0.12) * Math.exp(-t * 0.9) * Math.min(1, t * 60) * 0.5 * energy;
    }
  }
  // arpegio
  for (let e = 0; e < 8; e++) {
    const note = ch.notes[PATTERN[e]];
    const s = Math.floor((t0 + e * BEAT * 0.5) * SR);
    const len = Math.floor(0.9 * SR);
    const f = hz(note);
    for (let i = 0; i < len && s + i < pluckBus.length; i++) {
      const t = i / SR;
      pluckBus[s + i] +=
        (Math.sin(TAU * f * t) + Math.sin(TAU * f * 2 * t) * 0.32 * Math.exp(-t * 8) + Math.sin(TAU * f * 3 * t) * 0.12 * Math.exp(-t * 12)) *
        Math.exp(-t * 5.2) *
        Math.min(1, t * 300) *
        0.16 *
        (e % 2 === 0 ? 1 : 0.7) *
        energy;
    }
  }
  // colchón (acorde sostenido suave)
  for (const note of ch.notes.slice(0, 3)) {
    const f = hz(note - 12);
    const s = Math.floor(t0 * SR);
    const len = Math.floor(BEAT * 4 * SR);
    for (let i = 0; i < len && s + i < music.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t * 2) * Math.min(1, (len - i) / (SR * 0.4));
      music[s + i] += Math.sin(TAU * f * t) * 0.035 * env * energy;
    }
  }
  // kick (desde el compás 3)
  if (bar >= 2) {
    for (let beat = 0; beat < 4; beat++) {
      const s = Math.floor((t0 + beat * BEAT) * SR);
      let ph = 0;
      for (let i = 0; i < SR * 0.28 && s + i < music.length; i++) {
        const t = i / SR;
        ph += (TAU * (46 + 80 * Math.exp(-t * 32))) / SR;
        music[s + i] += Math.sin(ph) * Math.exp(-t * 11) * 0.55;
      }
    }
  }
  // hi-hat en octavos (desde el compás 4)
  if (bar >= 3) {
    for (let e = 0; e < 8; e++) {
      const s = Math.floor((t0 + e * BEAT * 0.5) * SR);
      let prev = 0;
      for (let i = 0; i < SR * 0.05 && s + i < music.length; i++) {
        const t = i / SR;
        const n = rnd();
        const hp = n - prev; // pasa-altos burdo
        prev = n;
        music[s + i] += hp * Math.exp(-t * 90) * (e % 2 ? 0.2 : 0.11);
      }
    }
  }
  // palmada en 2 y 4 (desde el compás 5)
  if (bar >= 4) {
    for (const beat of [1, 3]) {
      const s = Math.floor((t0 + beat * BEAT) * SR);
      for (let i = 0; i < SR * 0.12 && s + i < music.length; i++) {
        const t = i / SR;
        music[s + i] += rnd() * Math.exp(-t * 38) * 0.16;
      }
    }
  }
}

// eco punteado sobre los plucks
const d1 = Math.floor(BEAT * 0.75 * SR);
for (let i = d1; i < pluckBus.length; i++) pluckBus[i] += pluckBus[i - d1] * 0.34;
for (let i = 0; i < music.length; i++) music[i] += pluckBus[i];

wav('musica.wav', music, 0.8);
