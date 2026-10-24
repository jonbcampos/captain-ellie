/**
 * Drawing the world: space, the stars, everyone in it, and the two moments that
 * aren't space at all (the backyard title and the imagination warp).
 *
 * Every painted piece is optional. Each draw tries the sprite first and falls
 * back to a hand-drawn shape, so the game is complete with `public/sprites/`
 * deleted; that's the house rule.
 */

import { BIG_COMET, BLACK_HOLE, BOSS, ENEMIES, SCREEN, SCROLL_SPEED, SHIP, WEAPON, BUBBLE, BAND_TOP, BAND_BOTTOM, PICKUP } from '../game/config';
import type { Bubble, GameState, Enemy } from '../game/state';
import { PALETTE, alpha } from './palette';
import { drawStar, type Particles } from './particles';
import { frameBounds, sprite, spriteFrames } from './sprites';

// --- Camera: shake and flash ---------------------------------------------------

export const camera = { shake: 0, flash: 0, x: 0, y: 0 };

export function shake(amount: number): void {
  camera.shake = Math.min(1.2, Math.max(camera.shake, amount));
}

export function updateCamera(dt: number, time: number): void {
  camera.shake = Math.max(0, camera.shake - dt * 2.2);
  camera.flash = Math.max(0, camera.flash - dt * 3);
  const s = camera.shake * camera.shake * 7;
  camera.x = Math.sin(time * 71) * s;
  camera.y = Math.cos(time * 57) * s;
}

// --- Helpers ---------------------------------------------------------------------------

/**
 * Draw a frame so its CONTENT (not its padded cell) is `width` wide, centred on
 * (x, y). Uniform scale, so the painting keeps its shape.
 */
function drawContent(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement, x: number, y: number, width: number, flip = false): void {
  const b = frameBounds(frame);
  const k = width / b.w;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(frame, -(b.x + b.w / 2) * k, -(b.y + b.h / 2) * k, frame.width * k, frame.height * k);
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
}

/** Draw it a second time additively: a white-ish hit flash that works without ctx.filter (Safari). */
function flashed(ctx: CanvasRenderingContext2D, amount: number, draw: () => void): void {
  draw();
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, amount);
  draw();
  ctx.restore();
}

// --- Space -------------------------------------------------------------------------------

interface BgStar {
  x: number;
  y: number;
  depth: number;
  size: number;
  warm: boolean;
}

const STARS: BgStar[] = [];
{
  // Deterministic, so the sky is the same every launch.
  let seed = 12345;
  const r = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 140; i++) {
    const depth = i < 80 ? 0.15 : i < 120 ? 0.45 : 1;
    STARS.push({ x: r() * 700, y: r() * 270, depth, size: depth < 0.3 ? 1 : depth < 0.6 ? 1.5 : 2.2, warm: r() < 0.2 });
  }
}

/**
 * Painted backdrop plus three layers of scrolling stars.
 *
 * The painting is not tiled. Mirrored tiling (the slingshot ground trick) put
 * two Earths side by side at every seam, because a backdrop has landmarks and a
 * ground strip doesn't. Instead the painting drifts slowly back and forth across
 * its own spare width, the way a far-away planet barely moves, and the stars in
 * front of it carry the sense of flying forward.
 */
export function drawSpace(ctx: CanvasRenderingContext2D, backdrop: string, sky: readonly [string, string], time: number, speed = 1): void {
  const image = sprite(backdrop);
  if (image) {
    const k = Math.max(SCREEN.h / image.height, SCREEN.w / image.width);
    const w = image.width * k;
    const h = image.height * k;
    const spare = w - SCREEN.w;
    const offset = spare * (0.5 - 0.5 * Math.cos((time * SCROLL_SPEED * 0.004) % (Math.PI * 2)));
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, -offset, (SCREEN.h - h) / 2, w, h);
    ctx.imageSmoothingEnabled = smoothing;
    // Pushed back a little, so painted asteroids never read as things to dodge.
    ctx.fillStyle = alpha(PALETTE.overlay, 0.22);
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN.h);
    g.addColorStop(0, sky[0]);
    g.addColorStop(1, sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
    // A friendly planet, so the fallback isn't just a gradient.
    const px = SCREEN.w * 0.75 - ((time * 4) % (SCREEN.w * 1.5));
    ctx.fillStyle = alpha('#ffb37a', 0.5);
    ctx.beginPath();
    ctx.arc(px + SCREEN.w * 0.4, SCREEN.h * 1.05, 120, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of STARS) {
    const span = SCREEN.w + 20;
    const x = ((((s.x - time * SCROLL_SPEED * s.depth * speed) % span) + span) % span) - 10;
    ctx.fillStyle = s.warm ? PALETTE.starWarm : PALETTE.star;
    ctx.globalAlpha = 0.35 + s.depth * 0.6;
    if (speed > 2) {
      // Warp speed: stars stretch into streaks.
      ctx.fillRect(x, s.y, s.size * speed * 3 * s.depth + 1, s.size * 0.8);
    } else {
      ctx.fillRect(x, s.y, s.size, s.size);
    }
  }
  ctx.globalAlpha = 1;
}

// --- The ship ------------------------------------------------------------------------------

const MOOD_FRAME = { cheer: 0, oops: 1, wow: 2, brave: 3 } as const;

export function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, mood: GameState['ship']['mood'], time: number, safe: number): void {
  // Blink while safe, but never invisible: she has to see where she is.
  if (safe > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  const fly = spriteFrames('ellie.fly');
  const moods = spriteFrames('ellie.mood');
  const bob = Math.sin(time * 5) * 1;
  const frame = mood !== 'fly' && moods ? moods[MOOD_FRAME[mood]] : fly?.[Math.floor(time * 10) % fly.length];
  if (frame) {
    drawContent(ctx, frame, x, y + bob, SHIP.w + 10);
  } else {
    drawShipFallback(ctx, x, y + bob, time);
  }
  ctx.globalAlpha = 1;
  if (safe > 0) {
    ctx.strokeStyle = alpha(PALETTE.shield, 0.35 + 0.25 * Math.sin(time * 20));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, SHIP.w * 0.62, SHIP.h * 0.85, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawShipFallback(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const flame = 6 + Math.sin(time * 40) * 2;
  ctx.fillStyle = PALETTE.flame;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 4);
  ctx.lineTo(x - 22 - flame, y);
  ctx.lineTo(x - 22, y + 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(x - 20, y - 11, 6, 5);
  ctx.fillRect(x - 20, y + 6, 6, 5);
  ctx.fillStyle = PALETTE.shipPink;
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.chrome;
  ctx.beginPath();
  ctx.ellipse(x + 17, y, 6, 6, 0, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.fillStyle = alpha(PALETTE.glass, 0.85);
  ctx.beginPath();
  ctx.arc(x - 2, y - 7, 7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#5a3a2a';
  ctx.beginPath();
  ctx.arc(x - 2, y - 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

// --- Raccoon ships ---------------------------------------------------------------------

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  if (e.kind === 'comet') {
    drawComet(ctx, e, time);
    return;
  }
  if (e.kind === 'asteroid' || e.kind === 'rock') {
    drawAsteroid(ctx, e);
    return;
  }
  const spec = ENEMIES[e.kind];
  const sheet = e.kind === 'zipper' ? 'zipper.fly' : e.kind === 'tooter' ? 'tooter.fly' : e.tease > 0 ? 'saucer.tease' : 'saucer.fly';
  const frames = spriteFrames(sheet);
  let frame: HTMLCanvasElement | undefined;
  if (frames) {
    if (e.kind === 'tooter') {
      // Cheeks puff as the next toot comes due.
      frame = frames[e.parked > 0 && e.clock < 0.5 ? 2 : e.parked > 0 && e.clock < 1 ? 1 : Math.floor(time * 3) % 2 === 0 ? 0 : 3];
    } else if (sheet === 'saucer.tease') {
      frame = frames[Math.floor(e.seed * 10) % 3];
    } else {
      frame = frames[Math.floor(time * 6 + e.seed * 3) % frames.length];
    }
  }
  const tilt = e.kind === 'saucer' || e.kind === 'carrier' ? Math.sin(e.t * 3 + e.seed) * 0.12 : 0;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(tilt);
  if (e.kind === 'carrier') {
    // A gift saucer: wears a big ribbon bow and glows, so she knows it's good.
    ctx.fillStyle = alpha(PALETTE.gold, 0.25 + 0.15 * Math.sin(time * 8));
    ctx.beginPath();
    ctx.arc(0, 0, spec.r + 7, 0, Math.PI * 2);
    ctx.fill();
  }
  flashed(ctx, e.flash > 0 ? 0.8 : 0, () => {
    if (frame) drawContent(ctx, frame, 0, 0, spec.w);
    else drawEnemyFallback(ctx, e);
  });
  if (e.kind === 'carrier') drawBow(ctx, 0, -spec.h * 0.55);
  ctx.restore();
}

function drawBow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = PALETTE.heart;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 8, y - 5);
  ctx.lineTo(x - 8, y + 4);
  ctx.closePath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 8, y - 5);
  ctx.lineTo(x + 8, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyFallback(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const spec = ENEMIES[e.kind];
  const body = e.kind === 'zipper' ? PALETTE.zipper : e.kind === 'tooter' ? PALETTE.tooter : PALETTE.saucer;
  ctx.fillStyle = alpha(PALETTE.glass, 0.7);
  ctx.beginPath();
  ctx.arc(0, -spec.h * 0.15, spec.h * 0.35, Math.PI, 0);
  ctx.fill();
  // The raccoon: grey head, black mask.
  ctx.fillStyle = PALETTE.fur;
  ctx.beginPath();
  ctx.arc(0, -spec.h * 0.18, spec.h * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.mask;
  ctx.fillRect(-spec.h * 0.2, -spec.h * 0.24, spec.h * 0.4, spec.h * 0.1);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, spec.h * 0.08, spec.w / 2, spec.h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.lights;
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * spec.w * 0.16 - 1, spec.h * 0.06, 2, 2);
}

// --- The boss -----------------------------------------------------------------------------

function drawBoss(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const boss = state.boss;
  if (boss.phase === 'none' || boss.phase === 'gone') return;
  const spec = state.stage.boss;
  const image = sprite(spec.sprite);
  const lunging = boss.charge === 'lunge';
  const wobble = boss.phase === 'dying' ? Math.sin(time * 40) * 0.05 : lunging ? -0.12 : Math.sin(time * 1.5) * 0.04;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  // Angry: a pulsing red glow behind it, hotter in the last phase.
  if (boss.phase === 'fight' && (boss.rage > 0 || boss.charge !== 'none')) {
    const heat = boss.charge === 'windup' ? 0.75 : boss.rage === 2 ? 0.5 : 0.3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = alpha('#ff3b3b', heat * (0.6 + 0.4 * Math.sin(time * (boss.charge === 'windup' ? 30 : 8))));
    ctx.beginPath();
    ctx.ellipse(0, 4, BOSS.hitRX * 1.25, BOSS.hitRY * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.rotate(wobble);
  const windup = boss.charge === 'windup' && Math.floor(time * 16) % 2 === 0 ? 0.3 : 0;
  flashed(ctx, boss.flash > 0 ? 0.35 : boss.phase === 'dying' ? 0.3 + 0.3 * Math.sin(time * 25) : windup, () => {
    if (image) drawContent(ctx, image, 0, 0, BOSS.w, !spec.facesLeft);
    else drawBossFallback(ctx, spec.hull, spec.trim);
  });
  ctx.restore();
}

function drawBossFallback(ctx: CanvasRenderingContext2D, hull: string, trim: string): void {
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.ellipse(0, 8, BOSS.hitRX + 8, BOSS.hitRY * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = alpha(PALETTE.glass, 0.8);
  ctx.beginPath();
  ctx.arc(0, -6, BOSS.hitRY * 0.7, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = PALETTE.fur;
  ctx.beginPath();
  ctx.arc(0, -12, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.mask;
  ctx.fillRect(-14, -17, 28, 7);
  ctx.fillStyle = trim;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(i * 14, 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Shots, bubbles, pickups --------------------------------------------------------------

function drawShots(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const s of state.shots) {
    if (!s.alive) continue;
    if (s.kind === 'laser') {
      ctx.fillStyle = alpha(PALETTE.laser, 0.45);
      ctx.fillRect(s.x - 9, s.y - 2.5, 16, 5);
      ctx.fillStyle = PALETTE.laserCore;
      ctx.fillRect(s.x - 7, s.y - 1, 13, 2);
    } else {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin);
      drawStar(ctx, 0, 0, WEAPON.starRadius + 1.5, PALETTE.starShot);
      drawStar(ctx, 0, 0, WEAPON.starRadius - 2, '#fff7d0');
      ctx.restore();
    }
  }
}

function drawBubbles(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const clouds = spriteFrames('fart.clouds');
  for (const b of state.bubbles) {
    if (!b.alive || b.t < 0) continue;
    const r = BUBBLE.drawR * (b.big ? 1.8 : 1) * (1 + Math.sin(b.t * 6) * 0.06);
    if (b.kind !== 'stink') {
      drawSpecialBubble(ctx, b, r, time);
      continue;
    }
    // A soft bright halo first, so every bubble is visible against any backdrop.
    ctx.fillStyle = alpha(PALETTE.bubbleRim, 0.18 + 0.08 * Math.sin(time * 10 + b.look));
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 1.25, 0, Math.PI * 2);
    ctx.fill();
    const frame = clouds?.[b.look % clouds.length];
    if (frame) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.sin(b.t * 2 + b.look) * 0.2);
      drawContent(ctx, frame, 0, 0, r * 2.1);
      ctx.restore();
    } else {
      ctx.fillStyle = PALETTE.bubble;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bubbleDark;
      ctx.beginPath();
      ctx.arc(b.x + r * 0.3, b.y + r * 0.2, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = alpha(PALETTE.bubbleRim, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Which painted orb each pickup is: laser, star, heart, bomb. */
function pickupFrame(kind: string, weapon: number): number {
  if (kind === 'weapon') return weapon >= 2 ? 1 : 0;
  if (kind === 'star') return 1;
  if (kind === 'heart') return 2;
  return 3;
}

function drawPickups(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const orbs = spriteFrames('powerup.items');
  for (const p of state.pickups) {
    if (!p.alive) continue;
    const pulse = 1 + Math.sin(time * 8 + p.t) * 0.08;
    const y = p.y + Math.sin(p.t * 4) * 3;
    ctx.fillStyle = alpha('#ffffff', 0.18 + 0.12 * Math.sin(time * 10));
    ctx.beginPath();
    ctx.arc(p.x, y, PICKUP.r * 1.6 * pulse, 0, Math.PI * 2);
    ctx.fill();
    const frame = orbs?.[pickupFrame(p.kind, state.ship.weapon)];
    if (frame) {
      drawContent(ctx, frame, p.x, y, PICKUP.r * 2.2 * pulse);
    } else {
      const color = p.kind === 'heart' ? PALETTE.heart : p.kind === 'bomb' ? '#9b59d0' : p.kind === 'star' ? PALETTE.gold : PALETTE.laser;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, y, PICKUP.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      drawStar(ctx, p.x, y, PICKUP.r * 0.6, '#ffffff');
    }
  }
}

// --- The whole frame ----------------------------------------------------------------------

export function drawScene(ctx: CanvasRenderingContext2D, state: GameState, alphaT: number, particles: Particles, time: number): void {
  ctx.save();
  ctx.translate(camera.x, camera.y);
  drawSpace(ctx, state.stage.backdrop, state.stage.sky, time);

  drawCometWarning(ctx, state, time);
  drawBlackHoles(ctx, state, time);
  for (const e of state.enemies) if (e.alive) drawEnemy(ctx, e, time);
  drawBoss(ctx, state, time);
  drawPickups(ctx, state, time);
  drawShots(ctx, state);

  const ship = state.ship;
  if (state.phase !== 'lost' || state.endTime < 0.15) {
    const y = ship.prevY + (ship.y - ship.prevY) * alphaT;
    drawShip(ctx, SHIP.x, y, ship.mood, time, ship.safe);
  }
  drawBubbles(ctx, state, time);
  drawBigComet(ctx, state, time);
  drawWarnings(ctx, state, time);
  particles.draw(ctx);

  // The mega bomb: a huge bright ring sweeping the screen.
  if (state.bombT >= 0) {
    const r = state.bombRadius;
    ctx.strokeStyle = alpha('#ffffff', 0.9);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(state.bombX, state.bombY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = alpha(PALETTE.gold, 0.6);
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(state.bombX, state.bombY, Math.max(0, r - 12), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (camera.flash > 0) {
    ctx.fillStyle = alpha('#ffffff', Math.min(0.85, camera.flash * 0.7));
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  }
  // A faint edge to the band, so the top HUD strip reads as "not space you fly in".
  ctx.fillStyle = alpha('#000000', 0.25);
  ctx.fillRect(0, 0, SCREEN.w, BAND_TOP - 2);
  ctx.fillRect(0, BAND_BOTTOM + 2, SCREEN.w, SCREEN.h - BAND_BOTTOM);
}

// --- The backyard, and the imagination kicking in ----------------------------------------

/** The painted title (cover-fit), or a hand-drawn backyard and cardboard box. */
export function drawBackyard(ctx: CanvasRenderingContext2D, time: number, zoom = 1): void {
  const image = sprite('title');
  ctx.save();
  // Zoom towards the box, which sits right of centre in the painting.
  const fx = SCREEN.w * 0.62;
  const fy = SCREEN.h * 0.62;
  ctx.translate(fx, fy);
  ctx.scale(zoom, zoom);
  ctx.translate(-fx, -fy);
  if (image) {
    const k = Math.max(SCREEN.w / image.width, SCREEN.h / image.height);
    const w = image.width * k;
    const h = image.height * k;
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, (SCREEN.w - w) / 2, (SCREEN.h - h) / 2, w, h);
    ctx.imageSmoothingEnabled = smoothing;
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN.h);
    g.addColorStop(0, '#243a7a');
    g.addColorStop(0.55, '#f7b58a');
    g.addColorStop(1, '#ffd9a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
    ctx.fillStyle = '#b07a4a';
    ctx.fillRect(0, SCREEN.h * 0.55, SCREEN.w, SCREEN.h * 0.2);
    ctx.fillStyle = '#5bb84a';
    ctx.fillRect(0, SCREEN.h * 0.75, SCREEN.w, SCREEN.h * 0.25);
    // The cardboard box with crayon dials, and Ellie in a colander helmet.
    const bx = SCREEN.w * 0.58;
    const by = SCREEN.h * 0.66;
    ctx.fillStyle = '#5a3a2a';
    ctx.beginPath();
    ctx.arc(bx + 30, by - 14, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9a066';
    ctx.beginPath();
    ctx.arc(bx + 30, by - 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9ccd2';
    ctx.beginPath();
    ctx.arc(bx + 30, by - 18, 11, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#c8955a';
    ctx.fillRect(bx, by, 70, 34);
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(bx + 18, by + 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7df3ff';
    ctx.fillRect(bx + 32, by + 10, 10, 8);
  }
  ctx.restore();
  // A few twinkles in the evening sky, live, so the title isn't a still.
  for (let i = 0; i < 12; i++) {
    const x = (i * 97) % SCREEN.w;
    const y = 10 + ((i * 53) % 70);
    ctx.fillStyle = alpha('#ffffff', 0.3 + 0.5 * Math.max(0, Math.sin(time * 2 + i * 1.7)));
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

/**
 * The warp, `k` from 0 to 1. First the backyard rushes in towards the box
 * while a starburst blooms out of it (the imagination kicking in); then a white
 * flash; then space at warp speed, slowing as the real ship flies in.
 */
export function drawWarp(ctx: CanvasRenderingContext2D, k: number, backdrop: string, sky: readonly [string, string], time: number): void {
  if (k < 0.45) {
    const t = k / 0.45;
    drawBackyard(ctx, time, 1 + t * t * 2.5);
    const cx = SCREEN.w * 0.62;
    const cy = SCREEN.h * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.8);
    const rays = 18;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      ctx.fillStyle = alpha(i % 2 ? PALETTE.gold : '#ffffff', 0.25 + 0.6 * t);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, SCREEN.w * 1.2 * t, a, a + Math.PI / rays);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = alpha('#ffffff', Math.max(0, (t - 0.7) / 0.3));
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
    return;
  }
  const t = (k - 0.45) / 0.55;
  const speed = 1 + (1 - t) * 12;
  drawSpace(ctx, backdrop, sky, time * (1 + (1 - t) * 4), speed);
  // The real ship zooms in from the left and settles.
  const ease = 1 - (1 - t) ** 3;
  drawShip(ctx, -40 + (SHIP.x + 40) * ease, SCREEN.h * 0.5, t > 0.6 ? 'cheer' : 'brave', time, 0);
  ctx.fillStyle = alpha('#ffffff', Math.max(0, 1 - t * 3));
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
}

/**
 * A hunter on its way: a flashing red chevron at the right edge, at the height
 * it will fly in at, so she sees it coming and slides out of the way.
 */
function drawWarnings(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  for (const w of state.warnings) {
    if (!w.active) continue;
    if (Math.floor(time * 8) % 2 === 1) continue;
    const x = SCREEN.w - 8;
    ctx.fillStyle = alpha('#ff4d6d', 0.95);
    ctx.beginPath();
    ctx.moveTo(x - 22, w.y);
    ctx.lineTo(x, w.y - 16);
    ctx.lineTo(x, w.y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 7, w.y - 8, 3, 10);
    ctx.fillRect(x - 7, w.y + 5, 3, 3);
  }
}

/**
 * A comet: a lumpy bright-orange rock with a fiery tail streaming behind it
 * (to the right, since it flies left). Drawn by code; it's small and fast.
 */
function drawComet(ctx: CanvasRenderingContext2D, e: Enemy, time: number): void {
  const r = ENEMIES.comet.r;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 5; i >= 1; i--) {
    const k = i / 5;
    ctx.fillStyle = alpha(i > 3 ? '#ff4d6d' : '#ffd23f', 0.32 * (1 - k * 0.6));
    ctx.beginPath();
    ctx.arc(r * 0.9 + i * 7, Math.sin(time * 20 + i) * 1.5, r * (1.05 - k * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.rotate(e.t * -4);
  // Bright and warm on purpose: it must pop against the dark sky from the far
  // right edge (the first purple rock was nearly invisible on stage 1).
  ctx.fillStyle = '#e8622c';
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const rr = r * (0.85 + 0.15 * Math.sin(i * 2.7 + e.seed));
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffb36b';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.2, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9a3412';
  for (const [cx, cy, cr] of [[0.3, 0.25, 0.2], [-0.35, 0.35, 0.14], [0.1, -0.45, 0.12]] as const) {
    ctx.beginPath();
    ctx.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- Stage hazards ----------------------------------------------------------------------

/**
 * An asteroid (or a rock it broke into): the painted rock if there is one,
 * spinning slowly, with cracks showing as it takes damage.
 */
function drawAsteroid(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const spec = ENEMIES[e.kind];
  const image = sprite('asteroid');
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.t * (e.kind === 'rock' ? 2.5 : 0.4) + e.seed);
  flashed(ctx, e.flash > 0 ? 0.6 : 0, () => {
    if (image) {
      drawContent(ctx, image, 0, 0, spec.w);
      return;
    }
    const r = spec.r * 1.1;
    ctx.fillStyle = '#8a6a55';
    ctx.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const rr = r * (0.82 + 0.18 * Math.sin(i * 2.3 + e.seed * 5));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a3428';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#6b4f40';
    for (const [cx, cy, cr] of [[0.3, 0.2, 0.22], [-0.35, -0.25, 0.18], [-0.1, 0.45, 0.14]] as const) {
      ctx.beginPath();
      ctx.arc(cx * r, cy * r, cr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // Cracks spread as it's worn down, so she can see it's working.
  if (e.kind === 'asteroid') {
    const left = e.hp / spec.hp;
    const cracks = left > 0.66 ? 0 : left > 0.33 ? 2 : 4;
    ctx.strokeStyle = 'rgba(40, 20, 10, 0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < cracks; i++) {
      const a = e.seed + i * 1.7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * spec.r * 0.5, Math.sin(a) * spec.r * 0.5);
      ctx.lineTo(Math.cos(a + 0.4) * spec.r * 0.95, Math.sin(a + 0.4) * spec.r * 0.95);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Black holes: a swirling dark disc in a purple glow, with dust spiralling in. */
function drawBlackHoles(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const image = sprite('blackhole');
  for (const h of state.holes) {
    if (!h.active) continue;
    const R = BLACK_HOLE.drawR;
    ctx.save();
    ctx.translate(h.x, h.y);
    // The pull, made visible: faint rings drawn inwards.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const k = 1 - ((time * 0.6 + i / 3) % 1);
      ctx.strokeStyle = alpha('#a855f7', 0.25 * (1 - k));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R * (0.6 + k * 2.2), 0, Math.PI * 2);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 1.6);
    glow.addColorStop(0, alpha('#c084fc', 0.5));
    glow.addColorStop(1, alpha('#c084fc', 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(-time * 1.8);
    if (image) {
      drawContent(ctx, image, 0, 0, R * 2.4);
    } else {
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = alpha(i % 2 ? '#f0abfc' : '#7c3aed', 0.9);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, R * (0.45 + i * 0.12), i, i + Math.PI * 1.2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#05010d';
    ctx.beginPath();
    ctx.arc(0, 0, BLACK_HOLE.r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** The warning: the zone the giant comet will fill, flashing red, with arrows to the safe side. */
function drawCometWarning(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const c = state.bigComet;
  if (c.phase !== 'warn') return;
  const on = Math.floor(time * 6) % 2 === 0;
  ctx.fillStyle = alpha('#ff3b3b', on ? 0.28 : 0.12);
  ctx.fillRect(0, c.y0, SCREEN.w, c.y1 - c.y0);
  ctx.strokeStyle = alpha('#ff3b3b', 0.9);
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(1, c.y0 + 1, SCREEN.w - 2, c.y1 - c.y0 - 2);
  ctx.setLineDash([]);
  // Arrows pointing to the safe strip.
  const down = c.y0 === BAND_TOP;
  const ay = down ? c.y1 + 14 : c.y0 - 14;
  ctx.fillStyle = on ? '#ffffff' : alpha('#ffffff', 0.5);
  for (const x of [SHIP.x, SCREEN.w * 0.4, SCREEN.w * 0.6]) {
    ctx.beginPath();
    ctx.moveTo(x - 9, ay - (down ? 6 : -6));
    ctx.lineTo(x + 9, ay - (down ? 6 : -6));
    ctx.lineTo(x, ay + (down ? 6 : -6));
    ctx.closePath();
    ctx.fill();
  }
}

/** The giant comet itself: a huge flaming head and a long burning tail. */
function drawBigComet(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const c = state.bigComet;
  if (c.phase !== 'fly') return;
  const h = c.y1 - c.y0;
  const cy = (c.y0 + c.y1) / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 12; i >= 1; i--) {
    const k = i / 12;
    ctx.fillStyle = alpha(i > 7 ? '#ff4d6d' : i > 3 ? '#ff9f1c' : '#ffe066', 0.16);
    ctx.beginPath();
    ctx.ellipse(c.x + BIG_COMET.tail * k * 0.9, cy + Math.sin(time * 14 + i) * 3, h * 0.5 * (1 - k * 0.55), h * 0.42 * (1 - k * 0.5), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const image = sprite('megacomet');
  ctx.save();
  ctx.translate(c.x, cy);
  if (image) {
    drawContent(ctx, image, h * 0.35, 0, h * 1.9);
  } else {
    ctx.rotate(-time * 2);
    ctx.fillStyle = '#d9480f';
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = h * 0.4 * (0.85 + 0.15 * Math.sin(i * 2.1));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb36b';
    ctx.beginPath();
    ctx.arc(-h * 0.08, -h * 0.08, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * World 2's projectiles, drawn by code: a glowing lava blob, a snowball, and a
 * mine that blinks faster as its fuse runs down. Same sizes as the stink
 * bubbles they share hitboxes with.
 */
function drawSpecialBubble(ctx: CanvasRenderingContext2D, b: Bubble, r: number, time: number): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.kind === 'lava') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = alpha('#ff6b00', 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.25, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a2a0a';
    ctx.beginPath();
    ctx.arc(r * 0.35, r * 0.3, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'snow') {
    ctx.rotate(b.t * 4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bfdbfe';
    ctx.beginPath();
    ctx.arc(r * 0.25, r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // A mine: a spiky purple ball whose light blinks faster as it's about to go.
    const blink = Math.floor(time * (b.fuse < 0.8 ? 14 : 4)) % 2 === 0;
    ctx.rotate(b.t * 1.5);
    ctx.fillStyle = '#6d28d9';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * r * 0.8, Math.sin(a - 0.2) * r * 0.8);
      ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
      ctx.lineTo(Math.cos(a + 0.2) * r * 0.8, Math.sin(a + 0.2) * r * 0.8);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#ff3b3b' : '#fca5a5';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
