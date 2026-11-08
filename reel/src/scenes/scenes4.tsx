import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, FONT, MONO} from '../theme';
import {cue, SceneInfo} from '../timeline';
import {Chip, CobraleMark, ICheck, IShield, IX, LibretaMark, Lockup, Phone, Pop, Sfx, Shot, typed} from '../ui';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/* ===================================================================== 9 · AGENTE (Codex) */

const Line: React.FC<{children: React.ReactNode; color?: string; indent?: number; dim?: boolean}> = ({children, color = C.paper, indent = 0, dim}) => (
  <div style={{paddingLeft: indent * 22, color, opacity: dim ? 0.6 : 1, minHeight: 50, whiteSpace: 'pre-wrap'}}>{children}</div>
);

export const Agente: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cTien = cue(info, 'tienditas', 0.08);
  const cCodex = cue(info, 'Codex', 0.19);
  const cCobrale = cue(info, 'cóbrale', 0.3);
  const cUno = cue(info, 'uno', 0.62);
  const cCobra = cue(info, 'Cobra', 0.71);
  const cEspera = cue(info, 'espera', 0.76);
  const cPagado = cue(info, 'pagado', 0.89);

  const prompt = 'Cóbrale $1,250 al cliente por la factura FAC-001 y avísame en cuanto pague.';
  const spin = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][Math.floor(f / 3) % 10];
  const intro = interpolate(f, [cCodex - 8, cCodex + 2], [1, 0], clamp);
  const flash = interpolate(f - cPagado, [0, 4, 20], [0, 0.35, 0], clamp);

  return (
    <AbsoluteFill>
      <Sfx at={cCodex} name="swish" vol={0.4} />
      <Sfx at={cCobra} name="pop" vol={0.5} />
      <Sfx at={cEspera + 8} name="pop" vol={0.4} />
      <Sfx at={cPagado} name="chaching" vol={0.8} />

      {/* intro: no es solo para tienditas */}
      {f < cCodex + 2 && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 380, gap: 26, opacity: intro}}>
          {[
            {t: 'Facturas', at: info.voiceFrom + 4, bg: C.paper, fg: C.ink},
            {t: 'Suscripciones', at: info.voiceFrom + 22, bg: C.yellow, fg: C.ink},
            {t: 'Cobranza', at: cTien, bg: C.green, fg: C.white},
          ].map((c) => (
            <Pop key={c.t} at={c.at} y={60} scale={0.8}>
              <Chip bg={c.bg} color={c.fg} size={84}>
                {c.t}
              </Chip>
            </Pop>
          ))}
        </AbsoluteFill>
      )}

      {/* terminal */}
      <Pop at={cCodex - 4} y={90} style={{position: 'absolute', left: 60, top: 120, width: 960}}>
        <div style={{background: '#0B1226', borderRadius: 34, boxShadow: '0 40px 100px rgba(0,0,0,.5), inset 0 0 0 2px rgba(246,241,231,.08)', overflow: 'hidden', height: 730}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '22px 28px', background: 'rgba(246,241,231,.06)'}}>
            {['#FF6B6B', '#FFD166', '#7BE0AD'].map((c) => (
              <div key={c} style={{width: 20, height: 20, borderRadius: 10, background: c}} />
            ))}
            <div style={{marginLeft: 16, fontFamily: MONO, fontSize: 25, color: 'rgba(246,241,231,.55)'}}>codex · mcp: cobrale</div>
          </div>
          <div style={{padding: '26px 34px', fontFamily: MONO, fontSize: 35, lineHeight: '50px'}}>
            <Line>
              <span style={{color: C.yellow}}>› </span>
              {typed(prompt, f, cCobrale - 4, 17)}
              {f < cUno + 40 && <span style={{opacity: Math.floor(f / 8) % 2 ? 0 : 1, color: C.yellow}}>▍</span>}
            </Line>
            <div style={{height: 58}} />

            {f >= cCobra - 2 && (
              <>
                <Line color="#7BE0AD">
                  ● <span style={{color: C.paper}}>cobrale.</span>
                  <span style={{color: C.yellow}}>cobrar_a_celular</span>
                </Line>
                <Line indent={1} dim>
                  monto=1250 · concepto="FAC-001"
                </Line>
                <Line indent={1} color="#7BE0AD">
                  {typed('✓ solicitud enviada al cel •••• 5678', f, cCobra + 4, 38)}
                </Line>
              </>
            )}
            {f >= cEspera - 2 && (
              <>
                <Line color="#7BE0AD">
                  ● <span style={{color: C.paper}}>cobrale.</span>
                  <span style={{color: C.yellow}}>esperar_pago</span>
                </Line>
                {f < cPagado ? (
                  <Line indent={1} color={C.yellow}>
                    {spin} esperando el pago…
                  </Line>
                ) : (
                  <Line indent={1} color="#7BE0AD">
                    ✓ pagado · $1,250.00 · FAC-001
                  </Line>
                )}
              </>
            )}
          </div>
        </div>
      </Pop>

      {/* la libreta del negocio muestra el cobro del agente */}
      <Pop at={cEspera - 4} y={420} style={{position: 'absolute', left: (1080 - 548) / 2, top: 930}}>
        <Phone w={500}>
          <Shot name="agentes-pendiente" />
          <Shot name="agentes-pagado" opacity={interpolate(f, [cPagado, cPagado + 6], [0, 1], clamp)} />
        </Phone>
      </Pop>
      <AbsoluteFill style={{background: C.green, opacity: flash, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

/* ===================================================================== 10 · CONFIANZA */

const TrustRow: React.FC<{at: number; icon: React.ReactNode; bg: string; title: string; sub: string}> = ({at, icon, bg, title, sub}) => (
  <Pop at={at} y={70} x={-50} style={{width: 920}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 32, background: C.paper2, borderRadius: 42, padding: '34px 40px', boxShadow: '0 20px 50px rgba(20,33,61,.13)'}}>
      <div style={{width: 130, height: 130, borderRadius: 38, background: bg, display: 'grid', placeItems: 'center', flex: 'none'}}>{icon}</div>
      <div>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 58, color: C.ink, letterSpacing: '-0.02em', lineHeight: 1.05}}>{title}</div>
        <div style={{fontFamily: MONO, fontWeight: 500, fontSize: 32, color: C.ink2, marginTop: 10}}>{sub}</div>
      </div>
    </div>
  </Pop>
);

export const Confianza: React.FC<{info: SceneInfo}> = ({info}) => {
  const cUn = cue(info, 'Un', 0);
  const cFirma = cue(info, 'firma', 0.27);
  const cDup = cue(info, 'duplicados', 0.47);
  const cCobran = cue(info, 'cobran', 0.68);
  const cDinero = cue(info, 'dinero', 0.84);

  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 200}}>
      <Sfx at={cUn} name="pop" vol={0.45} />
      <Sfx at={cFirma} name="pop" vol={0.45} />
      <Sfx at={cDup} name="pop" vol={0.45} />
      <Sfx at={cCobran} name="pop" vol={0.45} />

      <Pop at={cUn} y={50}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 108, letterSpacing: '-0.045em', color: C.ink, lineHeight: 1, textAlign: 'center'}}>
          Un servidor.
          <br />
          <span style={{color: C.green}}>Todos los agentes.</span>
        </div>
      </Pop>

      <div style={{display: 'flex', flexDirection: 'column', gap: 30, marginTop: 84}}>
        <TrustRow at={cFirma} bg={C.green} icon={<IShield size={80} color="#fff" sw={1.9} />} title="Firma verificada" sub="Standard Webhooks" />
        <TrustRow at={cDup} bg={C.ink} icon={<ICheck size={80} color={C.yellow} sw={2.4} />} title="Sin cobros duplicados" sub="idempotencia por transacción" />
        <TrustRow at={cCobran} bg={C.alert} icon={<IX size={80} color="#fff" sw={2.4} />} title="Solo cobra" sub="ninguna herramienta manda dinero" />
      </div>

      <div style={{display: 'flex', gap: 16, marginTop: 64, flexWrap: 'wrap', justifyContent: 'center', width: 960}}>
        {['OpenAI', 'pey', 'CoDi', 'MCP'].map((t, i) => (
          <Pop key={t} at={cDinero + i * 4} y={30} scale={0.8}>
            <Chip bg="transparent" color={C.ink} size={40} style={{border: `4px solid ${C.ink}`}}>
              {t}
            </Chip>
          </Pop>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ===================================================================== 11 · CIERRE */

export const Cierre: React.FC<{info: SceneInfo}> = ({info}) => {
  const f = useCurrentFrame();
  const cName = cue(info, 'Cóbrale', 0);
  const cPagos = cue(info, 'pagos', 0.1);
  const cPei = cue(info, 'Pei', 0.39);
  const cNos = cue(info, 'nosotros', 0.63);
  const cManos = cue(info, 'manos', 0.74);
  const cFin = cue(info, 'agentes', 0.8, 1);
  const draw = interpolate(f - cName - 12, [0, 18], [0, 1], clamp);
  const glow = interpolate(f - cManos, [0, 10, 40], [0, 1, 0.5], clamp);

  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: 230}}>
      <Sfx at={cName} name="pop" vol={0.6} />
      <Sfx at={cManos} name="ding" vol={0.6} />

      <Pop at={cName} y={60} scale={0.7} damping={12}>
        <Lockup name="Cóbrale" size={168} color={C.paper} mark={{body: C.paper, check: '#2BD48B', fingers: C.yellow}} checkDraw={draw} />
      </Pop>

      <Pop at={cPagos} y={30} style={{marginTop: 46}}>
        <Chip bg={C.yellow} color={C.ink} size={52}>
          Pagos CoDi para agentes
        </Chip>
      </Pop>

      <div style={{marginTop: 130, textAlign: 'center', width: 980}}>
        <Pop at={cPei} y={40}>
          <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 70, color: 'rgba(246,241,231,.78)', letterSpacing: '-0.02em', lineHeight: 1.15}}>
            pey le dio una API a CoDi.
          </div>
        </Pop>
        <Pop at={cNos} y={40} style={{marginTop: 30}}>
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 88, color: C.paper, letterSpacing: '-0.035em', lineHeight: 1.1}}>
            Nosotros le damos{' '}
            <span style={{color: C.ink, background: C.yellow, borderRadius: 22, padding: '0 22px', display: 'inline-block', boxShadow: `0 0 ${70 * glow}px rgba(255,209,102,${0.7 * glow})`}}>manos</span>{' '}
            a los agentes.
          </div>
        </Pop>
      </div>

      <Pop at={cFin} y={30} style={{position: 'absolute', left: 0, right: 0, top: 1215, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
          <CobraleMark size={96} body={C.paper} check="#2BD48B" />
          <span style={{color: 'rgba(246,241,231,.4)', fontFamily: FONT, fontSize: 54, fontWeight: 700}}>+</span>
          <LibretaMark size={84} body={C.paper} />
        </div>
        <div style={{fontFamily: FONT, fontWeight: 600, fontSize: 34, color: 'rgba(246,241,231,.7)', textAlign: 'center', lineHeight: 1.4}}>
          Open source · hecho en la Ciudad de México
          <br />
          DevDay Exchange Community Hackathon 2026
        </div>
      </Pop>
    </AbsoluteFill>
  );
};
