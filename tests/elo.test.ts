import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expectedScore,
  calculateEliminationElo,
  calculateEliminationVsAverageElo,
  calculateKillerModeDistribution,
} from '../src/lib/elo.ts';
import { formatDelta, formatRating, roundToInternal } from '../src/lib/rating.ts';

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
  assert.equal(roundToInternal(killerDelta), killerDelta);
  assert.equal(roundToInternal(eliminatedDelta), eliminatedDelta);
});

test('elimination-vs-average returns survivor pool equal to eliminated loss magnitude', () => {
  const { eliminatedDelta, survivorPool } = calculateEliminationVsAverageElo(1000, 1100);
  assert.ok(eliminatedDelta < 0);
  assert.equal(survivorPool, -eliminatedDelta);
});

test('killer mode distribution is zero-sum', () => {
  const { eliminatedDelta, killerDelta, bystanderDeltas } = calculateKillerModeDistribution(
    1000, 1000, [1000, 1000]
  );
  const total = roundToInternal(eliminatedDelta + killerDelta + bystanderDeltas.reduce((s, d) => s + d, 0));
  assert.equal(total, 0);
});

test('killer mode distribution: equal ratings killer gets 2x each bystander', () => {
  const { eliminatedDelta, killerDelta, bystanderDeltas } = calculateKillerModeDistribution(
    1000, 1000, [1000, 1000]
  );
  // pool = 32 * 0.5 = 16; killer weight = 1.0, each bystander = 0.5, total = 2.0
  // killer = 8, each bystander = 4, eliminated = -16
  assert.equal(eliminatedDelta, -16);
  assert.equal(killerDelta, 8);
  assert.deepEqual(bystanderDeltas, [4, 4]);
});

test('killer mode distribution: harder kill earns more for killer', () => {
  const easy = calculateKillerModeDistribution(800, 1200, [1000, 1000]);
  const hard = calculateKillerModeDistribution(1200, 800, [1000, 1000]);
  assert.ok(hard.killerDelta > easy.killerDelta);
});

test('killer mode distribution: weaker bystander earns more than stronger bystander', () => {
  const { bystanderDeltas } = calculateKillerModeDistribution(1000, 1000, [800, 1200]);
  assert.ok(bystanderDeltas[0] > bystanderDeltas[1]);
});

test('formatters display ratings/deltas with one decimal place', () => {
  assert.equal(formatRating(1000), '1000.0');
  assert.equal(formatRating(1000.049), '1000.0');
  assert.equal(formatDelta(2.36), '+2.4');
  assert.equal(formatDelta(-2.36), '-2.4');
  assert.equal(formatDelta(0), '0.0');
});
