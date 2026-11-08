import {loadFont as loadJakarta} from '@remotion/google-fonts/PlusJakartaSans';
import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

export const FPS = 30;
export const W = 1080;
export const H = 1920;

/** Paleta oficial (docs/brand/guia-de-marca-libreta-y-cobrale.png) */
export const C = {
  ink: '#14213D',
  ink2: '#4A5677',
  green: '#0A7D4F',
  greenSoft: '#E3F4EC',
  yellow: '#FFD166',
  paper: '#F6F1E7',
  paper2: '#FFFDF8',
  line: '#D9E3F0',
  alert: '#E4572E',
  white: '#FFFFFF',
} as const;

/** Tipografía oficial: Plus Jakarta Sans. Caveat = letra a mano del cuaderno. Mono = terminal. */
export const FONT = loadJakarta('normal', {weights: ['500', '600', '700', '800'], subsets: ['latin', 'latin-ext']}).fontFamily;
export const HAND = loadCaveat('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext']}).fontFamily;
export const MONO = loadMono('normal', {weights: ['400', '500', '700'], subsets: ['latin', 'latin-ext']}).fontFamily;
