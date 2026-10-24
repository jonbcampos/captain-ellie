/**
 * Input: one finger, two things it can do.
 *
 *  - **Drag** anywhere to fly. The ship moves by however far the finger moves
 *    from where it went DOWN (main.ts applies the gain), never to where the
 *    finger is. Jumping the ship under her thumb would hide the ship behind
 *    the thumb, and a five-year-old shouldn't have to grab a 30px rocket.
 *  - **Tap** a button.
 *
 * Copied from ../slingshot; what changed is the keyboard, which now also
 * reports held arrow keys for flying on a desktop.
 *
 * Presses and releases are QUEUED rather than latched, as in the siblings: a
 * fixed 1/120s step can see a down and an up between two frames, and a latch
 * would lose the down and with it the whole gesture.
 *
 * Only the first finger counts. A second finger landing mid-aim is ignored
 * rather than allowed to restart the pull from somewhere else.
 */

import type { Viewport } from './viewport';

export type PointerEventKind = 'down' | 'up';

export interface QueuedPointer {
  kind: PointerEventKind;
  x: number;
  y: number;
}

export type KeyAction = 'restart' | 'pause' | 'confirm';

const QUEUE = 16;

export class Input {
  /** Where the tracked pointer is now, in virtual px. */
  readonly pointer = { x: 0, y: 0, down: false };
  /** Arrow keys or W/S held, for flying on a desktop. */
  readonly held = { up: false, down: false };

  private readonly queue: QueuedPointer[] = [];
  private count = 0;
  private readonly keys: KeyAction[] = [];
  private keyCount = 0;
  private activeId: number | null = null;
  private anyPress = false;

  constructor(private viewport: Viewport) {
    for (let i = 0; i < QUEUE; i++) {
      this.queue.push({ kind: 'down', x: 0, y: 0 });
      this.keys.push('pause');
    }
    const canvas = viewport.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.anyPress = true;
    if (this.activeId !== null) return;
    this.activeId = e.pointerId;
    // Keep receiving moves and the release even if the finger leaves the canvas.
    try {
      this.viewport.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events have no capturable pointer; harmless.
    }
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = true;
    this.push('down', x, y);
  };

  private onMove = (e: PointerEvent): void => {
    if (this.activeId !== null && e.pointerId !== this.activeId) return;
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = false;
    this.push('up', x, y);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') this.held.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') this.held.down = false;
  };

  private onKey = (e: KeyboardEvent): void => {
    this.anyPress = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      this.held.up = true;
      e.preventDefault();
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.held.down = true;
      e.preventDefault();
    }
    if (e.repeat) return;
    let action: KeyAction | null = null;
    if (e.code === 'KeyR') action = 'restart';
    else if (e.code === 'Escape' || e.code === 'KeyP') action = 'pause';
    else if (e.code === 'Enter' || e.code === 'Space') action = 'confirm';
    if (!action) return;
    e.preventDefault();
    if (this.keyCount < QUEUE) this.keys[this.keyCount++] = action;
  };

  /** A backgrounded tab never delivers pointerup. Treat leaving as letting go. */
  private releaseAll = (): void => {
    this.held.up = false;
    this.held.down = false;
    if (this.activeId === null) return;
    this.activeId = null;
    this.pointer.down = false;
    this.push('up', this.pointer.x, this.pointer.y);
  };

  private push(kind: PointerEventKind, x: number, y: number): void {
    if (this.count >= QUEUE) return;
    const q = this.queue[this.count++]!;
    q.kind = kind;
    q.x = x;
    q.y = y;
  }

  drainPointer(consume: (p: QueuedPointer) => void): void {
    for (let i = 0; i < this.count; i++) consume(this.queue[i]!);
    this.count = 0;
  }

  drainKeys(consume: (k: KeyAction) => void): void {
    for (let i = 0; i < this.keyCount; i++) consume(this.keys[i]!);
    this.keyCount = 0;
  }

  consumeAnyPress(): boolean {
    const p = this.anyPress;
    this.anyPress = false;
    return p;
  }
}
