import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleState } from '../src/lib/sampleData.ts';

test('buildSampleState creates a non-empty completed-history dataset', () => {
  const sample = buildSampleState();
  assert.equal(sample.gameInProgress, false);
  assert.equal(sample.turns.length, 0);
  assert.equal(sample.gameHistory.length > 0, true);
  assert.equal(Object.keys(sample.players).length >= 8, true);
});

test('sample history turns reference known players', () => {
  const sample = buildSampleState();
  const knownIds = new Set(Object.keys(sample.players));

  for (const game of sample.gameHistory) {
    for (const turn of game.turns) {
      assert.equal(knownIds.has(turn.eliminatedPlayerId), true);
      assert.equal(knownIds.has(turn.killerPlayerId), true);
      if (turn.newPlayerId) {
        assert.equal(knownIds.has(turn.newPlayerId), true);
      }
    }
  }
});
