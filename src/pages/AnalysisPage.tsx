import { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Turn } from '../types';

type PlayerStats = {
  id: string;
  name: string;
  turnsPlayed: number;
  kills: number;
  deaths: number;
  killRate: number;
  deathRate: number;
  aggression: number;
};

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function aggregatePlayerStats(turns: Turn[], players: Record<string, { name: string }>): PlayerStats[] {
  const stats = new Map<string, Omit<PlayerStats, 'killRate' | 'deathRate' | 'aggression'>>();

  const ensure = (id: string) => {
    if (!stats.has(id)) {
      stats.set(id, {
        id,
        name: players[id]?.name ?? id,
        turnsPlayed: 0,
        kills: 0,
        deaths: 0,
      });
    }
    return stats.get(id)!;
  };

  for (const turn of turns) {
    for (const id of turn.courtBefore) {
      const row = ensure(id);
      row.turnsPlayed += 1;
    }

    ensure(turn.killerPlayerId).kills += 1;
    ensure(turn.eliminatedPlayerId).deaths += 1;
  }

  return Array.from(stats.values())
    .map((row) => ({
      ...row,
      killRate: row.turnsPlayed > 0 ? row.kills / row.turnsPlayed : 0,
      deathRate: row.turnsPlayed > 0 ? row.deaths / row.turnsPlayed : 0,
      aggression: row.deaths > 0 ? row.kills / row.deaths : row.kills,
    }))
    .sort((a, b) => b.aggression - a.aggression || b.kills - a.kills || b.turnsPlayed - a.turnsPlayed);
}

export default function AnalysisPage() {
  const turns = useGameStore((s) => s.turns);
  const gameHistory = useGameStore((s) => s.gameHistory);
  const players = useGameStore((s) => s.players);

  const allTurns = useMemo(
    () => [...gameHistory.flatMap((g) => g.turns), ...turns],
    [gameHistory, turns]
  );

  const totalTurns = allTurns.length;

  const eliminatedByPos = [0, 0, 0, 0];
  const killsByPos = [0, 0, 0, 0];

  for (const turn of allTurns) {
    eliminatedByPos[turn.eliminatedPosition] += 1;
    killsByPos[turn.killerPosition] += 1;
  }

  const playerStats = useMemo(() => aggregatePlayerStats(allTurns, players), [allTurns, players]);

  if (totalTurns === 0) {
    return <p className="text-gray-500 text-center mt-12">No analysis yet. Record some turns first.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold mb-1">Analysis</h1>
        <p className="text-xs text-gray-500">Based on {totalTurns} recorded turns (current + past games).</p>
      </div>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-3">% Square Got Eliminated On</h2>
        <div className="space-y-2">
          {eliminatedByPos.map((count, i) => (
            <div key={`elim-${i}`} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Square #{i + 1}</span>
              <span className="font-mono">{formatPct(count / totalTurns)} ({count})</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-3">% Kills By Square</h2>
        <div className="space-y-2">
          {killsByPos.map((count, i) => (
            <div key={`kill-${i}`} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Square #{i + 1}</span>
              <span className="font-mono">{formatPct(count / totalTurns)} ({count})</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-3">Player Aggression</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-700">
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Turns</th>
                <th className="py-1.5 pr-2">Kills</th>
                <th className="py-1.5 pr-2">Deaths</th>
                <th className="py-1.5 pr-2">Kill Rate</th>
                <th className="py-1.5 pr-2">Aggro</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((p) => (
                <tr key={p.id} className="border-b border-gray-800 last:border-b-0">
                  <td className="py-1.5 pr-2 font-medium">{p.name}</td>
                  <td className="py-1.5 pr-2 font-mono">{p.turnsPlayed}</td>
                  <td className="py-1.5 pr-2 font-mono text-green-400">{p.kills}</td>
                  <td className="py-1.5 pr-2 font-mono text-red-400">{p.deaths}</td>
                  <td className="py-1.5 pr-2 font-mono">{formatPct(p.killRate)}</td>
                  <td className="py-1.5 pr-2 font-mono">{p.aggression.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">Aggro = kills / deaths (kills if deaths are zero).</p>
      </section>
    </div>
  );
}
