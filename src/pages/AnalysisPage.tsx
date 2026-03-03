import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import {
  buildHeadToHead,
  buildPerformanceTrends,
  buildPlayerSummary,
  buildPositionStrategy,
  defaultSelectedPlayers,
  getFilteredTurns,
  topRivalries,
} from '../lib/analyticsEngine';
import type { AnalyticsFilterState, AnalyticsScope, HeadToHeadRow } from '../types/analytics';

const defaultFilter: AnalyticsFilterState = {
  scope: 'all_time',
  includeCurrentGame: true,
  minTurnsThreshold: 5,
  rangeStartGameId: null,
  rangeEndGameId: null,
};

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function statClass(v: number): string {
  return v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
}

function scopeLabel(scope: AnalyticsScope): string {
  if (scope === 'all_time') return 'All-time';
  if (scope === 'current_game') return 'Current game';
  if (scope === 'last_5_games') return 'Last 5 games';
  if (scope === 'last_10_games') return 'Last 10 games';
  return 'Game range';
}

function MiniBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={labels[i]} className="flex items-center gap-2 text-xs">
          <span className="w-14 text-gray-500">{labels[i]}</span>
          <div className="flex-1 h-2 rounded bg-gray-900 overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono">{v}</span>
        </div>
      ))}
    </div>
  );
}

function LineChartCard({
  title,
  series,
  selected,
  players,
}: {
  title: string;
  series: Array<{ index: number; values: Record<string, number> }>;
  selected: string[];
  players: Record<string, { name: string }>;
}) {
  const width = 900;
  const height = 260;
  const pad = 28;

  const allValues = selected.flatMap((id) => series.map((p) => p.values[id] ?? 0));
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const span = Math.max(1, max - min);
  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a78bfa', '#14b8a6'];

  const toX = (idx: number) => pad + (idx / Math.max(1, series.length - 1)) * (width - pad * 2);
  const toY = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <h2 className="font-medium">{title}</h2>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full h-64 bg-gray-900 rounded">
          <line x1={pad} y1={toY(0)} x2={width - pad} y2={toY(0)} stroke="#374151" strokeDasharray="4 4" />
          {selected.map((id, lineIndex) => {
            const points = series
              .map((p, i) => `${toX(i)},${toY(p.values[id] ?? 0)}`)
              .join(' ');
            return (
              <polyline
                key={id}
                points={points}
                fill="none"
                stroke={colors[lineIndex % colors.length]}
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {selected.map((id, i) => (
          <span key={id} className="px-2 py-1 rounded bg-gray-900 border border-gray-700 inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
            {players[id]?.name ?? id}
          </span>
        ))}
      </div>
    </section>
  );
}

export default function AnalysisPage() {
  const turns = useGameStore((s) => s.turns);
  const gameHistory = useGameStore((s) => s.gameHistory);
  const players = useGameStore((s) => s.players);

  const [filter, setFilter] = useState<AnalyticsFilterState>(defaultFilter);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [h2hSort, setH2hSort] = useState<'volume' | 'net' | 'ratio'>('volume');

  const filtered = useMemo(
    () => getFilteredTurns(turns, gameHistory, filter),
    [turns, gameHistory, filter]
  );

  useEffect(() => {
    if (selectedPlayers.length === 0 && filtered.length > 0) {
      setSelectedPlayers(defaultSelectedPlayers(filtered));
    }
  }, [filtered, selectedPlayers.length]);

  const trends = useMemo(
    () => buildPerformanceTrends(filtered, players, selectedPlayers),
    [filtered, players, selectedPlayers]
  );
  const h2h = useMemo(
    () => buildHeadToHead(filtered, players, filter.minTurnsThreshold),
    [filtered, players, filter.minTurnsThreshold]
  );
  const strategy = useMemo(() => buildPositionStrategy(filtered), [filtered]);
  const summary = useMemo(() => buildPlayerSummary(filtered), [filtered]);

  const sortedH2h = useMemo(() => {
    const list = [...h2h];
    if (h2hSort === 'net') return list.sort((a, b) => Math.abs(b.netEloAminusB) - Math.abs(a.netEloAminusB));
    if (h2hSort === 'ratio') return list.sort((a, b) => b.killRatioA - a.killRatioA);
    return list.sort((a, b) => b.turnsTogether - a.turnsTogether);
  }, [h2h, h2hSort]);

  const top = topRivalries(h2h, 8);

  if (filtered.length === 0) {
    return <p className="text-gray-500 text-center mt-12">No analysis yet for selected filter.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold mb-1">Analytics Dashboard</h1>
        <p className="text-xs text-gray-500">{scopeLabel(filter.scope)} • {summary.totalTurns} turns • {summary.totalGamesRepresented} games</p>
      </div>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Filters</h2>
        <div className="flex flex-wrap gap-2">
          {(['all_time', 'current_game', 'last_5_games', 'last_10_games', 'game_range'] as AnalyticsScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, scope }))}
              className={`px-2.5 py-1.5 text-xs rounded border ${
                filter.scope === scope
                  ? 'bg-amber-600 text-white border-amber-500'
                  : 'bg-gray-900 border-gray-700 text-gray-300'
              }`}
            >
              {scopeLabel(scope)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filter.includeCurrentGame}
              onChange={(e) => setFilter((f) => ({ ...f, includeCurrentGame: e.target.checked }))}
            />
            Include current game
          </label>
          <label className="inline-flex items-center gap-2">
            Min turns
            <input
              type="number"
              min={1}
              className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
              value={filter.minTurnsThreshold}
              onChange={(e) => setFilter((f) => ({ ...f, minTurnsThreshold: Number(e.target.value) || 1 }))}
            />
          </label>
          {filter.scope === 'game_range' && (
            <>
              <label className="inline-flex items-center gap-2">
                Start
                <input
                  type="number"
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
                  value={filter.rangeStartGameId ?? ''}
                  onChange={(e) => setFilter((f) => ({ ...f, rangeStartGameId: e.target.value ? Number(e.target.value) : null }))}
                />
              </label>
              <label className="inline-flex items-center gap-2">
                End
                <input
                  type="number"
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
                  value={filter.rangeEndGameId ?? ''}
                  onChange={(e) => setFilter((f) => ({ ...f, rangeEndGameId: e.target.value ? Number(e.target.value) : null }))}
                />
              </label>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">Turns</p>
          <p className="font-mono text-xl">{summary.totalTurns}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">Players</p>
          <p className="font-mono text-xl">{summary.uniquePlayers}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">Games</p>
          <p className="font-mono text-xl">{summary.totalGamesRepresented}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">Avg turns/game</p>
          <p className="font-mono text-xl">{summary.avgTurnsPerGame}</p>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Selected Players</h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(players)
            .sort((a, b) => b.elo - a.elo)
            .map((p) => {
              const active = selectedPlayers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    setSelectedPlayers((ids) =>
                      active ? ids.filter((id) => id !== p.id) : [...ids, p.id].slice(-8)
                    )
                  }
                  className={`text-xs px-2 py-1 rounded border ${
                    active ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
        </div>
      </section>

      <LineChartCard
        title="Performance Trends (Net Elo in Filter Window)"
        series={trends.series}
        selected={selectedPlayers}
        players={players}
      />

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-3">Form (Last 10/20 Turns)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-700">
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Net 10</th>
                <th className="py-1.5 pr-2">Net 20</th>
                <th className="py-1.5 pr-2">Kill Rate 10</th>
                <th className="py-1.5 pr-2">Momentum</th>
              </tr>
            </thead>
            <tbody>
              {trends.formMetrics.slice(0, 12).map((p) => (
                <tr key={p.playerId} className="border-b border-gray-800 last:border-b-0">
                  <td className="py-1.5 pr-2 font-medium">{p.playerName}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(p.netElo10)}`}>{p.netElo10}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(p.netElo20)}`}>{p.netElo20}</td>
                  <td className="py-1.5 pr-2 font-mono">{pct(p.killRate10)}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(p.momentum10)}`}>{p.momentum10.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Head-to-Head Intelligence</h2>
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setH2hSort('volume')} className="px-2 py-1 border border-gray-700 rounded bg-gray-900">Volume</button>
            <button type="button" onClick={() => setH2hSort('net')} className="px-2 py-1 border border-gray-700 rounded bg-gray-900">Net</button>
            <button type="button" onClick={() => setH2hSort('ratio')} className="px-2 py-1 border border-gray-700 rounded bg-gray-900">Ratio</button>
          </div>
        </div>

        <MiniBars
          values={top.map((r) => r.turnsTogether)}
          labels={top.map((r) => `${r.playerAName} vs ${r.playerBName}`)}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-700">
                <th className="py-1.5 pr-2">Matchup</th>
                <th className="py-1.5 pr-2">Turns</th>
                <th className="py-1.5 pr-2">Kills A-B</th>
                <th className="py-1.5 pr-2">Kill Ratio A</th>
                <th className="py-1.5 pr-2">Net Elo A-B</th>
              </tr>
            </thead>
            <tbody>
              {sortedH2h.slice(0, 20).map((row: HeadToHeadRow) => (
                <tr key={row.pairKey} className="border-b border-gray-800 last:border-b-0">
                  <td className="py-1.5 pr-2">{row.playerAName} vs {row.playerBName}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.turnsTogether}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.killsAonB}-{row.killsBonA}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.killRatioA.toFixed(2)}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(row.netEloAminusB)}`}>{row.netEloAminusB.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-medium">Position Strategy</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm text-gray-400 mb-2">Elimination Rate by Square</h3>
            <MiniBars
              values={strategy.eliminationByPosition.map((r) => r.count)}
              labels={strategy.eliminationByPosition.map((r) => `#${r.position + 1}`)}
            />
          </div>
          <div>
            <h3 className="text-sm text-gray-400 mb-2">Kill Conversion by Square</h3>
            <MiniBars
              values={strategy.killsByPosition.map((r) => r.count)}
              labels={strategy.killsByPosition.map((r) => `#${r.position + 1}`)}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="border border-gray-700 rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-1">Safe Square</p>
            <p className="font-semibold">#{strategy.safeSquare + 1}</p>
          </div>
          <div className="border border-gray-700 rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-1">Pressure Square</p>
            <p className="font-semibold">#{strategy.pressureSquare + 1}</p>
          </div>
          <div className="border border-gray-700 rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-1">Entry Impact (first 3 turns)</p>
            <p className={`font-semibold ${statClass(strategy.entryImpact.averageThreeTurnNet)}`}>
              {strategy.entryImpact.averageThreeTurnNet}
            </p>
            <p className="text-xs text-gray-500 mt-1">{strategy.entryImpact.entries} entries sampled</p>
          </div>
          <div className="border border-gray-700 rounded-lg p-3">
            <p className="text-gray-500 text-xs mb-1">Rotation Efficiency (avg Elo delta)</p>
            <div className="text-xs space-y-1 mt-1">
              {strategy.rotationEfficiency.map((r) => (
                <div key={r.position} className="flex justify-between">
                  <span>#{r.position + 1}</span>
                  <span className={statClass(r.avgDelta)}>{r.avgDelta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h2 className="font-medium mb-3">Volatility</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-700">
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Volatility</th>
                <th className="py-1.5 pr-2">Avg Delta/Turn</th>
              </tr>
            </thead>
            <tbody>
              {trends.volatility.slice(0, 12).map((row) => (
                <tr key={row.playerId} className="border-b border-gray-800 last:border-b-0">
                  <td className="py-1.5 pr-2">{row.playerName}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.volatility.toFixed(2)}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(row.averageDelta)}`}>{row.averageDelta.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
