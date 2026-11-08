import rawGameData from '../data/gameData.json';
import type { PlanBasis } from '../types';
import type { VillageSnapshot } from './parseVillage';

const GAME = rawGameData as unknown as Record<string, { n: string }>;

/** What a plan is made against: the upgrades running in the pasted village data. */
export function basisOf(snapshot: VillageSnapshot | null): PlanBasis {
  if (!snapshot) return { exportedAt: null, builderCount: 0, jobs: [] };
  const jobs = [...snapshot.builders, ...snapshot.lab, ...snapshot.pets]
    .map((u) => `${u.entityId}:${u.toLevel}`)
    .sort();
  return { exportedAt: snapshot.exportedAtMs, builderCount: snapshot.builderCount, jobs };
}

const labelOf = (job: string): string => {
  const [id = '', level = ''] = job.split(':');
  return `${GAME[id]?.n ?? `Item #${id}`} → Lv ${level}`;
};

/** items of `a` that are not in `b` (duplicates counted) */
function difference(a: string[], b: string[]): string[] {
  const left = new Map<string, number>();
  for (const x of b) left.set(x, (left.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const c = left.get(x) ?? 0;
    if (c > 0) left.set(x, c - 1);
    else out.push(x);
  }
  return out;
}

export interface Drift {
  changed: boolean;
  noLongerRunning: string[];
  nowRunning: string[];
  builderCountChanged: boolean;
}

/** How the village data now differs from what the plan was made against. */
export function driftOf(planned: PlanBasis, current: PlanBasis): Drift {
  const noLongerRunning = difference(planned.jobs, current.jobs).map(labelOf);
  const nowRunning = difference(current.jobs, planned.jobs).map(labelOf);
  const builderCountChanged = planned.builderCount !== current.builderCount;
  return {
    changed: noLongerRunning.length > 0 || nowRunning.length > 0 || builderCountChanged,
    noLongerRunning,
    nowRunning,
    builderCountChanged,
  };
}

/** JSON with sorted keys, so two equal plans compare equal whatever order their keys were built in. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}