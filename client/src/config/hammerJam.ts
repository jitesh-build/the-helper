// Hammer Jam window (hard-coded). Both times are 1:30 PM IST.
// TESTING: the start is 31 Oct. Before deploying change START to '2026-11-01T13:30:00+05:30'.
export const HAMMER_JAM_START_MS = new Date('2026-11-01T13:30:00+05:30').getTime();
export const HAMMER_JAM_END_MS = new Date('2026-11-16T13:30:00+05:30').getTime();

/** Upgrades that START inside this window get 50% time and cost. */
export const isHammerJamAt = (ms: number): boolean => ms >= HAMMER_JAM_START_MS && ms < HAMMER_JAM_END_MS;