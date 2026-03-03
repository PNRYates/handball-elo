import test from 'node:test';
import assert from 'node:assert/strict';
import type { CompletedGame, Turn } from '../src/types/index.ts';
import type { AnalyticsFilterState } from '../src/types/analytics.ts';
import {
  buildHeadToHead,
  buildPerformanceTrends,
  buildPositionStrategy,
  buildPlayerSummary,
  defaultSelectedPlayers,
  getFilteredTurns,
} from '../src/lib/analyticsEngine.ts';

function mkTurn(n: number, killer: string, eliminated: string, killedPos: 0 | 1 | 2 | 3, killerPos: 0 | 1 | 2 | 3, court: [string, string, string, string]): Turn {
  return {
    turnNumber: n,
    timestamp: Date.now() + n,
    courtBefore: [...court],
    eliminatedPlayerId: eliminated,
    eliminatedPosition: killedPos,
    killerPlayerId: killer,
    killerPosition: killerPos,
    newPlayerId: null,
    courtAfter: [...court],
    eloChanges: [
      { playerId: killer, previousElo: 1000, newElo: 1010, delta: 10, reason: 'elimination_kill' },
      { playerId: eliminated, previousElo: 1000, newElo: 990, delta: -10, reason: 'elimination_death' },
    ],
  };
}

const players = {
  a: { name: 'A' },
  b: { name: 'B' },
  c: { name: 'C' },
  d: { name: 'D' },
};

const game1: CompletedGame = {
  id: 1,
  startedAt: 1,
  endedAt: 2,
  turns: [
    mkTurn(0, 'a', 'b', 1, 0, ['a', 'b', 'c', 'd']),
    mkTurn(1, 'c', 'a', 0, 2, ['a', 'b', 'c', 'd']),
  ],
  startingCourt: ['a', 'b', 'c', 'd'],
  finalCourt: ['a', 'b', 'c', 'd'],
};

const game2: CompletedGame = {
  id: 2,
  startedAt: 3,
  endedAt: 4,
  turns: [
    mkTurn(0, 'a', 'c', 2, 0, ['a', 'b', 'c', 'd']),
  ],
  startingCourt: ['a', 'b', 'c', 'd'],
  finalCourt: ['a', 'b', 'c', 'd'],
};

const currentTurns = [mkTurn(0, 'b', 'a', 0, 1, ['a', 'b', 'c', 'd'])];

const filterAll: AnalyticsFilterState = {
  scope: 'all_time',
  includeCurrentGame: true,
  minTurnsThreshold: 1,
  rangeStartGameId: null,
  rangeEndGameId: null,
};

test('getFilteredTurns supports all-time/current/last-N/range filters', () => {
  const all = getFilteredTurns(currentTurns, [game1, game2], filterAll);
  assert.equal(all.length, 4);

  const current = getFilteredTurns(currentTurns, [game1, game2], { ...filterAll, scope: 'current_game' });
  assert.equal(current.length, 1);

  const last5 = getFilteredTurns([], [game1, game2], { ...filterAll, scope: 'last_5_games', includeCurrentGame: false });
  assert.equal(last5.length, 3);

  const range = getFilteredTurns([], [game1, game2], {
    ...filterAll,
    scope: 'game_range',
    includeCurrentGame: false,
    rangeStartGameId: 2,
    rangeEndGameId: 2,
  });
  assert.equal(range.length, 1);
  assert.equal(range[0].gameId, 2);
});

test('buildPerformanceTrends returns deterministic series and form metrics', () => {
  const filtered = getFilteredTurns(currentTurns, [game1, game2], filterAll);
  const selected = defaultSelectedPlayers(filtered, 2);
  const first = buildPerformanceTrends(filtered, players, selected);
  const second = buildPerformanceTrends(filtered, players, selected);

  assert.deepEqual(first.series, second.series);
  assert.equal(first.series.length, filtered.length);
  assert.equal(first.formMetrics.length, selected.length);
});

test('buildHeadToHead aggregates matchup outcomes and net exchange', () => {
  const filtered = getFilteredTurns(currentTurns, [game1, game2], filterAll);
  const rows = buildHeadToHead(filtered, players, 1);
  const ab = rows.find((r) => r.pairKey === 'a::b');

  assert.ok(ab);
  assert.ok((ab?.turnsTogether ?? 0) > 0);
  assert.ok(typeof ab?.netEloAminusB === 'number');
});

test('buildPositionStrategy computes position distributions and entry impact', () => {
  const filtered = getFilteredTurns(currentTurns, [game1, game2], filterAll);
  const metrics = buildPositionStrategy(filtered);

  assert.equal(metrics.eliminationByPosition.reduce((s, r) => s + r.count, 0), filtered.length);
  assert.equal(metrics.killsByPosition.reduce((s, r) => s + r.count, 0), filtered.length);
  assert.equal(metrics.rotationEfficiency.length, 4);
  assert.ok(metrics.safeSquare >= 0 && metrics.safeSquare <= 3);
  assert.ok(metrics.pressureSquare >= 0 && metrics.pressureSquare <= 3);
});

test('buildPlayerSummary handles empty and non-empty datasets', () => {
  const empty = buildPlayerSummary([]);
  assert.equal(empty.totalTurns, 0);
  assert.equal(empty.totalGamesRepresented, 0);

  const filtered = getFilteredTurns(currentTurns, [game1], filterAll);
  const summary = buildPlayerSummary(filtered);
  assert.equal(summary.totalTurns, filtered.length);
  assert.ok(summary.uniquePlayers >= 1);
});
