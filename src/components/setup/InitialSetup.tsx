import { useState, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

export default function InitialSetup() {
  const [names, setNames] = useState(['', '', '', '']);
  const initializeGame = useGameStore((s) => s.initializeGame);
  const players = useGameStore((s) => s.players);
  const resetAllData = useGameStore((s) => s.resetAllData);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const existingPlayers = Object.values(players).sort((a, b) => b.elo - a.elo);
  const hasExistingPlayers = existingPlayers.length > 0;

  const updateName = (index: number, value: string) => {
    const next = [...names];
    next[index] = value;
    setNames(next);
  };

  const canSubmit =
    names.every((n) => n.trim().length > 0) &&
    new Set(names.map((n) => n.trim().toLowerCase())).size === 4;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    initializeGame(names.map((n) => n.trim()) as [string, string, string, string]);
  };

  // Quick-fill: select a player from the suggestion list
  const fillPlayer = (index: number, name: string) => {
    const next = [...names];
    next[index] = name;
    setNames(next);
    // Focus next empty input
    const nextEmpty = next.findIndex((n, i) => i > index && !n.trim());
    if (nextEmpty !== -1) {
      inputRefs.current[nextEmpty]?.focus();
    }
  };

  // Get suggestions for a specific input (exclude already selected names)
  const getSuggestions = (index: number) => {
    const selected = new Set(
      names.filter((n, i) => i !== index && n.trim()).map((n) => n.trim().toLowerCase())
    );
    return existingPlayers.filter((p) => !selected.has(p.id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-center mb-2">Handball ELO</h1>
      <p className="text-gray-400 text-center text-sm mb-6">
        {hasExistingPlayers ? 'Set up the court for a new game' : 'Enter the 4 starting players'}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {names.map((name, i) => {
          const suggestions = getSuggestions(i);
          const query = name.trim().toLowerCase();
          const filtered = query.length > 0
            ? suggestions.filter((p) => p.name.toLowerCase().startsWith(query))
            : suggestions;
          const exactMatch = suggestions.some((p) => p.id === query);

          return (
            <div key={i}>
              <label className="block text-xs text-gray-500 mb-1">
                Position #{i + 1}
              </label>
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                value={name}
                onChange={(e) => updateName(i, e.target.value)}
                placeholder="Player name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                autoFocus={i === 0}
              />
              {/* Show matching existing players as quick-fill chips */}
              {filtered.length > 0 && !exactMatch && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {filtered.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => fillPlayer(i, p.name)}
                      className="text-[clamp(0.72rem,2.4vw,0.9rem)] bg-gray-800 border border-gray-700 hover:border-amber-500 text-gray-400 hover:text-amber-300 px-[clamp(0.55rem,2vw,0.85rem)] py-[clamp(0.35rem,1.2vw,0.55rem)] rounded-md transition-colors whitespace-nowrap"
                    >
                      {p.name} <span className="text-gray-600">{p.elo.toFixed(1)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-lg transition-colors mt-4"
        >
          {hasExistingPlayers ? 'Start New Game' : 'Start Game'}
        </button>
      </form>
      {hasExistingPlayers && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete all player data and game history? This cannot be undone.')) {
              resetAllData();
            }
          }}
          className="w-full text-xs text-gray-600 hover:text-red-400 mt-4 transition-colors"
        >
          Reset All Data
        </button>
      )}
    </div>
  );
}
