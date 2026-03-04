import test from 'node:test';
import assert from 'node:assert/strict';
import { processTurn } from '../src/lib/gameEngine.ts';
import type { Player } from '../src/types/index.ts';

function createPlayers(): Record<string, Player> {
  const now = Date.now();
  return {
    a: { id: 'a', name: 'Alice', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    b: { id: 'b', name: 'Bob', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    c: { id: 'c', name: 'Cara', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    d: { id: 'd', name: 'Dan', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    e: { id: 'e', name: 'Eve', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
  };
}

test('killer mode: killer delta is ELO-based and turn remains zero-sum', () => {
  const players = createPlayers();
  const result = processTurn(['a', 'b', 'c', 'd'], players, 3, 0, 'Eve', true);

  const killerDelta = result.eloChanges.find((c) => c.reason === 'elimination_kill')?.delta ?? 0;
  const netMilli = result.eloChanges.reduce((sum, c) => sum + Math.round(c.delta * 1000), 0);

  // With equal ratings (all 1000), expected score = 0.5, so killerDelta = K * (1 - 0.5) = 16
  assert.equal(killerDelta, 16);
  assert.equal(netMilli, 0);
  assert.deepEqual(result.newCourt, ['a', 'b', 'c', 'eve']);
  assert.equal(result.newPlayer?.id, 'eve');
});

test('killer mode: higher-rated killer gains less ELO than lower-rated killer', () => {
  const now = Date.now();
  const highKillerPlayers: Record<string, Player> = {
    a: { id: 'a', name: 'Alice', elo: 1400, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    b: { id: 'b', name: 'Bob', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    c: { id: 'c', name: 'Cara', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    d: { id: 'd', name: 'Dan', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    e: { id: 'e', name: 'Eve', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
  };
  const lowKillerPlayers: Record<string, Player> = {
    a: { id: 'a', name: 'Alice', elo: 600, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    b: { id: 'b', name: 'Bob', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    c: { id: 'c', name: 'Cara', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    d: { id: 'd', name: 'Dan', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
    e: { id: 'e', name: 'Eve', elo: 1000, gamesPlayed: 0, eliminations: 0, timesEliminated: 0, createdAt: now },
  };

  const highRatedKillerResult = processTurn(['a', 'b', 'c', 'd'], highKillerPlayers, 3, 0, 'Eve', true);
  const lowRatedKillerResult = processTurn(['a', 'b', 'c', 'd'], lowKillerPlayers, 3, 0, 'Eve', true);

  const highRatedKillerDelta = highRatedKillerResult.eloChanges.find((c) => c.reason === 'elimination_kill')?.delta ?? 0;
  const lowRatedKillerDelta = lowRatedKillerResult.eloChanges.find((c) => c.reason === 'elimination_kill')?.delta ?? 0;

  // A lower-rated killer should gain more ELO for the same elimination than a higher-rated killer
  assert.ok(lowRatedKillerDelta > highRatedKillerDelta, `lowRatedKillerDelta (${lowRatedKillerDelta}) should be > highRatedKillerDelta (${highRatedKillerDelta})`);
});

test('position #1 elimination gets second chance and rotates to #4', () => {
  const players = createPlayers();
  const result = processTurn(['a', 'b', 'c', 'd'], players, 0, 2, undefined, true);

  assert.deepEqual(result.newCourt, ['b', 'c', 'd', 'a']);
  assert.equal(result.newPlayer, null);
});

test('killer mode allows #1 self-kill and scores it like no-killer mode', () => {
  const players = createPlayers();
  const result = processTurn(['a', 'b', 'c', 'd'], players, 0, 0, undefined, true);

  const hasKillerChange = result.eloChanges.some((c) => c.reason === 'elimination_kill');
  const eliminatedDelta = result.eloChanges.find((c) => c.reason === 'elimination_death')?.delta ?? 0;
  const survivorTotal = result.eloChanges
    .filter((c) => c.reason === 'survival')
    .reduce((sum, c) => sum + c.delta, 0);

  assert.equal(hasKillerChange, false);
  assert.equal(eliminatedDelta < 0, true);
  assert.equal(survivorTotal, -eliminatedDelta);
  assert.deepEqual(result.newCourt, ['b', 'c', 'd', 'a']);
});

test('killer mode allows non-#1 self-kill on every square and scores like no-killer mode', () => {
  const expectations: Record<number, [string, string, string, string]> = {
    1: ['a', 'c', 'd', 'eve'],
    2: ['a', 'b', 'd', 'eve'],
    3: ['a', 'b', 'c', 'eve'],
  };

  ([1, 2, 3] as const).forEach((eliminatedPos) => {
    const players = createPlayers();
    const result = processTurn(['a', 'b', 'c', 'd'], players, eliminatedPos, eliminatedPos, 'Eve', true);

    const hasKillerChange = result.eloChanges.some((c) => c.reason === 'elimination_kill');
    const eliminatedDelta = result.eloChanges.find((c) => c.reason === 'elimination_death')?.delta ?? 0;
    const survivorTotal = result.eloChanges
      .filter((c) => c.reason === 'survival')
      .reduce((sum, c) => sum + c.delta, 0);
    const netMilli = result.eloChanges.reduce((sum, c) => sum + Math.round(c.delta * 1000), 0);

    assert.equal(hasKillerChange, false);
    assert.equal(eliminatedDelta < 0, true);
    assert.equal(survivorTotal, -eliminatedDelta);
    assert.equal(netMilli, 0);
    assert.deepEqual(result.newCourt, expectations[eliminatedPos]);
  });
});

test('no-killer mode: eliminated loss is split across 3 survivors', () => {
  const players = createPlayers();
  const result = processTurn(['a', 'b', 'c', 'd'], players, 2, 0, 'Eve', false);

  const hasKillerChange = result.eloChanges.some((c) => c.reason === 'elimination_kill');
  const eliminatedDelta = result.eloChanges.find((c) => c.reason === 'elimination_death')?.delta ?? 0;
  const survivorDeltas = result.eloChanges
    .filter((c) => c.reason === 'survival')
    .map((c) => c.delta)
    .sort((a, b) => a - b);
  const survivorTotal = survivorDeltas.reduce((sum, d) => sum + d, 0);
  const netMilli = result.eloChanges.reduce((sum, c) => sum + Math.round(c.delta * 1000), 0);

  assert.equal(hasKillerChange, false);
  assert.equal(eliminatedDelta, -16);
  assert.deepEqual(survivorDeltas, [5.333, 5.333, 5.334]);
  assert.equal(survivorTotal, 16);
  assert.equal(netMilli, 0);
  assert.deepEqual(result.newCourt, ['a', 'b', 'd', 'eve']);
});


test('no-killer mode keeps milli-ELO survivor split stable after fractional rounds', () => {
  const players = createPlayers();

  // Seed fractional ratings first (from an earlier no-killer style turn).
  players.a.elo = 1005.333;
  players.b.elo = 998.667;
  players.c.elo = 1002.777;
  players.d.elo = 993.223;

  const result = processTurn(['a', 'b', 'c', 'd'], players, 3, 0, 'Eve', false);

  const survivorDeltas = result.eloChanges
    .filter((c) => c.reason === 'survival')
    .map((c) => c.delta)
    .sort((a, b) => a - b);
  const netMilli = result.eloChanges.reduce((sum, c) => sum + Math.round(c.delta * 1000), 0);

  for (const delta of result.eloChanges.map((c) => c.delta)) {
    assert.equal(Number(delta.toFixed(3)), delta);
  }

  assert.deepEqual(survivorDeltas, [5.194, 5.194, 5.196]);
  assert.equal(netMilli, 0);
});

test('processTurn does not mutate original input players map', () => {
  const players = createPlayers();
  const before = JSON.stringify(players);
  void processTurn(['a', 'b', 'c', 'd'], players, 1, 0, 'Eve', true);
  const after = JSON.stringify(players);

  assert.equal(after, before);
});

test('non-#1 elimination requires replacement name', () => {
  const players = createPlayers();

  assert.throws(() => {
    processTurn(['a', 'b', 'c', 'd'], players, 2, 0, undefined, true);
  }, /replacement player name is required/i);
});
