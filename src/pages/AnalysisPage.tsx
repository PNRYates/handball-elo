import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { selectActiveWorkspace, useGameStore } from '../store/gameStore';
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
import { formatDelta, formatRating } from '../lib/rating';
import type { AnalyticsScope, HeadToHeadRow } from '../types/analytics';

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

function InlineExplain({ label, text, className }: { label: string; text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [positionReady, setPositionReady] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const anchor = trigger.getBoundingClientRect();
      const pop = popoverRef.current;
      const popWidth = pop?.offsetWidth ?? 260;
      const popHeight = pop?.offsetHeight ?? 72;
      const next = computePopoverPosition(
        { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height },
        { width: popWidth, height: popHeight },
        { width: window.innerWidth, height: window.innerHeight }
      );
      setPosition({ left: next.left, top: next.top });
      setPositionReady(true);
    };

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    const raf = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => {
          setPositionReady(false);
          setOpen(true);
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          setPositionReady(false);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onClick={() => {
          setPositionReady(false);
          setOpen(true);
        }}
        className={`inline text-inherit underline decoration-dotted underline-offset-4 decoration-gray-500 hover:decoration-gray-300 ${className ?? ''}`}
      >
        {label}
      </button>
      {open && positionReady &&
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

function getTableMaxHeight(limit: number): number {
  return 42 + limit * 34;
}

type FormSortKey = 'playerName' | 'netElo10' | 'netElo20' | 'killRate10' | 'momentum10' | 'volatility' | 'avgDelta';
type FormSortDirection = 'asc' | 'desc';
type H2hSortKey = 'matchup' | 'turnsTogether' | 'kills' | 'killRatioA' | 'netEloAminusB';
type H2hSortDirection = 'asc' | 'desc';


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
  const height = 340;
  const padL = 52;
  const padR = 20;
  const padY = 24;

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPointPx, setHoverPointPx] = useState<{ x: number; y: number } | null>(null);

  const displaySeries = useMemo(() => {
    if (timeWindow === 'all') return series;
    return series.slice(-Number(timeWindow));
  }, [series, timeWindow]);

  const allValues = selected.flatMap((id) => displaySeries.map((p) => p.values[id] ?? 0));
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const span = Math.max(1, max - min);
  const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a78bfa', '#14b8a6'];

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return;

    const updateWidth = (next: number) => setChartWidth(Math.max(760, Math.floor(next)));
    updateWidth(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) updateWidth(entry.contentRect.width);
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

  const syncHover = (clientX: number, clientY: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const usable = chartWidth - padL - padR;
    const ratio = Math.max(0, Math.min(1, (localX - padL) / Math.max(1, usable)));
    const idx = Math.round(ratio * Math.max(0, displaySeries.length - 1));
    setHoveredIndex(idx);
    setHoverPointPx({ x: Math.max(8, localX), y: Math.max(8, localY) });
  };

  const hoverPoint =
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < displaySeries.length
      ? displaySeries[hoveredIndex]
      : null;

  const tooltipWidth = 220;
  const tooltipHeight = 120;
  const tooltipLeft = hoverPointPx
    ? Math.min(Math.max(8, hoverPointPx.x + 14), Math.max(8, chartWidth - tooltipWidth - 8))
    : 8;
  const tooltipTop = hoverPointPx
    ? Math.min(Math.max(8, hoverPointPx.y + 14), Math.max(8, height - tooltipHeight - 8))
    : 8;

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
        className="overflow-x-auto overflow-y-hidden relative"
        onMouseLeave={() => {
          setHoveredIndex(null);
          setHoverPointPx(null);
        }}
      >
        <svg
          viewBox={`0 0 ${chartWidth} ${height}`}
          className="h-[22rem] block"
          style={{ width: chartWidth }}
          onMouseMove={(e) => syncHover(e.clientX, e.clientY, e.currentTarget)}
          onPointerMove={(e) => syncHover(e.clientX, e.clientY, e.currentTarget)}
          onPointerDown={(e) => syncHover(e.clientX, e.clientY, e.currentTarget)}
        >
          <rect x={0} y={0} width={chartWidth} height={height} fill="#111827" rx={8} />

          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={padL} y1={toY(tick)} x2={chartWidth - padR} y2={toY(tick)} stroke="#374151" strokeDasharray="4 4" />
              <text x={padL - 8} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {formatRating(tick)}
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

          {selected.map((id, i) => {
            const points = displaySeries.map((p, idx) => `${toX(idx)},${toY(p.values[id] ?? 0)}`).join(' ');
            return <polyline key={id} points={points} fill="none" stroke={colors[i % colors.length]} strokeWidth="2" />;
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
          <div
            className="absolute bg-gray-950/95 border border-gray-700 rounded p-2 text-xs pointer-events-none"
            style={{ width: tooltipWidth, left: tooltipLeft, top: tooltipTop }}
          >
            <p className="text-gray-400 mb-1">{hoverPoint.label}</p>
            <div className="space-y-1">
              {selected.map((id, i) => (
                <div key={`${id}-tip`} className="flex justify-between gap-2">
                  <span className="inline-flex items-center gap-1 truncate">
                    <span className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                    {players[id]?.name ?? id}
                  </span>
                  <span className="font-mono">{formatDelta(hoverPoint.values[id] ?? 0)}</span>
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

export default function AnalysisPage() {
  const workspace = useGameStore((s) => selectActiveWorkspace(s));
  const setFilter = useGameStore((s) => s.setAnalyticsFilter);
  const setSelectedPlayers = useGameStore((s) => s.setSelectedPlayers);
  const setH2hSort = useGameStore((s) => s.setH2hSort);
  const setH2hPlayers = useGameStore((s) => s.setH2hPlayers);
  const setTrendWindow = useGameStore((s) => s.setTrendWindow);
  const setTableRowsVisible = useGameStore((s) => s.setTableRowsVisible);
  const setH2hRowsVisible = useGameStore((s) => s.setH2hRowsVisible);
  const [formSort, setFormSort] = useState<{ key: FormSortKey; direction: FormSortDirection }>({
    key: 'netElo10',
    direction: 'desc',
  });
  const [h2hTableSort, setH2hTableSort] = useState<{ key: H2hSortKey; direction: H2hSortDirection }>({
    key: 'turnsTogether',
    direction: 'desc',
  });
  const turns = workspace.turns;
  const gameHistory = workspace.gameHistory;
  const players = workspace.players;
  const filter = workspace.analytics.filter;
  const selectedPlayers = workspace.analytics.selectedPlayers;
  const h2hSort = workspace.analytics.h2hSort;
  const h2hPlayers = workspace.analytics.h2hPlayers;
  const trendWindow = workspace.analytics.trendWindow;
  const tableRowsVisible = workspace.analytics.tableRowsVisible;
  const h2hRowsVisible = workspace.analytics.h2hRowsVisible;

  const filtered = useMemo(() => getFilteredTurns(turns, gameHistory, filter), [turns, gameHistory, filter]);
  const defaultPlayers = useMemo(() => defaultSelectedPlayers(filtered), [filtered]);
  const effectiveSelectedPlayers = selectedPlayers.length > 0 ? selectedPlayers : defaultPlayers;

  const trends = useMemo(
    () => buildPerformanceTrends(filtered, players, effectiveSelectedPlayers),
    [filtered, players, effectiveSelectedPlayers]
  );
  const h2h = useMemo(() => buildHeadToHead(filtered, players, filter.minTurnsThreshold), [filtered, players, filter.minTurnsThreshold]);
  const strategy = useMemo(() => buildPositionStrategy(filtered), [filtered]);
  const summary = useMemo(() => buildPlayerSummary(filtered), [filtered]);

  const sortedH2h = useMemo(() => {
    const list = [...h2h];
    if (h2hSort === 'net') return list.sort((a, b) => Math.abs(b.netEloAminusB) - Math.abs(a.netEloAminusB));
    if (h2hSort === 'ratio') return list.sort((a, b) => b.killRatioA - a.killRatioA);
    return list.sort((a, b) => b.turnsTogether - a.turnsTogether);
  }, [h2h, h2hSort]);

  const filteredH2h = useMemo(() => {
    if (h2hPlayers.length === 0) return sortedH2h;
    const selected = new Set(h2hPlayers);
    return sortedH2h.filter((row) => selected.has(row.playerAId) || selected.has(row.playerBId));
  }, [sortedH2h, h2hPlayers]);

  const sortedH2hTableRows = useMemo(() => {
    const rows = [...filteredH2h];
    rows.sort((a, b) => {
      const direction = h2hTableSort.direction === 'asc' ? 1 : -1;
      if (h2hTableSort.key === 'matchup') {
        const left = `${a.playerAName} vs ${a.playerBName}`;
        const right = `${b.playerAName} vs ${b.playerBName}`;
        return left.localeCompare(right) * direction;
      }
      if (h2hTableSort.key === 'kills') {
        const left = a.killsAonB + a.killsBonA;
        const right = b.killsAonB + b.killsBonA;
        return (left - right) * direction;
      }
      return (a[h2hTableSort.key] - b[h2hTableSort.key]) * direction;
    });
    return rows;
  }, [filteredH2h, h2hTableSort]);

  const toggleH2hTableSort = (key: H2hSortKey) => {
    setH2hTableSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'matchup' ? 'asc' : 'desc' }
    );
  };

  const h2hSortArrow = (key: H2hSortKey) => {
    if (h2hTableSort.key !== key) return '↕';
    return h2hTableSort.direction === 'asc' ? '↑' : '↓';
  };

  const top = topRivalries(sortedH2hTableRows, 8);

  const volatilityById = useMemo(() => {
    const map = new Map<string, { volatility: number; averageDelta: number }>();
    for (const row of trends.volatility) map.set(row.playerId, { volatility: row.volatility, averageDelta: row.averageDelta });
    return map;
  }, [trends.volatility]);

  const combinedRows = useMemo(
    () =>
      trends.formMetrics.map((row) => {
        const vol = volatilityById.get(row.playerId);
        return { ...row, volatility: vol?.volatility ?? 0, avgDelta: vol?.averageDelta ?? 0 };
      }),
    [trends.formMetrics, volatilityById]
  );

  const sortedCombinedRows = useMemo(() => {
    const rows = [...combinedRows];
    rows.sort((a, b) => {
      const getValue = (row: (typeof combinedRows)[number]) => row[formSort.key];
      const left = getValue(a);
      const right = getValue(b);
      if (typeof left === 'string' && typeof right === 'string') {
        const result = left.localeCompare(right);
        return formSort.direction === 'asc' ? result : -result;
      }
      const result = Number(left) - Number(right);
      return formSort.direction === 'asc' ? result : -result;
    });
    return rows;
  }, [combinedRows, formSort]);

  const toggleFormSort = (key: FormSortKey) => {
    setFormSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'playerName' ? 'asc' : 'desc' }
    );
  };

  const sortArrow = (key: FormSortKey) => {
    if (formSort.key !== key) return '↕';
    return formSort.direction === 'asc' ? '↑' : '↓';
  };

  if (filtered.length === 0) return <p className="text-gray-500 text-center mt-12">No analysis yet for selected filter.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold mb-1">Analytics Dashboard</h1>
        <p className="text-xs text-gray-500">
          {scopeLabel(filter.scope)} • {summary.totalTurns} turns • {summary.totalGamesRepresented} games
        </p>
      </div>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-medium">
          <InlineExplain label="Filters" text="Adjust the analysis dataset. These controls do not change gameplay data, they only change what is included in charts and tables." />
        </h2>
        <div className="flex flex-wrap gap-2">
          {(['all_time', 'current_game', 'last_5_games', 'last_10_games', 'game_range'] as AnalyticsScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setFilter({ ...filter, scope })}
              className={`px-2.5 py-1.5 text-xs rounded border ${filter.scope === scope ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-900 border-gray-700 text-gray-300'}`}
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
              onChange={(e) => setFilter({ ...filter, includeCurrentGame: e.target.checked })}
            />
            <InlineExplain label="Include current game" text="If checked, analytics include in-progress turns from the active game." />
          </label>
          <label className="inline-flex items-center gap-2">
            <InlineExplain label="Min turns" text="Head-to-head rows with fewer shared turns than this threshold are hidden." />
            <input
              type="number"
              min={1}
              className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
              value={filter.minTurnsThreshold}
              onChange={(e) => setFilter({ ...filter, minTurnsThreshold: Number(e.target.value) || 1 })}
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
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      rangeStartGameId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label className="inline-flex items-center gap-2">
                <span>End</span>
                <input
                  type="number"
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1"
                  value={filter.rangeEndGameId ?? ''}
                  onChange={(e) =>
                    setFilter({
                      ...filter,
                      rangeEndGameId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
            </>
          )}
          <label className="inline-flex items-center gap-2">
            <span>Date from</span>
            <input
              type="date"
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1"
              value={filter.dateStart ?? ''}
              onChange={(e) => setFilter({ ...filter, dateStart: e.target.value || null })}
            />
          </label>
          <label className="inline-flex items-center gap-2">
            <span>Date to</span>
            <input
              type="date"
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1"
              value={filter.dateEnd ?? ''}
              onChange={(e) => setFilter({ ...filter, dateEnd: e.target.value || null })}
            />
          </label>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500"><InlineExplain label="Turns" text="Total turns in the currently selected analytics filter window." /></p>
          <p className="font-mono text-xl">{summary.totalTurns}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500"><InlineExplain label="Players" text="Unique players present in filtered turns." /></p>
          <p className="font-mono text-xl">{summary.uniquePlayers}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500"><InlineExplain label="Games" text="Number of games represented by filtered turns." /></p>
          <p className="font-mono text-xl">{summary.totalGamesRepresented}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-500"><InlineExplain label="Avg turns/game" text="Average number of turns per represented game in the active filter." /></p>
          <p className="font-mono text-xl">{summary.avgTurnsPerGame}</p>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <h2 className="font-medium">
          <InlineExplain label="Selected Players" text="Select which players appear in the Performance Trends chart. Defaults to most active players." />
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(players).sort((a, b) => b.elo - a.elo).map((p) => {
            const active = effectiveSelectedPlayers.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setSelectedPlayers((() => {
                    const base = selectedPlayers.length > 0 ? selectedPlayers : defaultPlayers;
                    return base.includes(p.id)
                      ? base.filter((id) => id !== p.id)
                      : [...base, p.id];
                  })())
                }
                className={`text-xs px-2 py-1 rounded border ${active ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300'}`}
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
        selected={effectiveSelectedPlayers}
        players={players}
        timeWindow={trendWindow}
        onTimeWindowChange={setTrendWindow}
      />

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">
            <InlineExplain label="Form + Volatility" text="Combines short-term performance and consistency metrics in one view." />
          </h2>
          <label className="text-xs flex items-center gap-2">
            <span className="text-gray-400">Visible rows before scroll</span>
            <select value={tableRowsVisible} onChange={(e) => setTableRowsVisible(Number(e.target.value))} className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
              {[8, 12, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className={`overflow-x-auto ${sortedCombinedRows.length > tableRowsVisible ? 'overflow-y-auto' : ''}`} style={sortedCombinedRows.length > tableRowsVisible ? { maxHeight: getTableMaxHeight(tableRowsVisible) } : undefined}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="text-left text-gray-500 border-b border-gray-700">
                <th className="py-1.5 pr-2">
                  <div className="inline-flex items-center gap-1">
                    <InlineExplain label="Player" text="Player identity for this row." />
                    <button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('playerName')} aria-label="Sort by player">
                      {sortArrow('playerName')}
                    </button>
                  </div>
                </th>
                <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Net 10" text="Net Elo change for this player across their last 10 filtered turns." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('netElo10')} aria-label="Sort by net 10">{sortArrow('netElo10')}</button></div></th>
                <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Net 20" text="Net Elo change for this player across their last 20 filtered turns." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('netElo20')} aria-label="Sort by net 20">{sortArrow('netElo20')}</button></div></th>
                <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Kill Rate 10" text="Kills divided by turns played in the last 10 turns." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('killRate10')} aria-label="Sort by kill rate 10">{sortArrow('killRate10')}</button></div></th>
                <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Momentum" text="Average Elo delta per recent turn (Net 10 / 10)." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('momentum10')} aria-label="Sort by momentum">{sortArrow('momentum10')}</button></div></th>
                <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Volatility" text="Standard deviation of non-zero turn deltas; higher means less stable results." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('volatility')} aria-label="Sort by volatility">{sortArrow('volatility')}</button></div></th>
                <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Avg Delta/Turn" text="Average non-zero Elo delta per turn for this player." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleFormSort('avgDelta')} aria-label="Sort by average delta per turn">{sortArrow('avgDelta')}</button></div></th>
              </tr>
            </thead>
            <tbody>
              {sortedCombinedRows.map((row) => (
                <tr key={row.playerId} className="border-b border-gray-800 last:border-b-0">
                  <td className="py-1.5 pr-2 font-medium">{row.playerName}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(row.netElo10)}`}>{formatDelta(row.netElo10)}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(row.netElo20)}`}>{formatDelta(row.netElo20)}</td>
                  <td className="py-1.5 pr-2 font-mono">{pct(row.killRate10)}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(row.momentum10)}`}>{formatDelta(row.momentum10)}</td>
                  <td className="py-1.5 pr-2 font-mono">{formatRating(row.volatility)}</td>
                  <td className={`py-1.5 pr-2 font-mono ${statClass(row.avgDelta)}`}>{formatDelta(row.avgDelta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">
              <InlineExplain label="Head-to-Head Intelligence" text="Pairwise matchup outcomes across turns where both players were on court." />
            </h2>
            <div className="flex gap-2 text-xs">
              {(['volume', 'net', 'ratio'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={h2hSort === mode}
                  onClick={() => setH2hSort(mode)}
                  className={`px-2 py-1 border rounded transition-colors ${h2hSort === mode ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                >
                  {mode === 'volume' ? 'Volume' : mode === 'net' ? 'Net' : 'Ratio'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-400">Filter to specific players</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(players).sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
                const active = h2hPlayers.includes(p.id);
                return (
                  <button
                    key={`h2h-${p.id}`}
                    type="button"
                    onClick={() =>
                      setH2hPlayers(
                        active ? h2hPlayers.filter((id) => id !== p.id) : [...h2hPlayers, p.id]
                      )
                    }
                    className={`text-xs px-2 py-1 rounded border ${active ? 'bg-amber-600 border-amber-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
              {h2hPlayers.length > 0 && (
                <button type="button" onClick={() => setH2hPlayers([])} className="text-xs px-2 py-1 rounded border bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500">
                  Clear
                </button>
              )}
            </div>
          </div>

          <MiniBars values={top.map((r) => r.turnsTogether)} labels={top.map((r) => `${r.playerAName} vs ${r.playerBName}`)} />

          <div className="flex justify-end">
            <label className="text-xs flex items-center gap-2">
              <span className="text-gray-400">Visible rows before scroll</span>
              <select value={h2hRowsVisible} onChange={(e) => setH2hRowsVisible(Number(e.target.value))} className="bg-gray-900 border border-gray-700 rounded px-2 py-1">
                {[10, 20, 40, 80].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          <div className={`overflow-x-auto ${sortedH2hTableRows.length > h2hRowsVisible ? 'overflow-y-auto' : ''}`} style={sortedH2hTableRows.length > h2hRowsVisible ? { maxHeight: getTableMaxHeight(h2hRowsVisible) } : undefined}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="text-left text-gray-500 border-b border-gray-700">
                  <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Matchup" text="Player pair compared in this head-to-head row." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleH2hTableSort('matchup')} aria-label="Sort by matchup">{h2hSortArrow('matchup')}</button></div></th>
                  <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Turns" text="How many turns both players shared court time." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleH2hTableSort('turnsTogether')} aria-label="Sort by turns">{h2hSortArrow('turnsTogether')}</button></div></th>
                  <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Kills A-B" text="Direct eliminations: player A on player B and vice versa." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleH2hTableSort('kills')} aria-label="Sort by kills">{h2hSortArrow('kills')}</button></div></th>
                  <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Kill Ratio A" text="Kills by player A divided by kills by player B (smoothed when denominator is zero)." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleH2hTableSort('killRatioA')} aria-label="Sort by kill ratio">{h2hSortArrow('killRatioA')}</button></div></th>
                  <th className="py-1.5 pr-2"><div className="inline-flex items-center gap-1"><InlineExplain label="Net Elo A-B" text="Net Elo differential between A and B during shared turns." /><button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={() => toggleH2hTableSort('netEloAminusB')} aria-label="Sort by net elo">{h2hSortArrow('netEloAminusB')}</button></div></th>
                </tr>
              </thead>
              <tbody>
                {sortedH2hTableRows.map((row: HeadToHeadRow) => (
                  <tr key={row.pairKey} className="border-b border-gray-800 last:border-b-0">
                    <td className="py-1.5 pr-2">{row.playerAName} vs {row.playerBName}</td>
                    <td className="py-1.5 pr-2 font-mono">{row.turnsTogether}</td>
                    <td className="py-1.5 pr-2 font-mono">{row.killsAonB}-{row.killsBonA}</td>
                    <td className="py-1.5 pr-2 font-mono">{row.killRatioA.toFixed(2)}</td>
                    <td className={`py-1.5 pr-2 font-mono ${statClass(row.netEloAminusB)}`}>{formatDelta(row.netEloAminusB)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
          <h2 className="font-medium">
            <InlineExplain label="Position Strategy" text="Square-level risk/reward and rotation impact based on filtered turn data." />
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm text-gray-400 mb-2">
                <InlineExplain label="Elimination Rate by Square" text="How often each square was the eliminated position." />
              </h3>
              <MiniBars values={strategy.eliminationByPosition.map((r) => r.count)} labels={strategy.eliminationByPosition.map((r) => `#${r.position + 1}`)} />
            </div>
            <div>
              <h3 className="text-sm text-gray-400 mb-2">
                <InlineExplain label="Kill Conversion by Square" text="How many kills originated from each square." />
              </h3>
              <MiniBars values={strategy.killsByPosition.map((r) => r.count)} labels={strategy.killsByPosition.map((r) => `#${r.position + 1}`)} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1"><InlineExplain label="Safe Square" text="Square with lowest elimination rate in current filter window." /></p>
              <p className="font-semibold">#{strategy.safeSquare + 1}</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1"><InlineExplain label="Pressure Square" text="Square with highest elimination rate in current filter window." /></p>
              <p className="font-semibold">#{strategy.pressureSquare + 1}</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1"><InlineExplain label="Entry Impact (first 3 turns)" text="Average net Elo across a player's first 3 turns after entering at #4." /></p>
              <p className={`font-semibold ${statClass(strategy.entryImpact.averageThreeTurnNet)}`}>{formatDelta(strategy.entryImpact.averageThreeTurnNet)}</p>
              <p className="text-xs text-gray-500 mt-1">{strategy.entryImpact.entries} entries sampled</p>
            </div>
            <div className="border border-gray-700 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1"><InlineExplain label="Rotation Efficiency (avg Elo delta)" text="Average turn-by-turn Elo delta for players occupying each square." /></p>
              <div className="text-xs space-y-1 mt-1">
                {strategy.rotationEfficiency.map((r) => (
                  <div key={r.position} className="flex justify-between">
                    <span>#{r.position + 1}</span>
                    <span className={statClass(r.avgDelta)}>{formatDelta(r.avgDelta)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
