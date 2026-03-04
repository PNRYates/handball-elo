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

test('killer mode: killer gets 3x survivor total and turn remains zero-sum', () => {
  const players = createPlayers();
  const result = processTurn(['a', 'b', 'c', 'd'], players, 3, 0, 'Eve', true);

  const survivorTotal = result.eloChanges
    .filter((c) => c.reason === 'survival')
    .reduce((sum, c) => sum + c.delta, 0);
  const killerDelta = result.eloChanges.find((c) => c.reason === 'elimination_kill')?.delta ?? 0;
  const net = result.eloChanges.reduce((sum, c) => sum + c.delta, 0);

  assert.equal(killerDelta, survivorTotal * 3);
  assert.equal(net, 0);
  assert.deepEqual(result.newCourt, ['a', 'b', 'c', 'eve']);
  assert.equal(result.newPlayer?.id, 'eve');
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

test('killer mode allows non-#1 self-kill and scores it like no-killer mode', () => {
  const players = createPlayers();
  const result = processTurn(['a', 'b', 'c', 'd'], players, 2, 2, 'Eve', true);

  const hasKillerChange = result.eloChanges.some((c) => c.reason === 'elimination_kill');
  const eliminatedDelta = result.eloChanges.find((c) => c.reason === 'elimination_death')?.delta ?? 0;
  const survivorTotal = result.eloChanges
    .filter((c) => c.reason === 'survival')
    .reduce((sum, c) => sum + c.delta, 0);
  const net = result.eloChanges.reduce((sum, c) => sum + c.delta, 0);

  assert.equal(hasKillerChange, false);
  assert.equal(eliminatedDelta < 0, true);
  assert.equal(survivorTotal, -eliminatedDelta);
  assert.equal(net, 0);
  assert.deepEqual(result.newCourt, ['a', 'b', 'd', 'eve']);
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
  const net = result.eloChanges.reduce((sum, c) => sum + c.delta, 0);

  assert.equal(hasKillerChange, false);
  assert.equal(eliminatedDelta, -16);
  assert.deepEqual(survivorDeltas, [5, 5, 6]);
  assert.equal(survivorTotal, 16);
  assert.equal(net, 0);
  assert.deepEqual(result.newCourt, ['a', 'b', 'd', 'eve']);
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
