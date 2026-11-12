import type { Resource } from '../types';
import { RESOURCE_META, formatDate, formatMinutes, formatNumber } from '../utils';
import type { PlanResult } from '../village/planning';
import { Panel } from './Panel';

interface Props {
  plan: PlanResult;
  now: number;
  useGoblins: boolean;
  onToggleGoblins: (v: boolean) => void;
  onRemove: (uid: string) => void;
  onMove: (uid: string, dir: -1 | 1) => void;
  onClear: () => void;
}

export function PlanList({ plan, now, useGoblins, onToggleGoblins, onRemove, onMove, onClear }: Props) {
  const totals: Record<Resource, number> = { gold: 0, elixir: 0, darkElixir: 0 };
  for (const p of plan.planned) totals[p.item.resource] += p.finalCost;
  const count = plan.planned.length + plan.unplaced.length;

  return (
    <Panel
      title={`📋 Your plan (${count})`}
      right={
        count > 0 && (
          <button className="btn-red text-sm" onClick={onClear}>
            Clear
          </button>
        )
      }
    >
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-5 w-5 accent-yellow-400"
          checked={useGoblins}
          onChange={(e) => onToggleGoblins(e.target.checked)}
        />
        Also plan on Goblin Builder / Researcher (costs gems)
      </label>

      <ul className="max-h-[60dvh] space-y-2 overflow-y-auto pr-1 lg:max-h-[28rem]">
        {plan.planned.map((p, i) => {
          const meta = RESOURCE_META[p.item.resource];
          return (
            <li key={p.item.uid} className="rounded-lg bg-black/25 p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 break-words">
                  {i + 1}. {p.item.name} <span className="text-coc-gold">→ Lv {p.item.level}</span>
                </p>
                <div className="flex shrink-0 gap-1">
                  <button className="btn-gold px-2 py-0.5 text-sm" onClick={() => onMove(p.item.uid, -1)}>
                    ▲
                  </button>
                  <button className="btn-gold px-2 py-0.5 text-sm" onClick={() => onMove(p.item.uid, 1)}>
                    ▼
                  </button>
                  <button className="btn-red px-2 py-0.5 text-sm" onClick={() => onRemove(p.item.uid)}>
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-sm">
                {p.slot} · starts{' '}
                <b>{p.startMin <= 0 ? 'now' : `${formatDate(now, p.startMin)} (in ${formatMinutes(p.startMin)})`}</b>
              </p>
              <p className="text-sm">
                Free at{' '}
                <b className="text-coc-good">
                  {formatDate(now, p.endMin)} (in {formatMinutes(p.endMin)})
                </b>
              </p>
              {p.waited && <p className="text-xs text-coc-gold">Waits for the previous level to finish first.</p>}
              <p className="text-xs">
                <span className={p.discounted ? 'text-coc-good' : p.exempt ? 'text-coc-gold' : 'text-coc-danger'}>
                  {p.discounted
                    ? '50% off'
                    : p.exempt
                      ? 'no Hammer Jam discount (crafted defence)'
                      : 'full price (starts outside Hammer Jam)'}
                </span>{' '}
                · <span className="line-through opacity-60">{formatMinutes(p.item.baseMinutes)}</span>{' '}
                {formatMinutes(p.finalMinutes)} ·{' '}
                <span className={meta.className}>
                  {meta.icon} <span className="line-through opacity-60">{formatNumber(p.item.baseCost)}</span>{' '}
                  {formatNumber(p.finalCost)}
                </span>
              </p>
            </li>
          );
        })}

        {plan.unplaced.map(({ item, reason }) => (
          <li
            key={item.uid}
            className="flex items-start justify-between gap-2 rounded-lg bg-black/25 p-2 text-coc-danger"
          >
            <span className="min-w-0 break-words">
              {item.name} → Lv {item.level}: {reason}
            </span>
            <button className="btn-red px-2 py-0.5 text-sm" onClick={() => onRemove(item.uid)}>
              ✕
            </button>
          </li>
        ))}

        {count === 0 && <li className="text-sm">Nothing planned yet. Add upgrades from the catalogue.</li>}
      </ul>

      {plan.planned.length > 0 && (
        <div className="mt-3 rounded-lg bg-black/30 p-2 text-sm">
          <p>
            <b className="text-coc-good">{plan.startedInJam}</b> of {plan.planned.filter((p) => !p.exempt).length} start inside Hammer Jam.
          </p>
          <p>
            Total:{' '}
            {(Object.keys(totals) as Resource[])
              .filter((r) => totals[r] > 0)
              .map((r) => (
                <span key={r} className={`mr-3 ${RESOURCE_META[r].className}`}>
                  {RESOURCE_META[r].icon} {formatNumber(totals[r])}
                </span>
              ))}
          </p>
        </div>
      )}
    </Panel>
  );
}