/**
 * The colour set the whole game draws with.
 *
 * The value rule for a shooter, which matters more than any hue choice:
 *
 *  1. **Anything that can bump her is warm and bright against cool space.**
 *     Stink bubbles are a sickly-silly yellow-green with a white rim, the one
 *     colour nothing friendly uses, so "green means dodge" is learnable.
 *  2. **Her own shots are cool and pale** (cyan lasers, gold stars) and thin,
 *     so they never get mistaken for something to dodge.
 *  3. **Pickups pulse**, so a catch is always findable in a busy screen.
 */
export const PALETTE = {
  overlay: '#070a1c',
  space: '#0d1640',
  star: '#ffffff',
  starWarm: '#ffe9a8',

  laser: '#7df3ff',
  laserCore: '#ffffff',
  starShot: '#ffd23f',

  bubble: '#c6e86a',
  bubbleDark: '#8fb83a',
  bubbleRim: '#f4ffd0',

  shipPink: '#ff7a8a',
  shipPinkDark: '#d94f62',
  chrome: '#d8dee8',
  glass: '#bfe9ff',
  flame: '#ffb01f',
  flameCore: '#fff4b8',
  shield: '#7df3ff',

  fur: '#8b8f98',
  furLight: '#c9ccd2',
  mask: '#26262e',
  saucer: '#b9c2cf',
  saucerDark: '#7d8696',
  lights: '#ffd23f',
  zipper: '#9b59d0',
  tooter: '#e07b3c',

  heart: '#ff4d6d',
  gold: '#ffd23f',
  hudText: '#ffffff',
  hudShadow: '#1b1f3a',
  panel: '#1d2452',
  panelEdge: '#7df3ff',
  button: '#ff7a8a',
  buttonDark: '#c04a5c',
  locked: '#5a607a',
  boom: '#ff8c42',
};

export function alpha(hex: string, a: number): string {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${a})`;
}
