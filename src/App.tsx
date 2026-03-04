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
  listWorkspaces,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  type SupabaseSession,
  type SupabaseUser,
} from './lib/supabaseRest';
import { useRemoteSync } from './lib/useRemoteSync';
import { useGameStore } from './store/gameStore';
import { buildSampleState } from './lib/sampleData';
import type { Workspace } from './types';

const SAMPLE_MODE_KEY = 'handball-elo-sample-mode';
const WORKSPACE_ID_KEY = 'handball-elo-workspace-id';
const DEFAULT_WORKSPACE_ID = 'default';
const DEFAULT_WORKSPACE_NAME = 'Default';

function generateWorkspaceId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

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
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    () => localStorage.getItem(WORKSPACE_ID_KEY) ?? DEFAULT_WORKSPACE_ID
  );
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  const activeWorkspaceName =
    workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? DEFAULT_WORKSPACE_NAME;

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

      // Load the workspaces list; seed a default entry if none exist yet.
      try {
        const remote = await listWorkspaces(nextUser.id, nextSession);
        if (remote.length > 0) {
          setWorkspaces(remote);
          // Validate stored workspace still exists; fall back to first available.
          const storedId = localStorage.getItem(WORKSPACE_ID_KEY) ?? DEFAULT_WORKSPACE_ID;
          const valid = remote.find((w) => w.id === storedId);
          const resolved = valid ? storedId : remote[0].id;
          setActiveWorkspaceId(resolved);
          localStorage.setItem(WORKSPACE_ID_KEY, resolved);
        } else {
          // No workspaces yet (brand new user) — use the default placeholder.
          setWorkspaces([
            { id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME, updatedAt: new Date().toISOString() },
          ]);
          setActiveWorkspaceId(DEFAULT_WORKSPACE_ID);
          localStorage.setItem(WORKSPACE_ID_KEY, DEFAULT_WORKSPACE_ID);
        }
      } catch {
        // Non-fatal: workspace list fetch failed; continue with defaults.
        setWorkspaces([
          { id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME, updatedAt: new Date().toISOString() },
        ]);
      }
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

  const handleSwitchWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    localStorage.setItem(WORKSPACE_ID_KEY, id);
  }, []);

  const handleCreateWorkspace = useCallback(
    async (name: string) => {
      if (!user || !session) return;
      const id = generateWorkspaceId();
      const now = new Date().toISOString();
      const initial = useGameStore.getState();
      try {
        await createWorkspace(user.id, id, name, {
          players: {},
          court: ['', '', '', ''],
          turns: [],
          turnNumber: 0,
          gameInProgress: false,
          gameStartedAt: null,
          gameHistory: [],
          _lastSnapshot: null,
          isInitialized: false,
          theme: initial.theme,
          requireKiller: initial.requireKiller,
          showReserveButtons: initial.showReserveButtons,
          undoStack: [],
          redoStack: [],
          recentEntrants: [],
          hiddenPlayerIds: [],
        }, session);
        const newWorkspace: Workspace = { id, name, updatedAt: now };
        setWorkspaces((prev) => [...prev, newWorkspace]);
        handleSwitchWorkspace(id);
      } catch {
        // Silently ignore — user can retry.
      }
    },
    [user, session, handleSwitchWorkspace]
  );

  const handleDeleteWorkspace = useCallback(
    async (id: string) => {
      if (!user || !session) return;
      if (workspaces.length <= 1) return;
      try {
        await deleteWorkspace(user.id, id, session);
        const remaining = workspaces.filter((w) => w.id !== id);
        setWorkspaces(remaining);
        if (activeWorkspaceId === id) {
          handleSwitchWorkspace(remaining[0].id);
        }
      } catch {
        // Silently ignore.
      }
    },
    [user, session, workspaces, activeWorkspaceId, handleSwitchWorkspace]
  );

  const handleRenameWorkspace = useCallback(
    async (id: string, name: string) => {
      if (!user || !session) return;
      try {
        await renameWorkspace(user.id, id, name, session);
        setWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
      } catch {
        // Silently ignore.
      }
    },
    [user, session]
  );

  const syncStatus = useRemoteSync(user, session, activeWorkspaceId, activeWorkspaceName);

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
        : syncStatus === 'error'
          ? 'Sync error'
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
        activeWorkspaceId={sampleMode ? undefined : activeWorkspaceId}
        workspaces={sampleMode ? [] : workspaces}
        onSwitchWorkspace={sampleMode ? undefined : handleSwitchWorkspace}
        onCreateWorkspace={sampleMode ? undefined : (name) => void handleCreateWorkspace(name)}
        onRenameWorkspace={sampleMode ? undefined : (id, name) => void handleRenameWorkspace(id, name)}
        onDeleteWorkspace={sampleMode ? undefined : (id) => void handleDeleteWorkspace(id)}
      />
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

