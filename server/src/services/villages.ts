import type { HydratedDocument } from 'mongoose';
import type { IUser } from '../models/User';
import type { IVillage } from '../models/Village';
import { VillageModel } from '../models/Village';

export const MAX_VILLAGES = 20;

/** "#gu0l0qquy", "GU0L0QQUY" and "#GUOLOQQUY" (letter O) all become "#GU0L0QQUY". */
export function normalizeTag(raw: string): string | null {
  const tag = `#${raw.trim().replace(/^#/, '').toUpperCase().replace(/O/g, '0')}`;
  return /^#[0-9A-Z]{3,15}$/.test(tag) ? tag : null;
}

export type ParsedExport = { ok: true; tag: string; exportedAt: number | null } | { ok: false; error: string };

export function parseExport(raw: string): ParsedExport {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That is not valid JSON.' };
  }
  if (typeof json !== 'object' || json === null) {
    return { ok: false, error: 'This does not look like a village export.' };
  }
  const o = json as { buildings?: unknown; tag?: unknown; timestamp?: unknown };
  if (!Array.isArray(o.buildings)) return { ok: false, error: 'This does not look like a village export.' };
  if (typeof o.tag !== 'string') {
    return { ok: false, error: 'This export has no village tag, so it cannot be matched to a village.' };
  }
  const tag = normalizeTag(o.tag);
  if (!tag) return { ok: false, error: 'The village tag in this export is not valid.' };
  return { ok: true, tag, exportedAt: typeof o.timestamp === 'number' ? o.timestamp * 1000 : null };
}

export const toSummary = (v: HydratedDocument<IVillage>) => ({
  id: v.id as string,
  tag: v.tag,
  name: v.name,
  exportedAt: v.exportedAt,
  updatedAt: (v.updatedAt ?? new Date()).toISOString(),
});

export const toPlan = (v: HydratedDocument<IVillage>) =>
  v.plan
    ? {
        queue: v.plan.queue,
        blocks: v.plan.blocks,
        useGoblins: v.plan.useGoblins,
        basedOn: v.plan.basedOn,
        savedAt: new Date(v.plan.savedAt).toISOString(),
      }
    : null;

export const toFull = (v: HydratedDocument<IVillage>) => ({
  ...toSummary(v),
  export: v.data,
  goldPass: { timeReduction: v.goldPass.timeReduction, costReduction: v.goldPass.costReduction },
  potions: { builder: v.potions.builder, research: v.potions.research, pet: v.potions.pet },
  plan: toPlan(v),
});

/**
 * Accounts created before multi-village support kept one export, Gold Pass perks and potions on the user.
 * Move them into a Village once (idempotent), then clear the legacy fields.
 */
export async function migrateLegacy(user: HydratedDocument<IUser>): Promise<void> {
  const raw = user.villageExport;
  if (!raw) return;
  const parsed = parseExport(raw);
  if (parsed.ok) {
    const village = await VillageModel.findOneAndUpdate(
      { userId: user._id, tag: parsed.tag },
      {
        $setOnInsert: {
          name: `Village ${parsed.tag}`,
          data: raw,
          exportedAt: parsed.exportedAt,
          goldPass: {
            timeReduction: user.goldPass?.timeReduction ?? 0,
            costReduction: user.goldPass?.costReduction ?? 0,
          },
          potions: {
            builder: user.potions?.builder ?? 0,
            research: user.potions?.research ?? 0,
            pet: user.potions?.pet ?? 0,
          },
        },
      },
      { upsert: true, new: true },
    );
    if (village && !user.activeVillageId) user.activeVillageId = village._id;
  }
  user.villageExport = null;
  await user.save();
}