import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { errorMessage } from '../api';
import { useToast } from '../toast/ToastContext';
import type { PlanBasis, SavedPlan, Village } from '../types';
import { tryParseVillage } from '../village/parseVillage';
import { basisOf, driftOf, stable } from '../village/planSync';
import type { Drift } from '../village/planSync';
import type { PotionBlock, QueueItem } from '../village/planning';
import { useVillages } from './VillageContext';

interface PlanState {
  queue: QueueItem[];
  setQueue: Dispatch<SetStateAction<QueueItem[]>>;
  blocks: PotionBlock[];
  setBlocks: Dispatch<SetStateAction<PotionBlock[]>>;
  useGoblins: boolean;
  setUseGoblins: Dispatch<SetStateAction<boolean>>;
  /** the plan saved on the server for this village (null = never saved) */
  saved: SavedPlan | null;
  /** the working plan differs from the saved one */
  dirty: boolean;
  saving: boolean;
  /** the village data changed since this plan was made */
  mismatch: boolean;
  drift: Drift;
  save: () => Promise<void>;
  /** drop unsaved changes and go back to the saved plan */
  revert: () => void;
  /** "the plan is still right": treat the current village data as the new basis */
  acceptCurrentData: () => void;
}

const PlanContext = createContext<PlanState | null>(null);

/**
 * The working copy of one village's plan. It lives above the tabs, so switching between "My Village" and the
 * planner keeps your edits. Edits are only kept for good once you press "Save plan".
 */
export function PlanProvider({ village, children }: { village: Village; children: ReactNode }) {
  const { savePlan } = useVillages();
  const toast = useToast();
  const saved = village.plan;

  const snapshot = useMemo(() => tryParseVillage(village.export), [village.export]);
  const current = useMemo(() => basisOf(snapshot), [snapshot]);

  const [queue, setQueue] = useState<QueueItem[]>(() => saved?.queue ?? []);
  const [blocks, setBlocks] = useState<PotionBlock[]>(() => saved?.blocks ?? []);
  const [useGoblins, setUseGoblins] = useState<boolean>(() => saved?.useGoblins ?? false);
  const [basedOn, setBasedOn] = useState<PlanBasis>(() => saved?.basedOn ?? current);
  const [saving, setSaving] = useState(false);

  const hasContent = queue.length > 0 || blocks.length > 0;

  // an empty, never-saved plan has nothing to disagree with, so it simply follows the latest data
  useEffect(() => {
    if (saved || hasContent) return;
    setBasedOn((prev) => (stable(prev) === stable(current) ? prev : current));
  }, [saved, hasContent, current]);

  const drift = useMemo(() => driftOf(basedOn, current), [basedOn, current]);
  const mismatch = hasContent && drift.changed;

  const dirty = useMemo(() => {
    if (!saved) return hasContent || useGoblins;
    return (
      stable({ queue, blocks, useGoblins, basedOn }) !==
      stable({ queue: saved.queue, blocks: saved.blocks, useGoblins: saved.useGoblins, basedOn: saved.basedOn })
    );
  }, [saved, hasContent, queue, blocks, useGoblins, basedOn]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await savePlan({ queue, blocks, useGoblins, basedOn });
      if (mismatch) {
        toast.warning('Plan saved, but your village data changed since you made it — please review it.');
      } else {
        toast.success('Plan saved ✔');
      }
    } catch (e: unknown) {
      toast.error(`Couldn't save the plan: ${errorMessage(e)}`);
    } finally {
      setSaving(false);
    }
  }, [savePlan, queue, blocks, useGoblins, basedOn, mismatch, toast]);

  const revert = useCallback(() => {
    setQueue(saved?.queue ?? []);
    setBlocks(saved?.blocks ?? []);
    setUseGoblins(saved?.useGoblins ?? false);
    setBasedOn(saved?.basedOn ?? current);
    toast.info(saved ? 'Went back to your saved plan.' : 'Plan cleared.');
  }, [saved, current, toast]);

  const acceptCurrentData = useCallback(() => {
    setBasedOn(current);
    toast.success('The plan now uses your latest village data. Save the plan to keep this.');
  }, [current, toast]);

  // warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const value = useMemo<PlanState>(
    () => ({
      queue,
      setQueue,
      blocks,
      setBlocks,
      useGoblins,
      setUseGoblins,
      saved,
      dirty,
      saving,
      mismatch,
      drift,
      save,
      revert,
      acceptCurrentData,
    }),
    [queue, blocks, useGoblins, saved, dirty, saving, mismatch, drift, save, revert, acceptCurrentData],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanState {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}