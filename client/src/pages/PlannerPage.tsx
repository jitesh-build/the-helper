import { useMemo } from 'react';
import { CalendarPanel } from '../components/CalendarPanel';
import { CatalogPanel } from '../components/CatalogPanel';
import { PlanList } from '../components/PlanList';
import { PlanSaveBar } from '../components/PlanSaveBar';
import { PlanSyncWarning } from '../components/PlanSyncWarning';
import { PotionsPanel } from '../components/PotionsPanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { VillageBoard } from '../components/VillageBoard';
import { useNow } from '../hooks/useNow';
import { useToast } from '../toast/ToastContext';
import type { GoldPass, PotionCounts, Upgrade } from '../types';
import { formatClock, formatStamp, makeId } from '../utils';
import { usePlan } from '../villages/PlanContext';
import { useVillages } from '../villages/VillageContext';
import { buildVillageModel } from '../village/model';
import { suggestPotions } from '../village/optimizer';
import { tryParseVillage } from '../village/parseVillage';
import { buildPlan } from '../village/planning';
import { POTION_META } from '../village/potions';
import type { PotionType } from '../village/potions';
import { eligibleUpgrades, idleTracks } from '../village/progress';

const NO_PERKS: GoldPass = { timeReduction: 0, costReduction: 0 };

export function PlannerPage() {
  const toast = useToast();
  const { active, updateSettings } = useVillages();
  const { queue, setQueue, blocks, setBlocks, useGoblins, setUseGoblins } = usePlan();
  const now = useNow();
  const snapshot = useMemo(() => tryParseVillage(active?.export ?? null), [active?.export]);
  const model = useMemo(() => buildVillageModel(snapshot, now), [snapshot, now]);
  const idle = useMemo(() => (snapshot ? idleTracks(snapshot, now) : []), [snapshot, now]);

  const goldPass = active?.goldPass ?? NO_PERKS;

  const plan = useMemo(
    () => buildPlan({ model, now, goldPass, blocks, useGoblins, queue, idleTracks: idle }),
    [model, now, goldPass, blocks, useGoblins, queue, idle],
  );
  const eligible = useMemo(() => eligibleUpgrades(plan), [plan]);

  if (!active) return null;

  const planned: PotionCounts = { builder: 0, research: 0, pet: 0 };
  for (const b of blocks) planned[b.type] += b.count;

  const add = (u: Upgrade) => {
    setQueue((q) => [
      ...q,
      {
        uid: makeId(),
        entityId: u.entityId,
        name: u.name,
        level: u.level,
        kind: u.kind,
        resource: u.resource,
        baseMinutes: u.baseMinutes,
        baseCost: u.baseCost,
      },
    ]);
    toast.success(`Added ${u.name} → Lv ${u.level} to your plan.`);
  };

  const remove = (uid: string) => setQueue((q) => q.filter((i) => i.uid !== uid));
  const move = (uid: string, dir: -1 | 1) =>
    setQueue((q) => {
      const i = q.findIndex((x) => x.uid === uid);
      const j = i + dir;
      const a = q[i];
      const b = q[j];
      if (!a || !b) return q;
      const copy = [...q];
      copy[i] = b;
      copy[j] = a;
      return copy;
    });

  const removeUnplaced = () => {
    const bad = new Set(plan.unplaced.map((u) => u.item.uid));
    setQueue((q) => q.filter((i) => !bad.has(i.uid)));
    toast.info(`Removed ${bad.size} upgrade${bad.size > 1 ? 's' : ''} that no longer fit.`);
  };

  const applyPotion = (type: PotionType, startMs: number, count: number) => {
    const label = POTION_META[type].label.toLowerCase();
    const left = active.potions[type] - planned[type];
    if (count > left) {
      toast.error(`You only have ${Math.max(0, left)} ${label}${left === 1 ? '' : 's'} left.`);
      return;
    }
    setBlocks((b) => [...b, { id: makeId(), type, startMs, count }]);
    toast.success(
      `Applied ${count} ${label}${count > 1 ? 's' : ''} from ${formatStamp(startMs)} until ${formatClock(startMs + count * 3_600_000)}. Press “Save plan” to keep it.`,
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((b) => b.filter((x) => x.id !== id));
    toast.info('Potions removed from the plan.');
  };

  const suggest = (type: PotionType) => {
    const result = suggestPotions(
      { model, now, goldPass, blocks, useGoblins, queue, idleTracks: idle },
      type,
      active.potions[type],
    );
    setBlocks((b) => [...b.filter((x) => x.type !== type), ...result.blocks]);
    toast[result.tone](result.message);
  };

  return (
    <div className="space-y-4">
      <PlanSyncWarning unplaced={plan.unplaced} onRemoveUnplaced={removeUnplaced} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel
          settings={{ goldPass: active.goldPass, potions: active.potions }}
          onChange={updateSettings}
          now={now}
        />
        <PotionsPanel
          owned={active.potions}
          blocks={blocks}
          windows={plan.windows}
          now={now}
          onRemove={removeBlock}
          onSuggest={suggest}
        />
      </div>

      <VillageBoard model={model} now={now} adjusted={plan.currentFreeIn} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <CatalogPanel
            hasVillage={snapshot !== null}
            now={now}
            goldPass={goldPass}
            available={eligible.available}
            recommended={eligible.recommended}
            onAdd={add}
          />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <CalendarPanel
            plan={plan}
            now={now}
            goldPass={goldPass}
            owned={active.potions}
            planned={planned}
            blocks={blocks}
            onApplyPotion={applyPotion}
            onRemoveBlock={removeBlock}
            saveBar={<PlanSaveBar />}
          />
          <PlanSaveBar />
          <PlanList
            plan={plan}
            now={now}
            useGoblins={useGoblins}
            onToggleGoblins={setUseGoblins}
            onRemove={remove}
            onMove={move}
            onClear={() => setQueue([])}
          />
        </div>
      </div>
    </div>
  );
}