import type { PersistedGameState } from '../store/gameStore';

interface PublicWorkspacePageProps {
  slug: string;
  workspaceName: string;
  updatedAt: string;
  state: PersistedGameState;
}

export default function PublicWorkspacePage({ slug, workspaceName, updatedAt, state }: PublicWorkspacePageProps) {
  const workspace = state.workspaces[state.activeWorkspaceId];
  const players = Object.values(workspace?.players ?? {}).sort((a, b) => b.elo - a.elo);
  const court = workspace?.court ?? ['', '', '', ''];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{workspaceName}</h1>
      <p className="text-xs text-gray-500">
        Public snapshot for <span className="text-gray-300">{slug}</span> · Updated{' '}
        {new Date(updatedAt).toLocaleString()}
      </p>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-2">Court</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {court.map((playerId, index) => (
            <div key={`slot-${index}`} className="rounded border border-gray-700 bg-gray-900 px-3 py-2">
              <p className="text-xs text-gray-500">Position {index + 1}</p>
              <p className="text-gray-100">{playerId ? workspace?.players[playerId]?.name ?? 'Unknown' : 'Empty'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-2">Leaderboard</h2>
        <div className="space-y-2 text-sm">
          {players.map((player, index) => (
            <div key={player.id} className="flex items-center justify-between rounded border border-gray-700 bg-gray-900 px-3 py-2">
              <p className="text-gray-100">#{index + 1} {player.name}</p>
              <p className="text-amber-400 font-medium">{Math.round(player.elo)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
