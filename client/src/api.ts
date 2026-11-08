import type {
  AuthResponse,
  Group,
  ImportResponse,
  Kind,
  Profile,
  Resource,
  Upgrade,
  UserSettings,
  SavedPlan,
  SavedPlanData,
  Village,
  VillageList,
  VillageSummary,
} from './types';

const BASE: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
if (import.meta.env.PROD && !BASE) {
  console.error('VITE_API_URL is not set: API calls will go to this site instead of your backend.');
}

const TOKEN_KEY = 'coc_token';
const TIMEOUT_MS = 75_000;

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string | null): void => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

let unauthorizedHandler: (() => void) | null = null;
export const onUnauthorized = (fn: (() => void) | null): void => {
  unauthorizedHandler = fn;
};

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { ...init, headers, signal: controller.signal });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('The server took too long to respond. It may be waking up, so please try again in a minute.');
    }
    throw new Error('Cannot reach the server. Check your connection and try again.');
  } finally {
    window.clearTimeout(timer);
  }

  if (!res.ok) {
    const isAuthCall = path.startsWith('/auth/');
    if (res.status === 401 && token && !isAuthCall && unauthorizedHandler) unauthorizedHandler();
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Something went wrong');

export const register = (name: string, email: string, password: string): Promise<AuthResponse> =>
  request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });

export const login = (email: string, password: string): Promise<AuthResponse> =>
  request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const getMe = (): Promise<Profile> => request<Profile>('/me');

// ---- villages ----

export const listVillages = (): Promise<VillageList> => request<VillageList>('/villages');

export const getVillage = (id: string): Promise<Village> => request<Village>(`/villages/${id}`);

export const savePlan = (id: string, data: SavedPlanData): Promise<SavedPlan> =>
  request<SavedPlan>(`/villages/${id}/plan`, { method: 'PUT', body: JSON.stringify(data) });

/** Adds a village, or updates the one with the same tag. */
export const importVillage = (raw: string): Promise<ImportResponse> =>
  request<ImportResponse>('/villages/import', { method: 'POST', body: JSON.stringify({ export: raw }) });

export const renameVillage = (id: string, name: string): Promise<VillageSummary> =>
  request<VillageSummary>(`/villages/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });

export const saveVillageSettings = (id: string, settings: UserSettings): Promise<Village> =>
  request<Village>(`/villages/${id}/settings`, { method: 'PUT', body: JSON.stringify(settings) });

/** Fire-and-forget save for when the tab is closing (keepalive lets it finish after the page is gone). */
export function saveVillageSettingsOnExit(id: string, settings: UserSettings): void {
  const token = getToken();
  if (!token) return;
  void fetch(`${BASE}/api/villages/${id}/settings`, {
    method: 'PUT',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(settings),
  }).catch(() => undefined);
}

export const activateVillage = (id: string): Promise<{ activeVillageId: string }> =>
  request<{ activeVillageId: string }>(`/villages/${id}/activate`, { method: 'POST' });

export const deleteVillage = (id: string): Promise<{ activeVillageId: string | null }> =>
  request<{ activeVillageId: string | null }>(`/villages/${id}`, { method: 'DELETE' });

// ---- catalogue ----

export interface UpgradeFilters {
  q: string;
  kind: Kind | 'all';
  group: Group | 'all';
  resource: Resource | 'all';
}

export function searchUpgrades(
  f: UpgradeFilters,
  available: { entityId: number; level: number }[],
): Promise<Upgrade[]> {
  const body = {
    available,
    ...(f.q.trim() ? { q: f.q.trim() } : {}),
    ...(f.kind !== 'all' ? { kind: f.kind } : {}),
    ...(f.group !== 'all' ? { group: f.group } : {}),
    ...(f.resource !== 'all' ? { resource: f.resource } : {}),
  };
  return request<Upgrade[]>('/upgrades/search', { method: 'POST', body: JSON.stringify(body) });
}