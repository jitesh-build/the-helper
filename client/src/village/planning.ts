import { isHammerJamAt } from '../config/hammerJam';
import type { GoldPass, Kind, Resource } from '../types';
import type { VillageModel, Worker } from './model';
import { POTION_MULT, chainWindows, finishWithWindows } from './potions';
import type { PotionType, PotionWindow } from './potions';

export const KINDS: Kind[] = ['builder', 'lab', 'pet'];

export const potionTypeFor = (kind: Kind): PotionType =>
  kind === 'builder' ? 'builder' : kind === 'lab' ? 'research' : 'pet';
export const kindForPotion = (type: PotionType): Kind =>
  type === 'builder' ? 'builder' : type === 'research' ? 'lab' : 'pet';

export interface QueueItem {
  uid: string;
  entityId: number;
  name: string;
  level: number;
  kind: Kind;
  resource: Resource;
  baseMinutes: number;
  baseCost: number;
}

/** `count` potions drunk back-to-back from `startMs`. */
export interface PotionBlock {
  id: string;
  type: PotionType;
  startMs: number;
  count: number;
}

/** Copies of something you own that are idle (not upgrading) at `level`. */
export interface IdleTrack {
  entityId: number;
  level: number;
  count: number;
}

/** One physical building / hero / troop: its level once the current job ends, and when that is. */
export interface TrackState {
  entityId: number;
  level: number;
  busyUntil: number; // minutes from now
}

export interface Segment {
  id: string;
  uid: string | null;
  kind: Kind;
  lane: number;
  slot: string;
  name: string;
  label: string;
  startMs: number;
  endMs: number;
  current: boolean;
  discounted: boolean;
}

export interface PlannedUpgrade {
  item: QueueItem;
  slot: string;
  startMin: number;
  endMin: number;
  finalMinutes: number;
  finalCost: number;
  discounted: boolean;
  waited: boolean;
}

export interface Unplaced {
  item: QueueItem;
  reason: string;
}

export interface NextFree {
  label: string;
  freeAtMin: number;
  lastEntityId: number | null;
  lastLevel: number | null;
}

export interface PlanArgs {
  model: VillageModel;
  now: number;
  goldPass: GoldPass;
  blocks: PotionBlock[];
  useGoblins: boolean;
  queue: QueueItem[];
  idleTracks: IdleTrack[];
}

export interface PlanResult {
  planned: PlannedUpgrade[];
  unplaced: Unplaced[];
  segments: Segment[];
  slotLabels: Record<Kind, string[]>;
  nextFree: Record<Kind, NextFree | null>;
  tracks: TrackState[];
  /** minutes until each currently-working worker is free, with potions applied */
  currentFreeIn: Record<string, number>;
  windows: Record<PotionType, PotionWindow[]>;
  startedInJam: number;
}

interface Slot {
  label: string;
  freeAt: number;
  lastEntityId: number | null;
  lastLevel: number | null;
}

function windowsOf(blocks: PotionBlock[], type: PotionType, now: number): PotionWindow[] {
  return chainWindows(
    blocks.filter((b) => b.type === type).map((b) => ({ startMin: (b.startMs - now) / 60_000, count: b.count })),
  );
}

export function buildPlan(a: PlanArgs): PlanResult {
  const { model, now, goldPass, useGoblins } = a;

  const windows: Record<PotionType, PotionWindow[]> = {
    builder: windowsOf(a.blocks, 'builder', now),
    research: windowsOf(a.blocks, 'research', now),
    pet: windowsOf(a.blocks, 'pet', now),
  };

  const poolFor = (kind: Kind): Worker[] =>
    kind === 'builder'
      ? [...model.builders, model.goblinBuilder]
      : kind === 'lab'
        ? [model.lab, model.goblinResearcher]
        : [model.pet];

  const segments: Segment[] = [];
  const tracks: TrackState[] = [];
  const currentFreeIn: Record<string, number> = {};
  const slotsByKind: Record<Kind, Slot[]> = { builder: [], lab: [], pet: [] };

  // 1) workers: what they are doing now, and when that finishes (potions applied)
  for (const kind of KINDS) {
    const type = potionTypeFor(kind);
    const slots = slotsByKind[kind];
    for (const w of poolFor(kind)) {
      if (w.state === 'locked') continue;
      if (w.state === 'unused' && !useGoblins) continue;
      const lane = slots.length;
      if (w.state === 'busy' && w.upgrade) {
        const freeAt = finishWithWindows(0, w.upgrade.remainingMin, windows[type], POTION_MULT[type]);
        currentFreeIn[w.id] = freeAt;
        slots.push({ label: w.label, freeAt, lastEntityId: w.upgrade.entityId, lastLevel: w.upgrade.toLevel });
        tracks.push({ entityId: w.upgrade.entityId, level: w.upgrade.toLevel, busyUntil: freeAt });
        segments.push({
          id: `cur-${w.id}`,
          uid: null,
          kind,
          lane,
          slot: w.label,
          name: w.upgrade.name,
          label: w.upgrade.label,
          startMs: now,
          endMs: now + freeAt * 60_000,
          current: true,
          discounted: false,
        });
      } else {
        slots.push({ label: w.label, freeAt: 0, lastEntityId: null, lastLevel: null });
      }
    }
  }

  // 2) idle copies of everything you own
  for (const t of a.idleTracks) {
    for (let i = 0; i < Math.min(t.count, 30); i++) {
      tracks.push({ entityId: t.entityId, level: t.level, busyUntil: 0 });
    }
  }

  // 3) the queue: each upgrade goes to the worker that frees up first, and only after the
  //    previous level of the same thing has finished
  const planned: PlannedUpgrade[] = [];
  const reasons = new Map<string, string>();
  let pending = [...a.queue];

  const tryPlace = (item: QueueItem): boolean => {
    const slots = slotsByKind[item.kind];
    if (slots.length === 0) {
      reasons.set(item.uid, 'No worker is available for this type of upgrade.');
      return false;
    }
    let track: TrackState | undefined;
    for (const t of tracks) {
      if (t.entityId === item.entityId && t.level === item.level - 1 && (!track || t.busyUntil < track.busyUntil)) {
        track = t;
      }
    }
    if (!track) {
      reasons.set(item.uid, `Needs ${item.name} Lv ${item.level - 1} to be planned or finished first.`);
      return false;
    }

    let best = 0;
    slots.forEach((s, i) => {
      if (s.freeAt < (slots[best] as Slot).freeAt) best = i;
    });
    const slot = slots[best] as Slot;

    const type = potionTypeFor(item.kind);
    const startMin = Math.max(slot.freeAt, track.busyUntil);
    const discounted = isHammerJamAt(now + startMin * 60_000);
    const jam = discounted ? 0.5 : 1;
    const finalMinutes = Math.max(1, Math.round(item.baseMinutes * jam * (1 - goldPass.timeReduction / 100)));
    const finalCost = Math.round(item.baseCost * jam * (1 - goldPass.costReduction / 100));
    const endMin = finishWithWindows(startMin, finalMinutes, windows[type], POTION_MULT[type]);

    planned.push({
      item,
      slot: slot.label,
      startMin,
      endMin,
      finalMinutes,
      finalCost,
      discounted,
      waited: track.busyUntil > slot.freeAt + 0.5,
    });
    segments.push({
      id: `plan-${item.uid}`,
      uid: item.uid,
      kind: item.kind,
      lane: best,
      slot: slot.label,
      name: item.name,
      label: `Lv ${item.level - 1} → ${item.level}`,
      startMs: now + startMin * 60_000,
      endMs: now + endMin * 60_000,
      current: false,
      discounted,
    });

    slot.freeAt = endMin;
    slot.lastEntityId = item.entityId;
    slot.lastLevel = item.level;
    track.level = item.level;
    track.busyUntil = endMin;
    return true;
  };

  // an upgrade whose previous level is queued later is retried once that level is placed
  let progress = true;
  while (progress && pending.length > 0) {
    progress = false;
    const still: QueueItem[] = [];
    for (const item of pending) {
      if (tryPlace(item)) progress = true;
      else still.push(item);
    }
    pending = still;
  }

  const order = new Map(a.queue.map((q, i) => [q.uid, i]));
  planned.sort((x, y) => (order.get(x.item.uid) ?? 0) - (order.get(y.item.uid) ?? 0));

  const nextFreeOf = (kind: Kind): NextFree | null => {
    const slots = slotsByKind[kind];
    if (slots.length === 0) return null;
    let best = slots[0] as Slot;
    for (const s of slots) if (s.freeAt < best.freeAt) best = s;
    return {
      label: best.label,
      freeAtMin: best.freeAt,
      lastEntityId: best.lastEntityId,
      lastLevel: best.lastLevel,
    };
  };

  return {
    planned,
    unplaced: pending.map((item) => ({ item, reason: reasons.get(item.uid) ?? 'Cannot be planned.' })),
    segments,
    slotLabels: {
      builder: slotsByKind.builder.map((s) => s.label),
      lab: slotsByKind.lab.map((s) => s.label),
      pet: slotsByKind.pet.map((s) => s.label),
    },
    nextFree: { builder: nextFreeOf('builder'), lab: nextFreeOf('lab'), pet: nextFreeOf('pet') },
    tracks,
    currentFreeIn,
    windows,
    startedInJam: planned.filter((p) => p.discounted).length,
  };
}