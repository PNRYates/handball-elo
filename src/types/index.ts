export type CourtPosition = 0 | 1 | 2 | 3;

export interface Player {
  id: string;
  name: string;
  elo: number;
  gamesPlayed: number;
  eliminations: number;
  timesEliminated: number;
  createdAt: number;
}

export interface EloChange {
  playerId: string;
  previousElo: number;
  newElo: number;
  delta: number;
  reason: 'elimination_kill' | 'elimination_death' | 'survival';
}

export interface Turn {
  turnNumber: number;
  timestamp: number;
  courtBefore: [string, string, string, string];
  eliminatedPlayerId: string;
  eliminatedPosition: CourtPosition;
  killerPlayerId: string;
  killerPosition: CourtPosition;
  newPlayerId: string | null;
  courtAfter: [string, string, string, string];
  eloChanges: EloChange[];
}

export interface GameSnapshot {
  players: Record<string, Player>;
  court: [string, string, string, string];
  turnNumber: number;
}

export interface CompletedGame {
  id: number;
  name?: string | null;
  startedAt: number;
  endedAt: number;
  turns: Turn[];
  startingCourt: [string, string, string, string];
  finalCourt: [string, string, string, string];
}
