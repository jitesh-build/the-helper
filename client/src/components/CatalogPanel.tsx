import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage, searchUpgrades } from '../api';
import type { GoldPass, Group, Kind, Resource, Upgrade } from '../types';
import { RESOURCE_META, formatDate, formatMinutes, formatNumber } from '../utils';
import { effectiveUpgrade, isJamExempt } from '../village/planning';
import { upgradeKey } from '../village/progress';
import type { AvailablePair, Recommended } from '../village/progress';
import { Panel } from './Panel';

const KINDS: { value: Kind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'builder', label: '🔨 Builder' },
  { value: 'lab', label: '📘 Lab' },
  { value: 'pet', label: '🐾 Pet' },
];

const GROUPS: Record<Kind, { value: Group; label: string }[]> = {
  builder: [
    { value: 'army', label: 'Army' },
    { value: 'defense', label: 'Defense' },
    { value: 'trap', label: 'Trap' },
    { value: 'hero', label: 'Hero' },
    { value: 'guardian', label: 'Guardian' },
    { value: 'resource', label: 'Resource' },
    { value: 'other', label: 'Other' },
  ],
  lab: [
    { value: 'troop', label: 'Troop' },
    { value: 'spell', label: 'Spell' },
    { value: 'siege', label: 'Siege' },
  ],
  pet: [],
};

const RESOURCES: { value: Resource | 'all'; label: string }[] = [
  { value: 'all', label: 'Any' },
  { value: 'gold', label: '🪙 Gold' },
  { value: 'elixir', label: '💧 Elixir' },
  { value: 'darkElixir', label: '⚫ Dark Elixir' },
];

const KIND_ICON: Record<Kind, string> = { builder: '🔨', lab: '📘', pet: '🐾' };
const NO_FILTERS = { q: '', kind: 'all', group: 'all', resource: 'all' } as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${active ? 'bg-coc-gold text-coc-woodDark' : 'bg-black/25 text-coc-parchment'}`}
    >
      {children}
    </button>
  );
}

interface RowProps {
  u: Upgrade;
  /** when this upgrade would start (ms), decides whether Hammer Jam applies */
  startMs: number;
  goldPass: GoldPass;
  extra?: ReactNode;
  onAdd: (u: Upgrade) => void;
}

function UpgradeRow({ u, startMs, goldPass, extra, onAdd }: RowProps) {
  const meta = RESOURCE_META[u.resource];
  const exempt = isJamExempt(u.entityId);
  const eff = effectiveUpgrade(u.baseMinutes, u.baseCost, startMs, goldPass, exempt);
  const timeChanged = eff.minutes !== u.baseMinutes;
  const costChanged = eff.cost !== u.baseCost;
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-black/25 p-2">
      <div className="min-w-0">
        <p className="break-words">
          {u.name} <span className="text-coc-gold">→ Lv {u.level}</span>
          {extra}
        </p>
        <p className="text-xs text-coc-parchment/80">
          {eff.discounted && <span className="mr-1 text-coc-good">50% off ·</span>}
          {exempt && <span className="mr-1 text-coc-gold">crafted defence, no Hammer Jam ·</span>}
          {timeChanged && <span className="mr-1 line-through opacity-60">{formatMinutes(u.baseMinutes)}</span>}
          {formatMinutes(eff.minutes)} ·{' '}
          <span className={meta.className}>
            {meta.icon}{' '}
            {costChanged && <span className="mr-1 line-through opacity-60">{formatNumber(u.baseCost)}</span>}
            {formatNumber(eff.cost)}
          </span>
        </p>
      </div>
      <button className="btn-green shrink-0 text-sm" onClick={() => onAdd(u)}>
        Add
      </button>
    </li>
  );
}

interface Props {
  hasVillage: boolean;
  now: number;
  goldPass: GoldPass;
  available: AvailablePair[];
  recommended: Recommended[];
  onAdd: (u: Upgrade) => void;
}

export function CatalogPanel({ hasVillage, now, goldPass, available, recommended, onAdd }: Props) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [group, setGroup] = useState<Group | 'all'>('all');
  const [resource, setResource] = useState<Resource | 'all'>('all');
  const [items, setItems] = useState<Upgrade[]>([]);
  const [recDocs, setRecDocs] = useState<Upgrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recKeys = useMemo(() => new Set(recommended.map((r) => upgradeKey(r.entityId, r.level))), [recommended]);
  const recKey = useMemo(() => [...recKeys].join(','), [recKeys]);
  const mainPairs = useMemo(
    () => available.filter((a) => !recKeys.has(upgradeKey(a.entityId, a.level))),
    [available, recKeys],
  );
  const mainKey = useMemo(() => mainPairs.map((a) => upgradeKey(a.entityId, a.level)).join(','), [mainPairs]);
  const countByKey = useMemo(() => new Map(available.map((a) => [upgradeKey(a.entityId, a.level), a.count])), [available]);
  const startByKey = useMemo(
    () => new Map(available.map((a) => [upgradeKey(a.entityId, a.level), a.startMin])),
    [available],
  );

  // refetch only when the set of offered upgrades changes, not on every clock tick
  const mainRef = useRef(mainPairs);
  mainRef.current = mainPairs;
  const recRef = useRef(recommended);
  recRef.current = recommended;

  useEffect(() => {
    if (!hasVillage) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      setLoading(true);
      const pairs = mainRef.current.map((a) => ({ entityId: a.entityId, level: a.level }));
      searchUpgrades({ q, kind, group, resource }, pairs)
        .then((data) => {
          if (cancelled) return;
          setItems(data);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(errorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [q, kind, group, resource, mainKey, hasVillage]);

  useEffect(() => {
    if (!hasVillage || recRef.current.length === 0) {
      setRecDocs([]);
      return;
    }
    let cancelled = false;
    const pairs = recRef.current.map((r) => ({ entityId: r.entityId, level: r.level }));
    searchUpgrades(NO_FILTERS, pairs)
      .then((data) => {
        if (!cancelled) setRecDocs(data);
      })
      .catch(() => {
        if (!cancelled) setRecDocs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [recKey, hasVillage]);

  const pickKind = (k: Kind | 'all') => {
    setKind(k);
    setGroup('all');
  };
  const groups = kind === 'all' ? [] : GROUPS[kind];

  return (
    <Panel title="📜 Upgrade Catalog">
      {!hasVillage ? (
        <p className="text-sm">Paste your village data first. The catalog then shows what you can plan next.</p>
      ) : (
        <>
          {recommended.length > 0 && recDocs.length > 0 && (
            <div className="mb-3 rounded-xl border-2 border-coc-gold bg-yellow-900/30 p-2">
              <p className="mb-2 text-sm text-coc-gold">⭐ Recommended — continues what frees up next</p>
              <ul className="space-y-2">
                {recommended.map((r) => {
                  const doc = recDocs.find((d) => d.entityId === r.entityId && d.level === r.level);
                  if (!doc) return null;
                  return (
                    <div key={`${r.kind}-${r.slot}`}>
                      <p className="mb-1 text-xs text-coc-parchment">
                        {KIND_ICON[r.kind]} {r.slot} frees {r.freeAtMin <= 0 ? 'now' : formatDate(now, r.freeAtMin)}
                      </p>
                      <UpgradeRow u={doc} startMs={now + r.freeAtMin * 60_000} goldPass={goldPass} onAdd={onAdd} />
                    </div>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="mb-2 text-xs text-coc-parchment/80">
            An upgrade appears once the previous level of that same thing has finished by the time the next worker
            frees up. Times and costs already include Hammer Jam (50%, only if the upgrade would start inside the
            event) and your Gold Pass perks.
          </p>

          <div className="mb-2 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Chip key={k.value} active={kind === k.value} onClick={() => pickKind(k.value)}>
                {k.label}
              </Chip>
            ))}
          </div>

          {groups.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              <Chip active={group === 'all'} onClick={() => setGroup('all')}>
                All types
              </Chip>
              {groups.map((g) => (
                <Chip key={g.value} active={group === g.value} onClick={() => setGroup(g.value)}>
                  {g.label}
                </Chip>
              ))}
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-2">
            {RESOURCES.map((r) => (
              <Chip key={r.value} active={resource === r.value} onClick={() => setResource(r.value)}>
                {r.label}
              </Chip>
            ))}
          </div>

          <input className="field mb-3" placeholder="Search by name…" value={q} onChange={(e) => setQ(e.target.value)} />

          {error && <p className="mb-2 text-sm text-coc-danger">{error}</p>}
          {loading && <p className="mb-2 text-sm">Loading…</p>}

          <ul className="max-h-[60dvh] space-y-2 overflow-y-auto pr-1 lg:max-h-[28rem]">
            {items.map((u) => {
              const k = upgradeKey(u.entityId, u.level);
              const count = countByKey.get(k) ?? 1;
              return (
                <UpgradeRow
                  key={u._id}
                  u={u}
                  startMs={now + (startByKey.get(k) ?? 0) * 60_000}
                  goldPass={goldPass}
                  onAdd={onAdd}
                  extra={count > 1 ? <span className="ml-2 text-xs text-coc-parchment">×{count} available</span> : null}
                />
              );
            })}
            {!loading && items.length === 0 && <li className="text-sm">Nothing matches these filters right now.</li>}
            {items.length >= 300 && <li className="text-xs opacity-70">Showing the first 300 — narrow the filters.</li>}
          </ul>
        </>
      )}
    </Panel>
  );
}