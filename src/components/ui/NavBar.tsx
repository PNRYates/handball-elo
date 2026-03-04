import { NavLink } from 'react-router-dom';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import type { Workspace } from '../../types';

const links = [
  { to: '/', label: 'Court' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/history', label: 'History' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/instructions', label: 'Instructions' },
  { to: '/settings', label: 'Settings' },
];

interface NavBarProps {
  userEmail: string;
  syncLabel: string;
  onLogout: () => void;
  logoutLabel?: string;
  activeWorkspaceId?: string;
  workspaces?: Workspace[];
  onSwitchWorkspace?: (id: string) => void;
  onCreateWorkspace?: (name: string) => void;
  onRenameWorkspace?: (id: string, name: string) => void;
  onDeleteWorkspace?: (id: string) => void;
}

export default function NavBar({
  userEmail,
  syncLabel,
  onLogout,
  logoutLabel = 'Sign out',
  activeWorkspaceId,
  workspaces,
  onSwitchWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
}: NavBarProps) {
  const showWorkspaceSwitcher =
    workspaces &&
    workspaces.length > 0 &&
    activeWorkspaceId !== undefined &&
    onSwitchWorkspace &&
    onCreateWorkspace &&
    onRenameWorkspace &&
    onDeleteWorkspace;

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          <div className="flex items-center gap-2">
            {showWorkspaceSwitcher ? (
              <WorkspaceSwitcher
                activeWorkspaceId={activeWorkspaceId}
                workspaces={workspaces}
                onSwitch={onSwitchWorkspace}
                onCreate={onCreateWorkspace}
                onRename={onRenameWorkspace}
                onDelete={onDeleteWorkspace}
              />
            ) : (
              <p className="text-[11px] text-gray-500">{syncLabel}</p>
            )}
            {showWorkspaceSwitcher && (
              <p className="text-[11px] text-gray-500">{syncLabel}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors"
        >
          {logoutLabel}
        </button>
      </div>
      <div className="max-w-xl mx-auto flex overflow-x-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `px-3 shrink-0 text-center py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

