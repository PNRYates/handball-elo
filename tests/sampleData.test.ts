import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSampleState } from '../src/lib/sampleData.ts';

test('buildSampleState creates a non-empty completed-history dataset', () => {
  const sample = buildSampleState();
  const workspace = sample.workspaces[sample.activeWorkspaceId];
  assert.ok(workspace);
  assert.equal(workspace.gameInProgress, false);
  assert.equal(workspace.turns.length, 0);
  assert.equal(workspace.gameHistory.length > 0, true);
  assert.equal(Object.keys(workspace.players).length >= 8, true);
});

test('sample history turns reference known players', () => {
  const sample = buildSampleState();
  const workspace = sample.workspaces[sample.activeWorkspaceId];
  assert.ok(workspace);
  const knownIds = new Set(Object.keys(workspace.players));

  for (const game of workspace.gameHistory) {
    for (const turn of game.turns) {
      assert.equal(knownIds.has(turn.eliminatedPlayerId), true);
      assert.equal(knownIds.has(turn.killerPlayerId), true);
      if (turn.newPlayerId) {
        assert.equal(knownIds.has(turn.newPlayerId), true);
      }
    }
  }
});
