import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Upgrade data comes from ClashKing's automatically updated copy of Supercell's own game files
 * (logic/*.csv downloaded from the official asset server and converted to JSON).
 */
const REPO = 'ClashKingInc/ClashKingAssets';
const SOURCE = `https://raw.githubusercontent.com/${REPO}/main/assets/static_data.json`;
const FEED = `https://github.com/${REPO}/commits/main/assets/static_data.json.atom`;

const CORE_SOURCES = ['buildings', 'traps', 'troops', 'spells', 'heroes', 'pets'] as const;
// Guardians are loaded too, but their section is looked up by name in main() and may be absent.
const SOURCES = [...CORE_SOURCES, 'guardians'] as const;
type Source = (typeof SOURCES)[number];
type Kind = 'builder' | 'lab' | 'pet';
type Group =
  | 'army'
  | 'defense'
  | 'trap'
  | 'hero'
  | 'guardian'
  | 'resource'
  | 'other'
  | 'troop'
  | 'spell'
  | 'siege'
  | 'pet';
type Resource = 'gold' | 'elixir' | 'darkElixir';

interface RawLevel {
  level: number;
  build_time?: number | null;
  build_cost?: number | null;
  upgrade_time?: number | null;
  upgrade_cost?: number | null;
  /** present on level 1 of a crafted defence: the buildings that are merged to make it */
  merge_requirement?: unknown;
}
interface RawEntity {
  _id: number;
  name: string;
  type?: string;
  village?: string | null;
  production_building?: string;
  upgrade_resource?: string;
  levels?: RawLevel[];
}
interface ClientEntity {
  n: string;
  v: 'home' | 'builderBase';
  g: Source;
  t: Record<string, number>; // level -> seconds it takes to reach that level
  /** true = crafted defence (made at the Crafting Station): Hammer Jam does not discount it */
  x?: true;
}
interface SeedRow {
  entityId: number;
  name: string;
  group: Group;
  level: number;
  kind: Kind;
  resource: Resource;
  baseMinutes: number;
  baseCost: number;
}

const RESOURCES: Record<string, Resource> = { Gold: 'gold', Elixir: 'elixir', 'Dark Elixir': 'darkElixir' };

function classify(source: Source, e: RawEntity): { kind: Kind; group: Group } {
  switch (source) {
    case 'buildings': {
      const group: Group =
        e.type === 'Army' ? 'army' : e.type === 'Defense' ? 'defense' : e.type === 'Resource' ? 'resource' : 'other';
      return { kind: 'builder', group };
    }
    case 'traps':
      return { kind: 'builder', group: 'trap' };
    case 'heroes':
      return { kind: 'builder', group: 'hero' };
    case 'guardians':
      return { kind: 'builder', group: 'guardian' };
    case 'troops':
      return { kind: 'lab', group: e.production_building === 'Workshop' ? 'siege' : 'troop' };
    case 'spells':
      return { kind: 'lab', group: 'spell' };
    case 'pets':
      return { kind: 'pet', group: 'pet' };
  }
}

/** Date of the last commit that touched static_data.json (null if GitHub's feed is unreachable). */
async function sourceUpdatedAt(): Promise<string | null> {
  try {
    const res = await fetch(FEED);
    if (!res.ok) return null;
    const xml = await res.text();
    const stamps = [...xml.matchAll(/<updated>([^<]+)<\/updated>/g)].map((m) => m[1]);
    return stamps[1] ?? stamps[0] ?? null; // [0] is the feed itself, [1] the newest commit
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const raw = (await res.json()) as Record<string, RawEntity[] | undefined>;

  // Guard against the source changing shape: fail loudly instead of writing a broken catalog.
  const minimum: Record<(typeof CORE_SOURCES)[number], number> = {
    buildings: 70,
    traps: 10,
    troops: 90,
    spells: 18,
    heroes: 8,
    pets: 12,
  };
  for (const s of CORE_SOURCES) {
    const n = raw[s]?.length ?? 0;
    if (n < minimum[s]) throw new Error(`Unexpected data: only ${n} ${s} (expected at least ${minimum[s]}).`);
  }

  // Guardians: use the "guardians" section, or any top-level key with "guardian" in its name.
  // Missing guardians do not stop the build, but they are reported loudly (they went unnoticed before).
  const guardianKey = raw.guardians ? 'guardians' : Object.keys(raw).find((k) => /guardian/i.test(k));
  const sections: Record<Source, RawEntity[] | undefined> = {
    buildings: raw.buildings,
    traps: raw.traps,
    troops: raw.troops,
    spells: raw.spells,
    heroes: raw.heroes,
    pets: raw.pets,
    guardians: guardianKey ? raw[guardianKey] : undefined,
  };
  if (!sections.guardians?.length) {
    console.warn(`WARNING: no guardians found in the source. Top-level keys: ${Object.keys(raw).join(', ')}`);
  } else {
    console.log(`Guardians read from "${guardianKey}": ${sections.guardians.length} entities`);
  }

  const client: Record<string, ClientEntity> = {};
  const seed = new Map<string, SeedRow>();

  for (const source of SOURCES) {
    for (const e of sections[source] ?? []) {
      const village = e.village === 'builderBase' ? 'builderBase' : 'home';
      const resource = e.upgrade_resource ? RESOURCES[e.upgrade_resource] : undefined;
      const { kind, group } = classify(source, e);
      const times: Record<string, number> = {};

      for (const l of e.levels ?? []) {
        const seconds = l.build_time ?? l.upgrade_time ?? 0;
        const cost = l.build_cost ?? l.upgrade_cost ?? 0;
        if (seconds <= 0) continue;
        times[String(l.level)] = seconds;

        if (village === 'home' && resource) {
          seed.set(`${e._id}|${l.level}`, {
            entityId: e._id,
            name: e.name,
            group,
            level: l.level,
            kind,
            resource,
            baseMinutes: Math.max(1, Math.round(seconds / 60)),
            baseCost: Math.round(cost),
          });
        }
      }
      // Crafted defences (Super Wizard Tower, Multi-Archer Tower, ...) are Defense buildings made by merging.
      // The Town Hall also has a merge_requirement on one level, which is why the type is checked.
      const crafted =
        source === 'buildings' && e.type === 'Defense' && (e.levels ?? []).some((l) => l.merge_requirement !== undefined);
      client[String(e._id)] = { n: e.name, v: village, g: source, t: times, ...(crafted ? { x: true as const } : {}) };
    }
  }

  const meta = { source: SOURCE, sourceUpdatedAt: await sourceUpdatedAt(), fetchedAt: new Date().toISOString() };

  const clientDir = path.resolve(__dirname, '../../../client/src/data');
  const seedFile = path.resolve(__dirname, '../../data/seed.json');
  await mkdir(clientDir, { recursive: true });
  await mkdir(path.dirname(seedFile), { recursive: true });
  await writeFile(path.join(clientDir, 'gameData.json'), JSON.stringify(client));
  await writeFile(path.join(clientDir, 'gameDataMeta.json'), JSON.stringify(meta, null, 2));
  await writeFile(seedFile, JSON.stringify([...seed.values()]));

  console.log(`Source last changed: ${meta.sourceUpdatedAt ?? 'unknown'}`);
  console.log(`gameData.json: ${Object.keys(client).length} entities`);
  console.log(`crafted defences (no Hammer Jam): ${Object.values(client).filter((c) => c.x).map((c) => c.n).join(', ') || 'NONE'}`);
  console.log(`seed.json: ${seed.size} upgrade rows`);
  const byGroup = new Map<string, number>();
  for (const row of seed.values()) byGroup.set(row.group, (byGroup.get(row.group) ?? 0) + 1);
  console.log(`rows per group: ${[...byGroup].map(([g, n]) => `${g}=${n}`).join(', ')}`);
  if (!byGroup.get('guardian')) {
    console.warn('WARNING: no guardian upgrade rows were produced (missing times or upgrade_resource in the source?).');
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});