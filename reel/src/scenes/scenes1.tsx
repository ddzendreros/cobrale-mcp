import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, MONO} from '../theme';
import {cue, SceneInfo} from '../timeline';
import {Beat, Bill, Chip, CobraleMark, IBuilding, IStore, Pop, Sfx, typed} from '../ui';

/* ===================================================================== 1 · GANCHO */

const Stopwatch: React.FC<{start: number}> = ({start}) => {
  const f = useCurrentFrame();
  const t = Math.max(0, f - start);
  const prog = interpolate(t, [0, 50], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const r = 215;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
      <svg width={520} height={520} viewBox="0 0 520 520">
        <rect x={228} y={6} width={64} height={34} rx={10} fill={C.paper} />
        <circle cx={260} cy={270} r={r} fill="rgba(246,241,231,.06)" stroke="rgba(246,241,231,.25)" strokeWidth={14} />
        <circle
          cx={260}
          cy={270}
          r={r}
          fill="none"
          stroke={C.yellow}
          strokeWidth={18}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - prog * 0.92)}
          transform="rotate(-90 260 270)"
        />
        {Array.from({length: 12}).map((_, i) => (
          <line
            key={i}
            x1={260}
            y1={270 - r + 34}
            x2={260}
            y2={270 - r + (i % 3 === 0 ? 64 : 50)}
            stroke={C.paper}
            strokeWidth={i % 3 === 0 ? 8 : 4}
            strokeLinecap="round"
            transform={`rotate(${i * 30} 260 270)`}
            opacity={0.7}
          />
        ))}
        <g transform={`rotate(${prog * 330} 260 270)`}>
          <line x1={260} y1={290} x2={260} y2={120} stroke={C.paper} strokeWidth={12} strokeLinecap="round" />
        </g>
        <circle cx={260} cy={270} r={18} fill={C.yellow} />
      </svg>
      <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 150, color: C.yellow, letterSpacing: '-0.04em', lineHeight: 1}}>
        {(prog * 2.9).toFixed(1)}
        <span style={{fontSize: 80, marginLeft: 12}}>s</span>
      </div>
    </div>
  );
};

export const Gancho: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cCodi = cue(info, 'Codi', 0);
  const cGratis = cue(info, 'gratis', 0.2);
  const cDinero = cue(info, 'dinero', 0.3);
  const cAun = cue(info, 'Aun', 0.55);

  const rainStart = cAun - 4;
  return (
    <AbsoluteFill>
      <Sfx at={cCodi} name="pop" vol={0.5} />
      <Sfx at={cGratis} name="pop" vol={0.5} />
      <Sfx at={cDinero} name="ding" vol={0.4} />

      {f >= rainStart &&
        Array.from({length: 13}).map((_, i) => {
          const t = (f - rainStart) / fps;
          const w = 190 + random(`bw${i}`) * 150;
          const speed = 380 + random(`bs${i}`) * 420;
          const x = random(`bx${i}`) * 1000 - 110;
          const y = ((t * speed + random(`by${i}`) * 2200) % 2500) - 300;
          return (
            <div key={i} style={{position: 'absolute', left: x, top: y, opacity: 0.24 * Math.min(1, t * 2)}}>
              <Bill w={w} rot={Math.sin(t * 1.4 + i) * 22 + (random(`br${i}`) - 0.5) * 50} />
            </div>
          );
        })}

      <Beat from={Math.min(cCodi - 2, 1)} to={cGratis - 3}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 330, letterSpacing: '-0.05em', color: C.paper, lineHeight: 1}}>
            Co<span style={{color: C.yellow}}>Di</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'center', gap: 18, marginTop: 38}}>
            <Chip bg={C.paper} color={C.ink} size={44}>
              Banco de México
            </Chip>
            <Chip bg="rgba(246,241,231,.12)" color={C.paper} size={44}>
              desde 2019
            </Chip>
          </div>
        </div>
      </Beat>

      <Beat from={cGratis - 2} to={cDinero - 3}>
        <div style={{textAlign: 'center'}}>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 470, letterSpacing: '-0.06em', color: C.yellow, lineHeight: 0.95}}>$0</div>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 96, color: C.paper, marginTop: 8}}>de comisión</div>
        </div>
      </Beat>

      <Beat from={cDinero - 2} to={cAun - 3}>
        <Stopwatch start={cDinero} />
      </Beat>

      <Beat from={cAun - 4}>
        <div style={{textAlign: 'center', position: 'relative', zIndex: 2}}>
          <Chip bg={C.yellow} color={C.ink} size={52}>
            todavía en
          </Chip>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 215, letterSpacing: '-0.05em', color: C.paper, lineHeight: 1.05, marginTop: 20}}>
            EFECTIVO
          </div>
          <svg width={760} height={40} viewBox="0 0 760 40" style={{marginTop: -6}}>
            <path
              d="M6 24 C 70 4, 130 40, 200 22 S 330 6, 400 24 S 530 40, 600 20 S 720 8, 754 22"
              fill="none"
              stroke={C.alert}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={900}
              strokeDashoffset={900 * (1 - interpolate(f - cAun - 14, [0, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))}
            />
          </svg>
        </div>
      </Beat>

    </AbsoluteFill>
  );
};

/* ===================================================================== 2 · PROBLEMA */

const colorize = (line: string): React.ReactNode[] =>
  line.split(/("[^"]*"?|\d+(?:\.\d+)?|POST)/g).map((part, i) => {
    if (!part) return null;
    if (part === 'POST') return <span key={i} style={{color: '#FF9A62'}}>{part}</span>;
    if (part.startsWith('"')) return <span key={i} style={{color: C.yellow}}>{part}</span>;
    if (/^\d/.test(part)) return <span key={i} style={{color: '#7BE0AD'}}>{part}</span>;
    return <span key={i}>{part}</span>;
  });

const CODE = ['POST /codi/qr', '{', '  "amount": 128.00,', '  "concept": "Doña Mary",', '  "numRef": 4821,', '  "expiration": 360,', '  "metadata": { … }', '}'].join('\n');

const CrossCard: React.FC<{label: string; sub: string; icon: React.ReactNode; at: number; xAt: number}> = ({label, sub, icon, at, xAt}) => {
  const f = useCurrentFrame();
  const p = interpolate(f - xAt, [0, 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <Pop at={at} y={80} style={{position: 'relative'}}>
      <div
        style={{
          width: 470,
          height: 380,
          borderRadius: 40,
          background: C.paper2,
          boxShadow: '0 24px 60px rgba(20,33,61,.16)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          opacity: 1 - 0.4 * p,
        }}
      >
        <div style={{color: C.ink}}>{icon}</div>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 60, color: C.ink}}>{label}</div>
        <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 32, color: C.ink2}}>{sub}</div>
      </div>
      <svg width={470} height={380} viewBox="0 0 470 380" style={{position: 'absolute', inset: 0}}>
        <path d="M165 40 L305 180 M305 40 L165 180" stroke={C.alert} strokeOpacity={0.95} strokeWidth={20} strokeLinecap="round" strokeDasharray={210} strokeDashoffset={210 * (1 - p)} />
      </svg>
    </Pop>
  );
};

export const Problema: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cPor = cue(info, 'Por', 0);
  const cInt = cue(info, 'integrarlo', 0.2);
  const cProg = cue(info, 'programador', 0.4);
  const cTien = cue(info, 'tiendita', 0.55);
  const cEmp = cue(info, 'empresas', 0.7);

  return (
    <AbsoluteFill style={{padding: '150px 60px 0', alignItems: 'center', gap: 40}}>
      <Sfx at={cPor} name="pop" vol={0.5} />
      <Sfx at={cProg + 2} name="swish" vol={0.5} />
      <Sfx at={cTien + 14} name="pop" vol={0.45} />
      <Sfx at={cEmp + 14} name="pop" vol={0.45} />

      <Pop at={cPor} y={60} scale={0.6}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 210, letterSpacing: '-0.05em', color: C.ink, lineHeight: 1}}>
          ¿Por qué<span style={{color: C.alert}}>?</span>
        </div>
      </Pop>

      <Pop at={cInt} y={70} style={{position: 'relative', width: 960}}>
        <div style={{background: '#0F1A33', borderRadius: 34, boxShadow: '0 30px 70px rgba(15,26,51,.35)', overflow: 'hidden'}}>
          <div style={{display: 'flex', gap: 12, padding: '22px 28px', background: 'rgba(255,255,255,.06)'}}>
            {['#FF6B6B', '#FFD166', '#7BE0AD'].map((c) => (
              <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />
            ))}
            <div style={{marginLeft: 14, fontFamily: MONO, fontSize: 24, color: 'rgba(246,241,231,.5)'}}>api.pey.mx</div>
          </div>
          <pre style={{margin: 0, padding: '28px 36px 34px', fontFamily: MONO, fontSize: 36, lineHeight: 1.45, color: C.paper, height: 440}}>
            {typed(CODE, f, cInt + 4, 95).split('\n').map((l, i) => (
              <div key={i}>{colorize(l)}</div>
            ))}
          </pre>
        </div>
        <Pop at={cProg + 2} scale={2.2} damping={11} style={{position: 'absolute', right: -14, bottom: -36}}>
          <div
            style={{
              transform: 'rotate(-7deg)',
              background: C.paper2,
              border: `10px solid ${C.alert}`,
              color: C.alert,
              borderRadius: 18,
              padding: '16px 30px',
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 50,
              lineHeight: 1.05,
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            CHAMBA DE
            <br />
            PROGRAMADOR
          </div>
        </Pop>
      </Pop>

      <div style={{display: 'flex', gap: 40, marginTop: 70}}>
        <CrossCard label="La tiendita" sub="no va a integrar una API" icon={<IStore size={120} sw={1.7} />} at={cTien} xAt={cTien + 14} />
        <CrossCard label="La empresa" sub="tampoco" icon={<IBuilding size={120} sw={1.7} />} at={cEmp} xAt={cEmp + 14} />
      </div>
    </AbsoluteFill>
  );
};

/* ===================================================================== 3 · GIRO */

const Agent: React.FC<{size: number}> = ({size}) => {
  const f = useCurrentFrame();
  const blink = f % 96 > 90 ? 0.12 : 1;
  const s = size / 300;
  return (
    <div style={{position: 'relative', width: size, height: size * 1.12}}>
      <div style={{position: 'absolute', left: size / 2 - 7 * s, top: 0, width: 14 * s, height: 60 * s, background: C.paper, borderRadius: 8}} />
      <div style={{position: 'absolute', left: size / 2 - 20 * s, top: -10 * s, width: 40 * s, height: 40 * s, borderRadius: '50%', background: C.yellow, boxShadow: `0 0 ${40 * s}px ${C.yellow}`}} />
      <div
        style={{
          position: 'absolute',
          top: 52 * s,
          left: 0,
          width: size,
          height: size * 0.92,
          borderRadius: 96 * s,
          background: `linear-gradient(160deg, ${C.paper}, #D5DDEF)`,
          boxShadow: '0 40px 90px rgba(0,0,0,.4)',
        }}
      >
        <div style={{position: 'absolute', left: 38 * s, right: 38 * s, top: 50 * s, height: 112 * s, borderRadius: 56 * s, background: C.ink, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 56 * s}}>
          {[0, 1].map((i) => (
            <div key={i} style={{width: 40 * s, height: 62 * s * blink, borderRadius: 24 * s, background: '#7BE0AD', boxShadow: '0 0 30px rgba(123,224,173,.8)'}} />
          ))}
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 30 * s, textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 50 * s, color: C.ink, letterSpacing: '-0.02em'}}>
          Agente
        </div>
      </div>
    </div>
  );
};

const ORBIT = ['REST', 'JSON', 'SDK', 'OAuth', 'MCP', 'webhooks'];

export const Giro: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cAg = cue(info, 'agentes', 0.08);
  const cSaben = cue(info, 'saben', 0.2);
  const cSolo = cue(info, 'Solo', 0.5);
  const cManos = cue(info, 'manos', 0.65);
  const cCobrar = cue(info, 'cobrar', 0.8);
  const chipsOut = interpolate(f, [cSolo - 4, cSolo + 8], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fill = interpolate(f - cCobrar, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const markPop = interpolate(f - cCobrar, [0, 8, 18], [1, 1.12, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const draw = interpolate(f - cCobrar - 8, [0, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill>
      <Sfx at={cAg} name="pop" vol={0.5} />
      <Sfx at={cCobrar} name="ding" vol={0.55} />

      {/* agente */}
      <Pop at={cAg} y={80} scale={0.7} style={{position: 'absolute', left: 540 - 190, top: 190}}>
        <Agent size={380} />
      </Pop>

      {/* chips de "sabe usar APIs" orbitando */}
      {ORBIT.map((label, i) => {
        const a = (i / ORBIT.length) * Math.PI * 2 + f * 0.012 - Math.PI / 2;
        const x = 540 + Math.cos(a) * 425;
        const y = 405 + Math.sin(a) * 285;
        const appear = interpolate(f - (cSaben + i * 4), [0, 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div key={label} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${0.5 + 0.5 * appear})`, opacity: appear * chipsOut}}>
            <Chip mono bg={C.paper} color={C.ink} size={40}>
              {label}
            </Chip>
          </div>
        );
      })}

      {/* conexión + manos */}
      <svg width={1080} height={600} viewBox="0 0 1080 600" style={{position: 'absolute', left: 0, top: 660, opacity: interpolate(f, [cSolo, cSolo + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
        <line x1={540} y1={30} x2={540} y2={190} stroke={C.yellow} strokeWidth={8} strokeDasharray="4 22" strokeLinecap="round" />
        <path d="M512 165 L540 198 L568 165" fill="none" stroke={C.yellow} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 540 - 200,
          top: 880,
          opacity: interpolate(f, [cSolo, cSolo + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          transform: `scale(${markPop})`,
        }}
      >
        <div style={{position: 'relative'}}>
          <CobraleMark size={400} body="rgba(246,241,231,.12)" check="rgba(10,125,79,0)" fingers="rgba(255,209,102,.22)" />
          <div style={{position: 'absolute', inset: 0, opacity: fill}}>
            <CobraleMark size={400} body={C.paper} check={C.green} fingers={C.yellow} checkDraw={draw} />
          </div>
        </div>
      </div>

      <Pop at={cManos} y={30} style={{position: 'absolute', left: 0, right: 0, top: 1300, textAlign: 'center', opacity: 1}}>
        <span style={{display: 'inline-block', opacity: 1 - fill}}>
          <Chip bg="rgba(255,209,102,.16)" color={C.yellow} size={42} style={{border: `3px dashed ${C.yellow}`}}>
            ¿y las manos?
          </Chip>
        </span>
      </Pop>
    </AbsoluteFill>
  );
};
