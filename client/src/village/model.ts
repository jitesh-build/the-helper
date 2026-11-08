import type { ActiveUpgrade, VillageSnapshot } from './parseVillage';
import type { PotionType } from './potions';

const MAX_BUILDERS = 6;

export interface UpgradeRow {
  key: string;
  entityId: number;
  toLevel: number;
  name: string;
  label: string;
  remainingMin: number;
  totalMin: number | null;
  extra: boolean;
}

/** busy = working, idle = free now, locked = builder not owned, unused = goblin not hired */
export type WorkerState = 'busy' | 'idle' | 'locked' | 'unused';

export interface Worker {
  id: string;
  label: string;
  icon: string;
  potion: PotionType;
  state: WorkerState;
  upgrade: UpgradeRow | null;
}

export interface VillageModel {
  builders: Worker[]; // always 6 slots
  goblinBuilder: Worker;
  lab: Worker;
  goblinResearcher: Worker;
  pet: Worker;
}

const toRow = (u: ActiveUpgrade, elapsedSec: number): UpgradeRow => ({
  key: u.key,
  entityId: u.entityId,
  toLevel: u.toLevel,
  name: u.name,
  label: u.fromLevel === 0 ? 'New build → Lv 1' : `Lv ${u.fromLevel} → ${u.toLevel}`,
  remainingMin: Math.max(0, u.remainingSec - elapsedSec) / 60,
  totalMin: u.totalSec === null ? null : u.totalSec / 60,
  extra: u.extra,
});

const worker = (
  id: string,
  label: string,
  icon: string,
  potion: PotionType,
  state: WorkerState,
  upgrade: UpgradeRow | null,
): Worker => ({ id, label, icon, potion, state, upgrade });

/** Timers are "seconds left at export time", so the time passed since the export is always subtracted. */
export function buildVillageModel(snapshot: VillageSnapshot | null, now: number): VillageModel {
  const elapsedSec =
    snapshot && snapshot.exportedAtMs !== null ? Math.max(0, (now - snapshot.exportedAtMs) / 1000) : 0;

  const rows = (list: ActiveUpgrade[] | undefined): UpgradeRow[] =>
    (list ?? [])
      .map((u) => toRow(u, elapsedSec))
      .filter((r) => r.remainingMin > 0)
      .sort((a, b) => a.remainingMin - b.remainingMin);

  const bRows = rows(snapshot?.builders);
  const lRows = rows(snapshot?.lab);
  const pRows = rows(snapshot?.pets);

  // The export marks work done by the Goblin Builder / Goblin Researcher with `extra: true`.
  const bRegular = bRows.filter((r) => !r.extra);
  const bExtra = bRows.filter((r) => r.extra);
  const lRegular = lRows.filter((r) => !r.extra);
  const lExtra = lRows.filter((r) => r.extra);

  const owned = snapshot
    ? Math.min(MAX_BUILDERS, Math.max(snapshot.builderCount, Math.min(bRegular.length, MAX_BUILDERS)))
    : MAX_BUILDERS;

  const builders = Array.from({ length: MAX_BUILDERS }, (_, i): Worker => {
    const id = `builder-${i + 1}`;
    const label = `Builder ${i + 1}`;
    const job = bRegular[i];
    if (i >= owned) return worker(id, label, '🔨', 'builder', 'locked', null);
    return job ? worker(id, label, '🔨', 'builder', 'busy', job) : worker(id, label, '🔨', 'builder', 'idle', null);
  });

  // Older exports without the flag: any job beyond the regular builders must be the goblin's.
  const goblinJob = bExtra[0] ?? (bExtra.length === 0 ? bRegular[owned] : undefined);
  const labJob = lRegular[0];
  const researcherJob = lExtra[0] ?? (lExtra.length === 0 ? lRegular[1] : undefined);
  const petJob = pRows[0];

  return {
    builders,
    goblinBuilder: goblinJob
      ? worker('goblin-builder', 'Goblin Builder', '🧌', 'builder', 'busy', goblinJob)
      : worker('goblin-builder', 'Goblin Builder', '🧌', 'builder', 'unused', null),
    lab: labJob
      ? worker('lab', 'Laboratory', '📘', 'research', 'busy', labJob)
      : worker('lab', 'Laboratory', '📘', 'research', 'idle', null),
    goblinResearcher: researcherJob
      ? worker('goblin-researcher', 'Goblin Researcher', '🧌', 'research', 'busy', researcherJob)
      : worker('goblin-researcher', 'Goblin Researcher', '🧌', 'research', 'unused', null),
    pet: petJob
      ? worker('pet', 'Pet House', '🐾', 'pet', 'busy', petJob)
      : worker('pet', 'Pet House', '🐾', 'pet', 'idle', null),
  };
}

export const allWorkers = (m: VillageModel): Worker[] => [
  ...m.builders,
  m.goblinBuilder,
  m.lab,
  m.goblinResearcher,
  m.pet,
];

/** Workers a potion type affects: those currently busy, and how many are idle (free now). */
export function potionWorkers(model: VillageModel, type: PotionType): { busy: Worker[]; idle: number } {
  const pool: Worker[] =
    type === 'builder'
      ? [...model.builders, model.goblinBuilder]
      : type === 'research'
        ? [model.lab, model.goblinResearcher]
        : [model.pet];
  return {
    busy: pool.filter((w) => w.state === 'busy'),
    idle: pool.filter((w) => w.state === 'idle').length,
  };
}