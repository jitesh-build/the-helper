import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { FreeCard, PotionVerdict } from '../components/PotionBits';
import { VillageBoard } from '../components/VillageBoard';
import { useNow } from '../hooks/useNow';
import { formatMinutes } from '../utils';
import { useVillages } from '../villages/VillageContext';
import { buildVillageModel, potionWorkers } from '../village/model';
import type { Worker } from '../village/model';
import { tryParseVillage } from '../village/parseVillage';
import { POTION_META, POTION_MULT, planPotions } from '../village/potions';
import type { PotionPlan, PotionType } from '../village/potions';

interface Target {
  mode: 'hours' | 'time';
  hours: string;
  dateTime: string;
}
const DEFAULT_TARGET: Target = { mode: 'hours', hours: '24', dateTime: '' };

const TYPE_UI: Record<PotionType, { select: string; noun: string; slot: string; potionName: string }> = {
  builder: { select: 'Builder', noun: 'builder', slot: 'builder', potionName: 'builder potion' },
  research: { select: 'Lab', noun: 'lab', slot: 'lab slot', potionName: 'research potion' },
  pet: { select: 'Pet', noun: 'pet', slot: 'Pet House', potionName: 'pet potion' },
};
const TYPES: PotionType[] = ['builder', 'research', 'pet'];

interface CardData {
  id: string;
  title: string;
  freeIn: number;
}

function cardsFor(workers: Worker[], busy: Worker[], plan: PotionPlan): CardData[] {
  const out: CardData[] = [];
  for (const w of workers) {
    if (w.state === 'idle') {
      out.push({ id: w.id, title: w.label, freeIn: 0 });
    } else if (w.state === 'busy') {
      const r = plan.workers[busy.findIndex((b) => b.id === w.id)];
      if (r) out.push({ id: w.id, title: w.label, freeIn: r.finishAfter });
    }
  }
  return out;
}

export function VillagePage() {
  const { active } = useVillages();
  const now = useNow();
  const snapshot = useMemo(() => tryParseVillage(active?.export ?? null), [active?.export]);
  const model = useMemo(() => buildVillageModel(snapshot, now), [snapshot, now]);

  const [type, setType] = useState<PotionType>('builder');
  // each type remembers its own target
  const [targets, setTargets] = useState<Record<PotionType, Target>>({
    builder: DEFAULT_TARGET,
    research: DEFAULT_TARGET,
    pet: DEFAULT_TARGET,
  });

  if (!active) return null;

  const ui = TYPE_UI[type];
  const meta = POTION_META[type];
  const target = targets[type];
  const patch = (p: Partial<Target>) => setTargets((t) => ({ ...t, [type]: { ...t[type], ...p } }));

  const targetMin: number | null = (() => {
    if (target.mode === 'hours') {
      const h = Number(target.hours);
      return target.hours.trim() !== '' && Number.isFinite(h) && h >= 0 ? h * 60 : null;
    }
    if (!target.dateTime) return null;
    const ms = new Date(target.dateTime).getTime();
    return Number.isFinite(ms) && ms >= now ? (ms - now) / 60_000 : null;
  })();

  const { busy, idle } = potionWorkers(model, type);
  const plan =
    targetMin === null
      ? null
      : planPotions(busy.map((w) => w.upgrade?.remainingMin ?? 0), idle, targetMin, POTION_MULT[type]);

  const pool: Worker[] =
    type === 'builder'
      ? [...model.builders, model.goblinBuilder]
      : type === 'research'
        ? [model.lab, model.goblinResearcher]
        : [model.pet];

  const owned = active.potions[type];
  const needed = plan?.potionsNeeded ?? null;
  const short = needed !== null ? Math.max(0, needed - owned) : 0;

  return (
    <div className="space-y-4">
      <Panel title={`🏘 ${active.name}`}>
        <p className="text-sm">
          Tag <b>{active.tag}</b>
          {snapshot && snapshot.exportedAtMs !== null && (
            <> · exported {formatMinutes((now - snapshot.exportedAtMs) / 60_000)} ago</>
          )}
        </p>
        <p className="mt-1 text-xs text-coc-parchment/70">
          Pasting this village's data again (the button above) updates it. Switch villages from the list above.
        </p>
      </Panel>

      {snapshot && (
        <>
          <VillageBoard model={model} now={now} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`🎯 When do you want the next ${ui.noun} free?`}>
              <div className="space-y-3">
                <label className="block">
                  <span className="label">Check for</span>
                  <select className="field" value={type} onChange={(e) => setType(e.target.value as PotionType)}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {POTION_META[t].icon} {TYPE_UI[t].select}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-2">
                  <button className={target.mode === 'hours' ? 'btn-gold' : 'btn'} onClick={() => patch({ mode: 'hours' })}>
                    In X hours
                  </button>
                  <button className={target.mode === 'time' ? 'btn-gold' : 'btn'} onClick={() => patch({ mode: 'time' })}>
                    At a time
                  </button>
                </div>

                {target.mode === 'hours' ? (
                  <label className="block">
                    <span className="label">Hours from now</span>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      step="any"
                      value={target.hours}
                      onChange={(e) => patch({ hours: e.target.value })}
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="label">Date & time</span>
                    <input
                      className="field"
                      type="datetime-local"
                      value={target.dateTime}
                      onChange={(e) => patch({ dateTime: e.target.value })}
                    />
                  </label>
                )}

                {plan ? (
                  <>
                    <div className="rounded-lg bg-black/30 p-3 text-center">
                      <p className="text-sm text-coc-parchment">
                        {meta.icon} {meta.label}s needed
                      </p>
                      <p className="stroke text-5xl text-coc-gold">{needed === null ? '—' : needed}</p>
                      <p className="text-sm">
                        You own <b>{owned}</b>
                        {short > 0 && <span className="text-coc-danger"> · short by {short}</span>}
                      </p>
                    </div>
                    <PotionVerdict plan={plan} potionName={ui.potionName} slot={ui.slot} owned={owned} now={now} />
                  </>
                ) : (
                  <p className="text-sm text-coc-danger">Enter a valid target (a time in the future).</p>
                )}

                <p className="text-xs text-coc-parchment/70">
                  Potions owned are saved per village in the Hammer Jam planner tab. Each option (builder / lab / pet)
                  keeps its own target.
                </p>
              </div>
            </Panel>

            <Panel title={`${meta.icon} ${meta.label}s`}>
              {plan ? (
                <div className="grid grid-cols-2 gap-3">
                  {cardsFor(pool, busy, plan).map((c) => (
                    <FreeCard key={c.id} title={c.title} freeInMin={c.freeIn} now={now} />
                  ))}
                </div>
              ) : (
                <p className="text-sm">Set a target time to see the result.</p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}