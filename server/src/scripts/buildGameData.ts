import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Upgrade data comes from ClashKing's automatically updated copy of Supercell's own game files
 * (logic/*.csv downloaded from the official asset server and converted to JSON).
 */
const REPO = 'ClashKingInc/ClashKingAssets';
const SOURCE = `https://raw.githubusercontent.com/${REPO}/main/assets/static_data.json`;
const FEED = `https://github.com/${REPO}/commits/main/assets/static_data.json.atom`;

const SOURCES = ['buildings', 'traps', 'troops', 'spells', 'heroes', 'pets'] as const;
type Source = (typeof SOURCES)[number];
type Kind = 'builder' | 'lab' | 'pet';
type Group = 'army' | 'defense' | 'hero' | 'resource' | 'other' | 'troop' | 'spell' | 'siege' | 'pet';
type Resource = 'gold' | 'elixir' | 'darkElixir';

interface RawLevel {
  level: number;
  build_time?: number | null;
  build_cost?: number | null;
  upgrade_time?: number | null;
  upgrade_cost?: number | null;
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
      return { kind: 'builder', group: 'other' };
    case 'heroes':
      return { kind: 'builder', group: 'hero' };
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
  const minimum: Record<Source, number> = { buildings: 70, traps: 10, troops: 90, spells: 18, heroes: 8, pets: 12 };
  for (const s of SOURCES) {
    const n = raw[s]?.length ?? 0;
    if (n < minimum[s]) throw new Error(`Unexpected data: only ${n} ${s} (expected at least ${minimum[s]}).`);
  }

  const client: Record<string, ClientEntity> = {};
  const seed = new Map<string, SeedRow>();

  for (const source of SOURCES) {
    for (const e of raw[source] ?? []) {
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
      client[String(e._id)] = { n: e.name, v: village, g: source, t: times };
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
  console.log(`seed.json: ${seed.size} upgrade rows`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});