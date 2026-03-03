import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedScore,
  calculateEliminationElo,
  calculateEliminationVsAverageElo,
  calculateSurvivalBonus,
} from '../src/lib/elo.ts';

test('expectedScore is complementary', () => {
  const a = expectedScore(1200, 1000);
  const b = expectedScore(1000, 1200);
  assert.ok(Math.abs((a + b) - 1) < 1e-12);
});

test('killer/eliminated Elo change is zero-sum in direct duel', () => {
  const { killerDelta, eliminatedDelta } = calculateEliminationElo(1100, 1000);
  assert.equal(killerDelta + eliminatedDelta, 0);
  assert.ok(killerDelta > 0);
  assert.ok(eliminatedDelta < 0);
});

test('elimination-vs-average returns survivor pool equal to eliminated loss magnitude', () => {
  const { eliminatedDelta, survivorPool } = calculateEliminationVsAverageElo(1000, 1100);
  assert.ok(eliminatedDelta < 0);
  assert.equal(survivorPool, -eliminatedDelta);
});

test('survival bonus has visible minimum gain', () => {
  const highRated = calculateSurvivalBonus(1600, 1000, false);
  const equalRated = calculateSurvivalBonus(1000, 1000, false);
  const posOneEqual = calculateSurvivalBonus(1000, 1000, true);

  assert.ok(highRated >= 1);
  assert.ok(equalRated >= 1);
  assert.ok(posOneEqual >= 1);
});
