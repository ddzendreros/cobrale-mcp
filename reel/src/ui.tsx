import React from 'react';
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {C, FONT, MONO} from './theme';

export type Tone = 'paper' | 'ink' | 'green';

/* ------------------------------------------------------------------ fondos */

export const Bg: React.FC<{tone: Tone}> = ({tone}) => {
  const frame = useCurrentFrame();
  const drift = frame * 0.12;
  const cfg =
    tone === 'paper'
      ? {bg: C.paper, dot: 'rgba(20,33,61,0.07)'}
      : tone === 'ink'
        ? {
            bg: `radial-gradient(1300px 1000px at 85% 8%, #24376A 0%, ${C.ink} 52%, #0C162E 100%)`,
            dot: 'rgba(246,241,231,0.06)',
          }
        : {
            bg: `radial-gradient(1300px 1000px at 15% 0%, #16A06F 0%, ${C.green} 52%, #07583A 100%)`,
            dot: 'rgba(255,255,255,0.09)',
          };
  return (
    <AbsoluteFill style={{background: cfg.bg}}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${cfg.dot} 2px, transparent 2px)`,
          backgroundSize: '36px 36px',
          backgroundPosition: `${drift}px ${drift}px`,
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ animación */

/** Entra con resorte desde `at` (frame local de la escena). Mantiene su lugar en el layout. */
export const Pop: React.FC<{
  at: number;
  y?: number;
  x?: number;
  scale?: number;
  damping?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({at, y = 50, x = 0, scale = 0.9, damping = 14, style, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f - at, fps, config: {damping, stiffness: 150, mass: 0.8}});
  return (
    <div
      style={{
        opacity: interpolate(p, [0, 0.35], [0, 1], {extrapolateRight: 'clamp'}),
        transform: `translate(${(1 - p) * x}px, ${(1 - p) * y}px) scale(${scale + (1 - scale) * p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Bloque a pantalla completa que vive entre `from` y `to` (frames locales). */
export const Beat: React.FC<{from: number; to?: number; shift?: number; children?: React.ReactNode}> = ({
  from,
  to = 1e9,
  shift = 380,
  children,
}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (f < from - 1 || f > to + 1) return null;
  const p = spring({frame: f - from, fps, config: {damping: 15, stiffness: 140, mass: 0.8}});
  const out = interpolate(f, [to - 7, to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: shift,
        opacity: Math.min(1, p * 1.5) * out,
        transform: `translateY(${(1 - p) * 70 - (1 - out) * 30}px) scale(${0.92 + 0.08 * p})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Efecto de sonido ligado a un frame local. */
export const Sfx: React.FC<{at: number; name: 'pop' | 'whoosh' | 'ding' | 'chaching' | 'key' | 'swish'; vol?: number}> = ({
  at,
  name,
  vol = 0.5,
}) => (
  <Sequence from={Math.max(0, at)} durationInFrames={75} layout="none">
    <Html5Audio src={staticFile(`audio/${name}.wav`)} volume={vol} />
  </Sequence>
);

export const typed = (text: string, frame: number, start: number, cps = 26, fps = 30) => {
  const n = Math.max(0, Math.floor(((frame - start) / fps) * cps));
  return text.slice(0, n);
};

/* ------------------------------------------------------------------ marca */

export const CobraleMark: React.FC<{
  size: number;
  body?: string;
  check?: string;
  fingers?: string;
  checkDraw?: number;
  style?: React.CSSProperties;
}> = ({size, body = C.ink, check = C.green, fingers = C.yellow, checkDraw = 1, style}) => (
  <svg viewBox="0 0 312 344" width={size * (312 / 344)} height={size} style={style}>
    <path
      fill={body}
      d="M159.8 56C132.6 58.3 109.6 74.5 88.6 90.6C47.5 122 2.3 156.8 0.4 213.3C-2.5 302 97 357.8 176.4 339.3C210.8 331.3 227.2 314.6 249.2 288.7C259.2 276.9 269.2 265 279.1 253C289.3 240.7 301.2 227.2 296.9 209.9C295.5 204.3 292.5 199.1 288.3 195.2C264.3 172.6 244 206.1 230.5 222.4C218.7 236.7 198.5 263.6 183.2 272.3C146.5 293.3 93.8 276.2 75.8 238.2C60.9 206.7 76.7 181.7 101.4 162.3C119.3 148.2 182.2 95.4 191.2 78.6C202.4 57.8 173.2 54.8 159.8 56Z"
    />
    <path fill="none" stroke={body} strokeWidth={38} strokeLinecap="round" d="M174.7 147.7L209 109.8M226.7 167.4L249.3 140.5" />
    <path
      fill="none"
      stroke={check}
      strokeWidth={33}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M119.6 218.8L149.8 248.6L193.6 201.2"
      strokeDasharray={112}
      strokeDashoffset={112 * (1 - checkDraw)}
      opacity={checkDraw > 0 ? 1 : 0}
    />
    <path
      fill={fingers}
      d="M220.6 51.7L229.6 12.9A15.8 15.8 0 1 1 259.8 22L245.9 59.3A13.2 13.2 0 0 1 220.6 51.7ZM258.2 68.2L283.6 37.9A15.8 15.8 0 1 1 306.4 59.8L277.2 86.4A13.2 13.2 0 0 1 258.2 68.2Z"
    />
  </svg>
);

export const LibretaMark: React.FC<{size: number; body?: string; rings?: string; style?: React.CSSProperties}> = ({
  size,
  body = C.ink,
  rings = C.yellow,
  style,
}) => (
  <svg viewBox="0 0 261 231" width={size * (261 / 231)} height={size} style={style}>
    <path
      fill={body}
      fillRule="evenodd"
      d="M107.6 19.3L227.3 51.5C249 57.3 259.5 78.6 250.7 99L208.1 197.9C199.3 218.3 174.5 230.1 152.8 224.3L33.1 192.1C11.4 186.3 0.9 165 9.7 144.6L52.3 45.8C61.1 25.3 85.9 13.5 107.6 19.3ZM94.1 78.3L184.6 101.1A13.1 13.1 0 0 1 178.2 126.5L87.7 103.7A13.1 13.1 0 0 1 94.1 78.3ZM75.8 122L155.9 142.6A13.1 13.1 0 0 1 149.3 168L69.2 147.4A13.1 13.1 0 0 1 75.8 122Z"
    />
    <path fill="none" stroke={rings} strokeWidth={26.4} strokeLinecap="round" d="M124.1 40.7L136 14M166.5 51.7L180.1 23.2M207.8 62.7L220.1 36.7" />
  </svg>
);

export const Lockup: React.FC<{
  name: 'Cóbrale' | 'Libreta';
  size: number;
  color?: string;
  mark?: {body?: string; check?: string; fingers?: string; rings?: string};
  checkDraw?: number;
}> = ({name, size, color = C.ink, mark, checkDraw = 1}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: size * 0.2}}>
    {name === 'Cóbrale' ? (
      <CobraleMark size={size * 1.25} body={mark?.body ?? color} check={mark?.check} fingers={mark?.fingers} checkDraw={checkDraw} />
    ) : (
      <LibretaMark size={size * 1.05} body={mark?.body ?? color} rings={mark?.rings} />
    )}
    <span style={{fontFamily: FONT, fontWeight: 800, fontSize: size, letterSpacing: '-0.035em', color, lineHeight: 1}}>{name}</span>
  </div>
);

/* ------------------------------------------------------------------ piezas */

export const Chip: React.FC<{
  children: React.ReactNode;
  bg?: string;
  color?: string;
  size?: number;
  mono?: boolean;
  style?: React.CSSProperties;
}> = ({children, bg = C.ink, color = C.paper, size = 34, mono, style}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      background: bg,
      color,
      fontFamily: mono ? MONO : FONT,
      fontWeight: 700,
      fontSize: size,
      padding: `${size * 0.36}px ${size * 0.72}px`,
      borderRadius: 999,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </span>
);

export const Phone: React.FC<{w: number; children: React.ReactNode; style?: React.CSSProperties}> = ({w, children, style}) => {
  const bez = Math.round(w * 0.034);
  const sh = (w * 932) / 430;
  return (
    <div
      style={{
        width: w + bez * 2,
        height: sh + bez * 2,
        borderRadius: w * 0.14,
        background: 'linear-gradient(160deg,#1B2440,#0A0F1E)',
        padding: bez,
        boxShadow: '0 70px 140px rgba(5,10,25,.45), inset 0 0 0 2px #2D385C',
        position: 'relative',
        flex: 'none',
        ...style,
      }}
    >
      <div style={{width: w, height: sh, borderRadius: w * 0.108, overflow: 'hidden', position: 'relative', background: C.paper}}>{children}</div>
    </div>
  );
};

export const Shot: React.FC<{name: string; opacity?: number; style?: React.CSSProperties}> = ({name, opacity = 1, style}) => (
  <Img
    src={staticFile(`shots/${name}.png`)}
    style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity, ...style}}
  />
);

/** Dedo / toque sobre la pantalla. */
export const Tap: React.FC<{x: number; y: number; at: number; size?: number}> = ({x, y, at, size = 90}) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0 || t > 22) return null;
  const grow = interpolate(t, [0, 10], [0.4, 1], {extrapolateRight: 'clamp'});
  const fade = interpolate(t, [0, 4, 22], [0, 1, 0], {extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(255,209,102,.55)',
        border: `5px solid ${C.yellow}`,
        transform: `scale(${grow})`,
        opacity: fade,
      }}
    />
  );
};

export const Confetti: React.FC<{at: number; x: number; y: number; n?: number; spread?: number}> = ({at, x, y, n = 70, spread = 1}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = (f - at) / fps;
  if (t < 0 || t > 3.2) return null;
  const colors = [C.yellow, C.paper, C.alert, '#4CC9F0', '#7BE0AD', C.white];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: n}).map((_, i) => {
        const a = random(`a${i}`) * Math.PI * 2;
        const sp = (380 + random(`s${i}`) * 900) * spread;
        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp - 700;
        const px = x + vx * t;
        const py = y + vy * t + 0.5 * 2100 * t * t;
        const w = 14 + random(`w${i}`) * 16;
        const rot = random(`r${i}`) * 360 + t * (300 + random(`q${i}`) * 500);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: px,
              top: py,
              width: w,
              height: w * 0.5,
              background: colors[i % colors.length],
              borderRadius: 3,
              transform: `rotate(${rot}deg) scaleY(${Math.cos(t * 9 + i)})`,
              opacity: interpolate(t, [2.2, 3.2], [1, 0], {extrapolateLeft: 'clamp'}),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ iconos (24x24, trazo) */

type IconProps = {size?: number; color?: string; sw?: number; style?: React.CSSProperties};
const Svg: React.FC<IconProps & {children: React.ReactNode}> = ({size = 64, color = 'currentColor', sw = 2, style, children}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {children}
  </svg>
);

export const IQr: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.2" />
    <rect x="14" y="3" width="7" height="7" rx="1.2" />
    <rect x="3" y="14" width="7" height="7" rx="1.2" />
    <path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4" />
  </Svg>
);
export const IPhone: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="6" y="2" width="12" height="20" rx="3" />
    <path d="M10.5 18.5h3" />
    <path d="M9.5 8.5a3.5 3.5 0 0 1 5 0M8 6.5a6 6 0 0 1 8 0" />
  </Svg>
);
export const ILink: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
);
export const ICheck: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Svg>
);
export const IX: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IShield: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M8.5 12l2.5 2.5L15.5 10" />
  </Svg>
);
export const ICopy: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const IMic: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
  </Svg>
);
export const ICamera: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.6" />
  </Svg>
);
export const IStore: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 9l1.5-5h15L21 9" />
    <path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3" />
    <path d="M5 12v8h14v-8M10 20v-5h4v5" />
  </Svg>
);
export const IBuilding: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M9 15.5h2M13 15.5h2M10.5 21v-3h3v3" />
  </Svg>
);
export const IBolt: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
  </Svg>
);
export const IArrowUpRight: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 17L17 7M8 7h9v9" />
  </Svg>
);
export const IWarn: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5M12 18v.01" />
  </Svg>
);
export const ISend: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 12L20 4l-4 16-4-6-8-2z" />
  </Svg>
);

/** Billete de efectivo (SVG propio). */
export const Bill: React.FC<{w?: number; rot?: number; style?: React.CSSProperties}> = ({w = 300, rot = 0, style}) => (
  <svg viewBox="0 0 300 150" width={w} height={w / 2} style={{transform: `rotate(${rot}deg)`, ...style}}>
    <rect x="3" y="3" width="294" height="144" rx="18" fill="#CFE6D8" stroke="#2F7D5A" strokeWidth="5" />
    <rect x="16" y="16" width="268" height="118" rx="10" fill="none" stroke="#2F7D5A" strokeWidth="2.5" strokeDasharray="7 6" />
    <circle cx="150" cy="75" r="40" fill="#A8D2BC" stroke="#2F7D5A" strokeWidth="4" />
    <text x="150" y="92" textAnchor="middle" fontSize="52" fontWeight="800" fill="#1E6B49" fontFamily="Georgia, serif">
      $
    </text>
    <circle cx="48" cy="40" r="11" fill="#A8D2BC" />
    <circle cx="252" cy="110" r="11" fill="#A8D2BC" />
  </svg>
);
