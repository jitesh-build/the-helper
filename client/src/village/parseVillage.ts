import rawGameData from '../data/gameData.json';

interface GameEntity {
  n: string;
  v: 'home' | 'builderBase';
  g: string;
  t: Record<string, number>;
}
const GAME = rawGameData as unknown as Record<string, GameEntity>;

const BUILDERS_HUT_ID = 1000015;
const BOBS_HUT_ID = 1000064;

export interface ActiveUpgrade {
  key: string;
  entityId: number;
  name: string;
  fromLevel: number;
  toLevel: number;
  remainingSec: number;
  totalSec: number | null;
  /** true when the export marks this upgrade as done by the Goblin Builder / Goblin Researcher */
  extra: boolean;
}

/** Everything the player owns that can be upgraded, as listed in the export. */
export interface OwnedEntry {
  id: number;
  level: number;
  count: number;
  /** seconds left at export time if it is being upgraded, else null */
  timerSec: number | null;
}

export interface VillageSnapshot {
  tag: string | null;
  exportedAtMs: number | null;
  /** Builder's Huts + B.O.B's Hut (regular builders, max 6) */
  builderCount: number;
  builders: ActiveUpgrade[];
  lab: ActiveUpgrade[];
  pets: ActiveUpgrade[];
  owned: OwnedEntry[];
}

interface Entry {
  data: number;
  lvl: number;
  cnt: number;
  timer?: number;
  extra: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readEntries(root: Record<string, unknown>, key: string): Entry[] {
  const list = root[key];
  if (!Array.isArray(list)) return [];
  const out: Entry[] = [];
  for (const item of list as unknown[]) {
    if (!isRecord(item) || typeof item.data !== 'number') continue;
    out.push({
      data: item.data,
      lvl: typeof item.lvl === 'number' ? item.lvl : 0,
      cnt: typeof item.cnt === 'number' ? item.cnt : 1,
      timer: typeof item.timer === 'number' ? item.timer : undefined,
      extra: item.extra === true,
    });
  }
  return out;
}

/** An entry with a timer is being upgraded from `lvl` to `lvl + 1` (lvl 0 = brand new build). */
function toUpgrades(entries: Entry[], section: string): ActiveUpgrade[] {
  const out: ActiveUpgrade[] = [];
  entries.forEach((e, i) => {
    if (e.timer === undefined) return;
    const info = GAME[String(e.data)];
    const toLevel = e.lvl + 1;
    out.push({
      key: `${section}-${e.data}-${i}`,
      entityId: e.data,
      name: info?.n ?? `Unknown item #${e.data}`,
      fromLevel: e.lvl,
      toLevel,
      remainingSec: e.timer,
      totalSec: info?.t[String(toLevel)] ?? null,
      extra: e.extra,
    });
  });
  return out;
}

const toOwned = (entries: Entry[]): OwnedEntry[] =>
  entries.map((e) => ({ id: e.data, level: e.lvl, count: e.cnt, timerSec: e.timer ?? null }));

export function parseVillage(text: string): VillageSnapshot {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error('The clipboard does not contain valid JSON. Copy the village export first.');
  }
  if (!isRecord(root) || !Array.isArray(root.buildings)) {
    throw new Error('That does not look like a village export (no "buildings" list found).');
  }

  const buildings = readEntries(root, 'buildings');
  const traps = readEntries(root, 'traps');
  const heroes = readEntries(root, 'heroes');
  const guardians = readEntries(root, 'guardians');
  const units = readEntries(root, 'units');
  const spells = readEntries(root, 'spells');
  const siege = readEntries(root, 'siege_machines');
  const pets = readEntries(root, 'pets');

  const builderCount = buildings
    .filter((e) => e.data === BUILDERS_HUT_ID || e.data === BOBS_HUT_ID)
    .reduce((sum, e) => sum + e.cnt, 0);

  return {
    tag: typeof root.tag === 'string' ? root.tag : null,
    exportedAtMs: typeof root.timestamp === 'number' ? root.timestamp * 1000 : null,
    builderCount,
    // Guardians are upgraded by a builder, just like buildings, traps and heroes.
    builders: [
      ...toUpgrades(buildings, 'b'),
      ...toUpgrades(traps, 't'),
      ...toUpgrades(heroes, 'h'),
      ...toUpgrades(guardians, 'g'),
    ],
    lab: [...toUpgrades(units, 'u'), ...toUpgrades(spells, 's'), ...toUpgrades(siege, 'm')],
    pets: toUpgrades(pets, 'p'),
    owned: [
      ...toOwned(buildings),
      ...toOwned(traps),
      ...toOwned(heroes),
      ...toOwned(guardians),
      ...toOwned(units),
      ...toOwned(spells),
      ...toOwned(siege),
      ...toOwned(pets),
    ],
  };
}

export function tryParseVillage(text: string | null): VillageSnapshot | null {
  if (!text) return null;
  try {
    return parseVillage(text);
  } catch {
    return null;
  }
}