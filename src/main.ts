import { Audio } from './core/audio';
import { Input, type QueuedPointer } from './core/input';
import { startLoop } from './core/loop';
import { clearStruggle, loadSave, recordLoss, recordStars, writeSave } from './core/save';
import { Viewport } from './core/viewport';
import { WakeLock } from './core/wakelock';
import { BAND_BOTTOM, BOOM_SLOWMO, BOOM_TIME_SCALE, ENEMIES, SCREEN, SHIP, WARP_TIME } from './game/config';
import { GameState, type GameEvent } from './game/state';
import { STAGES, isStageUnlocked, nextStage, stageById } from './game/stages';
import { PALETTE } from './render/palette';
import { Particles } from './render/particles';
import { camera, drawBackyard, drawScene, drawWarp, shake, updateCamera } from './render/scene';
import { loadSprites } from './render/sprites';
import {
  clearedButtons,
  drawCleared,
  drawHud,
  drawLost,
  drawPause,
  drawSelect,
  drawTitle,
  hitTest,
  hudButtons,
  lostButtons,
  pauseButtons,
  selectButtons,
  titleButtons,
} from './ui/screens';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

const viewport = new Viewport(canvas);
const input = new Input(viewport);
const state = new GameState();
const particles = new Particles();
const audio = new Audio();
const wakeLock = new WakeLock();

// Generated art and sound, both optional (scripts/generate-art.mjs,
// scripts/generate-sound.mjs). Each piece that arrives replaces its fallback.
loadSprites(import.meta.env.BASE_URL);
audio.loadRecorded(import.meta.env.BASE_URL);
const save = loadSave();
audio.muted = save.muted;

let realTime = 0;
/** Seconds into the imagination warp. */
let warpTime = 0;
/** The stage the warp is carrying her to. */
let warpStage = 1;
/** Real seconds of slow motion left, after a blast. */
let slowmo = 0;
let shotCount = 0;

/** Finger drag: where it went down, and the ship target it was anchored to. */
const drag = { active: false, startY: 0, baseY: 0 };

// --- Who says what, and how often -------------------------------------------------
//
// One voice at a time is enforced in audio.say(). These cooldowns are the other
// half: a line heard every five seconds stops being funny by the third time.

const lastSaid = new Map<string, number>();
function chance(key: string, cooldown: number, p: number): boolean {
  if (realTime - (lastSaid.get(key) ?? -999) < cooldown || Math.random() > p) return false;
  lastSaid.set(key, realTime);
  return true;
}
const RACCOON_GAIN = 0.8;

state.phase = 'title';

function startStage(id: number): void {
  state.help = save.struggle[id] ?? 0;
  state.load(stageById(id));
  particles.clear();
  slowmo = 0;
  drag.active = false;
  lastSaid.clear();
  audio.say(['e.captain'], { delay: 0.3 });
}

function beginWarp(id: number): void {
  warpStage = id;
  warpTime = 0;
  state.phase = 'warp';
  state.stage = stageById(id);
  audio.play('warp');
  audio.say(['e.blastoff'], { delay: 0.25, interrupt: true });
}

function toggleMute(): void {
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  writeSave(save);
}

function hasNext(): boolean {
  const next = nextStage(state.stage.id);
  return next !== null && isStageUnlocked(save.stars, next.id);
}

function pause(): void {
  if (state.phase !== 'play') return;
  state.pausedFrom = state.phase;
  state.phase = 'paused';
  drag.active = false;
}

// --- Input -------------------------------------------------------------------------------

function onPointer(p: QueuedPointer): void {
  const phase = state.phase;
  if (p.kind === 'up') {
    drag.active = false;
    return;
  }

  if (phase === 'title') {
    const hit = hitTest(titleButtons(audio.muted), p.x, p.y);
    if (hit?.id === 'mute') toggleMute();
    else if (hit?.id === 'play') {
      audio.play('select');
      state.phase = 'select';
    }
    return;
  }

  if (phase === 'select') {
    const hit = hitTest(selectButtons(save.stars), p.x, p.y);
    if (!hit) return;
    if (hit.id === 'back') {
      audio.play('select');
      state.phase = 'title';
      return;
    }
    if (hit.locked) {
      audio.play('deny');
      return;
    }
    beginWarp(Number(hit.id.slice('stage:'.length)));
    return;
  }

  if (phase === 'paused') {
    const hit = hitTest(pauseButtons(audio.muted), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'resume') state.phase = state.pausedFrom;
    else if (hit.id === 'restart') startStage(state.stage.id);
    else if (hit.id === 'stages') state.phase = 'select';
    else if (hit.id === 'mute') toggleMute();
    return;
  }

  if (phase === 'cleared') {
    if (state.endTime < 0.6) return;
    const hit = hitTest(clearedButtons(hasNext()), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'next') beginWarp(nextStage(state.stage.id)!.id);
    else if (hit.id === 'again') startStage(state.stage.id);
    else if (hit.id === 'stages') state.phase = 'select';
    return;
  }

  if (phase === 'lost') {
    if (state.endTime < 0.6) return;
    const hit = hitTest(lostButtons(), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'retry-checkpoint') {
      particles.clear();
      state.retry();
      audio.say(['e.again'], { delay: 0.2 });
    } else if (hit.id === 'stages') state.phase = 'select';
    return;
  }

  if (phase === 'play') {
    if (hitTest(hudButtons(), p.x, p.y)?.id === 'pause') {
      audio.play('select');
      pause();
      return;
    }
    // Anywhere else: start flying. The ship moves by the finger's movement
    // from here, never to the finger itself.
    drag.active = true;
    drag.startY = p.y;
    drag.baseY = state.ship.targetY;
  }
}

function steer(dt: number): void {
  if (state.phase !== 'play') return;
  if (drag.active && input.pointer.down) {
    // A black hole's pull moves the anchor too, so she feels it under her finger.
    drag.baseY += state.pullDY;
    const want = drag.baseY + (input.pointer.y - drag.startY) * SHIP.dragGain;
    state.setTarget(want);
    // At an edge, re-anchor, so reversing direction responds at once instead
    // of first having to "unwind" the finger travel spent pushing past it.
    if (state.ship.targetY !== want) {
      drag.baseY = state.ship.targetY;
      drag.startY = input.pointer.y;
    }
  }
  const dir = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
  if (dir !== 0) state.setTarget(state.ship.targetY + dir * SHIP.keySpeed * dt);
}

// --- Events -> sound, voices and particles -----------------------------------------------

/** A boss voice line: the raccoon bosses' `b.*`, or Mama Raccoon's own `m.*` in stage 10. */
function bossLine(name: string): string {
  return `${state.stage.boss.voice ?? 'b'}.${name}`;
}

const BOOM_WORDS = ['BOOM!', 'KABOOM!', 'BANG!', 'KA-BLAM!', 'POW!'];
let boomWord = 0;
let lastBoomWord = -10;

function bigBlast(x: number, y: number, size: number, word: string | null): void {
  particles.explosion(x, y, size);
  shake(Math.min(1.2, 0.5 + size * 0.4));
  camera.flash = Math.max(camera.flash, Math.min(1, size * 0.6));
  audio.play(size > 1.2 ? 'bigboom' : 'boom');
  audio.duck(0.3, 0.8);
  slowmo = BOOM_SLOWMO;
  if (word && realTime - lastBoomWord > 0.35) {
    particles.popup(x, y - 20 * size, word, '#ffd23f', 14 + size * 4, 0.9);
    lastBoomWord = realTime;
  }
}

function onEvent(e: GameEvent): void {
  switch (e.kind) {
    case 'shoot':
      // Every other volley, softly: autofire at full rate is a drone.
      if (shotCount++ % 2 === 0) audio.play('laser', 0.8);
      if (chance('pew', 25, 0.02)) audio.say(['e.pewpew']);
      break;
    case 'star-shot':
      audio.play('star');
      break;
    case 'hit':
      particles.sparks(e.x, e.y, 4, PALETTE.laser, 60);
      audio.play('zap', 0.6);
      break;
    case 'poof': {
      const kind = e.tag as keyof typeof ENEMIES;
      if (kind === 'asteroid') {
        bigBlast(e.x, e.y, 0.9, e.value ? 'CRUNCH!' : null);
        particles.puff(e.x, e.y, 22, '#b08968', 0.8);
        if (e.value) particles.popup(e.x, e.y - 34, `+${ENEMIES.asteroid.score}`, PALETTE.gold, 10, 0.8);
        break;
      }
      if (kind === 'comet' || kind === 'rock') {
        // A rock crumbling: no pilot.
        particles.starBurst(e.x, e.y, 8);
        particles.puff(e.x, e.y, 9, '#9b6aa8');
        audio.play('pop', 0.6);
        break;
      }
      const big = kind === 'tooter' || kind === 'carrier';
      particles.starBurst(e.x, e.y, big ? 16 : 10);
      particles.puff(e.x, e.y, big ? 16 : 10);
      if (big) particles.explosion(e.x, e.y, 0.7);
      particles.pilot(e.x, e.y);
      audio.play('pop');
      if (big) audio.play('boom', 0.6);
      if (e.value) {
        particles.popup(e.x, e.y - 12, `+${ENEMIES[kind].score}`, PALETTE.gold, 9, 0.7);
        if (chance('e.gotcha', 7, 0.3)) audio.say(['e.gotcha', 'e.takethat']);
        else if (chance('r.bye', 6, 0.3)) audio.say(['r.whoa', 'r.bye', 'r.nofair', 'r.uhoh'], { gain: RACCOON_GAIN, delay: 0.1 });
      }
      break;
    }
    case 'escape':
      if (e.tag === 'comet' || e.tag === 'asteroid' || e.tag === 'rock') break;
      if (chance('r.escape', 8, 0.4)) audio.say(['r.missed', 'r.smell', 'r.cantcatch'], { gain: RACCOON_GAIN });
      break;
    case 'tease':
      if (chance('r.tease', 6, 0.6)) {
        audio.say(['r.nyah', 'r.fart1', 'r.fart2', 'r.giggle'], { gain: RACCOON_GAIN });
        // Sometimes she answers.
        if (Math.random() < 0.4) audio.say(['e.nyah'], { delay: 1.1 });
      }
      break;
    case 'toot':
      audio.toot(Math.random() < 0.5 ? 'pfft' : 'squeak', 1.1, 0.7);
      particles.puff(e.x - 20, e.y, 8, PALETTE.bubble, 0.6);
      if (chance('r.toot', 9, 0.5)) audio.say(['r.toot', 'r.giggle'], { gain: RACCOON_GAIN, delay: 0.25 });
      break;
    case 'pickup':
      particles.starBurst(e.x, e.y, 14, 100);
      particles.ring(e.x, e.y, 30, '#ffffff', 0.4);
      if (e.tag === 'heart') {
        audio.play('heart');
        particles.popup(SHIP.x, state.ship.y - 22, 'SHIELD!', PALETTE.heart, 11);
        audio.say(['e.shield'], { interrupt: true });
      } else if (e.tag === 'weapon') {
        audio.play('powerup');
        particles.popup(SHIP.x + 10, state.ship.y - 22, e.value >= 3 ? 'STAR POWER!' : 'SUPER LASER!', PALETTE.laser, 11);
        audio.say([e.value >= 3 ? 'e.stars' : 'e.laser'], { interrupt: true });
      } else if (e.tag === 'star') {
        audio.play('powerup');
        particles.popup(SHIP.x + 10, state.ship.y - 22, '+500', PALETTE.gold, 11);
        audio.say(['e.wow'], { interrupt: true });
      }
      break;
    case 'bomb':
      bigBlast(e.x + 20, e.y, 1.6, 'MEGA BOOM!');
      particles.ring(e.x, e.y, SCREEN.w, PALETTE.gold, 0.8);
      audio.say(['e.kaboom'], { interrupt: true });
      break;
    case 'hurt':
      audio.play('hurt');
      shake(0.5);
      particles.sparks(e.x, e.y, 10, PALETTE.shield, 100);
      particles.ring(e.x, e.y, 34, PALETTE.shield, 0.4);
      if (e.tag === 'bubble') particles.stink(e.x, e.y);
      if (e.value > 0) {
        audio.say([e.tag === 'bubble' ? 'e.ew' : 'e.whoa'], { interrupt: true });
        if (chance('r.laugh', 5, 0.5)) audio.say(['r.giggle', 'r.missed'], { gain: RACCOON_GAIN, delay: 1 });
      }
      break;
    case 'boss-enter':
      audio.play('alarm');
      particles.popup(SCREEN.w / 2, SCREEN.h / 2 - 30, 'HERE COMES A BIG ONE!', PALETTE.heart, 14, 2.2);
      audio.say(['e.uhoh'], { interrupt: true, delay: 0.3 });
      audio.say([bossLine('hello')], { delay: 2.4 });
      break;
    case 'hazard':
      if (e.tag === 'blackhole') {
        audio.toot('rumble', 0.5, 0.7);
        audio.play('alarm', 0.5);
        particles.popup(SCREEN.w - 90, e.y - 46, 'BLACK HOLE!', '#c084fc', 14, 1.8);
        if (chance('e.whoa.bh', 10, 0.6)) audio.say(['e.whoa'], { delay: 0.6 });
      } else if (e.tag === 'bigcomet-warn') {
        audio.play('alarm');
        setTimeout(() => audio.play('alarm'), 450);
        particles.popup(SCREEN.w / 2, e.y - 10, 'BIG COMET!', PALETTE.heart, 20, 1.5);
        particles.popup(SCREEN.w / 2, e.y + 14, e.value === 0 ? 'GO DOWN!' : 'GO UP!', '#ffffff', 14, 1.5);
        audio.say(['e.uhoh'], { delay: 0.3 });
      } else if (e.tag === 'eruption') {
        audio.play('bigboom', 0.5);
        audio.toot('rumble', 0.6, 0.8);
        shake(0.7);
        particles.popup(SCREEN.w * 0.6, BAND_BOTTOM - 26, 'ERUPTION!', '#ff8c42', 14, 1.3);
      } else if (e.tag === 'bigcomet') {
        audio.play('warp');
        audio.play('bigboom', 0.6);
        shake(1.2);
      }
      break;
    case 'mine':
      particles.explosion(e.x, e.y, 0.5);
      audio.play('pop');
      audio.toot('squeak', 1, 0.6);
      break;
    case 'boss-rage':
      // Two thirds and one third of its health gone: it gets MAD, and faster.
      shake(0.9);
      camera.flash = 0.5;
      audio.play('alarm');
      audio.toot('rumble', 0.7, 1);
      particles.popup(e.x - 20, e.y - 70, e.value >= 2 ? 'SUPER MAD!' : "HE'S MAD!", PALETTE.heart, 16, 1.6);
      audio.say([bossLine('ouch')], { delay: 0.3 });
      break;
    case 'boss-attack':
      if (e.tag === 'snowballs') {
        audio.play('zap', 0.6);
        break;
      }
      if (e.tag === 'mines') {
        audio.play('alarm', 0.4);
        particles.popup(e.x - 60, e.y - 50, 'MINES!', PALETTE.heart, 11, 0.9);
        break;
      }
      if (e.tag === 'charge') {
        audio.play('alarm', 0.6);
        particles.popup(e.x - 60, e.y - 50, 'LOOK OUT!', PALETTE.heart, 12, 0.9);
        break;
      }
      if (e.tag === 'lunge') {
        audio.play('warp', 0.7);
        shake(0.6);
        break;
      }
      if (e.tag === 'bigtoot') {
        audio.toot('rumble', 0.8, 1);
        if (chance('b.toot', 8, 0.7)) audio.say([bossLine('toot')], { delay: 0.2 });
      } else if (e.tag !== 'minions') {
        audio.toot('pfft', 0.9, 0.8);
      }
      if (chance('b.never', 14, 0.3)) audio.say([bossLine('never')], { delay: 0.6 });
      break;
    case 'boss-hit':
      particles.sparks(e.x, e.y, 3, PALETTE.gold, 70);
      if (Math.random() < 0.3) audio.play('zap', 0.4);
      if ((e.value < 0.5 && chance('b.ouch1', 999, 1)) || (e.value < 0.2 && chance('b.ouch2', 999, 1))) audio.say([bossLine('ouch')]);
      break;
    case 'boss-boom': {
      const final = e.tag === 'final';
      bigBlast(e.x, e.y, e.value, final ? 'MEGA BOOM!' : BOOM_WORDS[boomWord++ % BOOM_WORDS.length]!);
      if (final) {
        camera.flash = 1;
        audio.play('bigboom');
        audio.say(['e.kaboom'], { interrupt: true });
        for (let i = 0; i < 6; i++) particles.explosion(e.x + (Math.random() - 0.5) * 120, e.y + (Math.random() - 0.5) * 90, 0.8);
      }
      break;
    }
    case 'boss-dead':
      particles.pilot(e.x, e.y);
      audio.say([bossLine('lose')], { delay: 0.9 });
      audio.say(['e.won'], { delay: 3 });
      break;
    case 'cleared':
      recordStars(save, state.stage.id, e.value);
      clearStruggle(save, state.stage.id);
      setTimeout(() => audio.play('win'), 1200);
      break;
    case 'checkpoint':
      audio.play('checkpoint');
      particles.popup(SCREEN.w / 2, 46, 'Checkpoint!', PALETTE.laser, 11, 1.4);
      break;
    case 'warn':
      audio.play('alarm', 0.35);
      break;
    case 'lost':
      // Next try gets a little more help (HELP). state.help is read on retry.
      state.help = recordLoss(save, state.stage.id);
      // A real KABOOM: running out of shields is an event, not a shrug. She
      // floats out in her bubble helmet (the lost panel), nobody hurt.
      audio.play('lose');
      bigBlast(e.x, e.y, 1.3, 'KABOOM!');
      particles.starBurst(e.x, e.y, 24);
      camera.flash = 0.8;
      audio.say(['e.ohno'], { interrupt: true, delay: 0.5 });
      break;
  }
}

// --- Loop --------------------------------------------------------------------------------

function update(dt: number): void {
  realTime += dt;
  if (input.consumeAnyPress()) {
    audio.unlock();
    wakeLock.arm();
  }
  input.drainKeys((k) => {
    if (k === 'pause') {
      if (state.phase === 'paused') state.phase = state.pausedFrom;
      else pause();
    } else if (k === 'restart' && (state.phase === 'play' || state.phase === 'lost' || state.phase === 'cleared')) {
      startStage(state.stage.id);
    } else if (k === 'confirm') {
      if (state.phase === 'title') state.phase = 'select';
      else if (state.phase === 'lost' && state.endTime > 0.6) state.retry();
      else if (state.phase === 'cleared' && state.endTime > 0.6 && hasNext()) beginWarp(nextStage(state.stage.id)!.id);
    }
  });
  input.drainPointer(onPointer);
  steer(dt);

  const menu = state.phase === 'title' || state.phase === 'select';
  const bossMusic = state.boss.phase === 'enter' || state.boss.phase === 'fight' || state.boss.phase === 'dying';
  audio.setMusic(menu ? 'music.title' : state.phase === 'warp' ? '' : bossMusic ? 'music.boss' : state.stage.id > 5 && audio.has('music.space2') ? 'music.space2' : 'music.space');
  audio.updateMusic();

  updateCamera(dt, realTime);
  if (state.phase === 'warp') {
    warpTime += dt;
    if (warpTime >= WARP_TIME) startStage(warpStage);
    return;
  }
  if (state.phase !== 'play' && state.phase !== 'cleared' && state.phase !== 'lost') return;

  let scale = 1;
  if (slowmo > 0) {
    slowmo -= dt;
    const k = Math.max(0, slowmo) / BOOM_SLOWMO;
    scale = 1 - (1 - BOOM_TIME_SCALE) * Math.min(1, k * 1.5);
  }
  state.update(dt * scale);
  state.drainEvents(onEvent);
  particles.update(dt * scale);
  if (state.time > 3 && state.time < 3 + dt && chance('r.hello', 60, 1)) audio.say(['r.hello'], { gain: RACCOON_GAIN });
}

/** Seconds of "space time", for scrolling. Keeps scrolling through menus too. */
function render(alphaT: number): void {
  const ctx = viewport.ctx;
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(-SCREEN.w, -SCREEN.h, SCREEN.w * 3, SCREEN.h * 3);

  switch (state.phase) {
    case 'title':
      drawBackyard(ctx, realTime);
      drawTitle(ctx, audio.muted, realTime);
      return;
    case 'select':
      drawBackyard(ctx, realTime);
      drawSelect(ctx, save.stars);
      return;
    case 'warp':
      drawWarp(ctx, Math.min(1, warpTime / WARP_TIME), state.stage.backdrop, state.stage.sky, realTime);
      return;
  }

  drawScene(ctx, state, state.phase === 'paused' ? 1 : alphaT, particles, realTime);
  if (state.phase === 'paused') drawPause(ctx, audio.muted);
  else if (state.phase === 'cleared') drawCleared(ctx, state, hasNext(), realTime);
  else if (state.phase === 'lost') drawLost(ctx, state);
  else drawHud(ctx, state, realTime);
}

startLoop({ update, render });

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('[sw] registration failed', error));
  });
}

if (import.meta.env.DEV) {
  void Promise.all([import('./dev/verify'), import('./dev/art')]).then(([{ verify, feel, feelMany, dodge }, { checkArt }]) => {
    (window as unknown as Record<string, unknown>).__game = {
      state,
      verify,
      feel,
      feelMany,
      dodge,
      checkArt,
      /** Jump straight into a stage, skipping the warp. */
      stage: (id: number) => startStage(id),
      /** Skip to the current stage's boss. */
      boss: () => {
        state.reachedBoss = true;
        state.retry();
        state.time = state.stage.length;
      },
      /** Run the whole loop (sim, events, particles) for `seconds`, regardless of rAF. */
      advance: (seconds: number) => {
        for (let t = 0; t < seconds; t += 1 / 120) update(1 / 120);
      },
      unlockAll: () => {
        for (const s of STAGES) save.stars[s.id] = Math.max(1, save.stars[s.id] ?? 0);
        writeSave(save);
      },
      invincible: (on = true) => {
        state.invincible = on;
      },
      /** Pin this exact frame over the game as an image, for screenshots of a 0.1s explosion. */
      snap: () => {
        render(1);
        document.getElementById('snap')?.remove();
        const img = document.createElement('img');
        img.id = 'snap';
        img.src = canvas.toDataURL();
        Object.assign(img.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '10' });
        img.addEventListener('pointerdown', () => img.remove());
        document.body.appendChild(img);
      },
    };
  });
}
