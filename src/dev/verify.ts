/**
 * Design contracts, run by hand in the dev console:
 *
 *     __game.verify()
 *
 * Every check runs on its OWN GameState, never the live one, and touches no
 * save: the tower-defense verify once overwrote a real save, and a check that
 * can cost a child her stars is worse than no check.
 *
 * What's checked, and why each one exists:
 *
 *  - **Every enemy enters inside the band**, on screen, in script order, before
 *    the boss. A raccoon spawned half off the top is one she can't shoot.
 *  - **Every stage hands out its gifts**: a Super Laser in the first sixteen
 *    seconds, at least one heart and at least one mega bomb.
 *  - **The ship never leaves the band**, however hard the finger or the keys
 *    push it.
 *  - **Every boss falls to the base laser** in under 150 seconds, with a bot
 *    that simply follows the boss up and down and can't be hurt. Power-ups make
 *    it quicker; they must never be required.
 *  - **A boss fight is a fight**: played by the dodging bot, 30-120 seconds and at
 *    least 15 attacks. Jonathan's first play: "the bosses die so fast you
 *    barely have to dodge one attack". They lasted 7-11 seconds.
 *  - **Every stage reaches its boss** on time with a bot that never dodges.
 *  - **Bubbles are slow**: slower than the ship can cross a third of the band.
 *  - **Sitting still loses; dodging wins.** The first playtest: "she just plays
 *    and doesn't work at all". A ship parked at the top, middle or bottom must
 *    run out of shields in every stage, and a bot that slides away from what's
 *    coming must clear every stage. Together they say moving is the game.
 *  - **Losing costs the weapon**, so there's something to lose.
 */

import { BAND_BOTTOM, BAND_TOP, BIG_COMET, BLACK_HOLE, BOSS, BUBBLE, ENEMIES, FIXED_DT, HUNTER, SHIP, SCREEN, WEAPON } from '../game/config';
import { GameState, bandY, shipMaxY, shipMinY } from '../game/state';
import { STAGES } from '../game/stages';

/**
 * A child who watches what's coming: each tick, pick the nearby height with the
 * least on a collision course in the next 1.6 s, preferring to stay put and to
 * line up with the nearest raccoon. Not clever, and not meant to be: if this
 * can't win a stage, a five-year-old can't either.
 */
export function dodge(s: GameState): void {
  // Everything that can hurt her, as a point moving in a straight line.
  type Threat = { x: number; y: number; vx: number; vy: number; r: number; from: number; bounce?: boolean };
  const threats: Threat[] = [];
  for (const b of s.bubbles) {
    if (!b.alive) continue;
    // A mine about to burst is a danger all round it.
    const r = (b.big ? BUBBLE.r * 1.8 : BUBBLE.r) + 9 + (b.kind === 'mine' && b.fuse < 1 ? 40 : 0);
    threats.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, r, from: Math.max(0, -b.t), bounce: b.kind === 'snow' });
  }
  for (const e of s.enemies) {
    if (!e.alive || e.kind === 'carrier') continue;
    const plain = e.kind === 'comet' || e.kind === 'tooter' || e.kind === 'asteroid' || e.kind === 'rock';
    const speed = plain ? ENEMIES[e.kind].speed : ENEMIES[e.kind].speed * s.stage.heat.speed;
    threats.push({ x: e.x, y: e.y, vx: -speed, vy: e.path === 'scatter' ? e.vy : 0, r: ENEMIES[e.kind].r * 0.75 + SHIP.hitRadius + 6, from: 0 });
  }
  for (const h of s.holes) {
    if (h.active) threats.push({ x: h.x, y: h.y, vx: -BLACK_HOLE.speed, vy: 0, r: BLACK_HOLE.r + SHIP.hitRadius + 10, from: 0 });
  }
  for (const w of s.warnings) {
    if (w.active) threats.push({ x: SCREEN.w + ENEMIES.comet.w * 0.5, y: w.y, vx: -ENEMIES.comet.speed, vy: 0, r: ENEMIES.comet.r * 0.75 + SHIP.hitRadius + 8, from: w.left });
  }
  const boss = s.boss;
  if (boss.phase === 'fight') {
    // The boss body, and during a charge the whole row it's about to sweep.
    const charging = boss.charge === 'windup' || boss.charge === 'lunge';
    const rowY = boss.charge === 'windup' ? boss.chargeY : boss.y;
    threats.push({ x: charging ? SHIP.x : boss.x, y: rowY, vx: 0, vy: 0, r: BOSS.hitRY * 0.8 + SHIP.hitRadius + 10, from: 0 });
  }

  // Line up with the nearest raccoon, or the boss, or a pickup: a kid shoots
  // what's in front of her and grabs presents.
  let target: number | null = null;
  let nearest = Infinity;
  for (const e of s.enemies) {
    if (e.alive && e.kind !== 'comet' && e.x > SHIP.x && e.x - SHIP.x < nearest) {
      nearest = e.x - SHIP.x;
      target = e.y;
    }
  }
  // Presents first: a gift saucer on screen beats any raccoon, a dropped
  // pickup beats everything.
  if (boss.phase !== 'fight') for (const e of s.enemies) if (e.alive && e.kind === 'carrier' && e.x > SHIP.x + 30) target = e.y;
  for (const p of s.pickups) if (p.alive) target = p.y;
  if (boss.phase === 'fight' && boss.charge === 'none') target ??= boss.y;

  let best = s.ship.y;
  let bestScore = Infinity;
  // Every height on screen, not just nearby ones: a giant comet's zone can be
  // wider than any short hop.
  for (let y = shipMinY; y <= shipMaxY; y += 6) {
    const dy = y - s.ship.y;
    let danger = 0;
    for (const t of threats) {
      // From 0.2s ahead: what's touching her right now scores the same for
      // every choice, and counting it froze the bot in place mid-charge.
      for (let k = 2; k <= 15; k++) {
        const tt = k * 0.1;
        const run = Math.max(0, tt - t.from);
        if (tt < t.from) continue;
        // The ship needs a moment to get there: interpolate from where it is now.
        const shipY = s.ship.y + (y - s.ship.y) * Math.min(1, tt / 0.25);
        const tx = t.x + t.vx * run;
        let ty = t.y + t.vy * run;
        if (t.bounce) {
          // Snowballs bounce off the top and bottom of the band.
          const lo = BAND_TOP + 8;
          const span = BAND_BOTTOM - 8 - lo;
          const m = (((ty - lo) % (2 * span)) + 2 * span) % (2 * span);
          ty = lo + (m > span ? 2 * span - m : m);
        }
        if (Math.abs(tx - SHIP.x) < t.r + 4 && Math.abs(ty - shipY) < t.r) {
          danger += 2 - tt;
          break;
        }
      }
    }
    // The giant comet: anywhere in its zone is bad, from the moment the warning goes up.
    const c = s.bigComet;
    if ((c.phase === 'warn' || (c.phase === 'fly' && c.x + BIG_COMET.tail > SHIP.x - 20)) && y > c.y0 - 14 && y < c.y1 + 14) danger += 3;
    const score = danger * 1000 + Math.abs(dy) * 0.4 + (target === null ? 0 : Math.abs(y - target) * 0.3);
    if (score < bestScore) {
      bestScore = score;
      best = y;
    }
  }
  s.setTarget(best);
}

interface Result {
  check: string;
  ok: boolean;
  detail: string;
}

export function verify(): Result[] {
  const results: Result[] = [];
  const add = (check: string, ok: boolean, detail: string): void => {
    results.push({ check, ok, detail });
  };

  // --- Scripts -------------------------------------------------------------------
  for (const stage of STAGES) {
    const bad = stage.spawns.filter((s) => {
      const y = bandY(s.y);
      const r = ENEMIES[s.kind].r;
      return y - r < BAND_TOP - 1 || y + r > BAND_BOTTOM + 1 || s.t < 0 || s.t >= stage.length;
    });
    add(`stage ${stage.id}: spawns inside band and before boss`, bad.length === 0, bad.length ? `${bad.length} bad: ${JSON.stringify(bad[0])}` : `${stage.spawns.length} spawns`);
    const ordered = stage.spawns.every((s, i, a) => i === 0 || a[i - 1]!.t <= s.t);
    add(`stage ${stage.id}: script in time order`, ordered, ordered ? 'sorted' : 'out of order');
    const early = stage.spawns.some((s) => s.drop === 'weapon' && s.t <= 16);
    const heart = stage.spawns.some((s) => s.drop === 'heart');
    const bomb = stage.spawns.some((s) => s.drop === 'bomb');
    add(`stage ${stage.id}: gifts`, early && heart && bomb, `laser by 16s ${early}, heart ${heart}, bomb ${bomb}`);
    add(`stage ${stage.id}: checkpoint mid-stage`, stage.checkpoint > 0 && stage.checkpoint < stage.length, `${stage.checkpoint}s of ${stage.length}s`);
  }

  // --- Ship stays in band ---------------------------------------------------------
  {
    const s = new GameState();
    s.load(STAGES[0]!);
    s.invincible = true;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 120 * 20; i++) {
      const phase = Math.floor(i / 240) % 4;
      s.setTarget(phase === 0 ? -5000 : phase === 1 ? 5000 : phase === 2 ? s.ship.targetY - 300 : s.ship.targetY + 300);
      s.update(FIXED_DT);
      s.drainEvents(() => {});
      lo = Math.min(lo, s.ship.y);
      hi = Math.max(hi, s.ship.y);
    }
    const ok = lo >= shipMinY - 0.01 && hi <= shipMaxY + 0.01 && lo < shipMinY + 1 && hi > shipMaxY - 1;
    add('ship stays in band and reaches both edges', ok, `y ${lo.toFixed(1)}..${hi.toFixed(1)} of ${shipMinY}..${shipMaxY}`);
  }

  // --- Drag reach -------------------------------------------------------------------
  {
    const travel = (shipMaxY - shipMinY) / SHIP.dragGain;
    add('a thumb can cross the band in one drag', travel < SCREEN.h * 0.9, `${travel.toFixed(0)}px of finger for the whole band`);
  }

  // --- Bubbles are dodgeable ----------------------------------------------------------
  {
    const crossThird = (BAND_BOTTOM - BAND_TOP) / 3 / SHIP.keySpeed;
    const bubbleTime = (SCREEN.w * 0.5) / BUBBLE.speed;
    add('stink bubbles are slow', bubbleTime > crossThird * 4, `bubble crosses half the screen in ${bubbleTime.toFixed(1)}s; ship crosses a third of the band in ${crossThird.toFixed(2)}s`);
  }

  // --- Hazards are fair -----------------------------------------------------------------
  add('a black hole can always be out-flown', BLACK_HOLE.pull < SHIP.keySpeed * 0.6, `pull ${BLACK_HOLE.pull}px/s vs the keys' ${SHIP.keySpeed}px/s (a finger is faster still)`);
  {
    const band = BAND_BOTTOM - BAND_TOP;
    const safe = band * (1 - BIG_COMET.cover) - 8;
    const crossing = (band * BIG_COMET.cover) / SHIP.keySpeed;
    add('a giant comet leaves a safe strip, with time to reach it', safe >= SHIP.h * 2.5 && crossing < BIG_COMET.warn * 0.6, `strip ${safe.toFixed(0)}px (ship ${SHIP.h}px), worst crossing ${crossing.toFixed(2)}s of a ${BIG_COMET.warn}s warning`);
    const toughest = ENEMIES.asteroid.hp + Math.max(...STAGES.map((st) => st.heat.armor)) * 4;
    const breakTime = toughest * WEAPON.laserEvery;
    const crossTime = (SCREEN.w - SHIP.x) / ENEMIES.asteroid.speed;
    add('the toughest asteroid breaks to a single laser in time', breakTime < crossTime * 0.6, `${breakTime.toFixed(1)}s of fire; it takes ${crossTime.toFixed(1)}s to reach her`);
  }

  // --- Every stage reaches its boss, and every boss falls to the base laser ------------
  for (const stage of STAGES) {
    const s = new GameState();
    s.load(stage);
    s.invincible = true;
    let t = 0;
    while (s.boss.phase === 'none' && t < stage.length + 20) {
      s.update(FIXED_DT);
      s.drainEvents(() => {});
      t += FIXED_DT;
    }
    add(`stage ${stage.id}: boss arrives`, s.boss.phase !== 'none' && t < stage.length + 10, `at ${t.toFixed(1)}s (script ${stage.length}s + intro)`);

    const b = new GameState();
    b.load(stage);
    b.invincible = true;
    b.reachedBoss = true;
    b.retry();
    b.ship.weapon = 1;
    let fight = 0;
    let started = false;
    while (b.phase === 'play' && fight < 200) {
      if (b.boss.phase === 'fight') started = true;
      // Follow the boss's height, no dodging. Pickups are left alone; there are
      // none in a boss fight except hearts from minions, which don't add damage.
      b.setTarget(b.boss.phase === 'none' ? bandY(0.5) : b.boss.y);
      b.update(FIXED_DT);
      b.drainEvents(() => {});
      if (started) fight += FIXED_DT;
    }
    // Not a race any more (bosses got 8x the health after the first playtest):
    // only that a retry with the single laser is never hopeless. Gift saucers
    // bring the laser back during the fight, but this bot doesn't collect them.
    add(`stage ${stage.id}: boss falls to base laser`, b.phase === 'cleared' && fight < 150, `${stage.boss.name}, ${stage.boss.hp} hp, ${b.phase} after ${fight.toFixed(1)}s of fighting`);
  }

  // --- Sitting still loses; dodging wins --------------------------------------------
  for (const stage of STAGES) {
    const parked: string[] = [];
    let allLost = true;
    for (const f of [0.1, 0.5, 0.9]) {
      const s = new GameState();
      s.load(stage);
      let t = 0;
      while (s.phase === 'play' && t < stage.length + 90) {
        s.setTarget(bandY(f));
        s.update(FIXED_DT);
        s.drainEvents(() => {});
        t += FIXED_DT;
      }
      if (s.phase !== 'lost') allLost = false;
      parked.push(`${f}: ${s.phase} at ${t.toFixed(0)}s`);
    }
    add(`stage ${stage.id}: a ship that never moves loses`, allLost, parked.join(', '));
  }
  for (const row of feel()) {
    const fight = Number(row['boss fight s']);
    const attacks = Number(row['boss attacks']);
    // World 1 should rarely cost her a try; world 2 is meant to take a few
    // (Jonathan: "maybe she will try again a few times to get it"), with HELP
    // adding hearts every time. `__game.feelMany()` gives the averages.
    const allowed = Number(row.stage) <= 5 ? 1 : 3;
    add(`stage ${row.stage}: a dodging ship wins`, row.result === 'cleared' && Number(row.losses) <= allowed, `${row.result}, ${row.hits} hits, ${row.losses} losses (allowed ${allowed})`);
    add(`stage ${row.stage}: the boss fight is a fight`, fight >= 30 && fight <= 120 && attacks >= 15, `${fight}s, ${attacks} attacks`);
  }
  {
    const s = new GameState();
    s.load(STAGES[0]!);
    s.ship.weapon = 3;
    s.retry();
    add('losing costs the weapon', s.ship.weapon === 1, `weapon ${s.ship.weapon} after a retry; hunters warn ${HUNTER.warn}s ahead`);
  }

  console.table(results);
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) console.log(`%c${results.length} contracts hold`, 'color:#2a2');
  else console.error(`${failed.length} of ${results.length} contracts FAILED`);
  return results;
}

/**
 * How a stage FEELS, played by the dodging bot the way a kid really plays:
 * picking up every power-up, so by the boss she usually has Star Power.
 *
 *     __game.feel()
 *
 * The numbers that matter: how busy the waves are (enemies and bubbles per
 * minute), how long the boss fight lasts, and how many boss attacks she has to
 * get through. Jonathan's first play of the boss fights: "they die so fast you
 * barely have to dodge one attack".
 */
export function feel(width = 585, only?: readonly number[], seed = 0): Record<string, string | number>[] {
  // The frame's width follows the phone's shape (480-640 virtual px), and a
  // wider frame changes where everything spawns, so pin it. 585 is a modern
  // phone held sideways. Measured without pinning, the numbers wandered with
  // the size of whatever window the dev console happened to be in.
  const savedW = SCREEN.w;
  SCREEN.w = width;
  const rows: Record<string, string | number>[] = [];
  for (const stage of STAGES) {
    if (only && !only.includes(stage.id)) continue;
    const s = new GameState();
    s.load(stage, seed);
    let t = 0;
    let enemies: number;
    let attacks = 0;
    let fight = 0;
    let wavesTime = 0;
    let losses = 0;
    let weaponAtBoss = 0;
    while (s.phase !== 'cleared' && t < 400) {
      if (s.phase === 'lost') {
        losses++;
        // The same quiet help she gets (HELP): more hearts every time.
        s.help = losses;
        // The fight numbers describe the attempt that wins.
        if (s.reachedBoss) {
          fight = 0;
          attacks = 0;
        }
        s.retry();
      }
      if (t % (1 / 30) < FIXED_DT) dodge(s);
      s.update(FIXED_DT);
      s.drainEvents((e) => {
        if (e.kind === 'boss-attack') attacks++;
        if (e.kind === 'boss-enter' && weaponAtBoss === 0) weaponAtBoss = s.ship.weapon;
      });
      if (s.boss.phase === 'fight') fight += FIXED_DT;
      else if (s.boss.phase === 'none' && !s.intro) wavesTime += FIXED_DT;
      t += FIXED_DT;
    }
    enemies = stage.spawns.length;
    rows.push({
      stage: stage.id,
      result: s.phase,
      'enemies/min': Math.round((enemies / stage.length) * 60),
      'bubbles/min (waves+boss)': Math.round((s.bubblesFired / Math.max(1, t)) * 60),
      'weapon at boss': weaponAtBoss,
      'boss fight s': Number(fight.toFixed(1)),
      'boss attacks': attacks,
      hits: s.hits,
      losses,
    });
  }
  SCREEN.w = savedW;
  console.table(rows);
  return rows;
}

/**
 * feel(), several times over: three different runs of luck on a narrow
 * (16:9, 480) and a modern (585) phone, averaged per stage. One run is too
 * noisy to tune by: a small change elsewhere could flip a stage from cleared to
 * three losses and back.
 *
 *     __game.feelMany()
 */
export function feelMany(seeds: readonly number[] = [0, 1, 2], widths: readonly number[] = [480, 585]): Record<string, string | number>[] {
  const by = new Map<number, Record<string, string | number>[]>();
  for (const w of widths) {
    for (const seed of seeds) {
      for (const row of feel(w, undefined, seed)) {
        const id = Number(row.stage);
        by.set(id, [...(by.get(id) ?? []), row]);
      }
    }
  }
  const avg = (rows: Record<string, string | number>[], key: string): number =>
    Math.round((rows.reduce((sum, r) => sum + Number(r[key]), 0) / rows.length) * 10) / 10;
  const out = [...by.entries()].map(([stage, rows]) => ({
    stage,
    runs: rows.length,
    cleared: rows.filter((r) => r.result === 'cleared').length,
    'avg losses': avg(rows, 'losses'),
    'max losses': Math.max(...rows.map((r) => Number(r.losses))),
    'avg hits': avg(rows, 'hits'),
    'avg boss fight s': avg(rows, 'boss fight s'),
    'avg boss attacks': avg(rows, 'boss attacks'),
  }));
  console.table(out);
  return out;
}
