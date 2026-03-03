import test from 'node:test';
import assert from 'node:assert/strict';
import { useGameStore, sanitizePersistedGameState } from '../src/store/gameStore.ts';

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
    players: useGameStore.getState().players,
    court: useGameStore.getState().court,
    turns: useGameStore.getState().turns,
    turnNumber: useGameStore.getState().turnNumber,
    recentEntrants: useGameStore.getState().recentEntrants,
  });

  useGameStore.getState().undoLastTurn();
  useGameStore.getState().redoLastTurn();

  const afterRedo = JSON.stringify({
    players: useGameStore.getState().players,
    court: useGameStore.getState().court,
    turns: useGameStore.getState().turns,
    turnNumber: useGameStore.getState().turnNumber,
    recentEntrants: useGameStore.getState().recentEntrants,
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
  assert.equal(useGameStore.getState().redoStack.length > 0, true);

  useGameStore.getState().recordTurn(2, 0, 'Grace');
  assert.equal(useGameStore.getState().redoStack.length, 0);
});

test('store path in no-killer mode uses no-killer Elo model', () => {
  resetStore();
  const store = useGameStore.getState();

  store.setRequireKiller(false);
  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(2, 0, 'Eve');

  const turn = useGameStore.getState().turns[0];
  const hasKillerChange = turn.eloChanges.some((c) => c.reason === 'elimination_kill');
  const eliminatedDelta = turn.eloChanges.find((c) => c.reason === 'elimination_death')?.delta ?? 0;
  const survivorTotal = turn.eloChanges
    .filter((c) => c.reason === 'survival')
    .reduce((sum, c) => sum + c.delta, 0);

  assert.equal(hasKillerChange, false);
  assert.equal(eliminatedDelta < 0, true);
  assert.equal(survivorTotal, -eliminatedDelta);
});

test('recent entrants tracks most recent replacements', () => {
  resetStore();
  const store = useGameStore.getState();

  store.initializeGame(['Alice', 'Bob', 'Cara', 'Dan']);
  useGameStore.getState().recordTurn(3, 0, 'Eve');
  useGameStore.getState().recordTurn(2, 0, 'Frank');
  useGameStore.getState().recordTurn(2, 0, 'Grace');

  const recents = useGameStore.getState().recentEntrants;
  assert.deepEqual(recents.slice(0, 3), ['grace', 'frank', 'eve']);
});
