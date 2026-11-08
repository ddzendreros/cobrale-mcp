import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {C, FONT, HAND} from './theme';

export type NbRow = {
  name: string;
  item: string;
  amount: string;
  /** frame local en que se "escribe" el renglón */
  at: number;
  /** frame local en que se tacha */
  strike?: number;
  /** monto manchado / ilegible */
  smudge?: boolean;
};

const ROW_H = 92;
const TOP = 138;

/** Hoja de cuaderno rayado con letra a mano que se va escribiendo. */
export const Notebook: React.FC<{
  w: number;
  h: number;
  title?: string;
  rows: NbRow[];
  scanY?: number | null;
  style?: React.CSSProperties;
}> = ({w, h, title = 'El fiado', rows, scanY = null, style}) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        width: w,
        height: h,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 30,
        background: '#FFFDF6',
        boxShadow: '0 40px 90px rgba(20,33,61,.28), 0 6px 0 rgba(20,33,61,.06)',
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${ROW_H - 3}px, #C3D3EC ${ROW_H - 3}px ${ROW_H - 1}px, transparent ${ROW_H - 1}px ${ROW_H}px)`,
        backgroundPosition: `0 ${TOP - 10}px`,
        backgroundRepeat: 'repeat-y',
        ...style,
      }}
    >
      {/* margen rojo */}
      <div style={{position: 'absolute', left: 92, top: 0, bottom: 0, width: 3, background: 'rgba(228,87,46,.5)'}} />
      {/* espiral */}
      <div style={{position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: '0 40px'}}>
        {Array.from({length: 9}).map((_, i) => (
          <div key={i} style={{width: 26, height: 26, borderRadius: '50%', background: '#E7DFCB', boxShadow: 'inset 0 4px 6px rgba(20,33,61,.25)'}} />
        ))}
      </div>
      <div style={{position: 'absolute', left: 120, top: 40, fontFamily: HAND, fontWeight: 700, fontSize: 82, color: '#1D2E5C'}}>{title}</div>

      {rows.map((r, i) => {
        const p = interpolate(f - r.at, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const pa = interpolate(f - r.at - 9, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const ps = r.strike != null ? interpolate(f - r.strike, [0, 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
        const top = TOP + i * ROW_H;
        return (
          <div key={i} style={{position: 'absolute', left: 0, right: 0, top, height: ROW_H}}>
            <div
              style={{
                position: 'absolute',
                left: 118,
                lineHeight: `${ROW_H - 8}px`,
                fontFamily: HAND,
                fontWeight: 700,
                fontSize: 62,
                color: '#1D2E5C',
                whiteSpace: 'nowrap',
                clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`,
              }}
            >
              {r.name}
              <span style={{opacity: 0.55, fontWeight: 500}}> · {r.item}</span>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 40,
                lineHeight: `${ROW_H - 8}px`,
                fontFamily: HAND,
                fontWeight: 700,
                fontSize: 64,
                color: '#1D2E5C',
                clipPath: `inset(0 ${(1 - pa) * 100}% 0 0)`,
                filter: r.smudge ? 'blur(1.4px)' : undefined,
              }}
            >
              {r.amount}
            </div>
            {r.smudge && (
              <div
                style={{
                  position: 'absolute',
                  right: 6,
                  top: 4,
                  width: 190,
                  height: 78,
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at center, rgba(139,92,46,.32), rgba(139,92,46,0) 70%)',
                  opacity: pa,
                }}
              />
            )}
            {r.strike != null && (
              <div
                style={{
                  position: 'absolute',
                  left: 108,
                  top: 40,
                  height: 6,
                  borderRadius: 6,
                  background: '#1D2E5C',
                  width: `calc((100% - 150px) * ${ps})`,
                  transform: 'rotate(-1.2deg)',
                }}
              />
            )}
          </div>
        );
      })}

      {scanY != null && (
        <div style={{position: 'absolute', left: 0, right: 0, top: scanY - 70, height: 140, pointerEvents: 'none'}}>
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(255,209,102,0), rgba(255,209,102,.55))`}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: C.yellow, boxShadow: '0 0 28px 8px rgba(255,209,102,.85)'}} />
        </div>
      )}
      <span style={{display: 'none', fontFamily: FONT}} />
    </div>
  );
};

export const NB_ROW_H = ROW_H;
export const NB_TOP = TOP;
