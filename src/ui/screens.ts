/**
 * Every screen that isn't flying: title, stage select, pause, the results, and
 * the in-flight HUD.
 *
 * Buttons are computed by a function per screen, and the same function feeds
 * both drawing and hit-testing, as in the siblings, so a button can never be
 * drawn in one place and tappable in another. Every button is big (at least
 * 40px tall in a 270px frame): she's five.
 */

import { BAND_TOP, SCREEN, SHIELDS, STAGE_INTRO } from '../game/config';
import type { GameState } from '../game/state';
import { STAGES, isStageUnlocked } from '../game/stages';
import { drawStar } from '../render/particles';
import { PALETTE, alpha } from '../render/palette';
import { drawText } from './text';

export interface Button {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  locked?: boolean;
  stars?: number;
  small?: boolean;
}

export function hitTest(buttons: readonly Button[], x: number, y: number): Button | null {
  // A little slop around every button: a near miss counts.
  const slop = 6;
  for (const b of buttons) {
    if (x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop) return b;
  }
  return null;
}

function drawButton(ctx: CanvasRenderingContext2D, b: Button, time = 0): void {
  const face = b.locked ? PALETTE.locked : b.id === 'play' || b.id === 'next' || b.id === 'retry-checkpoint' ? PALETTE.button : PALETTE.panel;
  const pulse = b.id === 'play' ? Math.sin(time * 4) * 1.5 : 0;
  const x = b.x - pulse;
  const y = b.y - pulse;
  const w = b.w + pulse * 2;
  const h = b.h + pulse * 2;
  ctx.fillStyle = alpha('#000000', 0.35);
  roundRect(ctx, x + 2, y + 3, w, h, 8);
  ctx.fill();
  ctx.fillStyle = face;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = b.locked ? alpha('#ffffff', 0.2) : alpha(PALETTE.panelEdge, 0.8);
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();
  drawText(ctx, b.label, x + w / 2, y + h / 2 + (b.stars !== undefined ? -6 : 0), {
    size: b.small ? 9 : 13,
    color: b.locked ? '#9aa0b8' : '#ffffff',
    align: 'center',
  });
  if (b.locked && b.stars !== undefined) drawLock(ctx, x + w / 2, y + h - 18);
  if (b.stars !== undefined && !b.locked) {
    for (let i = 0; i < 3; i++) {
      drawStar(ctx, x + w / 2 + (i - 1) * 14, y + h - 12, 5.5, i < b.stars ? PALETTE.gold : alpha('#ffffff', 0.2));
    }
  }
}

/** A little padlock, so a locked stage reads as "not yet" rather than "broken". */
function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = '#9aa0b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 3, 4.5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#9aa0b8';
  ctx.fillRect(x - 6.5, y - 3, 13, 10);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function muteButton(muted: boolean): Button {
  return { id: 'mute', x: SCREEN.w - 44, y: 8, w: 36, h: 28, label: muted ? 'x' : '♪', small: true };
}

// --- Title -----------------------------------------------------------------------------

export function titleButtons(muted: boolean): Button[] {
  return [{ id: 'play', x: 24, y: SCREEN.h - 70, w: 150, h: 46, label: 'BLAST OFF!' }, muteButton(muted)];
}

export function drawTitle(ctx: CanvasRenderingContext2D, muted: boolean, time: number): void {
  const bob = Math.sin(time * 2) * 2;
  drawText(ctx, 'CAPTAIN ELLIE', SCREEN.w / 2 + 2, 38 + bob + 2, { size: 30, color: PALETTE.hudShadow, align: 'center' });
  drawText(ctx, 'CAPTAIN ELLIE', SCREEN.w / 2, 38 + bob, { size: 30, color: PALETTE.gold, align: 'center' });
  drawText(ctx, 'and the Space Raccoons', SCREEN.w / 2 + 1, 66 + bob + 1, { size: 13, color: PALETTE.hudShadow, align: 'center' });
  drawText(ctx, 'and the Space Raccoons', SCREEN.w / 2, 66 + bob, { size: 13, color: '#ffffff', align: 'center' });
  for (const b of titleButtons(muted)) drawButton(ctx, b, time);
}

// --- Stage select ------------------------------------------------------------------------

/** Stages come in worlds of five, one row each. */
export const WORLDS = ['World 1: Raccoon Space', "World 2: Mama's Galaxy"] as const;
const PER_ROW = 5;

function rowY(row: number): number {
  return 54 + row * 102;
}

export function selectButtons(stars: Record<number, number>): Button[] {
  const gap = 8;
  const w = Math.min(84, (SCREEN.w - 40 - gap * (PER_ROW - 1)) / PER_ROW);
  const x0 = (SCREEN.w - (w * PER_ROW + gap * (PER_ROW - 1))) / 2;
  const buttons: Button[] = STAGES.map((s, i) => ({
    id: `stage:${s.id}`,
    x: x0 + (i % PER_ROW) * (w + gap),
    y: rowY(Math.floor(i / PER_ROW)),
    w,
    h: 62,
    label: String(s.id),
    locked: !isStageUnlocked(stars, s.id),
    stars: stars[s.id] ?? 0,
  }));
  buttons.push({ id: 'back', x: 10, y: 8, w: 64, h: 26, label: 'Back', small: true });
  return buttons;
}

export function drawSelect(ctx: CanvasRenderingContext2D, stars: Record<number, number>): void {
  ctx.fillStyle = alpha('#000000', 0.35);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  drawText(ctx, 'Pick a stage!', SCREEN.w / 2, 20, { size: 18, color: PALETTE.gold, align: 'center', glow: true });
  const buttons = selectButtons(stars);
  WORLDS.forEach((name, row) => {
    if (row * PER_ROW >= STAGES.length) return;
    const first = buttons[row * PER_ROW]!;
    drawText(ctx, name, first.x, rowY(row) - 9, { size: 8, color: row === 0 ? '#a5d8ff' : '#fbb6ce', align: 'left' });
  });
  for (const b of buttons) drawButton(ctx, b);
  // The stage names, small, under each card.
  STAGES.forEach((s, i) => {
    const b = buttons[i]!;
    drawText(ctx, s.name, b.x + b.w / 2, b.y + b.h + 9, { size: 7, color: '#ffffff', align: 'center' });
  });
}

// --- HUD -----------------------------------------------------------------------------------

export function hudButtons(): Button[] {
  return [{ id: 'pause', x: SCREEN.w - 40, y: 2, w: 34, h: 22, label: 'II', small: true }];
}

export function drawHud(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  // Shields: one glowing pip each, with empty slots up to the start count.
  const slots = Math.max(SHIELDS.start, state.ship.shields);
  for (let i = 0; i < slots; i++) {
    const on = i < state.ship.shields;
    drawHeart(ctx, 14 + i * 16, BAND_TOP / 2, on ? PALETTE.heart : alpha('#ffffff', 0.18), on && state.ship.shields === 1 ? 1 + 0.15 * Math.sin(time * 10) : 1);
  }
  drawText(ctx, String(state.score), SCREEN.w - 50, BAND_TOP / 2, { size: 10, color: '#ffffff', align: 'right' });
  for (const b of hudButtons()) drawButton(ctx, b);

  // The boss's bar, across the top centre.
  const boss = state.boss;
  if (boss.phase === 'fight' || boss.phase === 'enter' || boss.phase === 'dying') {
    const w = Math.min(200, SCREEN.w * 0.4);
    const x = (SCREEN.w - w) / 2;
    const y = 8;
    ctx.fillStyle = alpha('#000000', 0.5);
    ctx.fillRect(x - 1, y - 1, w + 2, 10);
    ctx.fillStyle = PALETTE.heart;
    ctx.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 8);
    drawText(ctx, state.stage.boss.name, SCREEN.w / 2, y + 16, { size: 7, color: '#ffffff', align: 'center' });
  }

  // The stage banner.
  if (state.time < 0) {
    const k = 1 + state.time / STAGE_INTRO; // 0 -> 1
    const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
    ctx.globalAlpha = a;
    drawText(ctx, `STAGE ${state.stage.id}`, SCREEN.w / 2, SCREEN.h / 2 - 16, { size: 13, color: '#ffffff', align: 'center', glow: true });
    drawText(ctx, state.stage.name, SCREEN.w / 2, SCREEN.h / 2 + 6, { size: 22, color: PALETTE.gold, align: 'center', glow: true });
    ctx.globalAlpha = 1;
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-8, -1, -5, -7, 0, -3);
  ctx.bezierCurveTo(5, -7, 8, -1, 0, 5);
  ctx.fill();
  ctx.restore();
}

// --- Pause ---------------------------------------------------------------------------------

export function pauseButtons(muted: boolean): Button[] {
  const cx = SCREEN.w / 2;
  return [
    { id: 'resume', x: cx - 80, y: 90, w: 160, h: 40, label: 'Keep flying' },
    { id: 'restart', x: cx - 80, y: 140, w: 160, h: 34, label: 'Start stage again', small: true },
    { id: 'stages', x: cx - 80, y: 182, w: 160, h: 34, label: 'Stages', small: true },
    muteButton(muted),
  ];
}

export function drawPause(ctx: CanvasRenderingContext2D, muted: boolean): void {
  ctx.fillStyle = alpha('#000000', 0.55);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  drawText(ctx, 'Paused', SCREEN.w / 2, 60, { size: 20, color: '#ffffff', align: 'center' });
  for (const b of pauseButtons(muted)) drawButton(ctx, b);
}

// --- Results ----------------------------------------------------------------------------------

export function clearedButtons(hasNext: boolean): Button[] {
  const cx = SCREEN.w / 2;
  const buttons: Button[] = [];
  if (hasNext) buttons.push({ id: 'next', x: cx - 80, y: 150, w: 160, h: 44, label: 'Next stage!' });
  buttons.push({ id: 'again', x: cx - 128, y: 204, w: 120, h: 34, label: 'Play again', small: true });
  buttons.push({ id: 'stages', x: cx + 8, y: 204, w: 120, h: 34, label: 'Stages', small: true });
  return buttons;
}

export function drawCleared(ctx: CanvasRenderingContext2D, state: GameState, hasNext: boolean, time: number): void {
  const k = Math.min(1, Math.max(0, state.endTime) * 2);
  ctx.fillStyle = alpha('#000000', 0.45 * k);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  ctx.globalAlpha = k;
  const last = state.stage.id === STAGES.length;
  drawText(ctx, last ? 'YOU SAVED SPACE!' : 'STAGE CLEAR!', SCREEN.w / 2, 56, { size: 24, color: PALETTE.gold, align: 'center', glow: true });
  for (let i = 0; i < 3; i++) {
    const pop = Math.min(1, Math.max(0, state.endTime * 3 - i * 0.6));
    const s = 14 * (pop < 1 ? pop * 1.3 : 1) + (i < state.stars ? Math.sin(time * 5 + i) : 0);
    drawStar(ctx, SCREEN.w / 2 + (i - 1) * 40, 104, s, i < state.stars ? PALETTE.gold : alpha('#ffffff', 0.2));
  }
  if (state.endTime > 0.6) for (const b of clearedButtons(hasNext)) drawButton(ctx, b);
  ctx.globalAlpha = 1;
}

export function lostButtons(): Button[] {
  const cx = SCREEN.w / 2;
  return [
    { id: 'retry-checkpoint', x: cx - 90, y: 130, w: 180, h: 48, label: 'Try again!' },
    { id: 'stages', x: cx - 60, y: 192, w: 120, h: 34, label: 'Stages', small: true },
  ];
}

export function drawLost(ctx: CanvasRenderingContext2D, state: GameState): void {
  const k = Math.min(1, state.endTime * 2);
  ctx.fillStyle = alpha('#000000', 0.45 * k);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  ctx.globalAlpha = k;
  drawText(ctx, 'Oopsie!', SCREEN.w / 2, 70, { size: 26, color: PALETTE.gold, align: 'center', glow: true });
  drawText(ctx, 'The raccoons got lucky. Fly again?', SCREEN.w / 2, 100, { size: 10, color: '#ffffff', align: 'center' });
  if (state.endTime > 0.6) for (const b of lostButtons()) drawButton(ctx, b);
  ctx.globalAlpha = 1;
}
