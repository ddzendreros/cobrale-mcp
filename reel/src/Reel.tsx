import React from 'react';
import {AbsoluteFill, Easing, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {C} from './theme';
import {SceneInfo, scenes, TOTAL} from './timeline';
import {Bg, Sfx, Tone} from './ui';
import {Captions} from './Captions';
import {Giro, Gancho, Problema} from './scenes/scenes1';
import {Cobrale, Esperar, LibretaIntro} from './scenes/scenes2';
import {Cobro, Foto} from './scenes/scenes3';
import {Agente, Cierre, Confianza} from './scenes/scenes4';

const SCENES: Record<string, {Comp: React.FC<{info: SceneInfo}>; tone: Tone}> = {
  gancho: {Comp: Gancho, tone: 'ink'},
  problema: {Comp: Problema, tone: 'paper'},
  giro: {Comp: Giro, tone: 'ink'},
  cobrale: {Comp: Cobrale, tone: 'paper'},
  esperar: {Comp: Esperar, tone: 'ink'},
  libreta: {Comp: LibretaIntro, tone: 'paper'},
  foto: {Comp: Foto, tone: 'paper'},
  cobro: {Comp: Cobro, tone: 'green'},
  agente: {Comp: Agente, tone: 'ink'},
  confianza: {Comp: Confianza, tone: 'paper'},
  cierre: {Comp: Cierre, tone: 'ink'},
};

/** Cortinilla amarilla que tapa el corte entre escenas (16 frames, el corte ocurre en el 8). */
const Wipe: React.FC = () => {
  const f = useCurrentFrame();
  const y =
    f < 8
      ? interpolate(f, [0, 8], [100, 0], {easing: Easing.in(Easing.cubic), extrapolateRight: 'clamp'})
      : interpolate(f, [8, 16], [0, -100], {easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: C.yellow, transform: `translateY(${y}%)`}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 26, background: C.ink}} />
    </AbsoluteFill>
  );
};

const MUSIC_BASE = 0.2;
const musicVolume = (f: number) => {
  let duck = 0;
  for (const s of scenes) {
    const v0 = s.from + s.voiceFrom;
    const v1 = v0 + s.voiceDur;
    const env = Math.max(0, Math.min(1, (f - (v0 - 8)) / 8)) * Math.max(0, Math.min(1, (v1 + 10 - f) / 10));
    duck = Math.max(duck, env);
  }
  const fadeIn = Math.min(1, f / 40);
  const fadeOut = Math.min(1, Math.max(0, (TOTAL - f) / 60));
  return MUSIC_BASE * (1 - 0.42 * duck) * fadeIn * fadeOut;
};

export const Reel: React.FC = () => {
  return (
    <AbsoluteFill style={{background: C.ink}}>
      <Html5Audio src={staticFile('audio/musica.wav')} volume={musicVolume} />

      {scenes.map((s) => {
        const {Comp, tone} = SCENES[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <Bg tone={tone} />
            <Comp info={s} />
            <Captions info={s} tone={tone} />
            <Sequence from={s.voiceFrom} durationInFrames={s.voiceDur + 6} layout="none">
              <Html5Audio src={staticFile(s.file)} volume={1} />
            </Sequence>
          </Sequence>
        );
      })}

      {scenes.slice(1).map((s) => (
        <React.Fragment key={`w-${s.id}`}>
          <Sequence from={s.from - 8} durationInFrames={16} name={`wipe-${s.id}`}>
            <Wipe />
          </Sequence>
          <Sfx at={s.from - 8} name="whoosh" vol={0.32} />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
