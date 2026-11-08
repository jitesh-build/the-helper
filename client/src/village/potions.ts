export type PotionType = 'builder' | 'research' | 'pet';

export const POTION_MULT: Record<PotionType, number> = { builder: 10, research: 24, pet: 24 };
export const POTION_META: Record<PotionType, { label: string; icon: string }> = {
  builder: { label: 'Builder potion', icon: '🧪' },
  research: { label: 'Research potion', icon: '📘' },
  pet: { label: 'Pet potion', icon: '🐾' },
};

export const POTION_MINUTES = 60;

/** A stretch of boosted time, in minutes from "now". */
export interface PotionWindow {
  a: number;
  b: number;
}

/**
 * Turns potion blocks into boosted windows. Potions can't overlap in the game, so a potion that would
 * start while another is running waits for it to end (they chain back-to-back).
 */
export function chainWindows(blocks: { startMin: number; count: number }[]): PotionWindow[] {
  const sorted = [...blocks].sort((x, y) => x.startMin - y.startMin);
  const out: PotionWindow[] = [];
  let cursor = -Infinity;
  for (const block of sorted) {
    if (block.count <= 0) continue;
    const a = Math.max(block.startMin, cursor);
    const b = a + block.count * POTION_MINUTES;
    const last = out[out.length - 1];
    if (last && Math.abs(last.b - a) < 1e-9) last.b = b;
    else out.push({ a, b });
    cursor = b;
  }
  return out;
}

/**
 * Minute at which a job finishes. It starts at `startMin` and needs `workMin` minutes of normal-speed
 * work; inside a potion window the worker does `mult` minutes of work per minute.
 */
export function finishWithWindows(startMin: number, workMin: number, windows: PotionWindow[], mult: number): number {
  let t = startMin;
  let work = workMin;
  if (work <= 0) return t;
  for (const win of windows) {
    if (win.b <= t) continue;
    if (win.a > t) {
      const gap = win.a - t;
      if (work <= gap) return t + work;
      work -= gap;
      t = win.a;
    }
    const capacity = (win.b - t) * mult;
    if (work <= capacity) return t + work / mult;
    work -= capacity;
    t = win.b;
  }
  return t + work;
}

export function finishFrom(startMin: number, workMin: number, windowMin: number, mult: number): number {
  if (workMin <= 0) return startMin;
  if (startMin >= windowMin) return startMin + workMin;
  const boostedCapacity = (windowMin - startMin) * mult;
  return workMin <= boostedCapacity ? startMin + workMin / mult : windowMin + (workMin - boostedCapacity);
}

export const finishAfter = (remaining: number, potions: number, mult: number): number =>
  finishFrom(0, remaining, potions * POTION_MINUTES, mult);

export interface WorkerResult {
  remainingNow: number;
  finishAfter: number;
  leftWhenPotionsEnd: number;
  saved: number;
}

export interface PotionPlan {
  /** null = impossible, even with unlimited potions */
  potionsNeeded: number | null;
  potionsShown: number;
  alreadyFree: boolean;
  fastestPossible: number;
  workers: WorkerResult[];
}

/** Fewest potions so that at least one worker is free within `targetMinutes`. */
export function planPotions(
  remaining: number[],
  idleWorkers: number,
  targetMinutes: number,
  mult: number,
): PotionPlan {
  const earliest = idleWorkers > 0 || remaining.length === 0 ? 0 : Math.min(...remaining);
  const maxUseful = Math.ceil(earliest / (POTION_MINUTES * mult));

  let needed: number | null = null;
  if (earliest <= targetMinutes) {
    needed = 0;
  } else {
    for (let k = 1; k <= maxUseful; k++) {
      if (finishAfter(earliest, k, mult) <= targetMinutes) {
        needed = k;
        break;
      }
    }
  }

  const shown = needed ?? maxUseful;
  return {
    potionsNeeded: needed,
    potionsShown: shown,
    alreadyFree: earliest === 0,
    fastestPossible: earliest / mult,
    workers: remaining.map((r) => {
      const fa = finishAfter(r, shown, mult);
      return {
        remainingNow: r,
        finishAfter: fa,
        leftWhenPotionsEnd: Math.max(0, r - shown * POTION_MINUTES * mult),
        saved: r - fa,
      };
    }),
  };
}