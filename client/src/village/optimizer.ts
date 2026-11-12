import { HAMMER_JAM_END_MS } from '../config/hammerJam';
import { makeId } from '../utils';
import { buildPlan, isJamExempt, kindForPotion } from './planning';
import type { PlanArgs, PlanResult, PotionBlock } from './planning';
import { chainWindows } from './potions';
import type { PotionType } from './potions';

const MAX_POTIONS = 60;
const MAX_CANDIDATES = 80;

export interface Suggestion {
  blocks: PotionBlock[];
  message: string;
  /** how to show the message: success = it works with the potions you own */
  tone: 'success' | 'info' | 'warning';
}

/** Times (minutes from now) worth trying for the next potion: when workers free up, or right after another potion. */
function candidateTimes(plan: PlanResult, args: PlanArgs, type: PotionType, jamEndMin: number): number[] {
  const kind = kindForPotion(type);
  const times = new Set<number>([0]);
  for (const s of plan.segments) {
    if (s.kind !== kind) continue;
    times.add(Math.round(((s.startMs - args.now) / 60_000) * 10) / 10);
    times.add(Math.round(((s.endMs - args.now) / 60_000) * 10) / 10);
  }
  for (const w of plan.windows[type]) times.add(Math.round(w.b * 10) / 10);
  return [...times]
    .filter((t) => t >= 0 && t < jamEndMin)
    .sort((x, y) => x - y)
    .slice(0, MAX_CANDIDATES);
}

/**
 * Greedy search: add one potion at a time at the moment that helps most (more upgrades starting inside Hammer
 * Jam first, then earlier starts) and stop once everything queued starts inside Hammer Jam.
 */
export function suggestPotions(args: PlanArgs, type: PotionType, owned: number): Suggestion {
  const kind = kindForPotion(type);
  const items = args.queue.filter((i) => i.kind === kind);
  if (items.length === 0) {
    return {
      blocks: [],
      message: 'Add some upgrades of this type first — potions are planned around your queue.',
      tone: 'info',
    };
  }

  // crafted defences never get the Hammer Jam discount, so potions can't help them and they don't count
  const boosted = items.filter((i) => !isJamExempt(i.entityId)).length;
  if (boosted === 0) {
    return {
      blocks: [],
      message: 'Everything queued of this type is a crafted defence. Hammer Jam does not discount those, so potions are not needed for the discount.',
      tone: 'info',
    };
  }

  const others = args.blocks.filter((b) => b.type !== type);
  const jamEndMin = (HAMMER_JAM_END_MS - args.now) / 60_000;

  const evaluate = (seq: number[]) => {
    const blocks: PotionBlock[] = [
      ...others,
      ...seq.map((m, i) => ({ id: `s${i}`, type, startMs: args.now + m * 60_000, count: 1 })),
    ];
    const plan = buildPlan({ ...args, queue: items, blocks });
    return {
      plan,
      inJam: plan.planned.filter((p) => p.discounted).length,
      sumStart: plan.planned.reduce((s, p) => s + p.startMin, 0),
    };
  };
  type Eval = ReturnType<typeof evaluate>;
  const reachedGoal = (r: Eval): boolean => r.plan.unplaced.length === 0 && r.inJam === boosted;
  const better = (x: Eval, y: Eval): boolean => x.inJam > y.inJam || (x.inJam === y.inJam && x.sumStart < y.sumStart - 0.5);

  let seq: number[] = [];
  let best = evaluate(seq);
  let neededAt: number | null = reachedGoal(best) ? 0 : null;

  while (neededAt === null && seq.length < MAX_POTIONS) {
    let pick: { m: number; r: Eval } | null = null;
    for (const m of candidateTimes(best.plan, args, type, jamEndMin)) {
      const r = evaluate([...seq, m]);
      if (better(r, pick ? pick.r : best)) pick = { m, r };
    }
    if (!pick) break;
    seq = [...seq, pick.m];
    best = pick.r;
    if (reachedGoal(best)) neededAt = seq.length;
  }

  const use = neededAt === null ? seq.slice(0, owned) : seq.slice(0, Math.min(neededAt, owned));
  const blocks: PotionBlock[] = chainWindows(use.map((m) => ({ startMin: m, count: 1 }))).map((w) => ({
    id: makeId(),
    type,
    startMs: args.now + w.a * 60_000,
    count: Math.round((w.b - w.a) / 60),
  }));

    let message: string;
  let tone: Suggestion['tone'] = 'warning';
  if (neededAt === 0) {
    message = 'No potions needed — everything queued already starts inside Hammer Jam.';
    tone = 'info';
  } else if (neededAt === null) {
    message =
      seq.length >= MAX_POTIONS
        ? `Even ${MAX_POTIONS} potions can't start everything inside Hammer Jam. Remove some upgrades or use Goblin workers.`
        : "Potions can't get everything started inside Hammer Jam. Remove some upgrades or use Goblin workers.";
    if (blocks.length > 0) message += ` Placed ${use.length} for the best effect.`;
  } else if (neededAt <= owned) {
    message = `Everything queued starts inside Hammer Jam with ${neededAt} potion(s). The other ${owned - neededAt} stay in your stock.`;
    tone = 'success';
  } else {
    message = `You'd need ${neededAt} potions to start everything inside Hammer Jam — you own ${owned} (short by ${neededAt - owned}). Placed all ${owned} for the best effect.`;
  }
  return { blocks, message, tone };
}