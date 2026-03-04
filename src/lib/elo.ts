import { roundToInternal } from './rating.ts';

const DEFAULT_K = 32;

// Killer's weight relative to a single bystander's weight at equal ratings.
// At 2, the killer receives 2× the share of each bystander when all ratings are equal.
const KILLER_WEIGHT_MULTIPLIER = 2;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateEliminationElo(
  killerRating: number,
  eliminatedRating: number,
  k: number = DEFAULT_K
): { killerDelta: number; eliminatedDelta: number } {
  const expected = expectedScore(killerRating, eliminatedRating);
  const killerDelta = roundToInternal(k * (1 - expected));
  const eliminatedDelta = roundToInternal(-killerDelta);
  return { killerDelta, eliminatedDelta };
}

export function calculateEliminationVsAverageElo(
  eliminatedRating: number,
  averageOpponentRating: number,
  k: number = DEFAULT_K
): { eliminatedDelta: number; survivorPool: number } {
  const expected = expectedScore(eliminatedRating, averageOpponentRating);
  const eliminatedDelta = roundToInternal(-k * expected);
  return { eliminatedDelta, survivorPool: roundToInternal(-eliminatedDelta) };
}

/**
 * Pool-based killer-mode distribution.
 *
 * 1. The eliminated player loses points proportional to how unexpected their
 *    elimination was (Elo expected score against the average of all 3 survivors).
 * 2. That loss becomes the pool, split among the killer and the two bystanders.
 * 3. Each bystander's share scales with how difficult their survival was:
 *    higher weight for a weaker survivor on a strong court.
 * 4. The killer's weight is KILLER_WEIGHT_MULTIPLIER × a bystander's weight,
 *    scaled by how strong the eliminated player was relative to the killer.
 * 5. Any rounding residual is absorbed into the killer's delta so the result
 *    is structurally zero-sum.
 */
export function calculateKillerModeDistribution(
  eliminatedRating: number,
  killerRating: number,
  bystanderRatings: number[],
  k: number = DEFAULT_K
): { eliminatedDelta: number; killerDelta: number; bystanderDeltas: number[] } {
  const allSurvivorRatings = [killerRating, ...bystanderRatings];
  const survivorAvg =
    allSurvivorRatings.reduce((s, r) => s + r, 0) / allSurvivorRatings.length;

  const pool = roundToInternal(k * expectedScore(eliminatedRating, survivorAvg));
  const eliminatedDelta = roundToInternal(-pool);

  // Bystander weight: probability the court average beats this survivor.
  // Higher for weaker survivors (harder survival → bigger reward).
  const bystanderWeights = bystanderRatings.map((r) => expectedScore(survivorAvg, r));

  // Killer weight: difficulty of the kill, boosted by the multiplier.
  const killerWeight = expectedScore(eliminatedRating, killerRating) * KILLER_WEIGHT_MULTIPLIER;

  const totalWeight = killerWeight + bystanderWeights.reduce((s, w) => s + w, 0);

  const bystanderDeltas = bystanderWeights.map((w) =>
    roundToInternal((w / totalWeight) * pool)
  );
  const bystanderTotal = bystanderDeltas.reduce((s, d) => roundToInternal(s + d), 0);
  // Killer absorbs any rounding residual to guarantee zero-sum.
  const killerDelta = roundToInternal(pool - bystanderTotal);

  return { eliminatedDelta, killerDelta, bystanderDeltas };
}
