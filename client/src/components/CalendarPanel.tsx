import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { HAMMER_JAM_END_MS, HAMMER_JAM_START_MS } from '../config/hammerJam';
import { useToast } from '../toast/ToastContext';
import type { GoldPass, Kind, PotionCounts } from '../types';
import { formatClock, formatDay, formatMinutes, toTimeInput } from '../utils';
import { KINDS, potionTypeFor } from '../village/planning';
import type { PlanResult, PotionBlock } from '../village/planning';
import { POTION_META, actualRuns } from '../village/potions';
import type { PotionType } from '../village/potions';
import { Panel } from './Panel';

const HEADER = 30; // px for the day number row
const LANE = 16; // bar height
const STEP = LANE + 3;
const OUTSIDE = 'repeating-linear-gradient(45deg, rgba(0,0,0,.5) 0 5px, rgba(0,0,0,.25) 5px 10px)';
// const POTION_TYPES: PotionType[] = ['builder', 'research', 'pet'];

const KIND_UI: Record<Kind, { label: string; icon: string; palette: number }> = {
  builder: { label: 'Builders', icon: '🔨', palette: 0 },
  lab: { label: 'Laboratory', icon: '📘', palette: 1 },
  pet: { label: 'Pet House', icon: '🐾', palette: 4 },
};

const COLORS = ['#ffd23f', '#ff79c6', '#5bb6f0', '#8be04e', '#ff9a3c', '#a99bff', '#2dd4bf'];
const SHEEN = 'linear-gradient(to bottom, rgba(255,255,255,.38), rgba(255,255,255,0) 60%)';
const INK = 'rgba(0,0,0,.16)';

/** a bright colour with a soft sheen, plus a faint pattern so lanes also differ without colour vision */
function laneStyle(index: number): CSSProperties {
  const color = COLORS[index % COLORS.length] as string;
  const patterns = [
    `repeating-linear-gradient(45deg, transparent 0 4px, ${INK} 4px 6px)`,
    `repeating-linear-gradient(-45deg, transparent 0 4px, ${INK} 4px 6px)`,
    `repeating-linear-gradient(90deg, transparent 0 4px, ${INK} 4px 6px)`,
    `repeating-linear-gradient(0deg, transparent 0 4px, ${INK} 4px 6px)`,
    `repeating-linear-gradient(45deg, transparent 0 5px, ${INK} 5px 6px), repeating-linear-gradient(-45deg, transparent 0 5px, ${INK} 5px 6px)`,
    `radial-gradient(${INK} 1.4px, transparent 1.8px)`,
  ];
  const pattern = patterns[index % 7];
  const dots = index % 7 === 5;
  return {
    backgroundColor: color,
    backgroundImage: pattern ? `${SHEEN}, ${pattern}` : SHEEN,
    backgroundSize: dots ? '100% 100%, 6px 6px' : undefined,
  };
}

/** 4 columns on every screen size (phones included) */
const COLS = 4;

/** local calendar days that Hammer Jam touches, plus a closing boundary */
function buildDays(startMs: number, endMs: number): number[] {
  const out: number[] = [];
  const d = new Date(startMs);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < endMs) {
    out.push(d.getTime());
    d.setDate(d.getDate() + 1);
  }
  out.push(d.getTime());
  return out;
}

/** time -> position in "day" units (0 = start of the first day) */
function positionOf(days: number[], ms: number): number {
  const n = days.length - 1;
  const t = Math.min(Math.max(ms, days[0] as number), days[n] as number);
  let i = 0;
  while (i < n - 1 && (days[i + 1] as number) <= t) i++;
  const a = days[i] as number;
  const b = days[i + 1] as number;
  return i + (t - a) / (b - a);
}

interface Clipped {
  left: number;
  width: number;
  contLeft: boolean;
  contRight: boolean;
}

/** the part of [a, b] (in "day" units) that falls inside calendar row `row` */
function clip(a: number, b: number, row: number, cols: number): Clipped | null {
  const lo = row * cols;
  const hi = lo + cols;
  const s = Math.max(a, lo);
  const e = Math.min(b, hi);
  if (e - s < 0.004) return null;
  return {
    left: ((s - lo) / cols) * 100,
    width: ((e - s) / cols) * 100,
    contLeft: a < lo - 1e-9,
    contRight: b > hi + 1e-9,
  };
}

function Pill({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'good' | 'gold' }) {
  const colors = { plain: 'bg-black/30 text-white', good: 'bg-coc-good/20 text-coc-good', gold: 'bg-coc-gold/20 text-coc-gold' };
  return <span className={`rounded-full px-3 py-1 text-xs ${colors[tone]}`}>{children}</span>;
}

interface DetailProps {
  index: number;
  days: number[];
  plan: PlanResult;
  now: number;
  /** only this kind (the calendar's dropdown) is shown */
  kind: Kind;
  owned: number;
  planned: number;
  blocks: PotionBlock[];
  onApply: (type: PotionType, startMs: number, count: number) => void;
  onRemoveBlock: (id: string) => void;
  saveBar: ReactNode;
  onClose: () => void;
}

export function DayDetail({
  index,
  days,
  plan,
  now,
  kind,
  owned,
  planned,
  blocks,
  onApply,
  onRemoveBlock,
  saveBar,
  onClose,
}: DetailProps) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [index]);

  const start = days[index] as number;
  const end = days[index + 1] as number;
  const sameDay = (ms: number) => ms >= start && ms < end;
  const when = (ms: number) => (sameDay(ms) ? formatClock(ms) : `${formatDay(ms)}, ${formatClock(ms)}`);

  const segs = plan.segments.filter((s) => s.kind === kind);
  const events = segs
    .filter((s) => sameDay(s.endMs))
    .sort((x, y) => x.endMs - y.endMs)
    .map((s) => ({
      s,
      next: segs
        .filter((x) => x.lane === s.lane && !x.current && x.startMs >= s.endMs - 1000)
        .sort((x, y) => x.startMs - y.startMs)[0],
    }));

  // potions: only the type that belongs to the selected group
  const potionType = potionTypeFor(kind);
  const pm = POTION_META[potionType];
  // where each potion really runs (a potion that overlaps an earlier one waits for it)
  const typeBlocks = blocks.filter((b) => b.type === potionType);
  const runs = actualRuns(typeBlocks);
  const dayBlocks = typeBlocks
    .map((b) => ({ b, run: runs.get(b.id) ?? { a: b.startMs, b: b.startMs + b.count * 3_600_000 } }))
    .filter(({ run }) => run.a < end && run.b > start)
    .sort((x, y) => x.run.a - y.run.a);

  // whole minutes only: `now` has seconds, but the time box doesn't, so 13:32 must be allowed at 13:32:40
  const minMs = Math.ceil(Math.max(start, HAMMER_JAM_START_MS, now) / 60_000) * 60_000;
  const maxMs = Math.min(end, HAMMER_JAM_END_MS) - 60_000;
  const canApply = minMs <= maxMs;
  const left = owned - planned;
  const isToday = now >= start && now < end;
  const defaultMs = Math.min(
    Math.max(isToday ? Math.ceil(now / 300_000) * 300_000 : start + 12 * 3_600_000, minMs),
    maxMs,
  );
  const [time, setTime] = useState<string>(() => toTimeInput(defaultMs));
  const [count, setCount] = useState('1');

  const apply = () => {
    const [h, m] = time.split(':').map((x) => Number.parseInt(x, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      toast.error('Pick a start time.');
      return;
    }
    const d = new Date(start);
    d.setHours(h as number, m as number, 0, 0);
    const startMs = d.getTime();
    if (startMs < minMs - 1000 || startMs > maxMs) {
      toast.error(`Pick a time between ${formatClock(minMs)} and ${formatClock(maxMs)} on this day.`);
      return;
    }
    const n = Number.parseInt(count, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error('Enter how many potions to apply.');
      return;
    }
    onApply(potionType, startMs, n);
  };

  const past = end <= now;

  return (
    <div ref={ref} className="mt-4 overflow-hidden rounded-xl border-2 border-coc-gold bg-coc-woodDark/70">
      <div className="flex items-center justify-between gap-2 bg-coc-gold/15 px-3 py-2">
        <div className="min-w-0">
          <h3 className="stroke text-xl leading-tight text-coc-gold">{formatDay(start)}</h3>
          <p className="text-xs text-coc-parchment">
            Day {index + 1} of Hammer Jam{past ? ' · already passed' : ''}
          </p>
        </div>
        <button className="btn px-2 py-0.5 text-sm" onClick={onClose}>
          ✕ Close
        </button>
      </div>

      <div className="space-y-4 p-3 text-sm">
        <section>
          <h4 className="mb-1 flex items-center gap-2 text-coc-parchment">
            <span aria-hidden>{KIND_UI[kind].icon}</span> {KIND_UI[kind].label} getting free
            <span className="rounded-full bg-black/30 px-2 text-xs">{events.length}</span>
          </h4>
          {events.length === 0 ? (
            <p className="rounded-lg bg-black/20 p-2 opacity-70">Nothing frees up on this day.</p>
          ) : (
            <ul className="space-y-2">
              {events.map(({ s, next }) => (
                <li key={s.id} className="flex gap-2 rounded-lg bg-black/25 p-2">
                  <span
                    className="w-1.5 shrink-0 self-stretch rounded"
                    style={laneStyle(KIND_UI[kind].palette + s.lane)}
                    aria-hidden
                  />
                  <div className="min-w-0 break-words">
                    <p>
                      <b className="mr-1 rounded bg-coc-good/20 px-1.5 text-coc-good">{when(s.endMs)}</b>
                      <b>{s.slot}</b> is free
                    </p>
                    <p className="text-xs text-coc-parchment/80">
                      after {s.name} {s.label}
                    </p>
                    <p className="text-xs">
                      {next ? (
                        <>
                          Next: <b>{next.name}</b> {next.label} starts {when(next.startMs)}
                        </>
                      ) : (
                        <span className="opacity-80">Nothing planned after this, so it stays idle.</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg bg-black/25 p-2">
          <h4 className="mb-2 text-coc-parchment">
            {pm.icon} Apply {pm.label.toLowerCase()}s on this day{' '}
            <span className="text-xs opacity-80">
              · {Math.max(0, left)} left of {owned}
            </span>
          </h4>

          {!canApply ? (
            <p className="opacity-80">Potions can't be applied on a day that has passed or is outside Hammer Jam.</p>
          ) : left <= 0 ? (
            <p className="text-coc-danger">
              No {pm.label.toLowerCase()}s left. Raise “Potions you own” in Hammer Jam & Boost, or remove one below.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="label">Start time</span>
                <input
                  className="field"
                  type="time"
                  value={time}
                  min={toTimeInput(minMs)}
                  max={toTimeInput(maxMs)}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="label">How many (1 hour each)</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  max={left}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <button className="btn-green" onClick={apply}>
                Apply
              </button>
            </div>
          )}
          <p className="mt-2 text-xs opacity-70">
            Potions can't overlap: one that would start while another is running waits for it to end.
          </p>

          {dayBlocks.length > 0 && (
            <ul className="mt-2 space-y-1">
              {dayBlocks.map(({ b, run }) => (
                <li key={b.id} className="flex items-start justify-between gap-2 rounded-lg bg-coc-elixir/20 p-2">
                  <span className="min-w-0 break-words">
                    {pm.icon} <b>{b.count}×</b> {when(run.a)} → {when(run.b)}
                    {run.a > b.startMs + 1000 && <span className="ml-1 text-xs opacity-70">(waits for the earlier potion)</span>}
                  </span>
                  <button className="btn-red px-2 py-0.5 text-sm" onClick={() => onRemoveBlock(b.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {saveBar}
      </div>
    </div>
  );
}

interface Props {
  plan: PlanResult;
  now: number;
  goldPass: GoldPass;
  /** potions owned / already used in the plan, per type */
  owned: PotionCounts;
  planned: PotionCounts;
  blocks: PotionBlock[];
  onApplyPotion: (type: PotionType, startMs: number, count: number) => void;
  onRemoveBlock: (id: string) => void;
  /** where the "Save plan" bar goes inside the day details */
  saveBar: ReactNode;
}

export function CalendarPanel({
  plan,
  now,
  goldPass,
  owned,
  planned,
  blocks,
  onApplyPotion,
  onRemoveBlock,
  saveBar,
}: Props) {
  const [kind, setKind] = useState<Kind>('builder');
  const [selected, setSelected] = useState<number | null>(null);
  const [focusLane, setFocusLane] = useState<number | null>(null);
  const cols = COLS;

  const days = useMemo(() => buildDays(HAMMER_JAM_START_MS, HAMMER_JAM_END_MS), []);
  const n = days.length - 1;
  const rows = Math.ceil(n / cols);
  const first = days[0] as number;
  const last = days[n] as number;
  const toX = (ms: number): number => positionOf(days, ms);

  const xStart = toX(HAMMER_JAM_START_MS);
  const xEnd = toX(HAMMER_JAM_END_MS);
  const nowInRange = now >= first && now < last;
  const xNow = toX(now);
  const todayIndex = nowInRange ? Math.min(n - 1, Math.floor(xNow)) : -1;
  const allPast = now >= last;

  const meta = KIND_UI[kind];
  const labels = plan.slotLabels[kind];
  const lanes = Math.max(1, labels.length);
  const segs = plan.segments.filter((s) => s.kind === kind);
  const windows = plan.windows[potionTypeFor(kind)];
  const hasPotions = windows.length > 0;
  const cellHeight = HEADER + (lanes + (hasPotions ? 1 : 0)) * STEP + 14;

  // how many workers get free on each day (shown as a 🔔 badge)
  const freesByDay = new Array<number>(n).fill(0);
  for (const s of segs) {
    if (s.endMs < HAMMER_JAM_START_MS || s.endMs >= HAMMER_JAM_END_MS) continue;
    freesByDay[Math.min(n - 1, Math.floor(toX(s.endMs)))] += 1;
  }

  const overlay = (a: number, b: number, row: number, key: string): ReactNode => {
    const c = clip(a, b, row, cols);
    return c ? (
      <div
        key={`${key}-${row}`}
        className="absolute inset-y-0"
        style={{ left: `${c.left}%`, width: `${c.width}%`, background: OUTSIDE }}
      />
    ) : null;
  };

  const layer = (r: number): ReactNode[] => {
    const out: ReactNode[] = [overlay(0, xStart, r, 'pre'), overlay(xEnd, n, r, 'post')];

    for (const s of segs) {
      const c = clip(Math.max(toX(s.startMs), xStart), Math.min(toX(s.endMs), xEnd), r, cols);
      if (!c) continue;
      const dim = focusLane !== null && focusLane !== s.lane;
      const rl = c.contLeft ? 0 : 6;
      const rr = c.contRight ? 0 : 6;
      out.push(
        <div
          key={`${s.id}-${r}`}
          className="absolute flex items-center overflow-hidden border border-black/50 px-0.5 text-[9px] font-semibold leading-none text-[#1f1308] sm:px-1 sm:text-[11px]"
          style={{
            left: `${c.left}%`,
            width: `${c.width}%`,
            minWidth: 6,
            top: HEADER + s.lane * STEP,
            height: LANE,
            borderRadius: `${rl}px ${rr}px ${rr}px ${rl}px`,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.22), 0 1px 0 rgba(0,0,0,.45)',
            opacity: dim ? 0.22 : 1,
            ...laneStyle(meta.palette + s.lane),
          }}
        >
          {c.width >= 12 && (
            <span className="truncate">
              {c.contLeft ? '◂ ' : ''}
              {s.current ? '▶ ' : ''}
              {s.name} {s.label.replace(/^.*→\s*/, '→')}
              {c.contRight ? ' ▸' : ''}
            </span>
          )}
        </div>,
      );
    }

    windows.forEach((w, i) => {
      const c = clip(
        Math.max(toX(now + w.a * 60_000), xStart),
        Math.min(toX(now + w.b * 60_000), xEnd),
        r,
        cols,
      );
      if (!c) return;
      out.push(
        <div
          key={`potion-${i}-${r}`}
          className="absolute flex items-center overflow-hidden rounded-md border border-black/50 bg-coc-elixir px-0.5 text-[9px] font-semibold leading-none text-white sm:px-1 sm:text-[11px]"
          style={{
            left: `${c.left}%`,
            width: `${c.width}%`,
            minWidth: 6,
            top: HEADER + lanes * STEP,
            height: LANE,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.25)',
          }}
        >
          {c.width >= 9 && (
            <span className="truncate">
              {POTION_META[potionTypeFor(kind)].icon} ×{Math.round((w.b - w.a) / 60)}
            </span>
          )}
        </div>,
      );
    });

    if (nowInRange && xNow >= r * cols && xNow < (r + 1) * cols) {
      out.push(
        <div
          key={`now-${r}`}
          className="absolute inset-y-0 w-0.5 bg-white"
          style={{ left: `${((xNow - r * cols) / cols) * 100}%`, boxShadow: '0 0 6px 1px rgba(255,255,255,.8)' }}
        />,
      );
    }
    return out;
  };

  const cell = (i: number): ReactNode => {
    const past = allPast || (todayIndex >= 0 && i < todayIndex);
    const today = i === todayIndex;
    const sel = i === selected;
    const ds = days[i] as number;
    const de = days[i + 1] as number;
    const date = new Date(ds);
    const startsHere = HAMMER_JAM_START_MS >= ds && HAMMER_JAM_START_MS < de;
    const endsHere = HAMMER_JAM_END_MS >= ds && HAMMER_JAM_END_MS < de;
    const frees = freesByDay[i] ?? 0;

    return (
      <button
        key={i}
        type="button"
        aria-pressed={sel}
        aria-label={`${formatDay(ds)}${frees ? `, ${frees} free up` : ''}`}
        onClick={() => setSelected(sel ? null : i)}
        className={`relative min-w-0 border-b border-r border-black/40 text-left transition hover:brightness-110 ${
          past ? 'bg-stone-600/50 text-stone-300' : 'bg-gradient-to-b from-coc-wood to-coc-woodDark/80'
        } ${sel ? 'z-10 ring-2 ring-inset ring-white' : today ? 'ring-2 ring-inset ring-coc-gold' : ''}`}
        style={{ height: cellHeight }}
      >
        <div className="flex items-start justify-between gap-0.5 px-1 pt-1 sm:gap-1 sm:px-1.5">
          <span className="flex min-w-0 items-baseline gap-0.5 sm:gap-1">
            <span className="text-base leading-none sm:text-lg">{date.getDate()}</span>
            {/* phones: weekday only (cells are narrow) · sm and up: month · weekday */}
            <span className="truncate text-[9px] uppercase tracking-wide opacity-70 sm:hidden">
              {date.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
            <span className="hidden truncate text-[10px] uppercase tracking-wide opacity-70 sm:inline">
              {date.toLocaleDateString(undefined, { month: 'short' })} · {date.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {today && (
              <>
                <span className="h-2 w-2 rounded-full bg-coc-gold sm:hidden" aria-hidden />
                <span className="hidden rounded bg-coc-gold px-1 text-[9px] leading-4 text-coc-woodDark sm:inline">TODAY</span>
              </>
            )}
            {frees > 0 && (
              <span className="rounded-full bg-coc-good/25 px-1 text-[9px] leading-4 text-coc-good sm:px-1.5 sm:text-[10px]">
                <span className="hidden sm:inline">🔔 </span>
                {frees}
              </span>
            )}
          </span>
        </div>
        {(startsHere || endsHere) && (
          <span className="absolute bottom-0.5 left-1 right-0.5 truncate text-[8px] text-coc-gold sm:left-1.5 sm:text-[9px]">
            {startsHere ? (
              <>
                ⚒ <span className="hidden sm:inline">starts </span>
                {formatClock(HAMMER_JAM_START_MS)}
              </>
            ) : (
              <>
                🏁 <span className="hidden sm:inline">ends </span>
                {formatClock(HAMMER_JAM_END_MS)}
              </>
            )}
          </span>
        )}
      </button>
    );
  };

  const dayNo = todayIndex >= 0 ? todayIndex + 1 : allPast ? n : 0;
  const left = HAMMER_JAM_END_MS - now;
  const noPerks = goldPass.timeReduction === 0 && goldPass.costReduction === 0;

  return (
    <Panel
      title="🗓 Hammer Jam calendar"
      right={
        <label className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline">Show</span>
          <select
            className="field w-auto"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setFocusLane(null);
            }}
            aria-label="Show builders, lab or pet"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_UI[k].icon} {KIND_UI[k].label}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="mb-3 flex gap-2 rounded-lg border-l-4 border-amber-400 bg-amber-900/30 p-2 text-sm" role="note">
        <span aria-hidden>⚠</span>
        <p>
          Planned with your <b>Gold Pass</b> perks: time −{goldPass.timeReduction}% · cost −{goldPass.costReduction}%.{' '}
          {noPerks && "No perks are set — if you have the Gold Pass, set them first. "}
          If your perks change, these dates change too, so check the plan again after updating them.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {dayNo > 0 && <Pill tone="gold">Day {dayNo} of {n}</Pill>}
        <Pill>
          {now < HAMMER_JAM_START_MS
            ? `Starts in ${formatMinutes((HAMMER_JAM_START_MS - now) / 60_000)}`
            : left > 0
              ? `Ends in ${formatMinutes(left / 60_000)}`
              : 'Hammer Jam is over'}
        </Pill>
        <Pill tone="good">
          {plan.planned.length} planned · {plan.startedInJam} of {plan.planned.filter((p) => !p.exempt).length} start inside Hammer Jam
        </Pill>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Highlight one lane">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={focusLane === i}
            onClick={() => setFocusLane(focusLane === i ? null : i)}
            className={`flex items-center gap-1.5 rounded-full border-2 px-2 py-0.5 text-xs transition ${
              focusLane === i ? 'border-white bg-black/40' : 'border-coc-woodDark bg-black/25'
            }`}
          >
            <span className="inline-block h-3 w-5 rounded-sm border border-black/50" style={laneStyle(meta.palette + i)} />
            {label}
          </button>
        ))}
        {hasPotions && (
          <span className="flex items-center gap-1.5 rounded-full border-2 border-coc-woodDark bg-black/25 px-2 py-0.5 text-xs">
            <span className="inline-block h-3 w-5 rounded-sm border border-black/50 bg-coc-elixir" />
            {POTION_META[potionTypeFor(kind)].icon} potions
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full border-2 border-coc-woodDark bg-black/25 px-2 py-0.5 text-xs">
          <span className="inline-block h-3 w-5 rounded-sm border border-black/50" style={{ background: OUTSIDE }} />
          outside Hammer Jam
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-coc-woodDark shadow-inner">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="relative">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                return i < n ? cell(i) : <div key={`empty-${c}`} className="bg-black/20" style={{ height: cellHeight }} />;
              })}
            </div>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">{layer(r)}</div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-coc-parchment/80">
        Tap a day to see when builders, the lab and the pet house get free. The number on a day = how many free up that day. Gray days
        have passed, the white line is now, and tapping a lane name highlights it.
      </p>

            {selected !== null && (
        <DayDetail
          key={selected}
          index={selected}
          days={days}
          plan={plan}
          now={now}
          kind={kind}
          owned={owned[potionTypeFor(kind)]}
          planned={planned[potionTypeFor(kind)]}
          blocks={blocks}
          onApply={onApplyPotion}
          onRemoveBlock={onRemoveBlock}
          saveBar={saveBar}
          onClose={() => setSelected(null)}
        />
      )}
    </Panel>
  );
}