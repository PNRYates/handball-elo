import { useMemo, useState } from 'react';
import { selectActiveWorkspace, useGameStore } from '../store/gameStore';

interface SettingsPageProps {
  onLoadSampleData?: () => void;
}

export default function SettingsPage({ onLoadSampleData }: SettingsPageProps) {
  const workspace = useGameStore((s) => selectActiveWorkspace(s));
  const workspaceMap = useGameStore((s) => s.workspaces);
  const activeWorkspaceId = useGameStore((s) => s.activeWorkspaceId);
  const setTheme = useGameStore((s) => s.setTheme);
  const setRequireKiller = useGameStore((s) => s.setRequireKiller);
  const setShowReserveButtons = useGameStore((s) => s.setShowReserveButtons);
  const createWorkspace = useGameStore((s) => s.createWorkspace);
  const renameWorkspace = useGameStore((s) => s.renameWorkspace);
  const deleteWorkspace = useGameStore((s) => s.deleteWorkspace);
  const switchWorkspace = useGameStore((s) => s.switchWorkspace);

  const workspaces = useMemo(() => Object.values(workspaceMap), [workspaceMap]);

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renameDraft, setRenameDraft] = useState(() => workspace.name);

  const sortedWorkspaces = useMemo(
    () => [...workspaces].sort((a, b) => a.createdAt - b.createdAt),
    [workspaces]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Settings</h1>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Workspaces</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Each workspace has isolated players, history, ratings, gameplay settings, and analytics filters.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {sortedWorkspaces.map((item) => {
            const active = item.id === activeWorkspaceId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  switchWorkspace(item.id);
                  setRenameDraft(item.name);
                }}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  active
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                {item.name}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="New workspace name"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              createWorkspace(newWorkspaceName.trim() || undefined);
              setNewWorkspaceName('');
            }}
            className="px-3 py-2 rounded border text-sm bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
          >
            Create workspace
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="text"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            placeholder="Rename active workspace"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => renameWorkspace(activeWorkspaceId, renameDraft)}
            className="px-3 py-2 rounded border text-sm bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              if (workspaces.length <= 1) return;
              if (window.confirm(`Delete workspace "${workspace.name}" and all its data?`)) {
                deleteWorkspace(activeWorkspaceId);
              }
            }}
            disabled={workspaces.length <= 1}
            className="px-3 py-2 rounded border text-sm bg-gray-900 border-red-900 text-red-300 hover:border-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete active
          </button>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Theme</h2>
          <p className="text-xs text-gray-500 mt-0.5">Switch between light and dark mode.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              workspace.theme === 'dark'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              workspace.theme === 'light'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            Light
          </button>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Turn Input</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Disable killer selection if you only want to record who was eliminated.
          </p>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Require selecting killer</span>
          <button
            type="button"
            role="switch"
            aria-checked={workspace.requireKiller}
            onClick={() => setRequireKiller(!workspace.requireKiller)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              workspace.requireKiller ? 'bg-amber-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                workspace.requireKiller ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        {!workspace.requireKiller && (
          <p className="text-xs text-amber-400">
            Eliminated player is rated vs average survivor skill, and the loss is split across survivors.
          </p>
        )}

        <label className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm">Show reserve selection buttons</span>
          <button
            type="button"
            role="switch"
            aria-checked={workspace.showReserveButtons}
            onClick={() => setShowReserveButtons(!workspace.showReserveButtons)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              workspace.showReserveButtons ? 'bg-amber-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                workspace.showReserveButtons ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500">
          Shows quick-tap reserve and recent entrant chips during replacement entry.
        </p>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Sample Dataset</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Load a pre-built sample history so you can explore charts and stats quickly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onLoadSampleData?.()}
          className="px-3 py-2 rounded-lg border text-sm bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
        >
          Switch to sample data
        </button>
      </section>
    </div>
  );
}
