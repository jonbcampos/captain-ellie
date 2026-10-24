/**
 * Progress: best stars per stage, and the mute switch. Copied from ../slingshot.
 *
 * Versioned, and defensive about what it reads back, for the same reason as
 * the siblings: localStorage is shared, hand-editable, and survives across
 * builds. Unreadable data is discarded and the game starts fresh; it never
 * throws on load.
 */

const KEY = 'captain-ellie.save';
const VERSION = 1;

export interface Save {
  v: number;
  /** Best stars per stage id, 0 meaning not yet beaten. */
  stars: Record<number, number>;
  /**
   * Losses on each stage since she last cleared it. The game helps more the
   * more she's lost (HELP in config.ts), and it's remembered between sessions so
   * the help is still there if she comes back to a stage tomorrow.
   */
  struggle: Record<number, number>;
  muted: boolean;
}

export function freshSave(): Save {
  return { v: VERSION, stars: {}, struggle: {}, muted: false };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const data = JSON.parse(raw) as Partial<Save>;
    if (data.v !== VERSION || typeof data.stars !== 'object' || data.stars === null) return freshSave();
    const stars: Record<number, number> = {};
    for (const [k, v] of Object.entries(data.stars)) {
      const n = Number(v);
      if (Number.isFinite(n)) stars[Number(k)] = Math.max(0, Math.min(3, Math.round(n)));
    }
    // `struggle` arrived after the first release; an older save simply has none.
    const struggle: Record<number, number> = {};
    for (const [k, v] of Object.entries(data.struggle ?? {})) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) struggle[Number(k)] = Math.min(9, Math.round(n));
    }
    return { v: VERSION, stars, struggle, muted: data.muted === true };
  } catch {
    return freshSave();
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or full storage: progress is lost, the game is not.
  }
}

/** Keep the better result. Never lowers a stage's stars. */
export function recordStars(save: Save, stageId: number, stars: number): void {
  save.stars[stageId] = Math.max(save.stars[stageId] ?? 0, stars);
  writeSave(save);
}

/** One more loss on this stage. Returns the new count. */
export function recordLoss(save: Save, stageId: number): number {
  save.struggle[stageId] = Math.min(9, (save.struggle[stageId] ?? 0) + 1);
  writeSave(save);
  return save.struggle[stageId];
}

/** Cleared: the help goes back to nothing for next time. */
export function clearStruggle(save: Save, stageId: number): void {
  if (!save.struggle[stageId]) return;
  delete save.struggle[stageId];
  writeSave(save);
}

// Unlocking lives with the stages (`isStageUnlocked` in game/stages.ts).
