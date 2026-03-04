const INTERNAL_DECIMALS = 3;
const UI_DECIMALS = 1;

const INTERNAL_FACTOR = 10 ** INTERNAL_DECIMALS;

function normalizeNegativeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function roundToInternal(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * INTERNAL_FACTOR) / INTERNAL_FACTOR;
  return normalizeNegativeZero(rounded);
}

export function formatRating(value: number, decimals: number = UI_DECIMALS): string {
  return roundToInternal(value).toFixed(decimals);
}

export function formatDelta(value: number, decimals: number = UI_DECIMALS): string {
  const rounded = roundToInternal(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(decimals)}`;
}
