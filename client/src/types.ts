import type { PotionBlock, QueueItem } from './village/planning';

export type Kind = 'builder' | 'lab' | 'pet';
export type Group = 'army' | 'defense' | 'hero' | 'resource' | 'other' | 'troop' | 'spell' | 'siege' | 'pet';
export type Resource = 'gold' | 'elixir' | 'darkElixir';
export type Reduction = 0 | 10 | 15 | 20;

export interface Upgrade {
  _id: string;
  entityId: number;
  name: string;
  group: Group;
  level: number;
  kind: Kind;
  resource: Resource;
  baseMinutes: number;
  baseCost: number;
}

export interface GoldPass {
  timeReduction: Reduction;
  costReduction: Reduction;
}

export interface PotionCounts {
  builder: number;
  research: number;
  pet: number;
}

/** Gold Pass perks and potion stock belong to one Clash of Clans account, i.e. one village. */
export interface UserSettings {
  goldPass: GoldPass;
  potions: PotionCounts;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: Profile;
}

/** What the village list shows (no export data). */
export interface VillageSummary {
  id: string;
  tag: string;
  name: string;
  /** when the export was taken (ms), from the export's own timestamp */
  exportedAt: number | null;
  updatedAt: string;
}

// export interface Village extends VillageSummary, UserSettings {
//   /** the raw village export JSON */
//   export: string;
// }

/** The village data a plan was made against (used to warn when newer data no longer matches). */
export interface PlanBasis {
  exportedAt: number | null;
  builderCount: number;
  /** running upgrades as "entityId:toLevel", sorted */
  jobs: string[];
}

export interface SavedPlanData {
  queue: QueueItem[];
  blocks: PotionBlock[];
  useGoblins: boolean;
  basedOn: PlanBasis;
}

export interface SavedPlan extends SavedPlanData {
  savedAt: string;
}

export interface Village extends VillageSummary, UserSettings {
  /** the raw village export JSON */
  export: string;
  /** the saved Hammer Jam plan, if any */
  plan: SavedPlan | null;
}

export interface VillageList {
  villages: VillageSummary[];
  activeVillageId: string | null;
}

export interface ImportResponse {
  village: Village;
  /** true = a new village was created, false = an existing village (same tag) was updated */
  created: boolean;
}