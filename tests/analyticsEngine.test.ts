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
  filterHeadToHeadBySelectedPlayers,
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
  dateStart: null,
  dateEnd: null,
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

test('date range filter restricts turns by timestamp', () => {
  const base = Date.UTC(2026, 2, 1, 12, 0, 0);
  const withDates: CompletedGame[] = [
    {
      ...game1,
      turns: game1.turns.map((t, i) => ({ ...t, timestamp: base + i * 86_400_000 })),
    },
  ];

  const filtered = getFilteredTurns([], withDates, {
    ...filterAll,
    includeCurrentGame: false,
    dateStart: '2026-03-02',
    dateEnd: '2026-03-02',
  });

  assert.equal(filtered.length, 1);
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

test('buildPositionStrategy does not attribute kill conversion in no-killer turns', () => {
  const noKillerTurn: Turn = {
    turnNumber: 0,
    timestamp: Date.now(),
    courtBefore: ['a', 'b', 'c', 'd'],
    eliminatedPlayerId: 'c',
    eliminatedPosition: 2,
    killerPlayerId: 'a',
    killerPosition: 0,
    newPlayerId: 'e',
    courtAfter: ['a', 'b', 'd', 'e'],
    eloChanges: [
      { playerId: 'c', previousElo: 1000, newElo: 984, delta: -16, reason: 'elimination_death' },
      { playerId: 'a', previousElo: 1000, newElo: 1006, delta: 6, reason: 'survival' },
      { playerId: 'b', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
      { playerId: 'd', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
    ],
  };
  const timeline = [{ gameId: 1, gameLabel: 'Game #1', turn: noKillerTurn }];
  const metrics = buildPositionStrategy(timeline);

  assert.equal(metrics.killsByPosition.reduce((s, r) => s + r.count, 0), 0);
});

test('self-kill turns do not count as kills in form metrics but still count deaths', () => {
  const selfKillTurn: Turn = {
    turnNumber: 0,
    timestamp: Date.now(),
    courtBefore: ['a', 'b', 'c', 'd'],
    eliminatedPlayerId: 'a',
    eliminatedPosition: 0,
    killerPlayerId: 'a',
    killerPosition: 0,
    newPlayerId: null,
    courtAfter: ['b', 'c', 'd', 'a'],
    eloChanges: [
      { playerId: 'a', previousElo: 1000, newElo: 995, delta: -5, reason: 'elimination_kill' },
      { playerId: 'a', previousElo: 995, newElo: 985, delta: -10, reason: 'elimination_death' },
      { playerId: 'b', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
      { playerId: 'c', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
      { playerId: 'd', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
    ],
  };

  const result = buildPerformanceTrends(
    [{ gameId: 1, gameLabel: 'Game #1', turn: selfKillTurn }],
    players,
    ['a']
  );
  const metrics = result.formMetrics[0];

  assert.equal(metrics.killRate10, 0);
  assert.equal(metrics.deathRate10, 1);
});

test('self-kill turns do not count in position kill conversion', () => {
  const selfKillTurn: Turn = {
    turnNumber: 0,
    timestamp: Date.now(),
    courtBefore: ['a', 'b', 'c', 'd'],
    eliminatedPlayerId: 'a',
    eliminatedPosition: 0,
    killerPlayerId: 'a',
    killerPosition: 0,
    newPlayerId: null,
    courtAfter: ['b', 'c', 'd', 'a'],
    eloChanges: [
      { playerId: 'a', previousElo: 1000, newElo: 995, delta: -5, reason: 'elimination_kill' },
      { playerId: 'a', previousElo: 995, newElo: 985, delta: -10, reason: 'elimination_death' },
      { playerId: 'b', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
      { playerId: 'c', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
      { playerId: 'd', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
    ],
  };

  const metrics = buildPositionStrategy([{ gameId: 1, gameLabel: 'Game #1', turn: selfKillTurn }]);
  assert.equal(metrics.killsByPosition.reduce((sum, row) => sum + row.count, 0), 0);
  assert.equal(metrics.eliminationByPosition[0].count, 1);
});

test('head-to-head kill counts ignore self-kill turns', () => {
  const selfKillTurn: Turn = {
    turnNumber: 0,
    timestamp: Date.now(),
    courtBefore: ['a', 'b', 'c', 'd'],
    eliminatedPlayerId: 'c',
    eliminatedPosition: 2,
    killerPlayerId: 'c',
    killerPosition: 2,
    newPlayerId: 'e',
    courtAfter: ['a', 'b', 'd', 'e'],
    eloChanges: [
      { playerId: 'c', previousElo: 1000, newElo: 984, delta: -16, reason: 'elimination_death' },
      { playerId: 'a', previousElo: 1000, newElo: 1006, delta: 6, reason: 'survival' },
      { playerId: 'b', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
      { playerId: 'd', previousElo: 1000, newElo: 1005, delta: 5, reason: 'survival' },
    ],
  };

  const rows = buildHeadToHead([{ gameId: 1, gameLabel: 'Game #1', turn: selfKillTurn }], players, 1);
  const ac = rows.find((r) => r.pairKey === 'a::c');
  assert.ok(ac);
  assert.equal(ac?.killsAonB, 0);
  assert.equal(ac?.killsBonA, 0);
});

test('buildPlayerSummary includes players appearing only in courtAfter', () => {
  const turn: Turn = {
    turnNumber: 0,
    timestamp: Date.now(),
    courtBefore: ['a', 'b', 'c', 'd'],
    eliminatedPlayerId: 'd',
    eliminatedPosition: 3,
    killerPlayerId: 'a',
    killerPosition: 0,
    newPlayerId: 'e',
    courtAfter: ['a', 'b', 'c', 'e'],
    eloChanges: [
      { playerId: 'a', previousElo: 1000, newElo: 1010, delta: 10, reason: 'elimination_kill' },
      { playerId: 'd', previousElo: 1000, newElo: 990, delta: -10, reason: 'elimination_death' },
    ],
  };

  const summary = buildPlayerSummary([{ gameId: 1, gameLabel: 'Game #1', turn }]);
  assert.equal(summary.uniquePlayers, 5);
});

test('analytics keep 3-decimal precision for derived delta metrics', () => {
  const turnA: Turn = {
    turnNumber: 0,
    timestamp: Date.now(),
    courtBefore: ['a', 'b', 'c', 'd'],
    eliminatedPlayerId: 'd',
    eliminatedPosition: 3,
    killerPlayerId: 'a',
    killerPosition: 0,
    newPlayerId: null,
    courtAfter: ['a', 'b', 'c', 'd'],
    eloChanges: [
      { playerId: 'a', previousElo: 1000, newElo: 1000.333, delta: 0.333, reason: 'elimination_kill' },
      { playerId: 'd', previousElo: 1000, newElo: 999.667, delta: -0.333, reason: 'elimination_death' },
    ],
  };
  const turnB: Turn = {
    ...turnA,
    turnNumber: 1,
    timestamp: Date.now() + 1,
    eloChanges: [
      { playerId: 'a', previousElo: 1000.333, newElo: 1001, delta: 0.667, reason: 'survival' },
      { playerId: 'd', previousElo: 999.667, newElo: 999, delta: -0.667, reason: 'elimination_death' },
    ],
  };

  const result = buildPerformanceTrends(
    [
      { gameId: 1, gameLabel: 'Game #1', turn: turnA },
      { gameId: 1, gameLabel: 'Game #1', turn: turnB },
    ],
    players,
    ['a']
  );

  const vol = result.volatility.find((row) => row.playerId === 'a');
  assert.ok(vol);
  assert.equal(vol?.averageDelta, 0.5);
  assert.equal(vol?.volatility, 0.167);
});


test('filterHeadToHeadBySelectedPlayers supports one-vs-all and selected-only matchups', () => {
  const rows = [
    { pairKey: 'a::b', playerAId: 'a', playerAName: 'A', playerBId: 'b', playerBName: 'B', turnsTogether: 10, killsAonB: 3, killsBonA: 2, killRatioA: 1.5, netEloAminusB: 5 },
    { pairKey: 'a::c', playerAId: 'a', playerAName: 'A', playerBId: 'c', playerBName: 'C', turnsTogether: 8, killsAonB: 2, killsBonA: 3, killRatioA: 0.67, netEloAminusB: -2 },
    { pairKey: 'b::c', playerAId: 'b', playerAName: 'B', playerBId: 'c', playerBName: 'C', turnsTogether: 6, killsAonB: 1, killsBonA: 1, killRatioA: 1, netEloAminusB: 0 },
    { pairKey: 'd::e', playerAId: 'd', playerAName: 'D', playerBId: 'e', playerBName: 'E', turnsTogether: 4, killsAonB: 1, killsBonA: 0, killRatioA: 1, netEloAminusB: 4 },
  ];

  const noSelection = filterHeadToHeadBySelectedPlayers(rows, []);
  assert.equal(noSelection.length, 4);

  const oneSelected = filterHeadToHeadBySelectedPlayers(rows, ['a']);
  assert.deepEqual(oneSelected.map((r) => r.pairKey), ['a::b', 'a::c']);

  const twoSelected = filterHeadToHeadBySelectedPlayers(rows, ['a', 'b']);
  assert.deepEqual(twoSelected.map((r) => r.pairKey), ['a::b']);

  const threeSelected = filterHeadToHeadBySelectedPlayers(rows, ['a', 'b', 'c']);
  assert.deepEqual(threeSelected.map((r) => r.pairKey), ['a::b', 'a::c', 'b::c']);
});
