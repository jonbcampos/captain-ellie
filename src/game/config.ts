/**
 * Every tuning number in the game lives in this file.
 *
 * Units: virtual pixels and seconds. The game simulates in a fixed-height
 * virtual frame and the renderer scales it to the device, so these numbers mean
 * the same thing on every phone. The stage scripts in `stages.ts` are the one
 * exception, as LEVELS are in the siblings: they are a data table, not loose
 * numbers.
 */

// --- Screen -----------------------------------------------------------------
// Same frame and export names as the siblings, so core/viewport.ts is a
// byte-identical copy.

export const DESIGN_W = 480;
export const VIRTUAL_H = 270;
export const MIN_VIRTUAL_W = DESIGN_W;
export const MAX_VIRTUAL_W = 640;
export const SCREEN = { w: DESIGN_W, h: VIRTUAL_H, rotated: false };
/** The frame width the game is tuned at: a modern phone held sideways (GameState.pace). */
export const PACE_WIDTH = 585;
export const MAX_DPR = 2;

// --- Loop -------------------------------------------------------------------

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_TIME = 0.25;

// --- The flyable band -------------------------------------------------------

/** A strip at the top for the shields, the boss bar and the pause button. */
export const BAND_TOP = 26;
export const BAND_BOTTOM = 262;

// --- Ellie's ship -----------------------------------------------------------

export const SHIP = {
  /** Fixed. She only moves up and down in round 1. */
  x: 72,
  /** Drawn size. */
  w: 50,
  h: 28,
  /**
   * The hurtbox is a small circle round the cockpit, well inside the sprite.
   * The runner's rule: a sprite may be bigger than its hitbox, never smaller.
   * A stink bubble that brushes a fin is a hit she'd swear never happened.
   */
  hitRadius: 7,
  /**
   * Finger-to-ship gain. 1 would be "the ship moves exactly as far as the
   * finger", which on a phone held sideways means a thumb sliding the whole
   * height of the screen. A little more than 1 reaches the edges comfortably
   * without feeling twitchy.
   */
  dragGain: 1.25,
  /** Smoothing toward the target, 1/s. High enough to feel attached, low enough to hide jitter. */
  follow: 22,
  /** Keyboard speed, px/s. */
  keySpeed: 190,
  /** How far inside the band the ship's centre may go. */
  margin: 12,
};

// --- Shields --------------------------------------------------------------------

export const SHIELDS = {
  start: 3,
  /**
   * Was 5. With hearts dropping often she could bank five and never feel a
   * hit; first playtest: "she just plays and doesn't work at all".
   */
  max: 4,
  /** Seconds of blinking safety after a hit. */
  invulnerable: 2,
  /** Seconds of safety at the start of a stage and after a retry. */
  spawnSafe: 1.5,
};

// --- Help ---------------------------------------------------------------------------

/**
 * Quiet help after losses, from Jonathan: "If we see her losing again and again
 * maybe up the quantity of hearts that come." Indexed by losses on this stage
 * since she last cleared it (capped at the last entry). Invisible on purpose: no
 * "easy mode" label, just more hearts, and from the second loss an extra shield
 * and a heart floating in as she starts.
 */
export const HELP = {
  heartMult: [1, 2, 3, 4] as readonly number[],
  extraShield: [0, 0, 1, 1] as readonly number[],
  heartOnStart: [false, false, false, true] as readonly boolean[],
};

// --- Weapons --------------------------------------------------------------------

/**
 * Autofire, always. Weapon level only ever goes UP within a stage: losing a
 * shield never costs her the power-up she was proud of catching.
 *
 *  1. one laser
 *  2. two lasers side by side ("Super laser!")
 *  3. two lasers plus a fan of spinning stars ("Star power!")
 */
export const WEAPON = {
  maxLevel: 3,
  /** Seconds between laser volleys. */
  laserEvery: 0.16,
  laserSpeed: 430,
  laserDamage: 1,
  /** Vertical gap between the two lasers at level 2+. */
  doubleGap: 7,
  /** Seconds between star volleys at level 3. */
  starEvery: 0.42,
  starSpeed: 300,
  starDamage: 1,
  /** Fan angles, radians. */
  starAngles: [-0.32, -0.12, 0.12, 0.32] as readonly number[],
  /** Laser hit radius, generous: a near miss on a raccoon still counts. */
  laserRadius: 5,
  starRadius: 6,
};

// --- Enemies ----------------------------------------------------------------------

export type EnemyKind = 'saucer' | 'zipper' | 'tooter' | 'carrier' | 'comet' | 'asteroid' | 'rock';

export interface EnemySpec {
  hp: number;
  /** Collision radius. */
  r: number;
  /** Drawn size. */
  w: number;
  h: number;
  /** Leftward speed, px/s. */
  speed: number;
  score: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  /** The common one: drifts in on a gentle wave. */
  saucer: { hp: 1, r: 12, w: 38, h: 26, speed: 85, score: 100 },
  /** Zips straight across, fast. */
  zipper: { hp: 1, r: 10, w: 36, h: 24, speed: 170, score: 150 },
  /** Slow and chunky; parks on the right and toots stink bubbles. */
  tooter: { hp: 5, r: 17, w: 46, h: 40, speed: 45, score: 400 },
  /** A wobbling gift saucer: always drops a power-up. */
  carrier: { hp: 3, r: 13, w: 40, h: 28, speed: 55, score: 300 },
  /**
   * A space rock the raccoons fling at her height (see HUNTER). Lasers go
   * straight through it: the only way past is to move, or the mega bomb.
   */
  comet: { hp: 1, r: 11, w: 30, h: 30, speed: 165, score: 0 },
  /**
   * A big slow space rock: about four seconds of steady single-laser fire to
   * break (more in later stages, `heat.armor`). It blocks her row, so she
   * either blasts through or flies round it. Breaks into ROCKS little rocks.
   */
  asteroid: { hp: 24, r: 26, w: 64, h: 64, speed: 40, score: 800 },
  /** What an asteroid breaks into: scattering up and down as they come. */
  rock: { hp: 2, r: 9, w: 22, h: 22, speed: 95, score: 50 },
};

/** Little rocks from a broken asteroid, and how hard they scatter (px/s). */
export const ROCKS = { count: 3, scatter: 70 };

// --- Stage hazards ---------------------------------------------------------------
//
// From Jonathan's second play: "not just ships but environmental stuff". These
// are scripted per stage in stages.ts (`hazards`), and none of them can be shot.

/**
 * A black hole drifting slowly across. It pulls her ship towards its height
 * (and bends the stink bubbles' paths), so getting past means flying against
 * it. The pull is always well under what a finger or the keys can do, so it
 * can be out-flown; touching the swirling core costs a shield.
 */
export const BLACK_HOLE = {
  /** Hurt radius of the core. */
  r: 14,
  drawR: 48,
  speed: 30,
  /** Pull on the ship, px/s, at its strongest (level with it, close by). */
  pull: 85,
  /** Horizontal reach of the pull, px. */
  range: 380,
  /**
   * Vertical falloff distance, px: farther above or below, a weaker pull. 120
   * barely faded at all, so passing one even 40px away was a tug-of-war; at 70
   * close is a fight and wide is easy.
   */
  falloff: 70,
  /** Pull on stink bubbles, px/s². */
  bubblePull: 160,
};

/**
 * A giant comet: a flashing red zone covers the top or bottom two thirds of the
 * band for `warn` seconds ("BIG COMET!"), then a comet the size of that zone
 * roars through it. The other third is the only safe place.
 */
export const BIG_COMET = {
  warn: 1.7,
  speed: 330,
  /** Fraction of the band it fills. */
  cover: 0.64,
  /** Length of the burning tail behind the head, px. It hurts too. */
  tail: 240,
};

/** Where a tooter stops and starts tooting, as a fraction of the screen width. */
export const TOOTER_PARK = 0.72;
export const TOOTER_SHOTS = 5;
export const TOOTER_EVERY = 1.15;
export const TOOTER_STAY = 6;

/** The wave path amplitude and speed for saucers. */
export const SAUCER_WAVE = { amp: 26, freq: 1.6 };

// --- Enemy shots ------------------------------------------------------------------

/**
 * Stink bubbles: BIG, SLOW and bright, so a five-year-old sees them coming
 * and has time to move. They're the only thing that shoots at her.
 */
export const BUBBLE = {
  speed: 72,
  /** Collision radius: half the 12px drawn cloud, so a graze is a miss. */
  r: 6,
  drawR: 12,
  /**
   * How much a bubble aims at her: 1 is straight at where she is now. It was
   * 0.6, which with formations arriving in the middle meant a ship parked
   * mid-screen was never in the way of anything (see HUNTER).
   */
  aim: 1,
};

/**
 * Hunters: comets that fly straight in at whatever height she is at when they
 * appear, a few every stage. They're the reason she has to move.
 *
 * The first playtest found a ship that never moves clearing all five stages
 * with 0-2 hits: every wave flies into her lasers and nothing came for her.
 * Hunters were first zippers aimed at her, and a ship parked mid-screen still
 * won untouched, because autofire pops anything flying along her own row. So
 * they're comets, which lasers don't stop. A hunter is dodged by sliding a ship's width either way, and it's telegraphed
 * by a flashing arrow at the right edge for `warn` seconds before it arrives.
 */
export const HUNTER = {
  warn: 0.9,
};

// --- Pickups ---------------------------------------------------------------------

export type PickupKind = 'weapon' | 'heart' | 'bomb' | 'star';

export const PICKUP = {
  r: 11,
  /** Pickups drift left slowly and bob, so they're easy to fly into. */
  speed: 40,
  /**
   * Chance a destroyed enemy drops a heart when she's below full shields.
   * "Hearts drop often" was the brief.
   */
  heartChance: 0.05,
  /** Hearts are more generous the lower she is. Halved after the first playtest (see SHIELDS.max). */
  heartChanceAtOne: 0.15,
  /** Little score star from every kill, purely for sparkle. */
};

/** The mega bomb: a shockwave that clears the screen. */
export const BOMB = {
  /** Seconds for the ring to cross the screen. */
  duration: 0.7,
  bossDamage: 18,
};

// --- Bosses -------------------------------------------------------------------------

export const BOSS = {
  /** Where the boss hovers, as a fraction of screen width (centre). */
  parkX: 0.8,
  enterSpeed: 60,
  /** Drawn size; the hitbox is an ellipse inside it. */
  w: 140,
  h: 105,
  hitRX: 52,
  hitRY: 40,
  /**
   * Vertical drift. Slow on purpose: a laser takes most of a second to reach
   * the boss, and at the first tuning (70px at 0.35Hz) the boss had moved out
   * of the way of three shots in four by the time they arrived. verify() caught
   * it as the later bosses taking over a minute with the base laser.
   */
  bobAmp: 55,
  bobFreq: 0.2,
  /** Seconds of the victory boom chain. */
  deathTime: 3.2,
  /** Explosions in the chain. */
  deathBooms: 14,
  /** Score for a boss. */
  score: 5000,
  /**
   * Phases, from Jonathan's first play: "the bosses die so fast you barely
   * have to dodge one attack". A boss now has three phases (above 2/3 health,
   * above 1/3, the rest). Each is faster to attack and bobs faster.
   */
  phaseSpeed: [1, 0.86, 0.78] as readonly number[],
  phaseBob: [1, 1.4, 1.8] as readonly number[],
  /** The charge: shake in place, lunge along her row, glide back. Seconds. */
  /** 0.85 at first; the bot (and Jonathan) were caught too often on narrow screens. */
  chargeWindup: 1.1,
  chargeLunge: 0.55,
  chargeBack: 0.9,
  /** How far left the lunge reaches: just short of the ship's nose would be no threat, so past it. */
  chargeReachX: 40,
  /** The wall's gap, px: about two and a half ships tall. */
  wallGap: 68,
  wallSpacing: 22,
  rainCount: 5,
  /** Horizontal gap between drops, px, and how steeply they fall (vy / |vx|). */
  rainSpacing: 70,
  rainSlope: 0.75,
  /** Mines: how slowly they drift in, how long until they burst, and into how many bubbles. */
  mineSpeed: 32,
  mineFuse: 2.6,
  mineBurst: 6,
  ringCount: 10,
  /**
   * A gift saucer flies in this often during a boss fight. Losing resets her to
   * one laser, and without these a retry at the boss would be a three-minute slog.
   */
  giftEvery: 15,
};

// --- Stage flow -----------------------------------------------------------------------

/** Seconds of the "Stage 1: Moon Meadow" banner before the first wave. */
export const STAGE_INTRO = 2.4;
/** Seconds after the boss chain finishes before the result panel. */
export const CLEAR_DELAY = 1.4;
/** Hits taken, at most, for each star count. */
export const STAR_HITS = { three: 1, two: 4 };
/**
 * Running out of shields costs her the weapon level: a retry starts with the
 * single laser again. Losing has to cost something she cares about, or there's
 * no reason to dodge (first playtest).
 */
export const LOSE_KEEPS_WEAPON = false;

// --- Feel ---------------------------------------------------------------------------

/** Slow motion after a big blast, as in slingshot. */
export const BOOM_SLOWMO = 0.7;
export const BOOM_TIME_SCALE = 0.4;
/** Scrolling speed of the near starfield, px/s. The far layers are fractions of it. */
export const SCROLL_SPEED = 110;

// --- The imagination transition --------------------------------------------------------

/** Seconds of the cardboard-box-to-rocket starburst. */
export const WARP_TIME = 2.2;

// --- Pools ------------------------------------------------------------------------------

export const POOL = {
  shots: 96,
  enemies: 56,
  bubbles: 96,
  pickups: 12,
  events: 128,
};
