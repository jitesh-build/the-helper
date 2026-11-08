import { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { Panel } from './components/Panel';
import { VillageBar } from './components/VillageBar';
import gameMeta from './data/gameDataMeta.json';
import { AuthPage } from './pages/AuthPage';
import { PlannerPage } from './pages/PlannerPage';
import { VillagePage } from './pages/VillagePage';
import { VillageProvider, useVillages } from './villages/VillageContext';
import { PlanProvider } from './villages/PlanContext';

type Tab = 'village' | 'planner';

const fmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'unknown';

function Main() {
  const { user, logout } = useAuth();
  const { active, loading, error } = useVillages();
  const [tab, setTab] = useState<Tab>('village');

  if (!user) return null;

  return (
    <main className="mx-auto max-w-7xl p-3 sm:p-4 2xl:max-w-[1600px]">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <h1 className="stroke min-w-0 text-2xl text-coc-gold sm:text-4xl">⚒ Hammer Jam Planner</h1>
        <div className="flex items-center gap-3">
          <span className="stroke hidden sm:inline">Hi, {user.name}</span>
          <button className="btn-red text-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:flex sm:gap-3">
        <button className={tab === 'village' ? 'btn-gold' : 'btn'} onClick={() => setTab('village')}>
          🏘 My Village
        </button>
        <button className={tab === 'planner' ? 'btn-gold' : 'btn'} onClick={() => setTab('planner')}>
          ⚒ Hammer Jam Planner
        </button>
      </nav>

      {loading ? (
        <p className="stroke p-6 text-center text-xl">Loading your villages…</p>
      ) : (
        <>
          <VillageBar />
          {error && <p className="panel mb-4 text-coc-danger">{error}</p>}
          {!active ? (
            <Panel title="No village open">
              <p className="text-sm">Add a village above, or pick one from the list, to get started.</p>
            </Panel>
          ) : (
            // key = village id: each village gets its own working plan and fresh page state
            <PlanProvider key={active.id} village={active}>
              {tab === 'village' ? <VillagePage /> : <PlannerPage />}
            </PlanProvider>
          )}
        </>
      )}

      <footer className="stroke mt-8 text-center text-xs">
        Game data: Supercell game files via ClashKing · changed {fmt(gameMeta.sourceUpdatedAt)} · downloaded{' '}
        {fmt(gameMeta.fetchedAt)}
      </footer>
    </main>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="stroke p-8 text-center text-2xl">Loading…</p>;
  }
  if (!user) return <AuthPage />;

  return (
    <VillageProvider>
      <Main />
    </VillageProvider>
  );
}