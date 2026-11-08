import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT} from './theme';
import {alignWords, CapWord, SceneInfo} from './timeline';

/** Parte la locución en frases cortas (máx. 5 palabras / 24 letras) que caben en dos renglones. */
const makeChunks = (words: CapWord[]): CapWord[][] => {
  const chunks: CapWord[][] = [];
  let cur: CapWord[] = [];
  let chars = 0;
  for (const w of words) {
    const len = w.w.length + 1;
    if (cur.length && (cur.length >= 5 || chars + len > 22)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(w);
    chars += len;
    if ((/[.?!:…]$/.test(w.w) && cur.length >= 1) || (/[,;]$/.test(w.w) && cur.length >= 2)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
};

export const Captions: React.FC<{info: SceneInfo; tone: 'paper' | 'ink' | 'green'}> = ({info, tone}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chunks = useMemo(() => makeChunks(alignWords(info)), [info]);
  const t = (frame - info.voiceFrom) / fps;

  let idx = -1;
  for (let i = 0; i < chunks.length; i++) if (chunks[i][0].s - 0.04 <= t) idx = i;
  const lastEnd = chunks[chunks.length - 1].slice(-1)[0].e;
  if (idx < 0 || t > lastEnd + 0.5) return null;

  const chunk = chunks[idx];
  const sinceChunk = (frame - info.voiceFrom) - Math.round(chunk[0].s * fps);
  const pop = spring({frame: sinceChunk + 3, fps, config: {damping: 15, stiffness: 220, mass: 0.6}});
  const leave = idx === chunks.length - 1 ? interpolate(t, [lastEnd + 0.15, lastEnd + 0.5], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1;

  const dark = tone === 'paper';
  const bg = dark ? 'rgba(20,33,61,0.96)' : 'rgba(255,253,248,0.97)';
  const fg = dark ? C.paper : C.ink;

  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 285, pointerEvents: 'none'}}>
      <div
        style={{
          maxWidth: 960,
          background: bg,
          borderRadius: 44,
          padding: '26px 42px 30px',
          textAlign: 'center',
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 64,
          lineHeight: 1.16,
          letterSpacing: '-0.02em',
          color: fg,
          boxShadow: '0 22px 60px rgba(8,14,32,.35)',
          opacity: Math.min(1, pop * 1.6) * leave,
          transform: `scale(${0.94 + 0.06 * pop}) translateY(${(1 - pop) * 18}px)`,
        }}
      >
        {chunk.map((w, i) => {
          const active = t >= w.s - 0.03 && t < w.e;
          const future = t < w.s - 0.03;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 0.11em',
                padding: '0 0.14em',
                borderRadius: 16,
                background: active ? C.yellow : 'transparent',
                color: active ? C.ink : fg,
                opacity: future ? 0.4 : 1,
              }}
            >
              {w.w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
