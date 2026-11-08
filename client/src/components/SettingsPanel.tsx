import { HAMMER_JAM_END_MS, HAMMER_JAM_START_MS } from '../config/hammerJam';
import type { PotionCounts, Reduction, UserSettings } from '../types';
import { formatIst, formatMinutes, toInt } from '../utils';
import { POTION_META } from '../village/potions';
import type { PotionType } from '../village/potions';
import { Panel } from './Panel';

const REDUCTIONS: Reduction[] = [0, 10, 15, 20];
const asReduction = (v: string): Reduction => REDUCTIONS.find((r) => r === Number(v)) ?? 0;
const POTION_TYPES: PotionType[] = ['builder', 'research', 'pet'];

interface Props {
  settings: UserSettings;
  onChange: (s: UserSettings) => void;
  now: number;
}

export function SettingsPanel({ settings, onChange, now }: Props) {
  const active = now >= HAMMER_JAM_START_MS && now < HAMMER_JAM_END_MS;
  const countdown =
    now < HAMMER_JAM_START_MS
      ? `Starts in ${formatMinutes((HAMMER_JAM_START_MS - now) / 60_000)}`
      : now < HAMMER_JAM_END_MS
        ? `Ends in ${formatMinutes((HAMMER_JAM_END_MS - now) / 60_000)}`
        : 'Event is over';

  const setPotion = (key: keyof PotionCounts, value: string) =>
    onChange({ ...settings, potions: { ...settings.potions, [key]: toInt(value) } });

  return (
    <Panel title="⚒ Hammer Jam & Boost">
      <div className="space-y-4">
        <div className="rounded-lg bg-black/25 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Hammer Jam active (50% time & cost)</span>
            <span
              className={`rounded-full px-3 py-0.5 text-sm ${active ? 'bg-coc-good text-coc-woodDark' : 'bg-black/40'}`}
            >
              {active ? 'ACTIVE' : 'NOT ACTIVE'}
            </span>
          </div>
          <p className="mt-1 text-sm">
            Start: <b>{formatIst(HAMMER_JAM_START_MS)}</b>
          </p>
          <p className="text-sm">
            End: <b>{formatIst(HAMMER_JAM_END_MS)}</b>
          </p>
          <p className="text-sm text-coc-gold">{countdown}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Gold Pass time −%</span>
            <select
              className="field"
              value={settings.goldPass.timeReduction}
              onChange={(e) =>
                onChange({ ...settings, goldPass: { ...settings.goldPass, timeReduction: asReduction(e.target.value) } })
              }
            >
              {REDUCTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Gold Pass cost −%</span>
            <select
              className="field"
              value={settings.goldPass.costReduction}
              onChange={(e) =>
                onChange({ ...settings, goldPass: { ...settings.goldPass, costReduction: asReduction(e.target.value) } })
              }
            >
              {REDUCTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <p className="label">Potions you own (saved to your account)</p>
          <div className="grid grid-cols-3 gap-3">
            {POTION_TYPES.map((t) => (
              <label key={t} className="block">
                <span className="label">
                  {POTION_META[t].icon} {POTION_META[t].label.replace(' potion', '')}
                </span>
                <input
                  type="number"
                  min={0}
                  className="field"
                  value={settings.potions[t]}
                  onChange={(e) => setPotion(t, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}