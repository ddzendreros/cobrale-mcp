import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, FONT, MONO} from '../theme';
import {cue, SceneInfo} from '../timeline';
import {Chip, ICheck, ILink, IPhone, IQr, Lockup, Pop, Sfx} from '../ui';
import {Notebook} from '../notebook';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* ===================================================================== 4 · CÓBRALE */

const ToolCard: React.FC<{at: number; icon: React.ReactNode; bg: string; fg: string; title: string; tool: string}> = ({at, icon, bg, fg, title, tool}) => (
  <Pop at={at} y={90} x={-60} style={{width: 920}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 34, background: C.paper2, borderRadius: 44, padding: '34px 40px', boxShadow: '0 22px 55px rgba(20,33,61,.14)'}}>
      <div style={{width: 150, height: 150, borderRadius: 40, background: bg, color: fg, display: 'grid', placeItems: 'center', flex: 'none'}}>{icon}</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 64, letterSpacing: '-0.02em', color: C.ink, lineHeight: 1}}>{title}</div>
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 36, color: C.green}}>{tool}</div>
      </div>
    </div>
  </Pop>
);

export const Cobrale: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cName = cue(info, 'Cóbrale', 0);
  const cServ = cue(info, 'servidor', 0.12);
  const cPei = cue(info, 'Pei', 0.28);
  const cQr = cue(info, 'Ku', 0.62);
  const cCel = cue(info, 'celular', 0.73);
  const cLink = cue(info, 'link', 0.84);
  const draw = clamp01((f - cName - 10) / 16);

  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 190}}>
      <Sfx at={cName} name="pop" vol={0.6} />
      <Sfx at={cQr} name="pop" vol={0.5} />
      <Sfx at={cCel} name="pop" vol={0.5} />
      <Sfx at={cLink} name="pop" vol={0.5} />

      <Pop at={cName} y={60} scale={0.7} damping={12}>
        <Lockup name="Cóbrale" size={158} checkDraw={draw} />
      </Pop>

      <div style={{display: 'flex', gap: 16, marginTop: 52}}>
        <Pop at={cServ} y={30}>
          <Chip bg={C.ink} color={C.paper} size={40}>
            Servidor MCP
          </Chip>
        </Pop>
        <Pop at={cPei} y={30}>
          <Chip bg={C.green} color={C.white} size={40}>
            sobre pey · CoDi
          </Chip>
        </Pop>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: 30, marginTop: 84}}>
        <ToolCard at={cQr} icon={<IQr size={100} sw={1.9} />} bg={C.ink} fg={C.paper} title="Cobro con QR" tool="cobrar_con_qr" />
        <ToolCard at={cCel} icon={<IPhone size={100} sw={1.9} />} bg={C.green} fg={C.white} title="Directo al celular" tool="cobrar_a_celular" />
        <ToolCard at={cLink} icon={<ILink size={100} sw={1.9} />} bg={C.yellow} fg={C.ink} title="Link de pago" tool="crear_link_de_pago" />
      </div>
    </AbsoluteFill>
  );
};

/* ===================================================================== 5 · ESPERAR_PAGO */

const NODE_W = 660;
const NODE_H = 150;
const GAP = 112;
const TOP0 = 160;
const nodeTop = (i: number) => TOP0 + i * (NODE_H + GAP);
const nodeMid = (i: number) => nodeTop(i) + NODE_H / 2;

const NODES = [
  {title: 'Agente', sub: 'Codex · ChatGPT · el de tu empresa'},
  {title: 'Cóbrale MCP', sub: 'cobrar_* · esperar_pago'},
  {title: 'pey', sub: 'API de CoDi'},
  {title: 'Banco del cliente', sub: 'CoDi · Banxico'},
];

export const Esperar: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cClave = cue(info, 'clave', 0.04);
  const cEsperar = cue(info, 'esperar', 0.1);
  const cPei = cue(info, 'Pei', 0.28);
  const cInst = cue(info, 'instante', 0.78);
  const cAgente = cue(info, 'agente', 0.58);

  // cobro viaja hacia abajo, aviso (webhook) viaja hacia arriba
  const down = clamp01((f - (cClave + 4)) / 34);
  const up = clamp01((f - cPei) / 62);
  const total = nodeMid(3) - nodeMid(0);
  const yDown = nodeMid(0) + down * total;
  const yUp = nodeMid(3) - up * total;
  const paid = f >= cInst;
  const waiting = f >= cClave + 38 && !paid;
  const dots = '.'.repeat(1 + (Math.floor(f / 8) % 3));

  return (
    <AbsoluteFill>
      <Sfx at={cClave} name="swish" vol={0.45} />
      <Sfx at={cPei} name="swish" vol={0.45} />
      <Sfx at={cInst} name="ding" vol={0.7} />

      {/* línea central */}
      <div style={{position: 'absolute', left: 540 - 4, top: nodeMid(0), width: 8, height: total, background: 'rgba(246,241,231,.14)', borderRadius: 4}} />
      <div style={{position: 'absolute', left: 540 - 4, top: nodeMid(0), width: 8, height: total * down, background: C.yellow, borderRadius: 4, opacity: up > 0 ? 0.25 : 1}} />
      <div style={{position: 'absolute', left: 540 - 4, top: nodeMid(3) - total * up, width: 8, height: total * up, background: '#7BE0AD', borderRadius: 4}} />

      {NODES.map((n, i) => {
        const at = cClave - 6 + i * 5;
        const isAgent = i === 0;
        const isMcp = i === 1;
        const glow = isMcp && f >= cEsperar && f < cEsperar + 50;
        return (
          <Pop key={n.title} at={at} y={50} style={{position: 'absolute', left: 540 - NODE_W / 2, top: nodeTop(i), width: NODE_W}}>
            <div
              style={{
                height: NODE_H,
                borderRadius: 40,
                background: isAgent && paid ? C.green : 'rgba(246,241,231,.97)',
                border: glow ? `6px solid ${C.yellow}` : '6px solid transparent',
                boxShadow: glow ? '0 0 60px rgba(255,209,102,.55)' : '0 24px 60px rgba(0,0,0,.35)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 44px',
                gap: 6,
              }}
            >
              <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 54, letterSpacing: '-0.02em', color: isAgent && paid ? C.white : C.ink, lineHeight: 1.05}}>
                {isAgent && paid ? '✓ ¡Pagado!' : n.title}
              </div>
              <div style={{fontFamily: isMcp ? MONO : FONT, fontWeight: 600, fontSize: isMcp ? 30 : 29, color: isAgent && paid ? 'rgba(255,255,255,.85)' : isMcp ? C.green : C.ink2}}>
                {isAgent && waiting ? `esperando el pago${dots}` : isAgent && paid ? 'se enteró al instante' : n.sub}
              </div>
            </div>
          </Pop>
        );
      })}

      {/* paquetes */}
      {down > 0 && down < 1 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: yDown - 38, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <Chip bg={C.yellow} color={C.ink} size={40} style={{boxShadow: '0 0 50px 8px rgba(255,209,102,.6)'}}>
            $ cobro
          </Chip>
        </div>
      )}
      {up > 0 && up < 1 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: yUp - 38, display: 'flex', justifyContent: 'center', zIndex: 3}}>
          <Chip bg="#7BE0AD" color={C.ink} size={40} style={{boxShadow: '0 0 50px 8px rgba(123,224,173,.6)'}}>
            <ICheck size={40} color={C.ink} sw={3.6} /> aviso firmado
          </Chip>
        </div>
      )}

      {/* leyenda de la herramienta clave */}
      <Pop at={cEsperar} y={40} style={{position: 'absolute', left: 0, right: 0, top: nodeTop(3) + NODE_H + 70, textAlign: 'center'}}>
        <Chip mono bg={C.yellow} color={C.ink} size={52} style={{boxShadow: '0 0 60px rgba(255,209,102,.4)'}}>
          esperar_pago
        </Chip>
      </Pop>
      <span style={{display: 'none'}}>{cAgente}</span>
    </AbsoluteFill>
  );
};

/* ===================================================================== 6 · LIBRETA (intro) */

export const LibretaIntro: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cPara = cue(info, 'Para', 0);
  const cLibreta = cue(info, 'Libreta', 0.16);
  const cUsuario = cue(info, 'usuario', 0.3);
  const cTiendita = cue(info, 'tiendita', 0.5);
  const cFiado = cue(info, 'fiado', 0.68);
  const cCuaderno = cue(info, 'cuaderno', 0.8);
  const slide = interpolate(f - cTiendita, [0, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const e = 1 - Math.pow(1 - slide, 3);

  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 170}}>
      <Sfx at={cLibreta} name="pop" vol={0.6} />
      <Sfx at={cTiendita} name="swish" vol={0.45} />

      <Pop at={cPara} y={20}>
        <Chip bg={C.ink} color={C.paper} size={38}>
          <span style={{color: C.yellow}}>▶</span> Primera app sobre Cóbrale
        </Chip>
      </Pop>

      <Pop at={cLibreta} y={60} scale={0.7} damping={12} style={{marginTop: 54}}>
        <Lockup name="Libreta" size={190} />
      </Pop>

      <Pop at={cUsuario} y={30} style={{marginTop: 30}}>
        <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 52, color: C.ink2, letterSpacing: '-0.01em'}}>El fiado que se cobra solo</div>
      </Pop>

      <div style={{position: 'absolute', left: 90, top: 760 + (1 - e) * 900, transform: `rotate(${-2.2 + (1 - e) * 5}deg)`}}>
        <Notebook
          w={900}
          h={640}
          title="El fiado"
          rows={[
            {name: 'Doña Mary', item: '2 cocas y pan', amount: '$86', at: cFiado},
            {name: 'Don Chuy', item: 'cigarros', amount: '$74.50', at: cFiado + 14},
            {name: 'Lupita', item: 'leche', amount: '$52', at: cCuaderno + 6},
            {name: 'El Güero', item: 'refrescos', amount: '$120', at: cCuaderno + 22},
          ]}
        />
      </div>
    </AbsoluteFill>
  );
};
