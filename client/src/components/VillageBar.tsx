import { useState } from 'react';
import { errorMessage } from '../api';
import { useNow } from '../hooks/useNow';
import { useToast } from '../toast/ToastContext';
import { formatMinutes } from '../utils';
import { useVillages } from '../villages/VillageContext';
import { PasteVillageButton } from './PasteVillageButton';

export function VillageBar() {
  const toast = useToast();
  const { villages, active, switchVillage, importVillage, renameVillage, deleteVillage } = useVillages();
  const now = useNow();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  /** runs an action, turning a failure into an error toast */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startRename = (name: string) => {
    setDraft(name);
    setEditing(true);
  };

  /** same tag as a saved village -> that village is updated; a new tag -> a new village is created */
  const onPasted = async (raw: string): Promise<string> => {
    const res = await importVillage(raw);
    if (res.created) {
      startRename(res.village.name);
      return `New village ${res.village.tag} added — give it a name below.`;
    }
    setEditing(false);
    return `Updated "${res.village.name}" (${res.village.tag}).`;
  };

  const saveName = () => {
    const name = draft.trim();
    if (!active || !name) return;
    void run(async () => {
      await renameVillage(active.id, name);
      setEditing(false);
      toast.success(`Village renamed to "${name}".`);
    });
  };

  const remove = () => {
    if (!active) return;
    const ok = window.confirm(
      `Delete "${active.name}" (${active.tag})? Its saved export, Gold Pass perks, potions and plan are removed.`,
    );
    if (!ok) return;
    const { id, name } = active;
    void run(async () => {
      await deleteVillage(id);
      setEditing(false);
      toast.success(`Deleted "${name}".`);
    });
  };

  const switchTo = (id: string) => {
    const target = villages.find((v) => v.id === id);
    void run(async () => {
      await switchVillage(id);
      if (target) toast.info(`Switched to "${target.name}".`);
    });
  };

  if (villages.length === 0) {
    return (
      <section className="panel mb-4">
        <h2 className="panel-title mb-2">🏘 Add your first village</h2>
        <p className="mb-3 text-sm">
          In the game, copy your village data, then add it here. Every Clash of Clans account is saved as its own
          village, matched by its tag — pasting the same village again just updates it.
        </p>
        <PasteVillageButton onText={onPasted} label="📋 Add village" />
      </section>
    );
  }

  return (
    <section className="panel mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="block min-w-0 flex-1">
          <span className="label">🏘 Village</span>
          <select className="field" value={active?.id ?? ''} disabled={busy} onChange={(e) => switchTo(e.target.value)}>
            {!active && (
              <option value="" disabled>
                Choose a village…
              </option>
            )}
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.tag})
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          <button className="btn-gold" disabled={!active || busy} onClick={() => active && startRename(active.name)}>
            ✎ Rename
          </button>
          <button className="btn-red" disabled={!active || busy} onClick={remove}>
            🗑 Delete
          </button>
        </div>

        <PasteVillageButton onText={onPasted} label="📋 Add / update village" />
      </div>

      {editing && active && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="field"
            value={draft}
            maxLength={40}
            placeholder="Village name"
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button className="btn-green" disabled={busy || !draft.trim()} onClick={saveName}>
            Save name
          </button>
          <button className="btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      )}

      {active && (
        <p className="text-sm">
          Tag <b>{active.tag}</b>
          {active.exportedAt !== null && <> · data from {formatMinutes((now - active.exportedAt) / 60_000)} ago</>}
        </p>
      )}
    </section>
  );
}