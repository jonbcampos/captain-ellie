/**
 * The five stages: who flies in when, and the boss at the end.
 *
 * A data table, like LEVELS in slingshot. Every wave is written with a few
 * little formation helpers so a stage reads as a script ("two saucers, then a
 * zipper line, then a gift"), and `__game.verify()` checks the arithmetic: that
 * every enemy enters inside the band and every stage has its power-ups.
 *
 * Positions are a fraction of the flyable band (0 = top, 1 = bottom), so a
 * stage plays the same whatever the band's pixel size turns out to be.
 *
 * ## Difficulty, for a five-year-old
 *
 * Stage 1 has nothing that shoots at her until halfway through, but from
 * the first playtest on, every stage sends hunters at wherever she is, so she
 * has to fly the ship and not just watch it. Every stage
 * hands her the Super Laser in its first fifteen seconds and has a mega bomb
 * (because she loves the BOOM more than anything), and hearts come from gift
 * saucers as well as from random drops. The boss is the only thing that gets
 * meaningfully harder from stage to stage.
 */

import type { EnemyKind, PickupKind } from './config';

export type Path =
  /** Gentle sine wave. */
  | 'wave'
  /** Straight across. */
  | 'straight'
  /** Fly in, then curve towards where the ship is. */
  | 'dive'
  /** Straight across at whatever height she is at when it appears (see HUNTER). */
  | 'hunt'
  /** A rock from a broken asteroid, drifting up or down as it comes (Enemy.vy). */
  | 'scatter';

/**
 * A stage hazard (config.ts: BLACK_HOLE, BIG_COMET). For a black hole `y` is
 * the height it drifts across at; for a giant comet 0 means it fills the TOP of
 * the band (fly to the bottom) and 1 the bottom.
 */
export interface Hazard {
  t: number;
  kind: 'blackhole' | 'bigcomet' | 'eruption';
  y: number;
}

export interface Spawn {
  /** Stage seconds. */
  t: number;
  kind: EnemyKind;
  /** 0..1 down the band. */
  y: number;
  path: Path;
  /** What it leaves behind when popped. */
  drop?: PickupKind;
}

export type BossAttack =
  | 'spread3'
  | 'spread5'
  | 'minions'
  | 'aimed'
  | 'bigtoot'
  /** Shakes, then lunges across her row and back. Telegraphed; dodge it. */
  | 'charge'
  /** A column of bubbles across the whole band with one gap to fly through. */
  | 'wall'
  /** Bubbles fall from the top of the screen in a row. */
  | 'rain'
  /** A burst of bubbles in every direction. */
  | 'ring'
  /** Three big snowballs lobbed up and down, bouncing off the top and bottom (world 2). */
  | 'snowballs'
  /** Three slow floating mines that burst into rings of bubbles (world 2). */
  | 'mines';

export interface BossSpec {
  sprite: string;
  name: string;
  hp: number;
  /** Seconds between attacks in phase 1; later phases are faster (BOSS.phaseSpeed). */
  every: number;
  /**
   * Attacks for each of the three phases (above 2/3 health, above 1/3, the
   * rest), each cycled in order. A boss gets angrier as she wears it down.
   */
  phases: readonly [readonly BossAttack[], readonly BossAttack[], readonly BossAttack[]];
  /** The painting already faces LEFT, towards her, so don't mirror it (the model drew Sam's cannon that way). */
  facesLeft?: boolean;
  /** Whose voice: the raccoon boss (`b.*` lines) or Mama Raccoon (`m.*`), world 2's last. */
  voice?: 'b' | 'm';
  /** Fallback paint colours. */
  hull: string;
  trim: string;
}

export interface Stage {
  id: number;
  name: string;
  backdrop: string;
  /** Fallback sky colours when the painted backdrop is missing. */
  sky: readonly [string, string];
  /** Seconds of waves before the boss. */
  length: number;
  /** A retry restarts here (and at the boss, once she's reached it). */
  checkpoint: number;
  spawns: readonly Spawn[];
  hazards: readonly Hazard[];
  boss: BossSpec;
  /**
   * How hot the stage runs, on top of the script (first playtest: "things
   * don't really get moving"). `saucerFire` is the chance per second that a
   * saucer on screen toots a bubble at her; `swarmEvery` sends an extra trio
   * of saucers at a random height every so many seconds. Then, from "I could
   * easily get around and 100% them all": `speed` multiplies how fast the
   * raccoons fly (and weave), `weave` how far saucers swing up and down, and
   * `armor` adds hit points to saucers and zippers.
   */
  heat: { saucerFire: number; swarmEvery: number; speed: number; weave: number; armor: number };
}

// --- Formation helpers ---------------------------------------------------------

/** `n` of a kind in a line at one height, one every `gap` seconds. */
function line(t: number, kind: EnemyKind, n: number, y: number, gap = 0.55, path: Path = 'wave'): Spawn[] {
  return Array.from({ length: n }, (_, i) => ({ t: t + i * gap, kind, y, path }));
}

/** `n` of a kind at once, spread from y0 to y1. */
function column(t: number, kind: EnemyKind, n: number, y0: number, y1: number, path: Path = 'straight'): Spawn[] {
  return Array.from({ length: n }, (_, i) => ({ t, kind, y: n === 1 ? y0 : y0 + ((y1 - y0) * i) / (n - 1), path }));
}

/** Five in a V pointing at her. */
function vee(t: number, kind: EnemyKind, y: number, spread = 0.16): Spawn[] {
  return [
    { t, kind, y, path: 'straight' },
    { t: t + 0.35, kind, y: y - spread, path: 'straight' },
    { t: t + 0.35, kind, y: y + spread, path: 'straight' },
    { t: t + 0.7, kind, y: y - spread * 2, path: 'straight' },
    { t: t + 0.7, kind, y: y + spread * 2, path: 'straight' },
  ];
}

function gift(t: number, y: number, drop: PickupKind): Spawn[] {
  return [{ t, kind: 'carrier', y, path: 'wave', drop }];
}

/** Big asteroids drifting in at these heights together: a wall to blast a hole in. */
function asteroids(t: number, ...ys: number[]): Spawn[] {
  return ys.map((y, i) => ({ t: t + i * 0.25, kind: 'asteroid' as const, y, path: 'straight' as const }));
}

/** A wall of asteroids across the band with one slot missing: fly to the gap, or blast a new one. */
function junkWall(t: number, gap: number): Spawn[] {
  const slots = [0.11, 0.37, 0.63, 0.89];
  return asteroids(t, ...slots.filter((_, i) => i !== gap)).map((sp) => ({ ...sp, t }));
}

/** A hunter comet every `every` seconds from `t0` to `t1`, aimed at her height. */
function hunters(t0: number, t1: number, every: number): Spawn[] {
  const out: Spawn[] = [];
  for (let t = t0; t <= t1; t += every) out.push({ t, kind: 'comet', y: 0.5, path: 'hunt' });
  return out;
}

function sorted(...groups: Spawn[][]): Spawn[] {
  return groups.flat().sort((a, b) => a.t - b.t);
}

// --- The stages ---------------------------------------------------------------------

export const STAGES: readonly Stage[] = [
  {
    id: 1,
    name: 'Moon Meadow',
    backdrop: 'space.1',
    sky: ['#0d1640', '#26346e'],
    length: 58,
    checkpoint: 30,
    spawns: sorted(
      hunters(11, 54, 6.5),
      asteroids(16, 0.3), asteroids(33, 0.7), asteroids(47, 0.2, 0.8),
      line(1, 'saucer', 4, 0.3),
      line(5, 'saucer', 4, 0.7),
      gift(9, 0.5, 'weapon'),
      line(13, 'saucer', 5, 0.5, 0.5),
      column(18, 'saucer', 3, 0.2, 0.8),
      line(22, 'saucer', 4, 0.25),
      line(24, 'saucer', 4, 0.75),
      gift(28, 0.4, 'bomb'),
      vee(32, 'saucer', 0.5),
      [{ t: 37, kind: 'tooter', y: 0.45, path: 'straight' }],
      line(41, 'saucer', 4, 0.8),
      gift(44, 0.3, 'heart'),
      column(47, 'saucer', 4, 0.15, 0.85),
      line(51, 'saucer', 5, 0.4, 0.45),
    ),
    hazards: [{ t: 39, kind: 'bigcomet', y: 0 }],
    boss: {
      sprite: 'boss.1',
      name: 'Captain Saucer',
      hp: 380,
      every: 2.2,
      phases: [['spread3', 'aimed'], ['spread3', 'charge', 'aimed'], ['spread5', 'charge', 'rain']],
      hull: '#b9c2cf',
      trim: '#ffd23f',
    },
    heat: { saucerFire: 0.06, swarmEvery: 5, speed: 1.15, weave: 1.4, armor: 0 },
  },
  {
    id: 2,
    name: 'Ring Planet',
    backdrop: 'space.2',
    sky: ['#2a1550', '#4a2a7a'],
    length: 62,
    checkpoint: 32,
    spawns: sorted(
      hunters(9, 58, 5.5),
      asteroids(14, 0.5), asteroids(37, 0.25, 0.75), asteroids(53, 0.15, 0.5),
      line(1, 'saucer', 4, 0.4),
      gift(5, 0.6, 'weapon'),
      line(8, 'zipper', 3, 0.2, 0.7, 'straight'),
      line(11, 'zipper', 3, 0.8, 0.7, 'straight'),
      vee(15, 'saucer', 0.5),
      [{ t: 20, kind: 'tooter', y: 0.3, path: 'straight' }],
      line(22, 'saucer', 4, 0.75),
      gift(27, 0.5, 'heart'),
      column(31, 'zipper', 3, 0.2, 0.8),
      line(35, 'saucer', 5, 0.3, 0.45),
      gift(39, 0.7, 'bomb'),
      [{ t: 42, kind: 'tooter', y: 0.65, path: 'straight' }],
      line(44, 'zipper', 4, 0.25, 0.6, 'dive'),
      vee(50, 'saucer', 0.5),
      column(55, 'saucer', 4, 0.15, 0.85),
    ),
    hazards: [{ t: 24, kind: 'blackhole', y: 0.5 }, { t: 46, kind: 'bigcomet', y: 1 }],
    boss: {
      sprite: 'boss.2',
      name: 'Robo-Raccoon',
      hp: 420,
      every: 2.1,
      phases: [['spread3', 'minions', 'aimed'], ['wall', 'spread3', 'charge'], ['wall', 'rain', 'charge', 'spread5']],
      hull: '#8b8f98',
      trim: '#ffb01f',
    },
    heat: { saucerFire: 0.1, swarmEvery: 4.5, speed: 1.25, weave: 1.6, armor: 1 },
  },
  {
    id: 3,
    name: 'Candy Comets',
    backdrop: 'space.3',
    sky: ['#0f1d4a', '#2c2f6e'],
    length: 66,
    checkpoint: 34,
    spawns: sorted(
      hunters(8, 62, 5),
      asteroids(21, 0.5), asteroids(45, 0.2, 0.8),
      vee(1, 'saucer', 0.5),
      gift(6, 0.35, 'weapon'),
      [{ t: 9, kind: 'tooter', y: 0.7, path: 'straight' }],
      line(10, 'zipper', 4, 0.2, 0.6, 'straight'),
      gift(16, 0.6, 'weapon'),
      column(19, 'saucer', 5, 0.1, 0.9, 'wave'),
      [{ t: 24, kind: 'tooter', y: 0.3, path: 'straight' }],
      line(26, 'saucer', 4, 0.8),
      gift(30, 0.5, 'heart'),
      line(34, 'zipper', 5, 0.5, 0.5, 'dive'),
      gift(40, 0.25, 'bomb'),
      [
        { t: 42, kind: 'tooter', y: 0.25, path: 'straight' },
        { t: 43, kind: 'tooter', y: 0.75, path: 'straight' },
      ],
      line(48, 'saucer', 6, 0.5, 0.4),
      column(54, 'zipper', 4, 0.15, 0.85),
      vee(58, 'saucer', 0.5, 0.14),
    ),
    hazards: [{ t: 13, kind: 'bigcomet', y: 0 }, { t: 30, kind: 'bigcomet', y: 1 }, { t: 51, kind: 'blackhole', y: 0.4 }, { t: 60, kind: 'bigcomet', y: 0 }],
    boss: {
      sprite: 'boss.3',
      name: 'Pirate Pete',
      hp: 580,
      every: 2.0,
      // Rain only in the last phase, and never straight into a spread5: the spread
      // is aimed at her while the curtain is still falling, and early rain pinned
      // one run in six against the edge (16-18 hits). Still world 1.
      phases: [['spread5', 'aimed', 'spread3'], ['charge', 'ring', 'aimed', 'wall'], ['ring', 'rain', 'charge', 'spread5', 'wall']],
      hull: '#a8693a',
      trim: '#a66bff',
    },
    heat: { saucerFire: 0.13, swarmEvery: 4, speed: 1.32, weave: 1.7, armor: 1 },
  },
  {
    id: 4,
    name: 'Nebula Nursery',
    backdrop: 'space.4',
    sky: ['#3a1450', '#7a2a6e'],
    length: 70,
    checkpoint: 36,
    spawns: sorted(
      hunters(7, 66, 4.5),
      asteroids(10, 0.3), asteroids(38, 0.15, 0.5, 0.85), asteroids(60, 0.7),
      line(1, 'saucer', 5, 0.3, 0.45),
      gift(5, 0.6, 'weapon'),
      line(7, 'zipper', 4, 0.75, 0.55, 'dive'),
      [{ t: 12, kind: 'tooter', y: 0.5, path: 'straight' }],
      gift(16, 0.3, 'weapon'),
      vee(19, 'saucer', 0.5),
      column(24, 'zipper', 5, 0.1, 0.9),
      gift(28, 0.7, 'heart'),
      [
        { t: 31, kind: 'tooter', y: 0.2, path: 'straight' },
        { t: 32, kind: 'tooter', y: 0.8, path: 'straight' },
      ],
      line(34, 'saucer', 6, 0.5, 0.4),
      gift(40, 0.4, 'bomb'),
      line(43, 'zipper', 4, 0.2, 0.5, 'straight'),
      line(45, 'zipper', 4, 0.8, 0.5, 'straight'),
      gift(50, 0.55, 'heart'),
      vee(53, 'saucer', 0.5, 0.15),
      [{ t: 58, kind: 'tooter', y: 0.4, path: 'straight' }],
      column(62, 'saucer', 5, 0.1, 0.9, 'wave'),
    ),
    hazards: [{ t: 18, kind: 'blackhole', y: 0.3 }, { t: 44, kind: 'blackhole', y: 0.7 }, { t: 56, kind: 'bigcomet', y: 1 }],
    boss: {
      sprite: 'boss.4',
      name: 'Trash Can Tex',
      hp: 620,
      every: 1.9,
      phases: [['spread3', 'bigtoot', 'aimed', 'minions'], ['wall', 'charge', 'ring', 'bigtoot'], ['charge', 'wall', 'rain', 'ring', 'aimed']],
      hull: '#c7ccd3',
      trim: '#ff8c42',
    },
    heat: { saucerFire: 0.16, swarmEvery: 3.6, speed: 1.4, weave: 1.8, armor: 1 },
  },
  {
    id: 5,
    name: 'The Raccoon King',
    backdrop: 'space.5',
    sky: ['#1d0f3a', '#3e1f5c'],
    length: 74,
    checkpoint: 38,
    spawns: sorted(
      hunters(6, 70, 4),
      asteroids(11, 0.5), asteroids(29, 0.2, 0.8), asteroids(47, 0.15, 0.5, 0.85), asteroids(68, 0.4),
      vee(1, 'saucer', 0.5),
      gift(5, 0.4, 'weapon'),
      line(8, 'zipper', 5, 0.25, 0.5, 'dive'),
      gift(13, 0.65, 'weapon'),
      [
        { t: 15, kind: 'tooter', y: 0.3, path: 'straight' },
        { t: 16, kind: 'tooter', y: 0.7, path: 'straight' },
      ],
      line(19, 'saucer', 6, 0.5, 0.4),
      gift(24, 0.3, 'heart'),
      column(27, 'zipper', 5, 0.1, 0.9),
      gift(31, 0.6, 'bomb'),
      vee(34, 'saucer', 0.38, 0.13),
      vee(37, 'saucer', 0.62, 0.13),
      [{ t: 41, kind: 'tooter', y: 0.5, path: 'straight' }],
      line(44, 'zipper', 5, 0.8, 0.45, 'dive'),
      gift(49, 0.45, 'heart'),
      column(52, 'saucer', 6, 0.1, 0.9, 'wave'),
      [
        { t: 57, kind: 'tooter', y: 0.2, path: 'straight' },
        { t: 58, kind: 'tooter', y: 0.8, path: 'straight' },
      ],
      gift(62, 0.5, 'bomb'),
      line(64, 'zipper', 4, 0.3, 0.5, 'straight'),
      line(66, 'zipper', 4, 0.7, 0.5, 'straight'),
    ),
    hazards: [{ t: 20, kind: 'bigcomet', y: 1 }, { t: 35, kind: 'blackhole', y: 0.5 }, { t: 54, kind: 'bigcomet', y: 0 }, { t: 61, kind: 'blackhole', y: 0.25 }],
    boss: {
      sprite: 'boss.5',
      name: 'The Raccoon King',
      hp: 600,
      every: 1.95,
      phases: [['spread5', 'minions', 'aimed', 'bigtoot'], ['ring', 'charge', 'wall', 'rain', 'aimed'], ['charge', 'ring', 'wall', 'spread3', 'rain', 'bigtoot']],
      hull: '#7a3fb0',
      trim: '#ffd23f',
    },
    heat: { saucerFire: 0.2, swarmEvery: 3.2, speed: 1.5, weave: 1.9, armor: 2 },
  },

  // --- World 2: Mama's Galaxy ------------------------------------------------------------
  // The Raccoon King went home and told his mom. Harder from the first wave: the
  // heat keeps climbing from where stage 5 left off, and every stage adds a trick.
  {
    id: 6,
    name: 'Snowball Comets',
    backdrop: 'space.6',
    sky: ['#0e2a4a', '#2a5a86'],
    length: 74,
    checkpoint: 38,
    spawns: sorted(
      hunters(5, 70, 4),
      asteroids(9, 0.3, 0.7), asteroids(24, 0.5), asteroids(42, 0.2, 0.55), asteroids(60, 0.4, 0.8),
      vee(1, 'saucer', 0.5),
      gift(4, 0.35, 'weapon'),
      line(7, 'zipper', 5, 0.75, 0.45, 'dive'),
      gift(12, 0.6, 'weapon'),
      [{ t: 15, kind: 'tooter', y: 0.25, path: 'straight' }, { t: 16, kind: 'tooter', y: 0.75, path: 'straight' }],
      column(19, 'saucer', 6, 0.1, 0.9, 'wave'),
      gift(27, 0.5, 'heart'),
      line(30, 'zipper', 5, 0.2, 0.45, 'dive'),
      gift(35, 0.7, 'bomb'),
      vee(46, 'saucer', 0.35, 0.13),
      vee(48, 'saucer', 0.65, 0.13),
      gift(53, 0.3, 'heart'),
      [{ t: 56, kind: 'tooter', y: 0.5, path: 'straight' }],
      column(64, 'zipper', 5, 0.1, 0.9),
      line(68, 'saucer', 6, 0.5, 0.4),
    ),
    hazards: [{ t: 20, kind: 'bigcomet', y: 0 }, { t: 38, kind: 'bigcomet', y: 1 }, { t: 57, kind: 'bigcomet', y: 0 }],
    boss: {
      sprite: 'boss.6',
      name: 'Snowball Sam',
      facesLeft: true,
      hp: 520,
      every: 2.0,
      phases: [['snowballs', 'spread3', 'snowballs', 'aimed'], ['snowballs', 'charge', 'wall', 'spread5'], ['snowballs', 'charge', 'ring', 'snowballs', 'rain']],
      hull: '#dbeafe',
      trim: '#60a5fa',
    },
    heat: { saucerFire: 0.2, swarmEvery: 3.2, speed: 1.52, weave: 1.9, armor: 2 },
  },
  {
    id: 7,
    name: 'Volcano Planet',
    backdrop: 'space.7',
    sky: ['#3a0f0f', '#7a2a12'],
    length: 76,
    checkpoint: 38,
    spawns: sorted(
      hunters(5, 72, 4),
      asteroids(14, 0.25), asteroids(33, 0.5, 0.85), asteroids(52, 0.15, 0.6), asteroids(70, 0.4),
      vee(1, 'saucer', 0.45),
      gift(4, 0.6, 'weapon'),
      [{ t: 8, kind: 'tooter', y: 0.3, path: 'straight' }],
      line(10, 'zipper', 5, 0.7, 0.45, 'dive'),
      gift(13, 0.35, 'weapon'),
      column(18, 'saucer', 6, 0.1, 0.9, 'wave'),
      gift(25, 0.5, 'heart'),
      [{ t: 28, kind: 'tooter', y: 0.2, path: 'straight' }, { t: 29, kind: 'tooter', y: 0.8, path: 'straight' }],
      line(36, 'saucer', 6, 0.3, 0.4),
      gift(41, 0.65, 'bomb'),
      line(45, 'zipper', 5, 0.25, 0.45, 'dive'),
      vee(55, 'saucer', 0.5, 0.15),
      gift(59, 0.4, 'heart'),
      column(63, 'zipper', 6, 0.1, 0.9),
      [{ t: 67, kind: 'tooter', y: 0.55, path: 'straight' }],
    ),
    hazards: [
      { t: 11, kind: 'eruption', y: 0 }, { t: 22, kind: 'eruption', y: 0 }, { t: 31, kind: 'bigcomet', y: 1 },
      { t: 43, kind: 'eruption', y: 0 }, { t: 50, kind: 'blackhole', y: 0.35 }, { t: 61, kind: 'eruption', y: 0 },
    ],
    boss: {
      sprite: 'boss.7',
      name: 'Lava Larry',
      hp: 660,
      every: 1.95,
      phases: [['spread5', 'aimed', 'bigtoot'], ['charge', 'wall', 'aimed', 'ring'], ['charge', 'ring', 'wall', 'bigtoot', 'spread5']],
      hull: '#f97316',
      trim: '#7c2d12',
    },
    heat: { saucerFire: 0.22, swarmEvery: 3, speed: 1.57, weave: 1.95, armor: 2 },
  },
  {
    id: 8,
    name: 'Jelly Nebula',
    backdrop: 'space.8',
    sky: ['#2a0f4a', '#6a1f7a'],
    length: 76,
    checkpoint: 40,
    spawns: sorted(
      hunters(6, 72, 3.8),
      asteroids(16, 0.7), asteroids(40, 0.2, 0.8), asteroids(64, 0.5),
      vee(1, 'saucer', 0.55),
      gift(5, 0.3, 'weapon'),
      line(8, 'zipper', 6, 0.5, 0.4, 'dive'),
      gift(12, 0.7, 'weapon'),
      column(20, 'saucer', 6, 0.1, 0.9, 'wave'),
      [{ t: 24, kind: 'tooter', y: 0.35, path: 'straight' }, { t: 25, kind: 'tooter', y: 0.65, path: 'straight' }],
      gift(30, 0.5, 'heart'),
      vee(34, 'saucer', 0.3, 0.12),
      vee(36, 'saucer', 0.7, 0.12),
      gift(44, 0.4, 'bomb'),
      line(48, 'zipper', 6, 0.75, 0.4, 'dive'),
      gift(56, 0.6, 'heart'),
      column(60, 'saucer', 7, 0.08, 0.92, 'wave'),
      line(68, 'zipper', 5, 0.3, 0.4, 'straight'),
    ),
    hazards: [
      { t: 10, kind: 'blackhole', y: 0.3 }, { t: 30, kind: 'bigcomet', y: 1 }, { t: 46, kind: 'blackhole', y: 0.6 },
    ],
    boss: {
      sprite: 'boss.8',
      name: 'Jelly Jim',
      hp: 600,
      every: 2.0,
      phases: [['mines', 'spread3', 'aimed'], ['mines', 'charge', 'rain', 'wall'], ['mines', 'charge', 'ring', 'rain', 'snowballs']],
      hull: '#e879f9',
      trim: '#a21caf',
    },
    heat: { saucerFire: 0.23, swarmEvery: 3, speed: 1.62, weave: 2, armor: 2 },
  },
  {
    id: 9,
    name: 'Junkyard Rings',
    backdrop: 'space.9',
    sky: ['#1f2937', '#4b5563'],
    length: 78,
    checkpoint: 40,
    spawns: sorted(
      hunters(6, 74, 4),
      junkWall(10, 1), junkWall(26, 3), junkWall(44, 0), junkWall(62, 2),
      asteroids(18, 0.5), asteroids(53, 0.3, 0.75),
      vee(1, 'saucer', 0.5),
      gift(4, 0.4, 'weapon'),
      line(6, 'zipper', 5, 0.7, 0.45, 'dive'),
      gift(14, 0.6, 'weapon'),
      [{ t: 21, kind: 'tooter', y: 0.3, path: 'straight' }],
      column(30, 'saucer', 6, 0.1, 0.9, 'wave'),
      gift(35, 0.5, 'heart'),
      line(38, 'zipper', 5, 0.25, 0.45, 'dive'),
      gift(49, 0.5, 'bomb'),
      [{ t: 57, kind: 'tooter', y: 0.25, path: 'straight' }, { t: 58, kind: 'tooter', y: 0.75, path: 'straight' }],
      gift(66, 0.4, 'heart'),
      line(70, 'saucer', 6, 0.5, 0.4),
    ),
    hazards: [{ t: 33, kind: 'blackhole', y: 0.5 }, { t: 70, kind: 'bigcomet', y: 1 }],
    boss: {
      sprite: 'boss.9',
      name: 'Junkbot 3000',
      hp: 600,
      every: 2.0,
      phases: [['spread5', 'minions', 'mines', 'aimed'], ['charge', 'wall', 'snowballs', 'mines'], ['charge', 'wall', 'ring', 'mines', 'rain', 'bigtoot']],
      hull: '#9ca3af',
      trim: '#f59e0b',
    },
    heat: { saucerFire: 0.22, swarmEvery: 3.1, speed: 1.6, weave: 2, armor: 2 },
  },
  {
    id: 10,
    name: "Mama's Mothership",
    backdrop: 'space.10',
    sky: ['#3b0a2a', '#7a1f5c'],
    length: 82,
    checkpoint: 42,
    spawns: sorted(
      hunters(5, 78, 4.2),
      asteroids(12, 0.35, 0.75), junkWall(30, 2), asteroids(48, 0.2, 0.6), asteroids(66, 0.3, 0.7),
      vee(1, 'saucer', 0.4),
      vee(2, 'saucer', 0.66, 0.14),
      gift(4, 0.5, 'weapon'),
      line(8, 'zipper', 6, 0.25, 0.4, 'dive'),
      gift(13, 0.35, 'weapon'),
      [{ t: 16, kind: 'tooter', y: 0.2, path: 'straight' }, { t: 17, kind: 'tooter', y: 0.8, path: 'straight' }],
      column(21, 'saucer', 7, 0.08, 0.92, 'wave'),
      gift(26, 0.5, 'heart'),
      line(36, 'zipper', 6, 0.75, 0.4, 'dive'),
      gift(40, 0.6, 'bomb'),
      vee(52, 'saucer', 0.35, 0.12),
      vee(54, 'saucer', 0.65, 0.12),
      gift(58, 0.45, 'heart'),
      [{ t: 61, kind: 'tooter', y: 0.5, path: 'straight' }],
      column(72, 'zipper', 6, 0.1, 0.9),
      gift(76, 0.5, 'bomb'),
    ),
    hazards: [
      { t: 10, kind: 'eruption', y: 0 }, { t: 19, kind: 'bigcomet', y: 0 }, { t: 34, kind: 'blackhole', y: 0.6 },
      { t: 44, kind: 'eruption', y: 0 }, { t: 57, kind: 'bigcomet', y: 1 }, { t: 70, kind: 'blackhole', y: 0.3 },
    ],
    boss: {
      sprite: 'boss.10',
      name: 'Mama Raccoon',
      voice: 'm',
      hp: 700,
      every: 2.05,
      phases: [
        ['spread5', 'snowballs', 'minions', 'aimed'],
        ['charge', 'mines', 'wall', 'rain', 'ring'],
        ['charge', 'ring', 'snowballs', 'wall', 'mines', 'rain', 'bigtoot'],
      ],
      hull: '#f472b6',
      trim: '#fde047',
    },
    heat: { saucerFire: 0.22, swarmEvery: 3.1, speed: 1.62, weave: 2, armor: 2 },
  },
];

export function stageById(id: number): Stage {
  return STAGES.find((s) => s.id === id) ?? STAGES[0]!;
}

export function nextStage(id: number): Stage | null {
  return STAGES.find((s) => s.id === id + 1) ?? null;
}

/** Stage 1 is always open; beating a stage opens the next. */
export function isStageUnlocked(stars: Record<number, number>, id: number): boolean {
  return id === 1 || (stars[id - 1] ?? 0) > 0;
}
