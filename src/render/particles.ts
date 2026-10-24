/**
 * Everything that is pure decoration: sparkles, puffs, explosions, shock rings,
 * score popups, and the raccoons floating away in their bubble helmets.
 *
 * One fixed pool, as in the siblings. Nothing here affects the game; it's all
 * spawned by main.ts from the simulation's events.
 */

import { spriteFrames, drawSprite } from './sprites';
import { PALETTE, alpha } from './palette';
import { drawText } from '../ui/text';

type Kind = 'spark' | 'star' | 'puff' | 'boom' | 'ring' | 'popup' | 'pilot' | 'stink';

interface Particle {
  alive: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds alive, and how long it lives. */
  t: number;
  life: number;
  size: number;
  spin: number;
  spinV: number;
  color: string;
  text: string;
  frame: number;
}

const POOL = 700;

export class Particles {
  private readonly pool: Particle[] = [];

  constructor() {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        alive: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 1,
        spin: 0, spinV: 0, color: '#fff', text: '', frame: 0,
      });
    }
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }

  private spawn(kind: Kind, x: number, y: number, life: number): Particle | null {
    const p = this.pool.find((p) => !p.alive);
    if (!p) return null;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.t = 0;
    p.life = life;
    p.size = 1;
    p.spin = Math.random() * Math.PI * 2;
    p.spinV = 0;
    p.color = '#fff';
    p.text = '';
    p.frame = 0;
    return p;
  }

  sparks(x: number, y: number, n: number, color: string, speed = 90): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn('spark', x, y, 0.3 + Math.random() * 0.3);
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.size = 1 + Math.random() * 1.5;
      p.color = color;
    }
  }

  /** A raccoon ship going poof: a burst of little spinning stars. */
  starBurst(x: number, y: number, n = 10, speed = 80): void {
    const colors = [PALETTE.gold, '#ffffff', PALETTE.shipPink, PALETTE.laser];
    for (let i = 0; i < n; i++) {
      const p = this.spawn('star', x, y, 0.6 + Math.random() * 0.4);
      if (!p) return;
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const s = speed * (0.5 + Math.random() * 0.7);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.size = 2.5 + Math.random() * 2.5;
      p.spinV = (Math.random() - 0.5) * 10;
      p.color = colors[i % colors.length]!;
    }
  }

  puff(x: number, y: number, size: number, color = '#ffffff', life = 0.5): void {
    const p = this.spawn('puff', x, y, life);
    if (!p) return;
    p.size = size;
    p.color = color;
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = (Math.random() - 0.5) * 20;
  }

  /** A fireball: the painted flipbook if there is one, a drawn one if not. */
  explosion(x: number, y: number, size: number): void {
    const p = this.spawn('boom', x, y, 0.55 + size * 0.2);
    if (p) {
      p.size = size;
      p.spin = Math.random() * Math.PI * 2;
    }
    const ring = this.spawn('ring', x, y, 0.4);
    if (ring) {
      ring.size = size * 60;
      ring.color = '#ffffff';
    }
    this.sparks(x, y, Math.round(10 + size * 12), PALETTE.flame, 140 * size);
    this.starBurst(x, y, Math.round(4 + size * 4), 110 * size);
  }

  ring(x: number, y: number, radius: number, color: string, life = 0.5): void {
    const p = this.spawn('ring', x, y, life);
    if (!p) return;
    p.size = radius;
    p.color = color;
  }

  popup(x: number, y: number, text: string, color: string, size = 10, life = 0.8): void {
    const p = this.spawn('popup', x, y, life);
    if (!p) return;
    p.text = text;
    p.color = color;
    p.size = size;
    p.vy = -30;
  }

  /** Nobody's hurt: the pilot floats off in a bubble helmet, spinning, waving. */
  pilot(x: number, y: number): void {
    const p = this.spawn('pilot', x, y, 2.2);
    if (!p) return;
    p.vx = 30 + Math.random() * 40;
    p.vy = -30 - Math.random() * 40;
    p.spinV = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2);
    p.frame = Math.floor(Math.random() * 8);
  }

  /** A stink bubble popping into a little green cloud. */
  stink(x: number, y: number): void {
    const p = this.spawn('stink', x, y, 0.8);
    if (!p) return;
    p.frame = Math.floor(Math.random() * 8);
    p.vy = -12;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.life) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += p.spinV * dt;
      if (p.kind === 'spark' || p.kind === 'star') {
        p.vx *= 1 - 2.5 * dt;
        p.vy *= 1 - 2.5 * dt;
      } else if (p.kind === 'popup') {
        p.vy *= 1 - 3 * dt;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const booms = spriteFrames('boom.fx');
    const pilots = spriteFrames('pilot.float');
    const clouds = spriteFrames('fart.clouds');
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.t / p.life;
      switch (p.kind) {
        case 'spark':
          ctx.fillStyle = alpha(p.color, 1 - k);
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case 'star':
          ctx.save();
          ctx.globalAlpha = 1 - k * k;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          drawStar(ctx, 0, 0, p.size * (1 - k * 0.4), p.color);
          ctx.restore();
          break;
        case 'puff':
          ctx.fillStyle = alpha(p.color, 0.5 * (1 - k));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.6 + k * 0.8), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = alpha(p.color, 0.8 * (1 - k));
          ctx.lineWidth = 3 * (1 - k) + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.2 + k * 0.8), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'boom': {
          const r = 34 * p.size;
          if (booms) {
            const frame = booms[Math.min(booms.length - 1, Math.floor(k * booms.length))]!;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(p.x, p.y);
            ctx.rotate(p.spin);
            drawSprite(ctx, frame, 0, 0, r * 2.4, r * 2.4);
            ctx.restore();
          } else {
            const grow = Math.min(1, k * 3);
            ctx.fillStyle = alpha('#ffffff', Math.max(0, 1 - k * 4));
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.6 * grow, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = alpha(k < 0.4 ? PALETTE.gold : PALETTE.boom, 0.9 * (1 - k));
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * grow, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = alpha('#e04a2a', 0.7 * (1 - k));
            for (let i = 0; i < 5; i++) {
              const a = p.spin + (i / 5) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(p.x + Math.cos(a) * r * 0.7 * grow, p.y + Math.sin(a) * r * 0.7 * grow, r * 0.4 * grow, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }
        case 'popup':
          ctx.save();
          ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          drawText(ctx, p.text, p.x + 1, p.y + 1, { size: p.size, color: PALETTE.hudShadow, align: 'center' });
          drawText(ctx, p.text, p.x, p.y, { size: p.size, color: p.color, align: 'center' });
          ctx.restore();
          break;
        case 'pilot': {
          ctx.save();
          ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin);
          const frame = pilots?.[p.frame % pilots.length];
          if (frame) drawSprite(ctx, frame, 0, 0, 26, 26);
          else drawPilot(ctx);
          ctx.restore();
          break;
        }
        case 'stink': {
          ctx.save();
          ctx.globalAlpha = 0.8 * (1 - k);
          const frame = clouds?.[p.frame % clouds.length];
          const s = 18 + k * 14;
          if (frame) drawSprite(ctx, frame, p.x, p.y, s, s);
          else {
            ctx.fillStyle = PALETTE.bubble;
            ctx.beginPath();
            ctx.arc(p.x, p.y, s / 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          break;
        }
      }
    }
  }
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** The hand-drawn fallback: a round grey raccoon in a bubble. */
function drawPilot(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PALETTE.fur;
  ctx.beginPath();
  ctx.arc(0, 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.mask;
  ctx.fillRect(-6, -1, 12, 3);
  ctx.strokeStyle = alpha(PALETTE.glass, 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();
}
