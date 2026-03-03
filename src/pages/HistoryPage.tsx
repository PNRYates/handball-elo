import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Turn } from '../types';

function TurnItem({ turn, players }: { turn: Turn; players: Record<string, { name: string }> }) {
  const eliminated = players[turn.eliminatedPlayerId]?.name ?? turn.eliminatedPlayerId;
  const killer = players[turn.killerPlayerId]?.name ?? turn.killerPlayerId;
  const newPlayer = turn.newPlayerId
    ? players[turn.newPlayerId]?.name ?? turn.newPlayerId
    : null;
  const isSecondChance = turn.eliminatedPosition === 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">
          Turn #{turn.turnNumber + 1}
        </span>
      </div>
      <p className="text-sm">
        <span className="text-green-400">{killer}</span>
        <span className="text-gray-500"> eliminated </span>
        <span className="text-red-400">{eliminated}</span>
        <span className="text-gray-600"> (#{turn.eliminatedPosition + 1})</span>
      </p>
      {isSecondChance && (
        <p className="text-xs text-amber-500 mt-0.5">
          {eliminated} got a second chance at #4
        </p>
      )}
      {newPlayer && (
        <p className="text-xs text-gray-500 mt-0.5">
          {newPlayer} entered at #4
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {turn.eloChanges.map((change) => {
          const name = players[change.playerId]?.name ?? change.playerId;
          const color =
            change.delta > 0
              ? 'text-green-400'
              : change.delta < 0
                ? 'text-red-400'
                : 'text-gray-500';
          return (
            <span key={change.playerId} className="text-xs">
              <span className="text-gray-400">{name}</span>{' '}
              <span className={color}>
                {change.delta > 0 ? '+' : ''}{change.delta}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const turns = useGameStore((s) => s.turns);
  const players = useGameStore((s) => s.players);
  const gameHistory = useGameStore((s) => s.gameHistory);
  const gameInProgress = useGameStore((s) => s.gameInProgress);
  const deleteGameFromHistory = useGameStore((s) => s.deleteGameFromHistory);
  const renameGameInHistory = useGameStore((s) => s.renameGameInHistory);
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const [draftGameName, setDraftGameName] = useState('');

  const hasAny = turns.length > 0 || gameHistory.length > 0;

  if (!hasAny) {
    return (
      <p className="text-gray-500 text-center mt-12">No history yet.</p>
    );
  }

  const reversedHistory = [...gameHistory].reverse();

  const startEditGameName = (gameId: number, name?: string | null) => {
    setEditingGameId(gameId);
    setDraftGameName(name ?? '');
  };

  const saveGameName = (gameId: number) => {
    renameGameInHistory(gameId, draftGameName);
    setEditingGameId(null);
    setDraftGameName('');
  };

  const cancelGameName = () => {
    setEditingGameId(null);
    setDraftGameName('');
  };

  return (
    <div className="space-y-6">
      {/* Current game */}
      {gameInProgress && turns.length > 0 && (
        <div>
          <h1 className="text-lg font-bold mb-1">Current Game</h1>
          <p className="text-xs text-gray-500 mb-3">{turns.length} turns</p>
          <div className="space-y-2">
            {[...turns].reverse().map((turn) => (
              <TurnItem key={turn.turnNumber} turn={turn} players={players} />
            ))}
          </div>
        </div>
      )}

      {/* Past games */}
      {reversedHistory.length > 0 && (
        <div>
          <h1 className="text-lg font-bold mb-3">Past Games</h1>
          <div className="space-y-4">
            {reversedHistory.map((game) => {
              const duration = game.endedAt - game.startedAt;
              const mins = Math.floor(duration / 60000);
              const date = new Date(game.startedAt);
              const dateStr = date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              const timeStr = date.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <details key={game.id} className="group">
                  <summary className="cursor-pointer bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 flex items-center justify-between list-none">
                    <div>
                      <span className="font-medium text-sm">{game.name || `Game #${game.id}`}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {dateStr} {timeStr}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">
                        {game.turns.length} turns &middot; {mins}m
                      </span>
                      <span className="text-xs text-gray-600 ml-2 group-open:rotate-90 inline-block transition-transform">
                        ▶
                      </span>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-2 pl-2 border-l border-gray-800">
                    <div>
                      {editingGameId === game.id ? (
                        <input
                          autoFocus
                          value={draftGameName}
                          onChange={(e) => setDraftGameName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveGameName(game.id);
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelGameName();
                            }
                          }}
                          onBlur={() => saveGameName(game.id)}
                          className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                          placeholder={`Game #${game.id}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditGameName(game.id, game.name)}
                          className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
                        >
                          {game.name ? 'Rename Game' : 'Name Game'}
                        </button>
                      )}
                    </div>
                    {game.turns.map((turn) => (
                      <TurnItem key={turn.turnNumber} turn={turn} players={players} />
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const label = game.name || `Game #${game.id}`;
                        if (window.confirm(`Delete ${label} from history?`)) {
                          deleteGameFromHistory(game.id);
                        }
                      }}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors mt-2"
                    >
                      Delete Game
                    </button>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
