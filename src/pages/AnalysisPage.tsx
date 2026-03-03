import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { computePopoverPosition } from '../lib/popover';
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

function InlineExplain({
  label,
  text,
  className,
}: {
  label: string;
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; placement: 'top' | 'bottom' }>({
    left: 0,
    top: 0,
    placement: 'bottom',
  });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const anchor = trigger.getBoundingClientRect();
      const pop = popoverRef.current;
      const popWidth = pop?.offsetWidth ?? 260;
      const popHeight = pop?.offsetHeight ?? 72;
      const next = computePopoverPosition(
        {
          left: anchor.left,
          top: anchor.top,
          width: anchor.width,
          height: anchor.height,
        },
        { width: popWidth, height: popHeight },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPosition(next);
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const rafId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className={`inline text-inherit underline decoration-dotted underline-offset-4 decoration-gray-500 hover:decoration-gray-300 ${className ?? ''}`}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 max-w-xs px-2.5 py-2 text-xs text-gray-200 bg-gray-900 border border-gray-700 rounded shadow-lg pointer-events-none"
            style={{ left: position.left, top: position.top }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
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
  titleHelp,
  series,
  selected,
  players,
  timeWindow,
  onTimeWindowChange,
}: {
  title: string;
  titleHelp: string;
  series: Array<{ index: number; label: string; values: Record<string, number> }>;
  selected: string[];
  players: Record<string, { name: string }>;
  timeWindow: 'all' | '50' | '20';
  onTimeWindowChange: (next: 'all' | '50' | '20') => void;
}) {
  const height = 280;
  const padL = 52;
  const padR = 20;
  const padY = 24;

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(900);

  const displaySeries = useMemo(() => {
    if (timeWindow === 'all') return series;
    const n = Number(timeWindow);
    return series.slice(-n);
  }, [series, timeWindow]);

  const allValues = selected.flatMap((id) => displaySeries.map((p) => p.values[id] ?? 0));
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const span = Math.max(1, max - min);
  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a78bfa', '#14b8a6'];

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return;

    const updateWidth = (next: number) => {
      const safe = Math.max(760, Math.floor(next));
      setChartWidth(safe);
    };

    updateWidth(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const toX = (idx: number) => {
    const denom = Math.max(1, displaySeries.length - 1);
    return padL + (idx / denom) * (chartWidth - padL - padR);
  };
  const toY = (v: number) => height - padY - ((v - min) / span) * (height - padY * 2);

  const yTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) => min + (i / (count - 1)) * span);
  }, [min, span]);

  const syncHoverFromClientX = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const localX = clientX - rect.left;
    const usable = chartWidth - padL - padR;
    const ratio = Math.max(0, Math.min(1, (localX - padL) / Math.max(1, usable)));
    const idx = Math.round(ratio * Math.max(0, displaySeries.length - 1));
    setHoveredIndex(idx);
  };

  const hoverPoint =
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < displaySeries.length
      ? displaySeries[hoveredIndex]
      : null;

  return (
    <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">
          <InlineExplain label={title} text={titleHelp} />
        </h2>
        <div className="flex gap-2">
          {(['all', '50', '20'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onTimeWindowChange(w)}
              className={`text-xs px-2 py-1 rounded border ${
                timeWindow === w
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-300'
              }`}
            >
              {w === 'all' ? 'All' : `Last ${w}`}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={chartContainerRef}
        className="overflow-x-auto relative"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="h-72 block"
          style={{ width: chartWidth }}
          onMouseMove={(e) => syncHoverFromClientX(e.clientX, e.currentTarget)}
          onPointerMove={(e) => syncHoverFromClientX(e.clientX, e.currentTarget)}
          onPointerDown={(e) => syncHoverFromClientX(e.clientX, e.currentTarget)}
        >
          <rect x={0} y={0} width={chartWidth} height={height} fill="#111827" rx={8} />

          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={padL} y1={toY(tick)} x2={chartWidth - padR} y2={toY(tick)} stroke="#374151" strokeDasharray="4 4" />
              <text x={padL - 8} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {tick.toFixed(0)}
              </text>
            </g>
          ))}

          <line x1={padL} y1={padY} x2={padL} y2={height - padY} stroke="#6b7280" />
          <line x1={padL} y1={height - padY} x2={chartWidth - padR} y2={height - padY} stroke="#6b7280" />
          <line x1={padL} y1={toY(0)} x2={chartWidth - padR} y2={toY(0)} stroke="#9ca3af" strokeDasharray="4 4" />
          <text x={16} y={height / 2} transform={`rotate(-90 16 ${height / 2})`} fontSize="11" fill="#9ca3af">
            Net Elo
          </text>
          <text x={chartWidth / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="#9ca3af">
            Turns
          </text>

          {selected.map((id, lineIndex) => {
            const points = displaySeries
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

          {hoverPoint && (
            <line
              x1={toX(hoveredIndex ?? 0)}
              y1={padY}
              x2={toX(hoveredIndex ?? 0)}
              y2={height - padY}
              stroke="#9ca3af"
              strokeDasharray="3 3"
            />
          )}

          {hoverPoint &&
            selected.map((id, i) => (
              <circle
                key={`${id}-hover-point`}
                cx={toX(hoveredIndex ?? 0)}
                cy={toY(hoverPoint.values[id] ?? 0)}
                r="3.5"
                fill={colors[i % colors.length]}
              />
            ))}
        </svg>

        {hoverPoint && (
          <div className="absolute right-2 top-2 w-52 bg-gray-950/95 border border-gray-700 rounded p-2 text-xs pointer-events-none">
            <p className="text-gray-400 mb-1">{hoverPoint.label}</p>
            <div className="space-y-1">
              {selected.map((id, i) => (
                <div key={`${id}-tip`} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                    {players[id]?.name ?? id}
                  </span>
                  <span className="font-mono">{(hoverPoint.values[id] ?? 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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

function Th({ label, help }: { label: string; help: string }) {
  return (
    <th className="py-1.5 pr-2">
      <InlineExplain label={label} text={help} />
    </th>
  );
}

export default function AnalysisPage() {
  const turns = useGameStore((s) => s.turns);
  const gameHistory = useGameStore((s) => s.gameHistory);
  const players = useGameStore((s) => s.players);

  const [filter, setFilter] = useState<AnalyticsFilterState>(defaultFilter);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [h2hSort, setH2hSort] = useState<'volume' | 'net' | 'ratio'>('volume');
  const [trendWindow, setTrendWindow] = useState<'all' | '50' | '20'>('all');

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
        <h2 className="font-medium">
          <InlineExplain
            label="Filters"
            text="Adjust the analysis dataset. These controls do not change gameplay data, they only change what is included in charts and tables."
          />
        </h2>
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
            <InlineExplain
              label="Include current game"
              text="If checked, analytics include in-progress turns from the active game."
            />
          </label>
          <label className="inline-flex items-center gap-2">
            <InlineExplain
              label="Min turns"
              text="Head-to-head rows with fewer shared turns than this threshold are hidden."
            />
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
                <span>Start</span>
                <input
                  type="number"
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
                  value={filter.rangeStartGameId ?? ''}
                  onChange={(e) => setFilter((f) => ({ ...f, rangeStartGameId: e.target.value ? Number(e.target.value) : null }))}
                />
              </label>
              <label className="inline-flex items-center gap-2">
                <span>End</span>
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
          <p className="text-xs text-gray-500">
            <InlineExplain label="Turns" text="Total turns in the currently selected analytics filter window." />
          </p>
          <p className="font-mono text-xl">{summary.totalTurns}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            <InlineExplain label="Players" text="Unique players present in filtered turns." />
          </p>
          <p className="font-mono text-xl">{summary.uniquePlayers}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            <InlineExplain label="Games" text="Number of games represented by filtered turns." />
          </p>
          <p className="font-mono text-xl">{summary.totalGamesRepresented}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500">
            <InlineExplain label="Avg turns/game" text="Average number of turns per represented game in the active filter." />
          </p>
          <p className="font-mono text-xl">{summary.avgTurnsPerGame}</p>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-medium">
          <InlineExplain
            label="Selected Players"
            text="Select which players appear in the Performance Trends chart. Defaults to most active players."
          />
        </h2>
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
        title="Performance Trends (Net Elo)"
        titleHelp="Shows cumulative net Elo over time for selected players. Hover or tap the chart to inspect exact values at a turn."
        series={trends.series}
        selected={selectedPlayers}
        players={players}
        timeWindow={trendWindow}
        onTimeWindowChange={setTrendWindow}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 items-start">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 2xl:col-span-1">
          <h2 className="font-medium mb-3">
            <InlineExplain
              label="Form (Last 10/20 Turns)"
              text="Short-window performance view to spot who is currently climbing or sliding."
            />
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-700">
                  <Th label="Player" help="Player identity for this row." />
                  <Th label="Net 10" help="Net Elo change for this player across their last 10 filtered turns." />
                  <Th label="Net 20" help="Net Elo change for this player across their last 20 filtered turns." />
                  <Th label="Kill Rate 10" help="Kills divided by turns played in the last 10 turns." />
                  <Th label="Momentum" help="Average Elo delta per recent turn (Net 10 / 10)." />
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

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3 2xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">
              <InlineExplain
                label="Head-to-Head Intelligence"
                text="Pairwise matchup outcomes across turns where both players were on court."
              />
            </h2>
            <div className="flex gap-2 text-xs">
              {(['volume', 'net', 'ratio'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={h2hSort === mode}
                  onClick={() => setH2hSort(mode)}
                  className={`px-2 py-1 border rounded transition-colors ${
                    h2hSort === mode
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {mode === 'volume' ? 'Volume' : mode === 'net' ? 'Net' : 'Ratio'}
                </button>
              ))}
            </div>
          </div>

          <MiniBars
            values={top.map((r) => r.turnsTogether)}
            labels={top.map((r) => `${r.playerAName} vs ${r.playerBName}`)}
          />
          <p className="text-xs text-gray-500">
            <InlineExplain
              label="Top rivalries by shared turns"
              text="Quick view of most frequent matchups in the current filter. Use the table below for detailed kill and Elo breakdowns."
            />
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-700">
                  <Th label="Matchup" help="Player pair compared in this head-to-head row." />
                  <Th label="Turns" help="How many turns both players shared court time." />
                  <Th label="Kills A-B" help="Direct eliminations: player A on player B and vice versa." />
                  <Th label="Kill Ratio A" help="Kills by player A divided by kills by player B (smoothed when denominator is zero)." />
                  <Th label="Net Elo A-B" help="Net Elo differential between A and B during shared turns." />
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

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3 2xl:col-span-2">
          <h2 className="font-medium">
            <InlineExplain
              label="Position Strategy"
              text="Square-level risk/reward and rotation impact based on filtered turn data."
            />
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm text-gray-400 mb-2">
                <InlineExplain label="Elimination Rate by Square" text="How often each square was the eliminated position." />
              </h3>
              <MiniBars
                values={strategy.eliminationByPosition.map((r) => r.count)}
                labels={strategy.eliminationByPosition.map((r) => `#${r.position + 1}`)}
              />
            </div>
            <div>
              <h3 className="text-sm text-gray-400 mb-2">
                <InlineExplain label="Kill Conversion by Square" text="How many kills originated from each square." />
              </h3>
              <MiniBars
                values={strategy.killsByPosition.map((r) => r.count)}
                labels={strategy.killsByPosition.map((r) => `#${r.position + 1}`)}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">
                <InlineExplain label="Safe Square" text="Square with lowest elimination rate in current filter window." />
              </p>
              <p className="font-semibold">#{strategy.safeSquare + 1}</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">
                <InlineExplain label="Pressure Square" text="Square with highest elimination rate in current filter window." />
              </p>
              <p className="font-semibold">#{strategy.pressureSquare + 1}</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">
                <InlineExplain
                  label="Entry Impact (first 3 turns)"
                  text="Average net Elo across a player's first 3 turns after entering at #4."
                />
              </p>
              <p className={`font-semibold ${statClass(strategy.entryImpact.averageThreeTurnNet)}`}>
                {strategy.entryImpact.averageThreeTurnNet}
              </p>
              <p className="text-xs text-gray-500 mt-1">{strategy.entryImpact.entries} entries sampled</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">
                <InlineExplain
                  label="Rotation Efficiency (avg Elo delta)"
                  text="Average turn-by-turn Elo delta for players occupying each square."
                />
              </p>
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

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 2xl:col-span-1">
          <h2 className="font-medium mb-3">
            <InlineExplain
              label="Volatility"
              text="Shows consistency by player. Higher volatility means wider swing between good and bad turns."
            />
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-700">
                  <Th label="Player" help="Player identity for this volatility row." />
                  <Th label="Volatility" help="Standard deviation of non-zero turn deltas; higher means less stable results." />
                  <Th label="Avg Delta/Turn" help="Average non-zero Elo delta per turn for this player." />
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
    </div>
  );
}
