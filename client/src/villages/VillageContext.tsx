import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as api from '../api';
import { useToast } from '../toast/ToastContext';
import type { ImportResponse, SavedPlanData, UserSettings, Village, VillageSummary } from '../types';

interface VillageState {
  /** all of the user's villages (without export data) */
  villages: VillageSummary[];
  /** the village that is open, with its export, Gold Pass perks, potions and saved plan */
  active: Village | null;
  loading: boolean;
  error: string | null;
  /** adds a village, or updates the one that has the same tag; the result becomes the open village */
  importVillage: (raw: string) => Promise<ImportResponse>;
  switchVillage: (id: string) => Promise<void>;
  renameVillage: (id: string, name: string) => Promise<void>;
  deleteVillage: (id: string) => Promise<void>;
  /** Gold Pass perks + potion stock of the open village (saved shortly after the last change) */
  updateSettings: (settings: UserSettings) => void;
  /** saves the Hammer Jam plan of the open village */
  savePlan: (data: SavedPlanData) => Promise<void>;
}

const VillageContext = createContext<VillageState | null>(null);

const summaryOf = (v: Village): VillageSummary => ({
  id: v.id,
  tag: v.tag,
  name: v.name,
  exportedAt: v.exportedAt,
  updatedAt: v.updatedAt,
});

export function VillageProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [villages, setVillages] = useState<VillageSummary[]>([]);
  const [active, setActive] = useState<Village | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeIdRef = useRef<string | null>(null);
  const pending = useRef<{ id: string; settings: UserSettings } | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active?.id]);

  /** sends any unsaved Gold Pass / potion change right away (used before switching villages) */
  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    try {
      await api.saveVillageSettings(p.id, p.settings);
    } catch (e: unknown) {
      console.error('Saving settings failed', e);
      // keep it for the next attempt, unless a newer change has already replaced it
      if (!pending.current) pending.current = p;
      toast.error(`Couldn't save your Gold Pass perks / potions: ${api.errorMessage(e)}`);
    }
  }, [toast]);

  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  // tab closing or going to the background: send pending changes with a keepalive request
  useEffect(() => {
    const sendNow = () => {
      const p = pending.current;
      if (!p) return;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      pending.current = null;
      api.saveVillageSettingsOnExit(p.id, p.settings);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendNow();
    };
    window.addEventListener('pagehide', sendNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', sendNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.listVillages();
        if (cancelled) return;
        setVillages(res.villages);
        if (res.activeVillageId) {
          const v = await api.getVillage(res.activeVillageId);
          if (!cancelled) setActive(v);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message = api.errorMessage(e);
          setError(message);
          toast.error(`Couldn't load your villages: ${message}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const importVillage = useCallback(
    async (raw: string) => {
      await flush();
      const res = await api.importVillage(raw);
      setVillages((list) =>
        res.created
          ? [...list, summaryOf(res.village)]
          : list.map((v) => (v.id === res.village.id ? summaryOf(res.village) : v)),
      );
      setActive(res.village);
      setError(null);
      return res;
    },
    [flush],
  );

  const switchVillage = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return;
      await flush();
      const village = await api.getVillage(id);
      await api.activateVillage(id);
      setActive(village);
      setError(null);
    },
    [flush],
  );

  const renameVillage = useCallback(async (id: string, name: string) => {
    const updated = await api.renameVillage(id, name);
    setVillages((list) => list.map((v) => (v.id === id ? updated : v)));
    setActive((a) => (a && a.id === id ? { ...a, name: updated.name } : a));
  }, []);

  const deleteVillage = useCallback(
    async (id: string) => {
      await flush();
      const res = await api.deleteVillage(id);
      setVillages((list) => list.filter((v) => v.id !== id));
      if (activeIdRef.current === id) {
        setActive(res.activeVillageId ? await api.getVillage(res.activeVillageId) : null);
      }
    },
    [flush],
  );

  const updateSettings = useCallback(
    (settings: UserSettings) => {
      setActive((a) => (a ? { ...a, goldPass: settings.goldPass, potions: settings.potions } : a));
      const id = activeIdRef.current;
      if (!id) return;
      pending.current = { id, settings };
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flush();
      }, 500);
    },
    [flush],
  );

  const savePlan = useCallback(async (data: SavedPlanData) => {
    const id = activeIdRef.current;
    if (!id) throw new Error('No village is open.');
    const plan = await api.savePlan(id, data);
    setActive((a) => (a && a.id === id ? { ...a, plan } : a));
  }, []);

  const value = useMemo<VillageState>(
    () => ({
      villages,
      active,
      loading,
      error,
      importVillage,
      switchVillage,
      renameVillage,
      deleteVillage,
      updateSettings,
      savePlan,
    }),
    [villages, active, loading, error, importVillage, switchVillage, renameVillage, deleteVillage, updateSettings, savePlan],
  );

  return <VillageContext.Provider value={value}>{children}</VillageContext.Provider>;
}

export function useVillages(): VillageState {
  const ctx = useContext(VillageContext);
  if (!ctx) throw new Error('useVillages must be used inside <VillageProvider>');
  return ctx;
}