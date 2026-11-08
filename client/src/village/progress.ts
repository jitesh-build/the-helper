import rawGameData from '../data/gameData.json';
import type { Kind } from '../types';
import type { VillageSnapshot } from './parseVillage';
import { KINDS } from './planning';
import type { IdleTrack, PlanResult } from './planning';

interface GameEntity {
  g: string;
  t: Record<string, number>;
}
const GAME = rawGameData as unknown as Record<string, GameEntity>;

export const upgradeKey = (entityId: number, level: number): string => `${entityId}:${level}`;

/** Does the game have an upgrade TO this level (with a real upgrade time)? */
export const hasLevel = (entityId: number, level: number): boolean =>
  GAME[String(entityId)]?.t[String(level)] !== undefined;

export function kindOfEntity(entityId: number): Kind | null {
  const g = GAME[String(entityId)]?.g;
  if (g === 'buildings' || g === 'traps' || g === 'heroes') return 'builder';
  if (g === 'troops' || g === 'spells') return 'lab';
  if (g === 'pets') return 'pet';
  return null;
}

/**
 * Everything you own that is not being upgraded right now (including upgrades that finished since the
 * export), at its current level. Only things that still have a next level are listed.
 */
export function idleTracks(snapshot: VillageSnapshot, now: number): IdleTrack[] {
  const elapsedSec = snapshot.exportedAtMs === null ? 0 : Math.max(0, (now - snapshot.exportedAtMs) / 1000);
  const found = new Map<string, IdleTrack>();

  for (const e of snapshot.owned) {
    let level = e.level;
    if (e.timerSec !== null) {
      if (e.timerSec - elapsedSec > 0) continue; // still upgrading: handled as a running job
      level = e.level + 1; // finished since the export
    }
    if (!hasLevel(e.id, level + 1)) continue;
    const key = upgradeKey(e.id, level);
    const existing = found.get(key);
    if (existing) existing.count += e.count;
    else found.set(key, { entityId: e.id, level, count: e.count });
  }
  return [...found.values()];
}

export interface AvailablePair {
  entityId: number;
  level: number;
  count: number;
}

export interface Recommended {
  kind: Kind;
  slot: string;
  freeAtMin: number;
  entityId: number;
  level: number;
}

const EPS = 0.5;

/**
 * What may be added next. An upgrade is offered when the previous level of that same thing has finished by
 * the time the next worker frees up, so the same thing is never upgraded on two workers at once.
 * `recommended` = the follow-up level of whatever the next-free worker is doing.
 */
export function eligibleUpgrades(plan: PlanResult): { available: AvailablePair[]; recommended: Recommended[] } {
  const map = new Map<string, AvailablePair>();
  for (const t of plan.tracks) {
    const kind = kindOfEntity(t.entityId);
    const next = kind ? plan.nextFree[kind] : null;
    if (!kind || !next) continue;
    if (t.busyUntil > next.freeAtMin + EPS) continue;
    const level = t.level + 1;
    if (!hasLevel(t.entityId, level)) continue;
    const key = upgradeKey(t.entityId, level);
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { entityId: t.entityId, level, count: 1 });
  }

  const recommended: Recommended[] = [];
  for (const kind of KINDS) {
    const nf = plan.nextFree[kind];
    if (!nf || nf.lastEntityId === null || nf.lastLevel === null) continue;
    if (!hasLevel(nf.lastEntityId, nf.lastLevel + 1)) continue;
    recommended.push({
      kind,
      slot: nf.label,
      freeAtMin: nf.freeAtMin,
      entityId: nf.lastEntityId,
      level: nf.lastLevel + 1,
    });
  }
  return { available: [...map.values()], recommended };
}