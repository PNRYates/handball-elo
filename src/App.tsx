import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/ui/NavBar';
import CourtPage from './pages/CourtPage';
import LeaderboardPage from './pages/LeaderboardPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import InstructionsPage from './pages/InstructionsPage';
import AnalysisPage from './pages/AnalysisPage';
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
import { buildSampleState } from './lib/sampleData';

const SAMPLE_MODE_KEY = 'handball-elo-sample-mode';

function LoginView({ error, onUseSample }: { error: string | null; onUseSample: () => void }) {
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
        <button
          type="button"
          onClick={onUseSample}
          className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium py-2.5 rounded-lg transition-colors border border-gray-700"
        >
          Explore sample data
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const theme = useGameStore((s) => s.theme);
  const resetAllData = useGameStore((s) => s.resetAllData);
  const hydrateFromRemote = useGameStore((s) => s.hydrateFromRemote);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [sampleMode, setSampleMode] = useState<boolean>(() => localStorage.getItem(SAMPLE_MODE_KEY) === 'true');

  const enterSampleMode = useCallback(async () => {
    if (session) {
      await logout(session);
    }
    localStorage.setItem(SAMPLE_MODE_KEY, 'true');
    setSession(null);
    setUser(null);
    setSampleMode(true);
    hydrateFromRemote(buildSampleState());
    setAuthLoading(false);
  }, [hydrateFromRemote, session]);

  const exitSampleMode = useCallback(() => {
    localStorage.removeItem(SAMPLE_MODE_KEY);
    setSampleMode(false);
    resetAllData();
    setSession(null);
    setUser(null);
    setAuthLoading(false);
  }, [resetAllData]);

  const bootAuth = useCallback(async () => {
    if (sampleMode) {
      setAuthError(null);
      hydrateFromRemote(buildSampleState());
      setAuthLoading(false);
      return;
    }
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
  }, [hydrateFromRemote, sampleMode]);

  useEffect(() => {
    void bootAuth();
  }, [bootAuth]);

  const syncStatus = useRemoteSync(user, session);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (authLoading && !sampleMode) {
    return <LoginView error={null} onUseSample={() => void enterSampleMode()} />;
  }

  if (!sampleMode && (!user || !session)) {
    return <LoginView error={authError} onUseSample={() => void enterSampleMode()} />;
  }

  const syncLabel =
    sampleMode
      ? 'Sample dataset'
      : syncStatus === 'loading'
      ? 'Loading data...'
      : syncStatus === 'saving'
        ? 'Saving...'
        : syncStatus === 'offline'
          ? 'Offline · changes saved locally'
          : syncStatus === 'error'
            ? 'Sync error · will retry'
            : 'Synced';
  const isAnalysisRoute = location.pathname === '/analysis';

  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <NavBar
        userEmail={sampleMode ? 'Sample mode' : user?.email ?? 'Signed in'}
        syncLabel={syncLabel}
        onLogout={async () => {
          if (sampleMode) {
            exitSampleMode();
            return;
          }
          await logout(session);
          setSession(null);
          setUser(null);
        }}
        logoutLabel={sampleMode ? 'Exit sample' : 'Sign out'}
      />
      {!sampleMode && syncStatus === 'offline' && (
        <div className="bg-amber-900 border-b border-amber-700 text-amber-200 text-xs text-center py-1.5 px-4">
          You are offline — changes are saved locally and will sync when reconnected.
        </div>
      )}
      <main className={`${isAnalysisRoute ? 'max-w-7xl' : 'max-w-xl'} w-full mx-auto px-4 py-6 flex-1`}>
        <Routes>
          <Route path="/" element={<CourtPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/settings" element={<SettingsPage onLoadSampleData={() => void enterSampleMode()} />} />
        </Routes>
      </main>
      <footer className="w-full px-4 pb-4 text-xs text-gray-500 text-center mt-auto">
        Version v{appVersion}
      </footer>
    </div>
  );
}
