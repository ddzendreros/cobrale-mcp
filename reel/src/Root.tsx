import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import {FPS, H, W} from './theme';
import {TOTAL} from './timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
