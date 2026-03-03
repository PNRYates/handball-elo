import { useCallback, useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import NavBar from './components/ui/NavBar';
import CourtPage from './pages/CourtPage';
import LeaderboardPage from './pages/LeaderboardPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import {
  getCurrentSession,
  getCurrentUser,
  loginWithGoogle,
  logout,
  type SupabaseSession,
  type SupabaseUser,
} from './lib/supabaseRest';
import { useRemoteSync } from './lib/useRemoteSync';
import { useGameStore } from './store/gameStore';

function LoginView({ error }: { error: string | null }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h1 className="text-xl font-bold">Handball ELO</h1>
        <p className="text-sm text-gray-400 mt-2">Sign in with Google to load your ratings from the cloud.</p>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        <button
          type="button"
          onClick={loginWithGoogle}
          className="w-full mt-5 bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const theme = useGameStore((s) => s.theme);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  const bootAuth = useCallback(async () => {
    try {
      setAuthError(null);
      const nextSession = await getCurrentSession();
      if (!nextSession) {
        setSession(null);
        setUser(null);
        return;
      }

      const nextUser = await getCurrentUser(nextSession);
      if (!nextUser) {
        await logout(nextSession);
        setSession(null);
        setUser(null);
        return;
      }

      setSession(nextSession);
      setUser(nextUser);
    } catch (error) {
      setSession(null);
      setUser(null);
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootAuth();
  }, [bootAuth]);

  const syncStatus = useRemoteSync(user, session);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (authLoading) {
    return <LoginView error={null} />;
  }

  if (!user || !session) {
    return <LoginView error={authError} />;
  }

  const syncLabel =
    syncStatus === 'loading'
      ? 'Loading data...'
      : syncStatus === 'saving'
        ? 'Saving...'
        : syncStatus === 'error'
          ? 'Sync error'
          : 'Synced';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <NavBar
        userEmail={user.email ?? 'Signed in'}
        syncLabel={syncLabel}
        onLogout={async () => {
          await logout(session);
          setSession(null);
          setUser(null);
        }}
      />
      <main className="max-w-lg mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<CourtPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
