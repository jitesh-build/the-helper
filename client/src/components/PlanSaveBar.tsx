import { formatStamp } from '../utils';
import { usePlan } from '../villages/PlanContext';

/** Save / revert the plan. Shown in the day details and above the plan list. */
export function PlanSaveBar() {
  const { saved, dirty, saving, save, revert } = usePlan();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/25 p-2 text-sm">
      <span className="min-w-0 break-words">
        {dirty ? (
          <b className="text-coc-gold">● Unsaved changes</b>
        ) : saved ? (
          <span className="text-coc-good">✔ Saved {formatStamp(Date.parse(saved.savedAt))}</span>
        ) : (
          <span className="opacity-70">Nothing saved yet</span>
        )}
      </span>
      <span className="flex gap-2">
        <button className="btn px-2 py-0.5" disabled={!dirty || saving} onClick={revert}>
          ↩ {saved ? 'Revert' : 'Clear'}
        </button>
        <button className="btn-green px-2 py-0.5" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : '💾 Save plan'}
        </button>
      </span>
    </div>
  );
}