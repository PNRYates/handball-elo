const DEFAULT_K = 32;
const SURVIVAL_K = 4;
const POSITION_1_SURVIVAL_K = 8;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateEliminationElo(
  killerRating: number,
  eliminatedRating: number,
  k: number = DEFAULT_K
): { killerDelta: number; eliminatedDelta: number } {
  const expected = expectedScore(killerRating, eliminatedRating);
  const killerDelta = Math.round(k * (1 - expected) * 1000) / 1000;
  const eliminatedDelta = Math.round(k * (0 - (1 - expected)) * 1000) / 1000;
  return { killerDelta, eliminatedDelta };
}

export function calculateEliminationVsAverageElo(
  eliminatedRating: number,
  averageOpponentRating: number,
  k: number = DEFAULT_K
): { eliminatedDelta: number; survivorPool: number } {
  const expected = expectedScore(eliminatedRating, averageOpponentRating);
  const eliminatedDelta = Math.round(k * (0 - expected) * 1000) / 1000;
  return { eliminatedDelta, survivorPool: -eliminatedDelta };
}

export function calculateSurvivalBonus(
  survivorRating: number,
  averageOpponentRating: number,
  isPositionOne: boolean
): number {
  const k = isPositionOne ? POSITION_1_SURVIVAL_K : SURVIVAL_K;
  const expected = expectedScore(survivorRating, averageOpponentRating);
  // Ensure survival always grants a visible passive gain.
  // Lower-rated survivors still earn a larger bonus via the expected-score term.
  return Math.max(1, Math.round(k * (0.5 - expected) * 1000) / 1000);
}
