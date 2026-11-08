// import type { PotionCounts } from '../types';
// import { toInt } from '../utils';
// import { POTION_META } from '../village/potions';
// import type { PotionType } from '../village/potions';
// import { Panel } from './Panel';

// const TYPES: PotionType[] = ['builder', 'research', 'pet'];

// interface Props {
//   owned: PotionCounts;
//   use: PotionCounts;
//   onChange: (use: PotionCounts) => void;
//   /** minimum potions so every queued upgrade of that type starts inside Hammer Jam (undefined = nothing queued) */
//   hints: Partial<Record<PotionType, number | null>>;
// }

// export function UsePotionsPanel({ owned, use, onChange, hints }: Props) {
//   const set = (t: PotionType, n: number) => onChange({ ...use, [t]: Math.min(n, owned[t]) });

//   return (
//     <Panel title="🧪 Use potions">
//       <p className="mb-3 text-xs text-coc-parchment/80">
//         Potions are drunk back-to-back starting now (1 hour each). They speed up current upgrades first and any
//         upgrade that starts inside the boosted hours.
//       </p>
//       <div className="space-y-3">
//         {TYPES.map((t) => {
//           const hint = hints[t];
//           return (
//             <div key={t} className="rounded-lg bg-black/25 p-3">
//               <div className="flex flex-wrap items-center justify-between gap-2">
//                 <span>
//                   {POTION_META[t].icon} {POTION_META[t].label}
//                   <span className="ml-2 text-xs text-coc-parchment/70">you own {owned[t]}</span>
//                 </span>
//                 <div className="flex items-center gap-2">
//                   <input
//                     type="number"
//                     min={0}
//                     max={owned[t]}
//                     className="field w-20"
//                     value={Math.min(use[t], owned[t])}
//                     onChange={(e) => set(t, toInt(e.target.value))}
//                   />
//                   <button className="btn-gold px-2 py-0.5 text-sm" onClick={() => set(t, owned[t])}>
//                     Max
//                   </button>
//                 </div>
//               </div>
//               {hint !== undefined && (
//                 <p className="mt-1 text-sm">
//                   {hint === null ? (
//                     <span className="text-coc-danger">Can't start everything inside Hammer Jam, even with many potions.</span>
//                   ) : hint === 0 ? (
//                     <span className="text-coc-good">Everything queued starts inside Hammer Jam without potions ✓</span>
//                   ) : (
//                     <>
//                       Need <b className="text-coc-gold">{hint}</b> to start everything queued inside Hammer Jam{' '}
//                       <button
//                         className="btn-green px-2 py-0.5 text-xs"
//                         disabled={hint > owned[t]}
//                         onClick={() => set(t, hint)}
//                       >
//                         {hint > owned[t] ? `short by ${hint - owned[t]}` : `Use ${hint}`}
//                       </button>
//                     </>
//                   )}
//                 </p>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </Panel>
//   );
// }