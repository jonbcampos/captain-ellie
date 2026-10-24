/**
 * The simulation: Ellie's ship, her shots, the raccoon ships, their stink
 * bubbles, the pickups and the boss.
 *
 * Pure game logic, in virtual pixels. It never imports from `src/render/`, and
 * it reports what happened through an event queue that `main.ts` drains into
 * particles, voices and sound, as in every sibling. Everything lives in fixed
 * pools allocated once, so a busy boss fight allocates nothing.
 *
 * Nobody is ever hurt. A popped raccoon ship is reported as a `poof`, and the
 * renderer turns that into a puff of stars and a raccoon floating away in a
 * bubble helmet, waving.
 */

import { Rng } from '../core/rng';
import {
  BAND_BOTTOM,
  BAND_TOP,
  BOMB,
  BOSS,
  BUBBLE,
  CLEAR_DELAY,
  BIG_COMET,
  BLACK_HOLE,
  ENEMIES,
  HELP,
  PACE_WIDTH,
  HUNTER,
  LOSE_KEEPS_WEAPON,
  PICKUP,
  POOL,
  ROCKS,
  SAUCER_WAVE,
  SCREEN,
  SHIELDS,
  SHIP,
  STAGE_INTRO,
  STAR_HITS,
  TOOTER_EVERY,
  TOOTER_PARK,
  TOOTER_SHOTS,
  TOOTER_STAY,
  WEAPON,
  type EnemyKind,
  type PickupKind,
} from './config';
import { STAGES, type BossAttack, type Path, type Stage } from './stages';

export type Phase = 'title' | 'select' | 'warp' | 'play' | 'paused' | 'cleared' | 'lost';

export interface Shot {
  alive: boolean;
  kind: 'laser' | 'star';
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
}

export interface Enemy {
  alive: boolean;
  kind: EnemyKind;
  x: number;
  y: number;
  /** The height the path is centred on. */
  baseY: number;
  path: Path;
  hp: number;
  /** Seconds alive. */
  t: number;
  /** Seconds of white hit-flash left. */
  flash: number;
  /** Tooters: bubbles left, and the clock to the next. */
  shots: number;
  clock: number;
  /** Tooters: seconds parked. */
  parked: number;
  /** Seconds of teasing pose left (tongue out, thumbs in ears). */
  tease: number;
  drop: PickupKind | null;
  /** Random phase, so a line of saucers doesn't wave in lockstep. */
  seed: number;
  /** Rocks from a broken asteroid drift up or down as they come (path 'scatter'). */
  vy: number;
}

export interface BlackHole {
  active: boolean;
  x: number;
  y: number;
  t: number;
}

export interface BigComet {
  /** Warning (the red zone flashes), flying, or not happening. */
  phase: 'none' | 'warn' | 'fly';
  /** The zone it fills, top to bottom. */
  y0: number;
  y1: number;
  /** Head position once flying. */
  x: number;
  t: number;
}

export interface Bubble {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  /** Which of the eight painted clouds it is. */
  look: number;
  big: boolean;
  /**
   * What it is. Stink bubbles from the raccoons; lava blobs from an eruption
   * (world 2); snowballs, which bounce off the top and bottom at full speed; and
   * mines, which drift slowly and then burst into a ring of stink bubbles.
   */
  kind: BubbleKind;
  /** Mines: seconds until it bursts. */
  fuse: number;
}

export type BubbleKind = 'stink' | 'lava' | 'snow' | 'mine';

export interface Pickup {
  alive: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  t: number;
}

export type BossPhase = 'none' | 'enter' | 'fight' | 'dying' | 'gone';

export interface Boss {
  phase: BossPhase;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  t: number;
  clock: number;
  attack: number;
  flash: number;
  /** Seconds into the victory chain. */
  dying: number;
  booms: number;
  /** 0, 1 or 2: angrier as her health drops (BOSS.phaseSpeed). */
  rage: number;
  /** The charge in progress: windup, lunge, back, or none. */
  charge: 'none' | 'windup' | 'lunge' | 'back';
  chargeT: number;
  chargeY: number;
  /** Seconds to the next gift saucer during the fight. */
  gift: number;
}

export type EventKind =
  | 'shoot'
  | 'star-shot'
  | 'hit'
  | 'poof'
  | 'escape'
  | 'tease'
  | 'toot'
  | 'pickup'
  | 'hurt'
  | 'bomb'
  | 'boss-enter'
  | 'boss-attack'
  | 'boss-rage'
  | 'hazard'
  | 'mine'
  | 'boss-hit'
  | 'boss-boom'
  | 'boss-dead'
  | 'checkpoint'
  | 'warn'
  | 'cleared'
  | 'lost';

export interface GameEvent {
  kind: EventKind;
  x: number;
  y: number;
  /** Event-specific: enemy kind, pickup kind, attack name… */
  tag: string;
  value: number;
}

export interface Ship {
  y: number;
  prevY: number;
  /** Where the finger (or keys) want the ship. */
  targetY: number;
  shields: number;
  /** Seconds of blinking safety left. */
  safe: number;
  weapon: number;
  laserClock: number;
  starClock: number;
  /** What face Ellie is pulling, and for how long. */
  mood: 'fly' | 'cheer' | 'oops' | 'wow' | 'brave';
  moodTime: number;
}

const bandH = BAND_BOTTOM - BAND_TOP;
export const shipMinY = BAND_TOP + SHIP.margin;
export const shipMaxY = BAND_BOTTOM - SHIP.margin;

/** A 0..1 band fraction to a y position. */
export function bandY(f: number): number {
  return BAND_TOP + f * bandH;
}

export class GameState {
  phase: Phase = 'title';
  pausedFrom: Phase = 'play';
  stage: Stage = STAGES[0]!;
  /** Seconds since the stage started (or resumed from a checkpoint). */
  time = 0;
  /** Seconds the result panel / lost panel has been waiting. */
  endTime = 0;
  score = 0;
  hits = 0;
  stars = 0;
  /** The stage time a retry restarts from. */
  checkpoint = 0;
  /** True once the boss has arrived: a retry restarts at the boss. */
  reachedBoss = false;
  /** Seconds the mega-bomb ring has been expanding, or -1. */
  bombT = -1;
  bombX = 0;
  bombY = 0;
  /** Index of the next scripted spawn. */
  private next = 0;
  /** Seconds to the next extra swarm (Stage.heat). */
  private swarm = 0;
  private bombHitBoss = false;

  readonly ship: Ship = {
    y: bandY(0.5),
    prevY: bandY(0.5),
    targetY: bandY(0.5),
    shields: SHIELDS.start,
    safe: 0,
    weapon: 1,
    laserClock: 0,
    starClock: 0,
    mood: 'fly',
    moodTime: 0,
  };
  readonly shots: Shot[] = [];
  readonly enemies: Enemy[] = [];
  readonly bubbles: Bubble[] = [];
  readonly pickups: Pickup[] = [];
  /**
   * Hunters on their way: aimed at her height when the warning went up, they
   * arrive `HUNTER.warn` seconds later. The renderer flashes an arrow at the
   * right edge for each one, so she has time to slide out of the way.
   */
  readonly holes: BlackHole[] = Array.from({ length: 3 }, () => ({ active: false, x: 0, y: 0, t: 0 }));
  readonly bigComet: BigComet = { phase: 'none', y0: 0, y1: 0, x: 0, t: 0 };
  /**
   * How far a black hole pulled the ship's target this tick. main.ts adds it to
   * its drag anchor, so the pull is felt even while her finger is down.
   */
  pullDY = 0;
  /** Losses on this stage since she last cleared it (HELP). Set by main.ts from the save. */
  help = 0;
  /** Every bubble ever fired, for __game.feel(). */
  bubblesFired = 0;
  private nextHazard = 0;
  readonly warnings: { active: boolean; y: number; left: number }[] = Array.from({ length: 8 }, () => ({ active: false, y: 0, left: 0 }));
  readonly boss: Boss = {
    phase: 'none', x: 0, y: 0, hp: 0, maxHp: 1, t: 0, clock: 0, attack: 0, flash: 0, dying: 0, booms: 0,
    rage: 0, charge: 'none', chargeT: 0, chargeY: 0, gift: 0,
  };

  private readonly events: GameEvent[] = [];
  private eventCount = 0;
  private rng = new Rng(1);

  /** Dev/verify: no damage to the ship. */
  invincible = false;

  constructor() {
    for (let i = 0; i < POOL.shots; i++) this.shots.push({ alive: false, kind: 'laser', x: 0, y: 0, vx: 0, vy: 0, spin: 0 });
    for (let i = 0; i < POOL.enemies; i++) {
      this.enemies.push({
        alive: false, kind: 'saucer', x: 0, y: 0, baseY: 0, path: 'wave', hp: 0, t: 0, flash: 0,
        shots: 0, clock: 0, parked: 0, tease: 0, drop: null, seed: 0, vy: 0,
      });
    }
    for (let i = 0; i < POOL.bubbles; i++) this.bubbles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, look: 0, big: false, kind: 'stink', fuse: 0 });
    for (let i = 0; i < POOL.pickups; i++) this.pickups.push({ alive: false, kind: 'heart', x: 0, y: 0, t: 0 });
    for (let i = 0; i < POOL.events; i++) this.events.push({ kind: 'hit', x: 0, y: 0, tag: '', value: 0 });
  }

  // --- Stage flow ---------------------------------------------------------------

  /** Start a stage from the top. */
  /** `seed` is for verify(): playtesting the same stage with different luck. */
  load(stage: Stage, seed = 0): void {
    this.stage = stage;
    this.score = 0;
    this.hits = 0;
    this.stars = 0;
    this.checkpoint = 0;
    this.reachedBoss = false;
    this.ship.weapon = 1;
    this.rng = new Rng(stage.id * 7919 + seed * 104729);
    this.resume(0);
  }

  /** Restart from the last checkpoint, with full shields, and the weapon back to one laser (LOSE_KEEPS_WEAPON). */
  retry(): void {
    if (!LOSE_KEEPS_WEAPON) this.ship.weapon = 1;
    this.resume(this.reachedBoss ? this.stage.length : this.checkpoint);
  }

  private resume(from: number): void {
    this.time = from === 0 ? -STAGE_INTRO : from - 1.2;
    this.next = this.stage.spawns.findIndex((s) => s.t >= from);
    if (this.next < 0) this.next = this.stage.spawns.length;
    this.nextHazard = this.stage.hazards.findIndex((h) => h.t >= from);
    if (this.nextHazard < 0) this.nextHazard = this.stage.hazards.length;
    for (const h of this.holes) h.active = false;
    this.bigComet.phase = 'none';
    this.pullDY = 0;
    for (const s of this.shots) s.alive = false;
    for (const e of this.enemies) e.alive = false;
    for (const b of this.bubbles) b.alive = false;
    for (const p of this.pickups) p.alive = false;
    for (const w of this.warnings) w.active = false;
    this.swarm = this.stage.heat.swarmEvery;
    this.boss.phase = 'none';
    this.bombT = -1;
    const ship = this.ship;
    ship.y = ship.prevY = ship.targetY = bandY(0.5);
    const help = Math.min(this.help, HELP.heartMult.length - 1);
    ship.shields = SHIELDS.start + HELP.extraShield[help]!;
    ship.safe = SHIELDS.spawnSafe;
    ship.laserClock = 0;
    ship.starClock = 0;
    ship.mood = 'brave';
    ship.moodTime = 1.5;
    this.endTime = 0;
    this.phase = 'play';
    if (HELP.heartOnStart[help]) this.dropPickup('heart', SCREEN.w * 0.75, bandY(0.5));
  }

  /** The intro banner is up while time is negative. */
  get intro(): boolean {
    return this.time < 0;
  }

  // --- Input ----------------------------------------------------------------------

  setTarget(y: number): void {
    this.ship.targetY = clamp(y, shipMinY, shipMaxY);
  }

  // --- Update ---------------------------------------------------------------------

  update(dt: number): void {
    if (this.phase !== 'play' && this.phase !== 'cleared' && this.phase !== 'lost') return;
    const ship = this.ship;
    ship.prevY = ship.y;

    if (this.phase === 'lost') {
      // The world keeps drifting behind the "Oopsie!" panel rather than
      // freezing mid-shot; nothing collides any more.
      this.endTime += dt;
      this.moveShots(dt);
      this.moveEnemies(dt);
      this.moveBubbles(dt);
      return;
    }

    this.time += dt;
    // The ship follows the target with exponential smoothing: attached to the
    // finger, without passing on every tremble of it.
    const k = 1 - Math.exp(-SHIP.follow * dt);
    ship.y += (ship.targetY - ship.y) * k;
    ship.y = clamp(ship.y, shipMinY, shipMaxY);
    ship.safe = Math.max(0, ship.safe - dt);
    ship.moodTime -= dt;
    if (ship.moodTime <= 0) ship.mood = 'fly';

    if (this.phase === 'cleared') {
      this.endTime += dt;
      this.moveShots(dt);
      this.movePickups(dt);
      return;
    }

    if (!this.intro) {
      this.fire(dt);
      this.spawnScripted();
      this.spawnHazards();
      this.updateSwarm(dt);
      this.updateWarnings(dt);
      this.updateBossArrival();
    }
    this.moveShots(dt);
    this.moveEnemies(dt);
    this.moveBubbles(dt);
    this.movePickups(dt);
    this.updateBoss(dt);
    this.updateBomb(dt);
    this.updateHazards(dt);
    this.collide();

    if (!this.reachedBoss && this.checkpoint < this.stage.checkpoint && this.time >= this.stage.checkpoint) {
      this.checkpoint = this.stage.checkpoint;
      this.emit('checkpoint', SHIP.x, ship.y, '', 0);
    }
  }

  private fire(dt: number): void {
    const ship = this.ship;
    ship.laserClock -= dt;
    if (ship.laserClock <= 0) {
      ship.laserClock += WEAPON.laserEvery;
      const x = SHIP.x + SHIP.w * 0.45;
      if (ship.weapon >= 2) {
        this.spawnShot('laser', x, ship.y - WEAPON.doubleGap / 2, WEAPON.laserSpeed, 0);
        this.spawnShot('laser', x, ship.y + WEAPON.doubleGap / 2, WEAPON.laserSpeed, 0);
      } else {
        this.spawnShot('laser', x, ship.y, WEAPON.laserSpeed, 0);
      }
      this.emit('shoot', x, ship.y, '', ship.weapon);
    }
    if (ship.weapon >= 3) {
      ship.starClock -= dt;
      if (ship.starClock <= 0) {
        ship.starClock += WEAPON.starEvery;
        for (const a of WEAPON.starAngles) {
          this.spawnShot('star', SHIP.x + 10, ship.y, Math.cos(a) * WEAPON.starSpeed, Math.sin(a) * WEAPON.starSpeed);
        }
        this.emit('star-shot', SHIP.x, ship.y, '', 0);
      }
    }
  }

  private spawnShot(kind: Shot['kind'], x: number, y: number, vx: number, vy: number): void {
    const s = this.shots.find((s) => !s.alive);
    if (!s) return;
    s.alive = true;
    s.kind = kind;
    s.x = x;
    s.y = y;
    s.vx = vx;
    s.vy = vy;
    s.spin = this.rng.range(0, Math.PI * 2);
  }

  private spawnScripted(): void {
    const spawns = this.stage.spawns;
    while (this.next < spawns.length && spawns[this.next]!.t <= this.time) {
      const s = spawns[this.next++]!;
      if (s.path === 'hunt') {
        const w = this.warnings.find((w) => !w.active);
        if (w) {
          w.active = true;
          w.y = clamp(this.ship.y, BAND_TOP + ENEMIES[s.kind].r, BAND_BOTTOM - ENEMIES[s.kind].r);
          w.left = HUNTER.warn;
          this.emit('warn', SCREEN.w, w.y, s.kind, 0);
        }
        continue;
      }
      this.spawnEnemy(s.kind, SCREEN.w + ENEMIES[s.kind].w, bandY(s.y), s.path, s.drop ?? null);
    }
  }

  /** An extra trio of saucers at a random height, every `heat.swarmEvery` seconds of waves. */
  private updateSwarm(dt: number): void {
    if (this.boss.phase !== 'none' || this.time > this.stage.length - 3) return;
    this.swarm -= dt;
    if (this.swarm > 0) return;
    this.swarm = this.stage.heat.swarmEvery;
    const y = bandY(this.rng.range(0.15, 0.85));
    const path: Path = this.rng.next() < 0.5 ? 'wave' : 'dive';
    for (let i = 0; i < 3; i++) this.spawnEnemy('saucer', SCREEN.w + ENEMIES.saucer.w + i * 34, y, path, null);
  }

  private updateWarnings(dt: number): void {
    for (const w of this.warnings) {
      if (!w.active) continue;
      w.left -= dt;
      if (w.left > 0) continue;
      w.active = false;
      this.spawnEnemy('comet', SCREEN.w + ENEMIES.comet.w * 0.5, w.y, 'hunt', null);
    }
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number, path: Path, drop: PickupKind | null): Enemy | null {
    const e = this.enemies.find((e) => !e.alive);
    if (!e) return null;
    const spec = ENEMIES[kind];
    e.alive = true;
    e.kind = kind;
    e.x = x;
    e.y = e.baseY = y;
    e.path = path;
    const armor = this.stage.heat.armor;
    e.hp = spec.hp + (kind === 'saucer' || kind === 'zipper' ? armor : kind === 'asteroid' ? armor * 4 : 0);
    e.vy = 0;
    e.t = 0;
    e.flash = 0;
    e.shots = TOOTER_SHOTS;
    e.clock = TOOTER_EVERY * 0.5;
    e.parked = 0;
    e.tease = 0;
    e.drop = drop;
    e.seed = this.rng.range(0, Math.PI * 2);
    return e;
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.spin += dt * 9;
      if (s.x > SCREEN.w + 20 || s.y < BAND_TOP - 20 || s.y > BAND_BOTTOM + 20) s.alive = false;
    }
  }

  /**
   * How fast the world runs on this screen. The frame is 480-640 virtual px wide
   * depending on the phone's shape, and on a narrow one everything reaches her
   * sooner: measured, a 480-wide frame gave about 25% less time to react and the
   * game played clearly harder than on a modern 585-wide phone. So raccoons and
   * bubbles move proportionally slower on narrow frames, and the reaction time
   * is the same on every phone. Wide frames run at full speed.
   */
  pace(): number {
    return clamp(SCREEN.w / PACE_WIDTH, 0.8, 1);
  }

  private moveEnemies(dt0: number): void {
    const ship = this.ship;
    const dt = dt0 * this.pace();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const spec = ENEMIES[e.kind];
      e.t += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.tease = Math.max(0, e.tease - dt);

      if (e.kind === 'tooter') {
        const park = SCREEN.w * TOOTER_PARK;
        if (e.x > park && e.parked === 0) {
          e.x -= spec.speed * dt;
        } else {
          e.parked += dt;
          if (e.parked > TOOTER_STAY || e.shots <= 0) e.x -= spec.speed * 1.6 * dt;
          e.clock -= dt;
          if (e.shots > 0 && e.clock <= 0 && e.parked > 0.4) {
            e.clock = TOOTER_EVERY;
            e.shots--;
            this.tootAt(e.x - spec.w * 0.45, e.y, ship.y, false);
            this.emit('toot', e.x, e.y, 'tooter', 0);
          }
        }
        e.y = e.baseY + Math.sin(e.t * 1.3 + e.seed) * 8;
      } else {
        // Comets keep their own speed: their warning arrow is timed to it.
        const heat = e.kind === 'comet' || e.kind === 'asteroid' || e.kind === 'rock' ? 1 : this.stage.heat.speed;
        const base = spec.speed * heat;
        const speed = e.path === 'dive' && e.x < SCREEN.w * 0.7 ? base * 1.15 : base;
        e.x -= speed * dt;
        if (e.path === 'wave' || e.kind === 'carrier') {
          const amp = SAUCER_WAVE.amp * (e.kind === 'carrier' ? 1 : this.stage.heat.weave);
          e.y = e.baseY + Math.sin(e.t * SAUCER_WAVE.freq * 2 * heat + e.seed) * amp;
        } else if (e.path === 'scatter') {
          e.y += e.vy * dt;
          e.vy *= Math.exp(-1.2 * dt);
          if ((e.y < BAND_TOP + spec.r && e.vy < 0) || (e.y > BAND_BOTTOM - spec.r && e.vy > 0)) e.vy = -e.vy;
        } else if (e.path === 'dive' && e.x < SCREEN.w * 0.75) {
          // Curve towards her, but never faster than she can move away.
          e.baseY += clamp(ship.y - e.baseY, -1, 1) * 55 * heat * dt;
          e.y = e.baseY;
        }
      }
      e.y = clamp(e.y, BAND_TOP + spec.r, BAND_BOTTOM - spec.r);

      // Saucers shoot back, more in later stages, but only from out in front of her.
      if (e.kind === 'saucer' && this.phase === 'play' && e.x < SCREEN.w * 0.92 && e.x > SHIP.x + 110 && this.rng.next() < this.stage.heat.saucerFire * dt) {
        this.tootAt(e.x - spec.w * 0.4, e.y, ship.y, false);
        this.emit('toot', e.x, e.y, 'saucer', 0);
      }

      // Now and then a saucer near her sticks its tongue out.
      if (e.kind === 'saucer' && e.tease === 0 && e.x < SCREEN.w * 0.8 && this.rng.next() < dt * 0.12) {
        e.tease = 1.2;
        this.emit('tease', e.x, e.y, e.kind, 0);
      }

      if (e.x < -spec.w) {
        e.alive = false;
        this.emit('escape', 0, e.y, e.kind, 0);
      }
    }
  }

  /** A stink bubble from (x, y), aimed loosely at `targetY`. */
  private tootAt(x: number, y: number, targetY: number, big: boolean, angle = 0): void {
    const b = this.bubbles.find((b) => !b.alive);
    if (!b) return;
    this.bubblesFired++;
    const dx = Math.max(60, x - SHIP.x);
    const aim = Math.atan2(targetY - y, dx) * BUBBLE.aim + angle;
    const speed = BUBBLE.speed * (big ? 0.8 : 1);
    b.alive = true;
    b.x = x;
    b.y = y;
    b.vx = -Math.cos(aim) * speed;
    b.vy = Math.sin(aim) * speed;
    b.t = 0;
    b.look = this.rng.int(0, 7);
    b.big = big;
    b.kind = 'stink';
    b.fuse = 0;
  }

  /**
   * A bubble with an exact velocity. `delay` holds it invisible for a moment,
   * so rain falls as a ripple rather than a line.
   */
  private launchBubble(x: number, y: number, vx: number, vy: number, big: boolean, delay = 0, kind: BubbleKind = 'stink'): Bubble | null {
    const b = this.bubbles.find((b) => !b.alive);
    if (!b) return null;
    this.bubblesFired++;
    b.alive = true;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.t = -delay;
    b.look = this.rng.int(0, 7);
    b.big = big;
    b.kind = kind;
    b.fuse = 0;
    return b;
  }

  /** A mine going off: a ring of stink bubbles, with a gap aimed away from nowhere in particular. */
  private burstMine(x: number, y: number): void {
    const n = BOSS.mineBurst;
    const turn = this.rng.next();
    for (let i = 0; i < n; i++) {
      const a = ((i + turn) / n) * Math.PI * 2;
      this.launchBubble(x, y, Math.cos(a) * BUBBLE.speed * 0.9, Math.sin(a) * BUBBLE.speed * 0.9, false);
    }
    this.emit('mine', x, y, '', 0);
  }

  private moveBubbles(dt0: number): void {
    const dt = dt0 * this.pace();
    for (const b of this.bubbles) {
      if (!b.alive) continue;
      b.t += dt;
      if (b.t < 0) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt + (b.kind === 'stink' ? Math.sin(b.t * 3) * 6 * dt : 0);
      if (b.kind === 'snow') {
        // Snowballs bounce off the top and bottom at full speed.
        if ((b.y < BAND_TOP + 8 && b.vy < 0) || (b.y > BAND_BOTTOM - 8 && b.vy > 0)) b.vy = -b.vy;
      } else if (b.kind === 'lava') {
        // Lava arcs up and off the top.
        if (b.y < BAND_TOP - 10) b.alive = false;
      } else if (b.y > BAND_BOTTOM && b.vy > BUBBLE.speed * 0.5) {
        // Rain (falling fast) drains away at the bottom; everything else bounces
        // off the edges of the band, as the stink bubbles always have.
        b.alive = false;
      } else if ((b.y < BAND_TOP && b.vy < 0) || (b.y > BAND_BOTTOM && b.vy > 0)) {
        b.vy = -b.vy * 0.6;
      }
      if (b.kind === 'mine') {
        b.fuse -= dt;
        if (b.fuse <= 0) {
          b.alive = false;
          this.burstMine(b.x, b.y);
          continue;
        }
      }
      if (b.x < -20 || b.x > SCREEN.w + 30) b.alive = false;
    }
  }

  private movePickups(dt: number): void {
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.t += dt;
      // Drift towards her height a little: easy to catch, still a catch.
      p.x -= PICKUP.speed * dt;
      p.y += clamp(this.ship.y - p.y, -1, 1) * 10 * dt;
      if (p.x < -20) p.alive = false;
      // Magnet once close.
      const dx = SHIP.x - p.x;
      const dy = this.ship.y - p.y;
      if (dx * dx + dy * dy < 60 * 60) {
        p.x += dx * 3 * dt;
        p.y += dy * 3 * dt;
      }
    }
  }

  dropPickup(kind: PickupKind, x: number, y: number): void {
    const p = this.pickups.find((p) => !p.alive);
    if (!p) return;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = clamp(y, BAND_TOP + 14, BAND_BOTTOM - 14);
    p.t = 0;
  }

  // --- The boss ---------------------------------------------------------------------

  private updateBossArrival(): void {
    if (this.boss.phase !== 'none' || this.time < this.stage.length) return;
    // Wait for the last stragglers, but never long.
    const busy = this.enemies.some((e) => e.alive && e.x > SCREEN.w * 0.3);
    if (busy && this.time < this.stage.length + 5) return;
    const boss = this.boss;
    const spec = this.stage.boss;
    boss.phase = 'enter';
    boss.x = SCREEN.w + BOSS.w * 0.6;
    boss.y = bandY(0.5);
    boss.hp = boss.maxHp = spec.hp;
    boss.t = 0;
    boss.clock = 2.5;
    boss.attack = 0;
    boss.flash = 0;
    boss.dying = 0;
    boss.booms = 0;
    boss.rage = 0;
    boss.charge = 'none';
    boss.gift = BOSS.giftEvery * 0.5;
    this.reachedBoss = true;
    this.emit('boss-enter', boss.x, boss.y, spec.name, 0);
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (boss.phase === 'none' || boss.phase === 'gone') return;
    const spec = this.stage.boss;
    boss.t += dt;
    boss.flash = Math.max(0, boss.flash - dt);
    const parkX = SCREEN.w * BOSS.parkX;

    if (boss.phase === 'enter') {
      boss.x -= BOSS.enterSpeed * dt;
      if (boss.x <= parkX) {
        boss.x = parkX;
        boss.phase = 'fight';
        boss.t = 0;
      }
      return;
    }

    if (boss.phase === 'dying') {
      boss.dying += dt;
      boss.y += Math.sin(boss.dying * 30) * 0.6;
      boss.x += 8 * dt;
      // The chain: booms all over the ship, closer together towards the end,
      // then one giant one.
      const due = Math.floor((boss.dying / BOSS.deathTime) ** 0.8 * BOSS.deathBooms);
      while (boss.booms < due && boss.booms < BOSS.deathBooms) {
        boss.booms++;
        const ox = this.rng.range(-BOSS.hitRX, BOSS.hitRX);
        const oy = this.rng.range(-BOSS.hitRY, BOSS.hitRY);
        this.emit('boss-boom', boss.x + ox, boss.y + oy, '', 0.9 + this.rng.next() * 0.6);
      }
      if (boss.dying >= BOSS.deathTime) {
        boss.phase = 'gone';
        this.emit('boss-boom', boss.x, boss.y, 'final', 2.2);
        this.emit('boss-dead', boss.x, boss.y, spec.name, 0);
        this.score += BOSS.score;
        this.phase = 'cleared';
        this.endTime = -CLEAR_DELAY;
        this.stars = this.hits <= STAR_HITS.three ? 3 : this.hits <= STAR_HITS.two ? 2 : 1;
        for (const b of this.bubbles) b.alive = false;
        for (const e of this.enemies) if (e.alive) this.poof(e, false);
        this.emit('cleared', boss.x, boss.y, '', this.stars);
      }
      return;
    }

    // Fight: angrier as her health drops.
    const rage = boss.hp > boss.maxHp * (2 / 3) ? 0 : boss.hp > boss.maxHp / 3 ? 1 : 2;
    if (rage > boss.rage) {
      boss.rage = rage;
      boss.attack = 0;
      boss.clock = Math.min(boss.clock, 1.2);
      this.emit('boss-rage', boss.x, boss.y, spec.name, rage);
    }

    if (boss.charge !== 'none') {
      this.updateCharge(dt, parkX);
    } else {
      // Bob up and down. `t` only advances while bobbing, so a charge picks up where it left off.
      boss.y = bandY(0.5) + Math.sin(boss.t * BOSS.bobFreq * BOSS.phaseBob[rage]! * Math.PI * 2) * Math.min(BOSS.bobAmp, (BAND_BOTTOM - BAND_TOP) / 2 - BOSS.hitRY);
      boss.x = parkX + Math.sin(boss.t * 0.5) * 12;
      boss.clock -= dt;
      if (boss.clock <= 0) {
        boss.clock = spec.every * BOSS.phaseSpeed[rage]!;
        const attacks = spec.phases[rage]!;
        this.bossAttack(attacks[boss.attack++ % attacks.length]!);
      }
    }

    // A gift saucer now and then, carrying the laser back if a retry took it.
    boss.gift -= dt;
    if (boss.gift <= 0) {
      boss.gift = BOSS.giftEvery;
      // Struggling (HELP): the boss fight's gift is a heart whenever she's not full.
      const drop: PickupKind =
        this.help > 0 && this.ship.shields < SHIELDS.start ? 'heart' : this.ship.weapon < WEAPON.maxLevel ? 'weapon' : this.ship.shields < 2 ? 'heart' : 'star';
      this.spawnEnemy('carrier', SCREEN.w + ENEMIES.carrier.w, bandY(this.rng.next() < 0.5 ? 0.15 : 0.85), 'wave', drop);
    }
  }

  /**
   * The charge: shake in place at her height (the telegraph), lunge along that
   * row past her ship, then glide back to its post.
   */
  private updateCharge(dt: number, parkX: number): void {
    const boss = this.boss;
    boss.chargeT += dt;
    const reach = SHIP.x - BOSS.chargeReachX + BOSS.hitRX;
    if (boss.charge === 'windup') {
      // Drift to her row while shaking, so the lunge is aimed and readable.
      boss.y += (boss.chargeY - boss.y) * Math.min(1, dt * 6);
      boss.x = parkX + Math.sin(boss.chargeT * 60) * 3;
      if (boss.chargeT >= BOSS.chargeWindup) {
        boss.charge = 'lunge';
        boss.chargeT = 0;
        this.emit('boss-attack', boss.x, boss.y, 'lunge', 0);
      }
    } else if (boss.charge === 'lunge') {
      const k = Math.min(1, boss.chargeT / BOSS.chargeLunge);
      boss.x = parkX + (reach - parkX) * (k * k);
      if (k >= 1) {
        boss.charge = 'back';
        boss.chargeT = 0;
      }
    } else {
      const k = Math.min(1, boss.chargeT / BOSS.chargeBack);
      boss.x = reach + (parkX - reach) * (1 - (1 - k) * (1 - k));
      if (k >= 1) boss.charge = 'none';
    }
  }

  private bossAttack(attack: BossAttack): void {
    const boss = this.boss;
    const mouthX = boss.x - BOSS.hitRX;
    const y = this.ship.y;
    switch (attack) {
      // Spreads are centred on HER, not on the boss: a ship parked level with
      // the boss's middle used to sit in the gap of every spread.
      case 'spread3':
        for (const a of [-0.35, 0, 0.35]) this.tootAt(mouthX, boss.y, y, false, a);
        break;
      case 'spread5':
        for (const a of [-0.6, -0.3, 0, 0.3, 0.6]) this.tootAt(mouthX, boss.y, y, false, a);
        break;
      case 'aimed':
        for (let i = 0; i < 3; i++) this.tootAt(mouthX - i * 18, boss.y, y, false);
        break;
      case 'bigtoot':
        this.tootAt(mouthX, boss.y, y, true);
        break;
      case 'minions':
        for (const f of [0.2, 0.8]) this.spawnEnemy('saucer', boss.x, bandY(f), 'wave', null);
        break;
      case 'charge':
        boss.charge = 'windup';
        boss.chargeT = 0;
        boss.chargeY = clamp(y, BAND_TOP + BOSS.hitRY, BAND_BOTTOM - BOSS.hitRY);
        break;
      case 'wall': {
        // A column from top to bottom with one gap, somewhere she has to fly to.
        const half = BOSS.wallGap / 2;
        const lo = BAND_TOP + half + 10;
        const hi = BAND_BOTTOM - half - 10;
        let gap = this.rng.range(lo, hi);
        if (Math.abs(gap - y) < 40) gap = clamp(y + (y < (lo + hi) / 2 ? 80 : -80), lo, hi);
        for (let by = BAND_TOP + 8; by <= BAND_BOTTOM - 8; by += BOSS.wallSpacing) {
          if (Math.abs(by - gap) < half) continue;
          this.launchBubble(mouthX, by, -BUBBLE.speed * 0.85, 0, false);
        }
        break;
      }
      case 'rain':
        // A diagonal drizzle sweeping in from the top right. Straight down was
        // undodgeable (Jonathan: "not sure what she is supposed to do there other
        // than get hit"): the ship only moves up and down, so a drop falling down
        // her own column passes through every height. On a slant, each drop
        // crosses her column at one height. The first slant was too shallow and
        // too crowded: drops crossed 22px apart, a solid wall. Now they cross
        // about 52px apart (BOSS.rainSpacing x the slope), gaps she can slip through.
        for (let i = 0; i < BOSS.rainCount; i++) {
          // Anchored to the ship, not the screen edge, so the gaps cross her
          // column at the same heights on every phone.
          const x = SHIP.x + 130 + i * BOSS.rainSpacing;
          this.launchBubble(x, BAND_TOP + 2, -BUBBLE.speed, BUBBLE.speed * BOSS.rainSlope, false, i * 0.3);
        }
        break;
      case 'snowballs':
        // Big snowballs lobbed up and down: they bounce off the top and bottom,
        // so she watches the bounce and slips under or over.
        for (const dir of [-1, 1, -1]) {
          const b = this.launchBubble(mouthX, boss.y, -BUBBLE.speed * 0.85, dir * BUBBLE.speed * 1.2, true, dir === -1 && boss.attack % 2 ? 0.5 : 0, 'snow');
          if (b) b.look = 0;
        }
        break;
      case 'mines':
        for (let i = 0; i < 3; i++) {
          const b = this.launchBubble(mouthX, bandY(0.2 + i * 0.3), -BOSS.mineSpeed, 0, true, i * 0.25, 'mine');
          if (b) b.fuse = BOSS.mineFuse + i * 0.25;
        }
        break;
      case 'ring':
        for (let i = 0; i < BOSS.ringCount; i++) {
          const a = (i / BOSS.ringCount) * Math.PI * 2 + this.rng.next() * 0.3;
          this.launchBubble(boss.x, boss.y, Math.cos(a) * BUBBLE.speed - 20, Math.sin(a) * BUBBLE.speed, false);
        }
        break;
    }
    this.emit('boss-attack', mouthX, boss.y, attack, 0);
  }

  private damageBoss(amount: number, x: number, y: number): void {
    const boss = this.boss;
    if (boss.phase !== 'fight') return;
    boss.hp -= amount;
    boss.flash = 0.05;
    this.emit('boss-hit', x, y, '', boss.hp / boss.maxHp);
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.phase = 'dying';
      boss.dying = 0;
      for (const b of this.bubbles) b.alive = false;
      this.emit('boss-boom', boss.x, boss.y, 'first', 1.4);
    }
  }

  // --- Mega bomb ----------------------------------------------------------------------

  private triggerBomb(): void {
    this.bombT = 0;
    this.bombX = SHIP.x;
    this.bombY = this.ship.y;
    this.bombHitBoss = false;
    for (const b of this.bubbles) b.alive = false;
    this.emit('bomb', SHIP.x, this.ship.y, '', 0);
  }

  /** Radius of the bomb ring now. */
  get bombRadius(): number {
    return this.bombT < 0 ? 0 : (this.bombT / BOMB.duration) * (SCREEN.w * 1.1);
  }

  private updateBomb(dt: number): void {
    if (this.bombT < 0) return;
    this.bombT += dt;
    const r = this.bombRadius;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - this.bombX, e.y - this.bombY) < r) this.poof(e, true);
    }
    for (const b of this.bubbles) b.alive = false;
    const boss = this.boss;
    if (!this.bombHitBoss && boss.phase === 'fight' && Math.hypot(boss.x - this.bombX, boss.y - this.bombY) < r) {
      this.bombHitBoss = true;
      this.damageBoss(BOMB.bossDamage, boss.x, boss.y);
    }
    if (this.bombT >= BOMB.duration) this.bombT = -1;
  }

  // --- Collisions ---------------------------------------------------------------------

  // --- Stage hazards ------------------------------------------------------------------

  private spawnHazards(): void {
    const hazards = this.stage.hazards;
    while (this.nextHazard < hazards.length && hazards[this.nextHazard]!.t <= this.time) {
      const h = hazards[this.nextHazard++]!;
      if (h.kind === 'eruption') {
        // The mirror of the boss's rain: lava blobs arcing up from the bottom
        // right, crossing her column at heights a gap apart.
        for (let i = 0; i < BOSS.rainCount; i++) {
          const x = SHIP.x + 130 + i * BOSS.rainSpacing;
          this.launchBubble(x, BAND_BOTTOM - 2, -BUBBLE.speed, -BUBBLE.speed * BOSS.rainSlope, false, i * 0.3, 'lava');
        }
        this.emit('hazard', SCREEN.w * 0.7, BAND_BOTTOM, 'eruption', 0);
      } else if (h.kind === 'blackhole') {
        const hole = this.holes.find((o) => !o.active);
        if (!hole) continue;
        hole.active = true;
        hole.x = SCREEN.w + BLACK_HOLE.drawR;
        hole.y = bandY(h.y);
        hole.t = 0;
        this.emit('hazard', hole.x, hole.y, 'blackhole', 0);
      } else if (this.bigComet.phase === 'none') {
        const c = this.bigComet;
        const span = (BAND_BOTTOM - BAND_TOP) * BIG_COMET.cover;
        c.phase = 'warn';
        c.t = 0;
        c.y0 = h.y === 0 ? BAND_TOP : BAND_BOTTOM - span;
        c.y1 = c.y0 + span;
        this.emit('hazard', SCREEN.w, (c.y0 + c.y1) / 2, 'bigcomet-warn', h.y);
      }
    }
  }

  private updateHazards(dt: number): void {
    const ship = this.ship;
    let pull = 0;
    for (const h of this.holes) {
      if (!h.active) continue;
      h.t += dt;
      h.x -= BLACK_HOLE.speed * dt;
      if (h.x < -BLACK_HOLE.drawR * 2) {
        h.active = false;
        continue;
      }
      // Pull the ship towards its height: strongest level with it and close by.
      const dy = h.y - ship.y;
      const fx = clamp(1 - Math.abs(h.x - SHIP.x) / BLACK_HOLE.range, 0, 1);
      const fy = 1 / (1 + (dy / BLACK_HOLE.falloff) ** 2);
      pull += Math.sign(dy) * Math.min(1, Math.abs(dy) / 6) * BLACK_HOLE.pull * fx * fy;
      // Bend the bubbles towards it, and swallow any that fall in.
      for (const b of this.bubbles) {
        if (!b.alive || b.t < 0) continue;
        const bx = h.x - b.x;
        const by = h.y - b.y;
        const d = Math.hypot(bx, by) || 1;
        if (d < BLACK_HOLE.r) {
          b.alive = false;
          continue;
        }
        const f = (BLACK_HOLE.bubblePull * dt) / (1 + (d / 90) ** 2);
        b.vx += (bx / d) * f;
        b.vy += (by / d) * f;
      }
      // Lasers that fly into the core are gone.
      for (const sh of this.shots) {
        if (sh.alive && Math.hypot(sh.x - h.x, sh.y - h.y) < BLACK_HOLE.drawR * 0.45) sh.alive = false;
      }
    }
    const before = ship.targetY;
    if (pull !== 0) this.setTarget(ship.targetY + pull * dt);
    this.pullDY = ship.targetY - before;

    const c = this.bigComet;
    if (c.phase === 'warn') {
      c.t += dt;
      if (c.t >= BIG_COMET.warn) {
        c.phase = 'fly';
        c.t = 0;
        c.x = SCREEN.w + (c.y1 - c.y0) / 2;
        this.emit('hazard', c.x, (c.y0 + c.y1) / 2, 'bigcomet', 0);
      }
    } else if (c.phase === 'fly') {
      c.t += dt;
      c.x -= BIG_COMET.speed * dt;
      // It sweeps away whatever's in its path, raccoons and bubbles alike.
      for (const e of this.enemies) {
        if (e.alive && e.y > c.y0 && e.y < c.y1 && Math.abs(e.x - c.x) < (c.y1 - c.y0) * 0.5) this.poof(e, false);
      }
      for (const b of this.bubbles) {
        if (b.alive && b.y > c.y0 && b.y < c.y1 && Math.abs(b.x - c.x) < (c.y1 - c.y0) * 0.5) b.alive = false;
      }
      if (c.x + BIG_COMET.tail < -40) c.phase = 'none';
    }
  }

  /** True if the giant comet's head or burning tail is over the ship's row right now. */
  bigCometHits(y: number, margin = 0): boolean {
    const c = this.bigComet;
    if (c.phase !== 'fly') return false;
    const r = (c.y1 - c.y0) / 2;
    return SHIP.x > c.x - r * 0.8 && SHIP.x < c.x + BIG_COMET.tail && y > c.y0 + 4 - margin && y < c.y1 - 4 + margin;
  }

  private collide(): void {
    const ship = this.ship;
    const boss = this.boss;

    for (const s of this.shots) {
      if (!s.alive) continue;
      const r = s.kind === 'star' ? WEAPON.starRadius : WEAPON.laserRadius;
      const dmg = s.kind === 'star' ? WEAPON.starDamage : WEAPON.laserDamage;
      for (const e of this.enemies) {
        // Comets: lasers fly straight through. She has to move.
        if (!e.alive || e.x > SCREEN.w + 4 || e.kind === 'comet') continue;
        const rr = ENEMIES[e.kind].r + r;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        s.alive = false;
        e.hp -= dmg;
        e.flash = 0.08;
        if (e.hp <= 0) this.poof(e, true);
        else this.emit('hit', s.x, s.y, e.kind, 0);
        break;
      }
      if (!s.alive) continue;
      if (boss.phase === 'fight') {
        const nx = (s.x - boss.x) / (BOSS.hitRX + r);
        const ny = (s.y - boss.y) / (BOSS.hitRY + r);
        if (nx * nx + ny * ny <= 1) {
          s.alive = false;
          this.damageBoss(dmg, s.x, s.y);
        }
      }
    }

    // Pickups: generous, a pickup she flew near is a pickup she caught.
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const dx = p.x - SHIP.x;
      const dy = p.y - ship.y;
      const rr = PICKUP.r + 16;
      if (dx * dx + dy * dy > rr * rr) continue;
      p.alive = false;
      this.collect(p.kind, p.x, p.y);
    }

    if (ship.safe > 0 || this.invincible) return;
    const hr = SHIP.hitRadius;
    for (const b of this.bubbles) {
      if (!b.alive || b.t < 0) continue;
      const rr = (b.big ? BUBBLE.r * 1.8 : BUBBLE.r) + hr;
      const dx = b.x - SHIP.x;
      const dy = b.y - ship.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      b.alive = false;
      this.hurt('bubble');
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const rr = ENEMIES[e.kind].r * 0.75 + hr;
      const dx = e.x - SHIP.x;
      const dy = e.y - ship.y;
      if (dx * dx + dy * dy > rr * rr) continue;
      this.poof(e, false);
      this.hurt('bump');
      return;
    }
    for (const h of this.holes) {
      if (!h.active) continue;
      if (Math.hypot(h.x - SHIP.x, h.y - ship.y) < BLACK_HOLE.r + hr) {
        this.hurt('bump');
        return;
      }
    }
    if (this.bigCometHits(ship.y)) {
      this.hurt('bump');
      return;
    }
    if (boss.phase === 'fight') {
      // A lunging boss only bumps with its core: near the top or bottom edge
      // the full body would leave nowhere to go.
      const k = boss.charge === 'lunge' || boss.charge === 'back' ? 0.5 : 0.8;
      const nx = (SHIP.x - boss.x) / (BOSS.hitRX * k + hr);
      const ny = (ship.y - boss.y) / (BOSS.hitRY * k + hr);
      if (nx * nx + ny * ny <= 1) this.hurt('bump');
    }
  }

  private collect(kind: PickupKind, x: number, y: number): void {
    const ship = this.ship;
    let level = 0;
    switch (kind) {
      case 'weapon':
        ship.weapon = Math.min(WEAPON.maxLevel, ship.weapon + 1);
        level = ship.weapon;
        ship.mood = 'wow';
        break;
      case 'heart':
        ship.shields = Math.min(SHIELDS.max, ship.shields + 1);
        ship.mood = 'cheer';
        break;
      case 'bomb':
        this.triggerBomb();
        ship.mood = 'cheer';
        break;
      case 'star':
        this.score += 500;
        ship.mood = 'cheer';
        break;
    }
    ship.moodTime = 1.2;
    this.emit('pickup', x, y, kind, level);
  }

  private hurt(how: 'bubble' | 'bump'): void {
    const ship = this.ship;
    ship.shields--;
    this.hits++;
    ship.safe = SHIELDS.invulnerable;
    ship.mood = 'oops';
    ship.moodTime = 1;
    this.emit('hurt', SHIP.x, ship.y, how, ship.shields);
    if (ship.shields <= 0) {
      this.phase = 'lost';
      this.endTime = 0;
      this.emit('lost', SHIP.x, ship.y, '', 0);
    }
  }

  /** A raccoon ship goes poof. `byHer` scores it and may drop a pickup. */
  private poof(e: Enemy, byHer: boolean): void {
    e.alive = false;
    this.emit('poof', e.x, e.y, e.kind, byHer ? 1 : 0);
    if (e.kind === 'asteroid') {
      // Bursts into little rocks, scattering up and down: still coming at her.
      for (let i = 0; i < ROCKS.count; i++) {
        const r = this.spawnEnemy('rock', e.x + 6, e.y, 'scatter', null);
        if (r) r.vy = ((i / (ROCKS.count - 1)) * 2 - 1) * ROCKS.scatter + this.rng.range(-10, 10);
      }
    }
    if (!byHer) return;
    this.score += ENEMIES[e.kind].score;
    if (e.drop) {
      // A weapon gift at full power becomes a star bonus instead.
      const drop = e.drop === 'weapon' && this.ship.weapon >= 3 ? 'star' : e.drop;
      this.dropPickup(drop, e.x, e.y);
      return;
    }
    const help = HELP.heartMult[Math.min(this.help, HELP.heartMult.length - 1)]!;
    const chance = (this.ship.shields <= 1 ? PICKUP.heartChanceAtOne : PICKUP.heartChance) * help;
    if (this.ship.shields < SHIELDS.max && this.rng.next() < chance) this.dropPickup('heart', e.x, e.y);
  }

  // --- Events ---------------------------------------------------------------------------

  private emit(kind: EventKind, x: number, y: number, tag: string, value: number): void {
    if (this.eventCount >= this.events.length) return;
    const ev = this.events[this.eventCount++]!;
    ev.kind = kind;
    ev.x = x;
    ev.y = y;
    ev.tag = tag;
    ev.value = value;
  }

  drainEvents(consume: (e: GameEvent) => void): void {
    for (let i = 0; i < this.eventCount; i++) consume(this.events[i]!);
    this.eventCount = 0;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
