import test from 'node:test';
import assert from 'node:assert/strict';
import { useGameStore, sanitizePersistedGameState, selectActiveWorkspace } from '../src/store/gameStore.ts';


function getWS() {
  return selectActiveWorkspace(useGameStore.getState());
}
function resetStore(): void {
  useGameStore.setState(sanitizePersistedGameState({}));
}

test('undo then redo restores exact current-game state', () => {
  resetStore();
  const store = useGameStore.getState();

  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(3, 0, 'Eve');
  useGameStore.getState().recordTurn(2, 0, 'Frank');

  const beforeUndo = JSON.stringify({
    players: getWS().players,
    court: getWS().court,
    turns: getWS().turns,
    turnNumber: getWS().turnNumber,
    recentEntrants: getWS().recentEntrants,
  });

  useGameStore.getState().undoLastTurn();
  useGameStore.getState().redoLastTurn();

  const afterRedo = JSON.stringify({
    players: getWS().players,
    court: getWS().court,
    turns: getWS().turns,
    turnNumber: getWS().turnNumber,
    recentEntrants: getWS().recentEntrants,
  });

  assert.equal(afterRedo, beforeUndo);
});

test('new turn after undo clears redo stack', () => {
  resetStore();
  const store = useGameStore.getState();

  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(3, 0, 'Eve');
  useGameStore.getState().recordTurn(2, 0, 'Frank');

  useGameStore.getState().undoLastTurn();
  assert.equal(getWS().redoStack.length > 0, true);

  useGameStore.getState().recordTurn(2, 0, 'Grace');
  assert.equal(getWS().redoStack.length, 0);
});

test('store path in no-killer mode uses no-killer Elo model', () => {
  resetStore();
  const store = useGameStore.getState();

  store.setRequireKiller(false);
  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(2, 0, 'Eve');

  const turn = getWS().turns[0];
  const hasKillerChange = turn.eloChanges.some((c) => c.reason === 'elimination_kill');
  const eliminatedDelta = turn.eloChanges.find((c) => c.reason === 'elimination_death')?.delta ?? 0;
  const survivorTotal = turn.eloChanges
    .filter((c) => c.reason === 'survival')
    .reduce((sum, c) => sum + c.delta, 0);

  assert.equal(hasKillerChange, false);
  assert.equal(eliminatedDelta < 0, true);
  assert.equal(survivorTotal, -eliminatedDelta);
});

test('killer mode allows #1 self-kill from store path', () => {
  resetStore();
  const store = useGameStore.getState();

  store.setRequireKiller(true);
  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(0, 0);

  const turn = getWS().turns[0];
  assert.equal(Boolean(turn), true);
  assert.equal(turn.killerPosition, 0);
  assert.equal(turn.eliminatedPosition, 0);
  assert.deepEqual(getWS().court, ['bob', 'cara', 'dan', 'alice']);
});

test('killer mode allows non-#1 self-kill from store path on every square', () => {
  const expectations: Record<number, [string, string, string, string]> = {
    1: ['alice', 'cara', 'dan', 'eve'],
    2: ['alice', 'bob', 'dan', 'eve'],
    3: ['alice', 'bob', 'cara', 'eve'],
  };

  ([1, 2, 3] as const).forEach((eliminatedPos) => {
    resetStore();
    const store = useGameStore.getState();

    store.setRequireKiller(true);
    store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
    useGameStore.getState().recordTurn(eliminatedPos, eliminatedPos, 'Eve');

    const turn = getWS().turns[0];
    assert.equal(Boolean(turn), true);
    assert.equal(turn.killerPosition, eliminatedPos);
    assert.equal(turn.eliminatedPosition, eliminatedPos);
    const hasKillerChange = turn.eloChanges.some((c) => c.reason === 'elimination_kill');
    assert.equal(hasKillerChange, false);
    assert.deepEqual(getWS().court, expectations[eliminatedPos]);
  });
});

test('recent entrants tracks most recent replacements', () => {
  resetStore();
  const store = useGameStore.getState();

  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(3, 0, 'Eve');
  useGameStore.getState().recordTurn(2, 0, 'Frank');
  useGameStore.getState().recordTurn(2, 0, 'Grace');

  const recents = getWS().recentEntrants;
  assert.deepEqual(recents.slice(0, 3), ['grace', 'frank', 'eve']);
});

test('recordTurn ignores invalid non-#1 elimination without replacement name', () => {
  resetStore();
  const store = useGameStore.getState();

  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  const before = JSON.stringify({
    court: getWS().court,
    players: getWS().players,
    turnNumber: getWS().turnNumber,
    turns: getWS().turns,
  });

  useGameStore.getState().recordTurn(2, 0, '   ');

  const after = JSON.stringify({
    court: getWS().court,
    players: getWS().players,
    turnNumber: getWS().turnNumber,
    turns: getWS().turns,
  });

  assert.equal(after, before);
});

test('renameGameInHistory renames/clears target game and ignores missing IDs', () => {
  resetStore();
  const store = useGameStore.getState();
  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(3, 0, 'Eve');
  useGameStore.getState().endGame();

  const gameId = getWS().gameHistory[0].id;
  useGameStore.getState().renameGameInHistory(gameId, 'Friday Session');
  assert.equal(getWS().gameHistory[0].name, 'Friday Session');

  useGameStore.getState().renameGameInHistory(gameId, '   ');
  assert.equal(getWS().gameHistory[0].name, null);

  const before = JSON.stringify(getWS().gameHistory);
  useGameStore.getState().renameGameInHistory(9999, 'No-op');
  const after = JSON.stringify(getWS().gameHistory);
  assert.equal(after, before);
});

test('sanitizePersistedGameState normalizes game names when absent', () => {
  const sanitized = sanitizePersistedGameState({
    gameHistory: [
      {
        id: 1,
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
        turns: [],
        startingCourt: ['a', 'b', 'c', 'd'],
        finalCourt: ['a', 'b', 'c', 'd'],
      },
    ],
  });

  assert.equal(selectActiveWorkspace(sanitized).gameHistory[0].name, null);
});

test('hidePlayer hides off-court players and keeps on-court players visible', () => {
  resetStore();
  const store = useGameStore.getState();

  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(3, 0, 'Eve');

  useGameStore.getState().hidePlayer('dan');
  assert.equal(getWS().hiddenPlayerIds.includes('dan'), true);

  useGameStore.getState().hidePlayer('alice');
  assert.equal(getWS().hiddenPlayerIds.includes('alice'), false);
});
