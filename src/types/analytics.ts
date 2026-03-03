import type { CourtPosition, Turn } from './index';

export type AnalyticsScope = 'all_time' | 'current_game' | 'last_5_games' | 'last_10_games' | 'game_range';

export interface AnalyticsFilterState {
  scope: AnalyticsScope;
  includeCurrentGame: boolean;
  minTurnsThreshold: number;
  rangeStartGameId: number | null;
  rangeEndGameId: number | null;
  dateStart: string | null;
  dateEnd: string | null;
}

export interface TimelineTurn {
  gameId: number;
  gameLabel: string;
  turn: Turn;
}

export interface TrendSeriesPoint {
  index: number;
  label: string;
  values: Record<string, number>;
}

export interface PlayerFormMetrics {
  playerId: string;
  playerName: string;
  turnsPlayed: number;
  netElo10: number;
  netElo20: number;
  killRate10: number;
  deathRate10: number;
  momentum10: number;
}

export interface PlayerVolatilityMetrics {
  playerId: string;
  playerName: string;
  volatility: number;
  averageDelta: number;
}

export interface HeadToHeadRow {
  pairKey: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  turnsTogether: number;
  killsAonB: number;
  killsBonA: number;
  killRatioA: number;
  netEloAminusB: number;
}

export interface PositionRateRow {
  position: CourtPosition;
  count: number;
  rate: number;
}

export interface RotationEfficiencyRow {
  position: CourtPosition;
  avgDelta: number;
  sampleSize: number;
}

export interface EntryImpactMetrics {
  entries: number;
  averageThreeTurnNet: number;
}

export interface PositionStrategyMetrics {
  eliminationByPosition: PositionRateRow[];
  killsByPosition: PositionRateRow[];
  rotationEfficiency: RotationEfficiencyRow[];
  entryImpact: EntryImpactMetrics;
  safeSquare: CourtPosition;
  pressureSquare: CourtPosition;
}

export interface PlayerSummary {
  totalTurns: number;
  uniquePlayers: number;
  totalGamesRepresented: number;
  avgTurnsPerGame: number;
}

export interface PerformanceTrendsResult {
  series: TrendSeriesPoint[];
  formMetrics: PlayerFormMetrics[];
  volatility: PlayerVolatilityMetrics[];
}
