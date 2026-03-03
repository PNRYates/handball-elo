import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Court' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/history', label: 'History' },
];

interface NavBarProps {
  userEmail: string;
  syncLabel: string;
  onLogout: () => void;
}

export default function NavBar({ userEmail, syncLabel, onLogout }: NavBarProps) {
  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          <p className="text-[11px] text-gray-500">{syncLabel}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded px-2 py-1 transition-colors"
        >
          Sign out
        </button>
      </div>
      <div className="max-w-lg mx-auto flex">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex-1 text-center py-3 text-sm font-medium transition-colors ${
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
