import { Link, useLocation } from 'react-router-dom';
import LeaderboardPage from './LeaderboardPage';
import HistoryPage from './HistoryPage';
import AnalysisPage from './AnalysisPage';

interface PublicWorkspacePageProps {
  slug: string;
  workspaceName: string;
  updatedAt: string;
}

const PUBLIC_VIEWS = [
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'history', label: 'History' },
  { key: 'analysis', label: 'Analysis' },
] as const;

function resolveActiveView(pathname: string, slug: string): (typeof PUBLIC_VIEWS)[number]['key'] {
  const parts = pathname.split('/').filter(Boolean);
  const maybeView = parts[2];
  if (parts[0] !== 'public' || parts[1] !== slug) {
    return 'leaderboard';
  }
  if (maybeView === 'history' || maybeView === 'analysis' || maybeView === 'leaderboard') {
    return maybeView;
  }
  return 'leaderboard';
}

export default function PublicWorkspacePage({ slug, workspaceName, updatedAt }: PublicWorkspacePageProps) {
  const location = useLocation();
  const activeView = resolveActiveView(location.pathname, slug);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{workspaceName}</h1>
      <p className="text-xs text-gray-500">
        Public snapshot for <span className="text-gray-300">{slug}</span> · Updated{' '}
        {new Date(updatedAt).toLocaleString()}
      </p>

      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
        {PUBLIC_VIEWS.map((view) => (
          <Link
            key={view.key}
            to={`/public/${slug}/${view.key}`}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              activeView === view.key
                ? 'bg-amber-600 border-amber-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-600'
            }`}
          >
            {view.label}
          </Link>
        ))}
      </div>

      {activeView === 'leaderboard' && <LeaderboardPage readOnly />}
      {activeView === 'history' && <HistoryPage readOnly />}
      {activeView === 'analysis' && <AnalysisPage />}
    </div>
  );
}
