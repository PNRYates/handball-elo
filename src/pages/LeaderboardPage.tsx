import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function LeaderboardPage() {
  const players = useGameStore((s) => s.players);
  const renamePlayer = useGameStore((s) => s.renamePlayer);
  const hidePlayer = useGameStore((s) => s.hidePlayer);
  const hiddenPlayerIds = useGameStore((s) => s.hiddenPlayerIds);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const hiddenSet = new Set(hiddenPlayerIds);
  const sorted = Object.values(players)
    .filter((p) => !hiddenSet.has(p.id))
    .sort((a, b) => b.elo - a.elo);

  useEffect(() => {
    if (editingId) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editingId]);

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      renamePlayer(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  if (sorted.length === 0) {
    return (
      <p className="text-gray-500 text-center mt-12">
        No players yet. Start a game first.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-bold mb-1">Leaderboard</h1>
      <p className="text-xs text-gray-600 mb-4">Click a name to rename</p>
      <div className="space-y-2">
        {sorted.map((player, i) => (
          <div
            key={player.id}
            className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5"
          >
            <span className="text-gray-500 text-sm w-7 shrink-0">
              #{i + 1}
            </span>
            <div className="flex-1 min-w-0">
              {editingId === player.id ? (
                <input
                  ref={editRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onBlur={commitEdit}
                  className="bg-gray-700 border border-amber-500 rounded px-2 py-0.5 text-gray-100 text-sm w-full focus:outline-none"
                />
              ) : (
                <div
                  onClick={() => startEdit(player.id, player.name)}
                  className="font-medium truncate cursor-pointer hover:text-amber-400 transition-colors"
                >
                  {player.name}
                </div>
              )}
              <div className="text-xs text-gray-500">
                {player.gamesPlayed} games &middot; {player.eliminations} kills
                &middot; {player.timesEliminated} deaths
              </div>
            </div>
            <div className="text-right shrink-0 ml-3 flex items-center gap-2">
              <div className="font-mono font-bold text-lg">{player.elo}</div>
              <button
                type="button"
                onClick={() => hidePlayer(player.id)}
                className="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-300"
                title="Delete name"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
