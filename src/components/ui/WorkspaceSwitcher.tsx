import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '../../types';

interface WorkspaceSwitcherProps {
  activeWorkspaceId: string;
  workspaces: Workspace[];
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function WorkspaceSwitcher({
  activeWorkspaceId,
  workspaces,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const displayName = activeWorkspace?.name ?? 'Default';

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRenamingId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const startRename = (w: Workspace) => {
    setRenamingId(w.id);
    setRenameValue(w.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName('');
    setOpen(false);
  };

  const handleDelete = (w: Workspace) => {
    onDelete(w.id);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-gray-300 hover:text-gray-100 transition-colors"
        title="Switch workspace"
      >
        <span className="font-medium truncate max-w-[120px]">{displayName}</span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
          <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Workspaces
          </p>

          <ul className="max-h-52 overflow-y-auto">
            {workspaces.map((w) => (
              <li
                key={w.id}
                className={`flex items-center gap-2 px-3 py-2 ${
                  w.id === activeWorkspaceId ? 'bg-gray-800' : 'hover:bg-gray-800'
                }`}
              >
                {renamingId === w.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                    onBlur={commitRename}
                    className="flex-1 min-w-0 bg-gray-700 border border-amber-500 rounded px-2 py-0.5 text-sm text-gray-100 focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitch(w.id);
                      setOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left text-sm text-gray-200 truncate"
                  >
                    {w.id === activeWorkspaceId && (
                      <span className="text-amber-400 mr-1">✓</span>
                    )}
                    {w.name}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startRename(w)}
                  className="text-[11px] text-gray-500 hover:text-gray-300 shrink-0"
                  title="Rename"
                >
                  ✎
                </button>
                {workspaces.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDelete(w)}
                    className="text-[11px] text-gray-500 hover:text-red-400 shrink-0"
                    title="Delete workspace"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-gray-700 px-3 py-2 flex gap-2">
            <input
              ref={newInputRef}
              type="text"
              placeholder="New workspace name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="shrink-0 px-2 py-1 text-sm bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
