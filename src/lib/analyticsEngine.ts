import type { CompletedGame, Turn } from '../types';
import type {
  AnalyticsFilterState,
  EntryImpactMetrics,
  HeadToHeadRow,
  PerformanceTrendsResult,
  PlayerSummary,
  PositionRateRow,
  PositionStrategyMetrics,
  RotationEfficiencyRow,
  TimelineTurn,
  TrendSeriesPoint,
} from '../types/analytics';

function getPlayerDelta(turn: Turn, playerId: string): number {
  return turn.eloChanges
    .filter((c) => c.playerId === playerId)
    .reduce((sum, c) => sum + c.delta, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getFilteredTurns(
  currentTurns: Turn[],
  gameHistory: CompletedGame[],
  filter: AnalyticsFilterState
): TimelineTurn[] {
  const completed = [...gameHistory]
    .sort((a, b) => a.id - b.id)
    .map((g) => ({
      gameId: g.id,
      gameLabel: `Game #${g.id}`,
      turns: g.turns,
    }));

  const currentGameId = (completed[completed.length - 1]?.gameId ?? 0) + 1;
  const current = {
    gameId: currentGameId,
    gameLabel: 'Current Game',
    turns: currentTurns,
  };

  let selectedGames = completed;

  if (filter.scope === 'current_game') {
    selectedGames = [];
  }

  if (filter.scope === 'last_5_games') {
    selectedGames = completed.slice(-5);
  }

  if (filter.scope === 'last_10_games') {
    selectedGames = completed.slice(-10);
  }

  if (filter.scope === 'game_range') {
    const start = filter.rangeStartGameId ?? Number.MIN_SAFE_INTEGER;
    const end = filter.rangeEndGameId ?? Number.MAX_SAFE_INTEGER;
    selectedGames = completed.filter((g) => g.gameId >= start && g.gameId <= end);
  }

  const selected: TimelineTurn[] = [];

  for (const g of selectedGames) {
    for (const turn of g.turns) {
      selected.push({ gameId: g.gameId, gameLabel: g.gameLabel, turn });
    }
  }

  const shouldIncludeCurrent = filter.scope === 'current_game' || filter.includeCurrentGame;

  if (shouldIncludeCurrent) {
    for (const turn of current.turns) {
      selected.push({ gameId: current.gameId, gameLabel: current.gameLabel, turn });
    }
  }

  return selected;
}

function computePlayerList(turns: TimelineTurn[]): string[] {
  const ids = new Set<string>();
  turns.forEach(({ turn }) => {
    turn.courtBefore.forEach((id) => ids.add(id));
    turn.eloChanges.forEach((c) => ids.add(c.playerId));
  });
  return [...ids];
}

export function buildPerformanceTrends(
  turns: TimelineTurn[],
  players: Record<string, { name: string }>,
  selectedPlayerIds?: string[]
): PerformanceTrendsResult {
  const playerIds = selectedPlayerIds?.length ? selectedPlayerIds : computePlayerList(turns);
  const totals: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));
  const series: TrendSeriesPoint[] = [];

  turns.forEach((entry, idx) => {
    for (const id of playerIds) {
      totals[id] += getPlayerDelta(entry.turn, id);
    }
    series.push({
      index: idx + 1,
      label: `${entry.gameLabel} T${entry.turn.turnNumber + 1}`,
      values: { ...totals },
    });
  });

  const formMetrics = playerIds
    .map((id) => {
      const recent20 = turns.slice(-20);
      const recent10 = turns.slice(-10);
      const net20 = recent20.reduce((sum, t) => sum + getPlayerDelta(t.turn, id), 0);
      const net10 = recent10.reduce((sum, t) => sum + getPlayerDelta(t.turn, id), 0);
      const turnsPlayed10 = recent10.filter((t) => t.turn.courtBefore.includes(id)).length;
      const kills10 = recent10.filter((t) => t.turn.killerPlayerId === id).length;
      const deaths10 = recent10.filter((t) => t.turn.eliminatedPlayerId === id).length;
      return {
        playerId: id,
        playerName: players[id]?.name ?? id,
        turnsPlayed: turns.filter((t) => t.turn.courtBefore.includes(id)).length,
        netElo10: net10,
        netElo20: net20,
        killRate10: turnsPlayed10 > 0 ? kills10 / turnsPlayed10 : 0,
        deathRate10: turnsPlayed10 > 0 ? deaths10 / turnsPlayed10 : 0,
        momentum10: recent10.length > 0 ? net10 / recent10.length : 0,
      };
    })
    .sort((a, b) => b.netElo10 - a.netElo10);

  const volatility = playerIds
    .map((id) => {
      const deltas = turns.map((t) => getPlayerDelta(t.turn, id)).filter((d) => d !== 0);
      if (deltas.length === 0) {
        return {
          playerId: id,
          playerName: players[id]?.name ?? id,
          volatility: 0,
          averageDelta: 0,
        };
      }
      const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
      const variance = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length;
      return {
        playerId: id,
        playerName: players[id]?.name ?? id,
        volatility: round2(Math.sqrt(variance)),
        averageDelta: round2(mean),
      };
    })
    .sort((a, b) => b.volatility - a.volatility);

  return { series, formMetrics, volatility };
}

export function buildHeadToHead(
  turns: TimelineTurn[],
  players: Record<string, { name: string }>,
  minTurnsThreshold: number
): HeadToHeadRow[] {
  const map = new Map<string, HeadToHeadRow>();

  const keyFor = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);

  for (const { turn } of turns) {
    const ids = [...turn.courtBefore];

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i];
        const b = ids[j];
        const key = keyFor(a, b);
        const existing = map.get(key) ?? {
          pairKey: key,
          playerAId: a < b ? a : b,
          playerAName: players[a < b ? a : b]?.name ?? (a < b ? a : b),
          playerBId: a < b ? b : a,
          playerBName: players[a < b ? b : a]?.name ?? (a < b ? b : a),
          turnsTogether: 0,
          killsAonB: 0,
          killsBonA: 0,
          killRatioA: 0,
          netEloAminusB: 0,
        };

        existing.turnsTogether += 1;

        const deltaA = getPlayerDelta(turn, existing.playerAId);
        const deltaB = getPlayerDelta(turn, existing.playerBId);
        existing.netEloAminusB += deltaA - deltaB;

        if (turn.killerPlayerId === existing.playerAId && turn.eliminatedPlayerId === existing.playerBId) {
          existing.killsAonB += 1;
        }
        if (turn.killerPlayerId === existing.playerBId && turn.eliminatedPlayerId === existing.playerAId) {
          existing.killsBonA += 1;
        }

        map.set(key, existing);
      }
    }
  }

  return [...map.values()]
    .map((row) => {
      const denom = row.killsBonA === 0 ? Math.max(row.killsAonB, 1) : row.killsBonA;
      return {
        ...row,
        killRatioA: round2(row.killsAonB / denom),
        netEloAminusB: round2(row.netEloAminusB),
      };
    })
    .filter((row) => row.turnsTogether >= minTurnsThreshold)
    .sort((a, b) => b.turnsTogether - a.turnsTogether);
}

function buildRateRows(counts: number[], total: number): PositionRateRow[] {
  return [0, 1, 2, 3].map((pos) => ({
    position: pos as 0 | 1 | 2 | 3,
    count: counts[pos],
    rate: total > 0 ? counts[pos] / total : 0,
  }));
}

function buildRotationEfficiency(turns: TimelineTurn[]): RotationEfficiencyRow[] {
  const totals = [0, 0, 0, 0];
  const samples = [0, 0, 0, 0];

  for (const { turn } of turns) {
    for (let pos = 0; pos < 4; pos++) {
      const pid = turn.courtBefore[pos];
      totals[pos] += getPlayerDelta(turn, pid);
      samples[pos] += 1;
    }
  }

  return [0, 1, 2, 3].map((pos) => ({
    position: pos as 0 | 1 | 2 | 3,
    avgDelta: samples[pos] > 0 ? round2(totals[pos] / samples[pos]) : 0,
    sampleSize: samples[pos],
  }));
}

function buildEntryImpact(turns: TimelineTurn[]): EntryImpactMetrics {
  const entries = turns
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => t.turn.newPlayerId !== null);

  if (entries.length === 0) {
    return { entries: 0, averageThreeTurnNet: 0 };
  }

  let total = 0;

  for (const { t, idx } of entries) {
    const playerId = t.turn.newPlayerId;
    if (!playerId) continue;

    let net = 0;
    let used = 0;

    for (let j = idx; j < turns.length && used < 3; j++) {
      if (turns[j].gameId !== t.gameId) break;
      net += getPlayerDelta(turns[j].turn, playerId);
      used += 1;
    }

    total += net;
  }

  return {
    entries: entries.length,
    averageThreeTurnNet: round2(total / entries.length),
  };
}

export function buildPositionStrategy(turns: TimelineTurn[]): PositionStrategyMetrics {
  const total = turns.length;
  const eliminations = [0, 0, 0, 0];
  const kills = [0, 0, 0, 0];

  for (const { turn } of turns) {
    eliminations[turn.eliminatedPosition] += 1;
    const hasDirectKill = turn.eloChanges.some((change) => change.reason === 'elimination_kill');
    if (hasDirectKill) {
      kills[turn.killerPosition] += 1;
    }
  }

  const eliminationByPosition = buildRateRows(eliminations, total);
  const killsByPosition = buildRateRows(kills, total);
  const rotationEfficiency = buildRotationEfficiency(turns);
  const entryImpact = buildEntryImpact(turns);

  const safeSquare = [...eliminationByPosition].sort((a, b) => a.rate - b.rate)[0].position;
  const pressureSquare = [...eliminationByPosition].sort((a, b) => b.rate - a.rate)[0].position;

  return {
    eliminationByPosition,
    killsByPosition,
    rotationEfficiency,
    entryImpact,
    safeSquare,
    pressureSquare,
  };
}

export function buildPlayerSummary(turns: TimelineTurn[]): PlayerSummary {
  const uniquePlayers = new Set<string>();
  const games = new Set<number>();

  for (const { gameId, turn } of turns) {
    games.add(gameId);
    turn.courtBefore.forEach((id) => uniquePlayers.add(id));
    turn.courtAfter.forEach((id) => uniquePlayers.add(id));
    turn.eloChanges.forEach((change) => uniquePlayers.add(change.playerId));
  }

  return {
    totalTurns: turns.length,
    uniquePlayers: uniquePlayers.size,
    totalGamesRepresented: games.size,
    avgTurnsPerGame: games.size > 0 ? round2(turns.length / games.size) : 0,
  };
}

export function defaultSelectedPlayers(
  turns: TimelineTurn[],
  limit: number = 5
): string[] {
  const counts = new Map<string, number>();
  for (const { turn } of turns) {
    for (const id of turn.courtBefore) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export function topRivalries(rows: HeadToHeadRow[], limit: number = 8): HeadToHeadRow[] {
  return [...rows]
    .sort((a, b) => b.turnsTogether - a.turnsTogether)
    .slice(0, limit);
}
