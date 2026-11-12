import { useState } from 'react';
import type { PotionCounts } from '../types';
import { formatClock, formatDay, formatStamp } from '../utils';
import type { PotionBlock } from '../village/planning';
import { POTION_META, actualRuns } from '../village/potions';
import type { PotionType, PotionWindow } from '../village/potions';
import { Panel } from './Panel';

const TYPES: PotionType[] = ['builder', 'research', 'pet'];

interface Props {
  owned: PotionCounts;
  blocks: PotionBlock[];
  /** when potions are really active (potions that would overlap are chained one after another) */
  windows: Record<PotionType, PotionWindow[]>;
  now: number;
  onRemove: (id: string) => void;
  onSuggest: (type: PotionType) => void;
}

const sameDay = (x: number, y: number): boolean => new Date(x).toDateString() === new Date(y).toDateString();

export function PotionsPanel({ owned, blocks, windows, now, onRemove, onSuggest }: Props) {
  const [type, setType] = useState<PotionType>('builder');
  const meta = POTION_META[type];

  const planned = blocks.filter((b) => b.type === type).reduce((sum, b) => sum + b.count, 0);
  const left = owned[type] - planned;

  const rows = windows[type].map((w, i) => {
    const a = now + w.a * 60_000;
    const b = now + w.b * 60_000;
    return {
      key: `${i}-${Math.round(a)}`,
      a,
      b,
      count: Math.round((w.b - w.a) / 60),
      state: b <= now ? 'done' : a <= now ? 'now' : 'next',
    } as const;
  });

  const mine = blocks.filter((b) => b.type === type).sort((x, y) => x.startMs - y.startMs);
  const runs = actualRuns(mine);

  return (
    <Panel
      title="🧪 Potions in Hammer Jam"
      right={
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline">Overview</span>
          <select
            className="field w-auto"
            value={type}
            onChange={(e) => setType(e.target.value as PotionType)}
            aria-label="Which potion overview to show"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {POTION_META[t].icon} {POTION_META[t].label}s
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/25 p-2">
        <span className="text-sm">
          own <b>{owned[type]}</b> · used <b>{planned}</b> · left{' '}
          <b className={left < 0 ? 'text-coc-danger' : 'text-coc-good'}>{left}</b>
        </span>
        <button className="btn-gold px-2 py-0.5 text-sm" onClick={() => onSuggest(type)}>
          ✨ Suggest best use
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-black/20 p-3 text-sm">
          No {meta.label.toLowerCase()}s planned yet. Tap a day in the calendar to apply some, or use “Suggest best use”.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-sm">
            <thead className="text-coc-parchment">
              <tr>
                <th className="p-1">Day</th>
                <th className="p-1">Time</th>
                <th className="p-1 text-right">Potions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={`border-t border-white/10 ${r.state === 'done' ? 'opacity-50' : ''}`}>
                  <td className="p-1">{formatDay(r.a)}</td>
                  <td className="p-1">
                    {formatClock(r.a)} → {sameDay(r.a, r.b) ? formatClock(r.b) : `${formatDay(r.b)}, ${formatClock(r.b)}`}
                    {r.state === 'now' && <span className="ml-2 rounded bg-coc-good/25 px-1 text-xs text-coc-good">active</span>}
                    {r.state === 'done' && <span className="ml-2 text-xs">done</span>}
                  </td>
                  <td className="p-1 text-right">
                    {meta.icon} <b>{r.count}</b>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/20">
                <td className="p-1" colSpan={2}>
                  Total
                </td>
                <td className="p-1 text-right">
                  <b>{rows.reduce((s, r) => s + r.count, 0)}</b>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {mine.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-coc-parchment">Edit or remove applied potions</summary>
          <ul className="mt-2 space-y-2">
            {mine.map((b) => {
              const run = runs.get(b.id) ?? { a: b.startMs, b: b.startMs + b.count * 3_600_000 };
              return (
              <li key={b.id} className="flex items-start justify-between gap-2 rounded-lg bg-black/25 p-2">
                <span className="min-w-0 break-words">
                  <b>{b.count}×</b> {formatStamp(run.a)} → {formatStamp(run.b)}
                  {run.a > b.startMs + 1000 && <span className="ml-1 text-xs opacity-70">(waits for the earlier potion)</span>}
                </span>
                <button className="btn-red px-2 py-0.5 text-sm" onClick={() => onRemove(b.id)}>
                  ✕
                </button>
              </li>
              );
            })}
          </ul>
        </details>
      )}
    </Panel>
  );
}