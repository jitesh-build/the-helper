import type { Resource } from './types';

export function formatMinutes(total: number): string {
  const t = Math.round(total);
  if (t <= 0) return '0m';
  const d = Math.floor(t / 1440);
  const h = Math.floor((t % 1440) / 60);
  const m = t % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '0m';
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
export const formatNumber = (n: number): string => compact.format(n);

/** Local date/time for `minutesFromNow` after `nowMs`. */
export const formatDate = (nowMs: number, minutesFromNow: number): string =>
  new Date(nowMs + minutesFromNow * 60_000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatIst = (ms: number): string =>
  `${new Date(ms).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} IST`;

export const toInt = (v: string): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const RESOURCE_META: Record<Resource, { label: string; icon: string; className: string }> = {
  gold: { label: 'Gold', icon: '🪙', className: 'text-coc-gold' },
  elixir: { label: 'Elixir', icon: '💧', className: 'text-coc-elixir' },
  darkElixir: { label: 'Dark Elixir', icon: '⚫', className: 'text-coc-dark' },
};

export const makeId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const formatClock = (ms: number): string =>
  new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDay = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const formatStamp = (ms: number): string =>
  new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** value for <input type="datetime-local"> in the user's own time zone */
export const toLocalInput = (ms: number): string =>
  new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** localStorage prefix for one village's plan (queue, potions, goblin toggle) */
// export const planStorageKey = (userId: string, villageId: string): string => `coc-plan-v2-${userId}-${villageId}`;

/** value for <input type="time"> (24-hour HH:MM, local) */
export const toTimeInput = (ms: number): string =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });