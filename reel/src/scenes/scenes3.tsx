import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {C, FONT, MONO} from '../theme';
import {cue, SceneInfo} from '../timeline';
import {Chip, Confetti, IMic, IQr, ICheck, IWarn, Phone, Pop, Sfx, Shot, Tap, typed} from '../ui';
import {Notebook} from '../notebook';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/* ===================================================================== 7 · FOTO + VOZ */

const ResultRow: React.FC<{at: number; kind: 'ok' | 'skip' | 'warn'; name: string; item: string; amount: string; tag?: string}> = ({
  at,
  kind,
  name,
  item,
  amount,
  tag,
}) => {
  const palette =
    kind === 'ok'
      ? {bg: C.paper2, border: 'transparent', badge: C.green}
      : kind === 'skip'
        ? {bg: 'rgba(20,33,61,.07)', border: 'transparent', badge: C.ink2}
        : {bg: '#FFF0C6', border: C.yellow, badge: '#B7791F'};
  return (
    <Pop at={at} y={40} x={-30} style={{width: 900}}>
      <div
        style={{
          height: 112,
          borderRadius: 32,
          background: palette.bg,
          border: `5px solid ${palette.border}`,
          boxShadow: kind === 'skip' ? 'none' : '0 16px 40px rgba(20,33,61,.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '0 34px',
        }}
      >
        <div style={{width: 62, height: 62, borderRadius: 31, background: palette.badge, display: 'grid', placeItems: 'center', flex: 'none'}}>
          {kind === 'ok' ? <ICheck size={40} color="#fff" sw={3.4} /> : kind === 'skip' ? <span style={{color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 40}}>—</span> : <IWarn size={38} color="#fff" sw={2.6} />}
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.ink, lineHeight: 1.05, textDecoration: kind === 'skip' ? 'line-through' : 'none', opacity: kind === 'skip' ? 0.55 : 1}}>
            {name}
          </div>
          <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 28, color: C.ink2, opacity: kind === 'skip' ? 0.55 : 1}}>{item}</div>
        </div>
        {tag && (
          <Chip size={26} bg={kind === 'warn' ? C.yellow : C.ink} color={kind === 'warn' ? C.ink : C.paper}>
            {tag}
          </Chip>
        )}
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 46, color: C.ink, minWidth: 130, textAlign: 'right', opacity: kind === 'skip' ? 0.4 : 1}}>{amount}</div>
      </div>
    </Pop>
  );
};

const Brackets: React.FC<{progress: number; x: number; y: number; w: number; h: number}> = ({progress, x, y, w, h}) => {
  const off = 50 * (1 - progress) + 18;
  const L = 92;
  const common = {position: 'absolute', width: L, height: L, borderColor: C.yellow, borderStyle: 'solid', borderWidth: 0} as React.CSSProperties;
  return (
    <div style={{position: 'absolute', left: x - off, top: y - off, width: w + off * 2, height: h + off * 2, opacity: progress}}>
      <div style={{...common, left: 0, top: 0, borderTopWidth: 12, borderLeftWidth: 12, borderTopLeftRadius: 30}} />
      <div style={{...common, right: 0, top: 0, borderTopWidth: 12, borderRightWidth: 12, borderTopRightRadius: 30}} />
      <div style={{...common, left: 0, bottom: 0, borderBottomWidth: 12, borderLeftWidth: 12, borderBottomLeftRadius: 30}} />
      <div style={{...common, right: 0, bottom: 0, borderBottomWidth: 12, borderRightWidth: 12, borderBottomRightRadius: 30}} />
    </div>
  );
};

export const Foto: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cFoto = cue(info, 'Foto', 0);
  const cCuad = cue(info, 'cuaderno', 0.04);
  const cIA = cue(info, 'I-A', 0.12);
  const cLimpio = cue(info, 'limpio', 0.26);
  const cTachado = cue(info, 'tachado', 0.37);
  const cMonto = cue(info, 'monto', 0.46);
  const cMarca = cue(info, 'marca', 0.57);
  const cSolo = cue(info, 'solo', 0.76);
  const cCobrale = cue(info, 'cóbrale', 0.83);
  const cMary = cue(info, 'Mary', 0.9);

  const CARD = {x: 90, y: 230, w: 900, h: 560};
  const bracketP = interpolate(f - cFoto, [0, 14], [0, 1], clamp) * interpolate(f, [cIA, cIA + 10], [1, 0], clamp);
  const flash = interpolate(f - (cCuad + 8), [0, 3, 14], [0, 0.85, 0], clamp);
  const scanning = f >= cIA && f <= cLimpio + 4;
  const scanY = interpolate(f, [cIA, cLimpio], [90, 540], clamp);
  const group = interpolate(f, [cSolo - 8, cSolo + 6], [1, 0], clamp);

  // modo voz
  const vf = f - cSolo;
  const talking = f >= cCobrale - 6 && f <= cMary + 14;
  const ripple = (i: number) => {
    const t = ((vf - i * 18) % 54) / 54;
    return vf < 0 || t < 0 ? 0 : t;
  };

  return (
    <AbsoluteFill>
      <Sfx at={cFoto + 6} name="pop" vol={0.5} />
      <Sfx at={cCuad + 8} name="key" vol={0.9} />
      <Sfx at={cIA} name="swish" vol={0.4} />
      <Sfx at={cLimpio} name="ding" vol={0.45} />
      <Sfx at={cSolo} name="pop" vol={0.5} />
      <Sfx at={cMary + 16} name="ding" vol={0.6} />

      <div style={{opacity: group, transform: `translateY(${(1 - group) * -60}px)`}}>
        <Pop at={cIA} y={20} style={{position: 'absolute', left: 0, right: 0, top: 118, textAlign: 'center'}}>
          <Chip bg={C.ink} color={C.paper} size={32}>
            <span style={{color: '#7BE0AD'}}>●</span> OpenAI · visión
          </Chip>
        </Pop>

        <div style={{position: 'absolute', left: CARD.x, top: CARD.y, transform: 'rotate(-1.4deg)'}}>
          <Notebook
            w={CARD.w}
            h={CARD.h}
            title="Fiado"
            scanY={scanning ? scanY : null}
            rows={[
              {name: 'Doña Mary', item: '2 cocas y pan', amount: '$86', at: -100},
              {name: 'Don Chuy', item: 'cigarros', amount: '$74.50', at: -100},
              {name: 'Pedro', item: 'refrescos', amount: '$40', at: -100, strike: -100},
              {name: 'Lupita', item: 'leche', amount: '$5?', at: -100, smudge: true},
            ]}
          />
        </div>
        <Brackets progress={bracketP} x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} />

        <div style={{position: 'absolute', left: 90, top: 840, display: 'flex', flexDirection: 'column', gap: 14}}>
          <ResultRow at={cLimpio - 2} kind="ok" name="Doña Mary" item="2 cocas y pan" amount="$86.00" />
          <ResultRow at={cLimpio + 6} kind="ok" name="Don Chuy" item="cigarros" amount="$74.50" />
          <ResultRow at={cTachado} kind="skip" name="Pedro" item="línea tachada" amount="$40.00" tag="ignorado" />
          <ResultRow at={cMonto} kind="warn" name="Lupita" item="el monto no se lee" amount="$ ?" tag="revísalo" />
        </div>
        {f >= cMarca && f < cMarca + 40 && (
          <div
            style={{
              position: 'absolute',
              left: 90 - 10,
              top: 840 + 3 * 126 - 10,
              width: 920,
              height: 132,
              borderRadius: 40,
              border: `6px solid ${C.alert}`,
              opacity: interpolate(f - cMarca, [0, 6, 40], [0, 1, 0], clamp),
              transform: `scale(${1 + interpolate(f - cMarca, [0, 40], [0, 0.04], clamp)})`,
            }}
          />
        )}
      </div>

      {/* flash del obturador */}
      <AbsoluteFill style={{background: '#fff', opacity: flash, pointerEvents: 'none'}} />

      {/* ---------- voz ---------- */}
      {f >= cSolo - 2 && (
        <AbsoluteFill>
          <Pop at={cSolo} y={40} scale={0.6} style={{position: 'absolute', left: 540 - 150, top: 230, width: 300, height: 300}}>
            {[0, 1, 2].map((i) => {
              const t = ripple(i);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `6px solid ${C.green}`,
                    opacity: (1 - t) * 0.5,
                    transform: `scale(${1 + t * 0.9})`,
                  }}
                />
              );
            })}
            <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: C.green, display: 'grid', placeItems: 'center', boxShadow: '0 30px 80px rgba(10,125,79,.5)'}}>
              <IMic size={150} color="#fff" sw={1.7} />
            </div>
          </Pop>

          <div style={{position: 'absolute', left: 90, right: 90, top: 620, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12}}>
            {Array.from({length: 27}).map((_, i) => {
              const amp = talking ? 0.35 + 0.65 * Math.abs(Math.sin(f * 0.34 + i * 0.9) * Math.cos(f * 0.21 + i * 0.37)) : 0.07;
              const edge = 1 - Math.abs(i - 13) / 15;
              const h = 16 + amp * edge * 120 + random(`wv${i}`) * (talking ? 22 : 0);
              return <div key={i} style={{width: 18, height: h, borderRadius: 9, background: i % 5 === 0 ? C.yellow : C.ink}} />;
            })}
          </div>

          <Pop at={cCobrale - 6} y={30} style={{position: 'absolute', left: 90, top: 800, width: 900}}>
            <div style={{background: C.paper2, borderRadius: 40, padding: '34px 44px', boxShadow: '0 22px 60px rgba(20,33,61,.15)', minHeight: 120, display: 'flex', alignItems: 'center'}}>
              <span style={{fontFamily: FONT, fontWeight: 700, fontSize: 68, color: C.ink, letterSpacing: '-0.02em'}}>
                “{typed('Cóbrale a Doña Mary', f, cCobrale - 3, 15)}
                <span style={{opacity: Math.floor(f / 8) % 2 ? 0 : 1, color: C.green}}>|</span>”
              </span>
            </div>
          </Pop>

          <Pop at={cMary + 14} y={50} scale={0.85} style={{position: 'absolute', left: 90, top: 1020, width: 900}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 28, background: C.green, color: '#fff', borderRadius: 40, padding: '28px 40px', boxShadow: '0 24px 60px rgba(10,125,79,.4)'}}>
              <IQr size={84} color="#fff" sw={1.8} />
              <div>
                <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 50, lineHeight: 1.05}}>Cobro CoDi · $128.00</div>
                <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 30, opacity: 0.85}}>Doña Mary · QR listo para escanear</div>
              </div>
            </div>
          </Pop>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/* ===================================================================== 8 · COBRO CON QR */

export const Cobro: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cSale = cue(info, 'Sale', 0);
  const cCodi = cue(info, 'Codi', 0.14);
  const cPaga = cue(info, 'paga', 0.3);
  const cSeg = cue(info, 'segundos', 0.41);
  const cCuenta = cue(info, 'cuenta', 0.49);
  const cCero = cue(info, 'cero', 0.59);
  const cSin = cue(info, 'comisión', 0.8);

  const PW = 540;
  const bez = Math.round(PW * 0.034);
  const left = (1080 - (PW + bez * 2)) / 2;
  const top = 110;
  const o = (a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
  const qr = o(cSale + 12, cSale + 17);
  const paid = o(cPaga + 6, cPaga + 10);
  const after = o(cCuenta - 2, cCuenta + 3);
  const zoom = interpolate(f, [cCuenta + 4, cCero + 6], [1, 1.42], clamp);
  const ring = f >= cCero ? interpolate(f - cCero, [0, 10, 40], [0, 1, 0.0], clamp) : 0;

  const sx = PW / 430;
  const centerX = left + bez + PW / 2;
  const centerY = top + bez + (PW * 932) / 430 / 2;

  return (
    <AbsoluteFill>
      <Sfx at={cSale + 6} name="key" vol={0.9} />
      <Sfx at={cPaga + 8} name="chaching" vol={0.85} />
      <Sfx at={cCuenta} name="swish" vol={0.35} />
      <Sfx at={cSin} name="pop" vol={0.5} />

      <Pop at={cSale - 4} y={120} style={{position: 'absolute', left, top}}>
        <Phone w={PW}>
          <Shot name="libreta-cards" />
          <Shot name="cobro-qr" opacity={qr} />
          <Shot name="pagado-b" opacity={paid} />
          <div style={{position: 'absolute', inset: 0, opacity: after, transform: `scale(${zoom})`, transformOrigin: '30% 39%'}}>
            <Shot name="libreta-despues" />
            <div
              style={{
                position: 'absolute',
                left: 20 * sx,
                top: 283 * sx,
                width: 188 * sx,
                height: 152 * sx,
                borderRadius: 24 * sx,
                border: `${5 * sx}px solid ${C.green}`,
                opacity: ring,
                boxShadow: `0 0 ${40 * sx}px rgba(10,125,79,.55)`,
              }}
            />
          </div>
          <Tap x={136 * sx} y={580 * sx} at={cSale + 6} size={110} />
        </Phone>
      </Pop>

      <Confetti at={cPaga + 8} x={centerX} y={centerY - 40} />

      <Pop at={cCodi} y={30} style={{position: 'absolute', left: 54, top: 190}}>
        <div style={{transform: 'rotate(-5deg)'}}>
          <Chip bg={C.paper} color={C.ink} size={36}>
            <span style={{color: C.green}}>●</span> CoDi · Banxico
          </Chip>
        </div>
      </Pop>
      <Pop at={cSeg} y={30} style={{position: 'absolute', right: 26, top: 235}}>
        <div style={{transform: 'rotate(4deg)'}}>
          <Chip bg={C.ink} color={C.paper} size={40}>
            <span style={{color: C.yellow}}>⚡</span> en segundos
          </Chip>
        </div>
      </Pop>
      <Pop at={cSin} y={40} scale={0.7} style={{position: 'absolute', left: 38, top: 930}}>
        <div style={{transform: 'rotate(-6deg)'}}>
          <Chip bg={C.yellow} color={C.ink} size={50} style={{boxShadow: '0 18px 50px rgba(0,0,0,.28)'}}>
            $0 de comisión
          </Chip>
        </div>
      </Pop>
      <span style={{display: 'none', fontFamily: MONO}} />
    </AbsoluteFill>
  );
};
