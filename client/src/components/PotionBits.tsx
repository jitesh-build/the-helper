import type { ReactNode } from 'react';
import { formatDate, formatMinutes } from '../utils';
import type { PotionPlan } from '../village/potions';

export function FreeCard({ title, freeInMin, now }: { title: string; freeInMin: number; now: number }) {
  const free = freeInMin <= 0;
  return (
    <div className="min-w-0 rounded-lg bg-black/25 p-2">
      <p className="break-words text-coc-gold">{title}</p>
      <p className="text-sm">
        Free in <b className="text-coc-good">{free ? 'now' : formatMinutes(freeInMin)}</b>
      </p>
      <p className="break-words text-sm">
        Free at <b>{free ? 'now' : formatDate(now, freeInMin)}</b>
      </p>
    </div>
  );
}

interface VerdictProps {
  plan: PotionPlan;
  potionName: string;
  slot: string;
  owned: number;
  now: number;
}

export function PotionVerdict({ plan, potionName, slot, owned, now }: VerdictProps) {
  let text: ReactNode;
  let good = true;

  if (plan.alreadyFree) {
    text = <>A {slot} is already free — no potions needed.</>;
  } else if (plan.potionsNeeded === null) {
    good = false;
    text = (
      <>
        Not possible by then. Even with unlimited {potionName}s the earliest a {slot} frees up is in{' '}
        {formatMinutes(plan.fastestPossible)} ({formatDate(now, plan.fastestPossible)}).
      </>
    );
  } else if (plan.potionsNeeded === 0) {
    text = <>No potions needed — a {slot} frees up in time by itself.</>;
  } else {
    const short = plan.potionsNeeded - owned;
    good = short <= 0;
    text = (
      <>
        You need <b>{plan.potionsNeeded}</b> {potionName}(s) — you have {owned}
        {short > 0 ? `, short by ${short}.` : '. Enough!'} Drink them back-to-back starting right now.
      </>
    );
  }
  return <p className={good ? 'text-coc-good' : 'text-coc-danger'}>{text}</p>;
}