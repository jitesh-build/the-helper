import type { Unplaced } from '../village/planning';
import { usePlan } from '../villages/PlanContext';

const MAX_LINES = 6;

function Lines({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-coc-parchment">{title}</p>
      <ul className="list-inside list-disc">
        {lines.slice(0, MAX_LINES).map((l, i) => (
          <li key={`${l}-${i}`} className="break-words">
            {l}
          </li>
        ))}
        {lines.length > MAX_LINES && <li>…and {lines.length - MAX_LINES} more</li>}
      </ul>
    </div>
  );
}

interface Props {
  /** planned upgrades that can no longer be placed with the current village data */
  unplaced: Unplaced[];
  onRemoveUnplaced: () => void;
}

/** Warns when newer village data no longer matches what the plan was made against. */
export function PlanSyncWarning({ unplaced, onRemoveUnplaced }: Props) {
  const { mismatch, drift, acceptCurrentData } = usePlan();
  if (!mismatch) return null;

  return (
    <div role="alert" className="rounded-xl border-2 border-amber-400 bg-amber-900/40 p-3 text-sm">
      <p className="text-base">⚠ Your village data changed since this plan was made</p>
      <p className="mt-1">
        You pasted newer village data after planning, so some dates in this plan may be wrong. Check what changed, then
        save the plan again.
      </p>

      <Lines title="No longer running (finished or changed):" lines={drift.noLongerRunning} />
      <Lines title="Running now:" lines={drift.nowRunning} />
      {drift.builderCountChanged && <p className="mt-2">The number of builders changed.</p>}
      <Lines
        title="Planned upgrades that no longer fit:"
        lines={unplaced.map((u) => `${u.item.name} → Lv ${u.item.level} — ${u.reason}`)}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {unplaced.length > 0 && (
          <button className="btn-red" onClick={onRemoveUnplaced}>
            Remove {unplaced.length} upgrade{unplaced.length > 1 ? 's' : ''} that no longer fit
          </button>
        )}
        <button className="btn-gold" onClick={acceptCurrentData}>
          The plan is still right — use the new data
        </button>
      </div>
    </div>
  );
}