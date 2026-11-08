import type { ReactNode } from 'react';
import { formatDate, formatMinutes } from '../utils';
import type { VillageModel, Worker } from '../village/model';
import { Panel } from './Panel';

interface CardProps {
  worker: Worker;
  now: number;
  /** minutes until free after the chosen potions (only for busy workers) */
  freeIn?: number;
}

function WorkerCard({ worker, now, freeIn }: CardProps) {
  const u = worker.upgrade;
  let body: ReactNode;

  if (worker.state === 'locked') {
    body = <p className="text-sm opacity-70">🔒 Not unlocked</p>;
  } else if (worker.state === 'unused') {
    body = <p className="text-sm opacity-70">Not hired (costs gems)</p>;
  } else if (worker.state === 'idle' || !u) {
    body = <p className="text-coc-good">😴 Idle — free now</p>;
  } else {
    const shown = freeIn ?? u.remainingMin;
    const boosted = freeIn !== undefined && u.remainingMin - freeIn > 0.5;
    const pct = u.totalMin ? Math.min(100, Math.max(0, (1 - u.remainingMin / u.totalMin) * 100)) : null;
    body = (
      <>
        <p className="break-words text-lg leading-tight">{u.name}</p>
        <p className="text-sm text-coc-gold">{u.label}</p>
        {pct !== null && (
          <div className="my-2 h-2 rounded bg-black/40">
            <div className="h-2 rounded bg-coc-good" style={{ width: `${pct}%` }} />
          </div>
        )}
        <p className="text-sm">
          Free in <b className="text-coc-good">{formatMinutes(shown)}</b>
        </p>
        <p className="break-words text-sm">
          Free at <b>{formatDate(now, shown)}</b>
        </p>
        {boosted && (
          <p className="text-xs text-coc-elixir">🧪 with potions · was {formatMinutes(u.remainingMin)}</p>
        )}
      </>
    );
  }

  return (
    <div className="min-w-0 rounded-xl bg-black/25 p-3">
      <p className="mb-1 text-sm text-coc-parchment">
        {worker.icon} {worker.label}
      </p>
      {body}
    </div>
  );
}

interface Props {
  model: VillageModel;
  now: number;
  adjusted?: Record<string, number>;
}

export function VillageBoard({ model, now, adjusted }: Props) {
  const card = (w: Worker) => <WorkerCard key={w.id} worker={w} now={now} freeIn={adjusted?.[w.id]} />;

  return (
    <div className="space-y-4">
      <Panel title="🔨 Builders">
        {/* phone: 1 column · tablet: 2 · laptop/desktop: 3 (so 6 builders = 3×2) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{model.builders.map(card)}</div>
      </Panel>

      {/* stacked on phones/tablets, side by side (50% / 50%) from laptop width */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="📘 Laboratory">
          <div className="grid gap-3 sm:grid-cols-2">
            {card(model.lab)}
            {card(model.goblinResearcher)}
          </div>
        </Panel>
        <Panel title="🧌 Goblin Builder & 🐾 Pet House">
          <div className="grid gap-3 sm:grid-cols-2">
            {card(model.goblinBuilder)}
            {card(model.pet)}
          </div>
        </Panel>
      </div>
    </div>
  );
}