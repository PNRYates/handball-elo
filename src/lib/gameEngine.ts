import type { CourtPosition, Player, EloChange } from '../types';
import {
  calculateEliminationVsAverageElo,
  calculateKillerModeDistribution,
} from './elo.ts';
import { roundToInternal } from './rating.ts';

export interface TurnResult {
  newCourt: [string, string, string, string];
  updatedPlayers: Record<string, Player>;
  newPlayer: Player | null;
  eloChanges: EloChange[];
}

function applyPlayerDelta(
  updatedPlayers: Record<string, Player>,
  playerId: string,
  delta: number
): { previousElo: number; newElo: number; appliedDelta: number } {
  const previousElo = roundToInternal(updatedPlayers[playerId].elo);
  const newElo = roundToInternal(previousElo + roundToInternal(delta));
  updatedPlayers[playerId].elo = newElo;
  return {
    previousElo,
    newElo,
    appliedDelta: roundToInternal(newElo - previousElo),
  };
}

function splitPool(survivorPool: number, survivorCount: number): number[] {
  const pool = roundToInternal(survivorPool);
  if (survivorCount <= 0) return [];
  const shares = Array.from({ length: survivorCount }, () => roundToInternal(pool / survivorCount));
  const allocated = shares.reduce((sum, share) => roundToInternal(sum + share), 0);
  shares[shares.length - 1] = roundToInternal(shares[shares.length - 1] + (pool - allocated));
  return shares;
}

export function processTurn(
  court: [string, string, string, string],
  players: Record<string, Player>,
  eliminatedPos: CourtPosition,
  killerPos: CourtPosition,
  newPlayerName?: string,
  requireKiller: boolean = true
): TurnResult {
  const eliminatedId = court[eliminatedPos];
  const killerId = court[killerPos];
  if (!eliminatedId || !players[eliminatedId]) {
    throw new Error('Invalid eliminated position or player');
  }
  if (!killerId || !players[killerId]) {
    throw new Error('Invalid killer position or player');
  }
  const isSelfKill = requireKiller && eliminatedId === killerId;

  const updatedPlayers: Record<string, Player> = {};
  for (const key in players) {
    updatedPlayers[key] = { ...players[key] };
  }

  const eloChanges: EloChange[] = [];
  if (requireKiller && !isSelfKill) {
    // Identify the two bystanders (not killer, not eliminated).
    const bystanderIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (i !== eliminatedPos && i !== killerPos) bystanderIds.push(court[i]);
    }

    // Pool-based distribution: eliminated player's loss funds all gains.
    const { eliminatedDelta, killerDelta, bystanderDeltas } = calculateKillerModeDistribution(
      updatedPlayers[eliminatedId].elo,
      updatedPlayers[killerId].elo,
      bystanderIds.map((id) => updatedPlayers[id].elo)
    );

    const killerApplied = applyPlayerDelta(updatedPlayers, killerId, killerDelta);
    updatedPlayers[killerId].eliminations += 1;
    eloChanges.push({
      playerId: killerId,
      previousElo: killerApplied.previousElo,
      newElo: killerApplied.newElo,
      delta: killerApplied.appliedDelta,
      reason: 'elimination_kill',
    });

    const elimApplied = applyPlayerDelta(updatedPlayers, eliminatedId, eliminatedDelta);
    updatedPlayers[eliminatedId].timesEliminated += 1;
    eloChanges.push({
      playerId: eliminatedId,
      previousElo: elimApplied.previousElo,
      newElo: elimApplied.newElo,
      delta: elimApplied.appliedDelta,
      reason: 'elimination_death',
    });

    bystanderIds.forEach((id, idx) => {
      const delta = bystanderDeltas[idx];
      if (delta === 0) return;
      const applied = applyPlayerDelta(updatedPlayers, id, delta);
      eloChanges.push({
        playerId: id,
        previousElo: applied.previousElo,
        newElo: applied.newElo,
        delta: applied.appliedDelta,
        reason: 'survival',
      });
    });
  } else {
    // No-killer mode, or self-kill in killer mode:
    // eliminated player is scored against the average of the 3 survivors,
    // and any ELO loss is split across those 3 survivors.
    const survivorIds = court.filter((id) => id !== eliminatedId);
    const survivorAvg =
      roundToInternal(
        survivorIds.reduce((sum, id) => sum + updatedPlayers[id].elo, 0) / survivorIds.length
      );

    const { eliminatedDelta, survivorPool } = calculateEliminationVsAverageElo(
      updatedPlayers[eliminatedId].elo,
      survivorAvg
    );

    const elimApplied = applyPlayerDelta(updatedPlayers, eliminatedId, eliminatedDelta);
    updatedPlayers[eliminatedId].timesEliminated += 1;
    eloChanges.push({
      playerId: eliminatedId,
      previousElo: elimApplied.previousElo,
      newElo: elimApplied.newElo,
      delta: elimApplied.appliedDelta,
      reason: 'elimination_death',
    });

    const shares = splitPool(survivorPool, survivorIds.length);
    survivorIds.forEach((id, idx) => {
      const share = shares[idx];
      if (share === 0) return;
      const applied = applyPlayerDelta(updatedPlayers, id, share);
      eloChanges.push({
        playerId: id,
        previousElo: applied.previousElo,
        newElo: applied.newElo,
        delta: applied.appliedDelta,
        reason: 'survival',
      });
    });
  }

  // 3. Increment gamesPlayed for all court players
  for (const id of court) {
    updatedPlayers[id].gamesPlayed += 1;
  }

  // 4. Compute new court positions
  let newCourt: [string, string, string, string];
  let newPlayer: Player | null = null;

  if (eliminatedPos === 0) {
    // #1 eliminated: second chance — goes to #4, everyone shifts up
    newCourt = [court[1], court[2], court[3], eliminatedId];
  } else {
    // Non-#1 eliminated: removed, everyone below shifts up, new player at #4
    const remaining: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (i !== eliminatedPos) remaining.push(court[i]);
    }

    const trimmedName = newPlayerName?.trim();
    if (!trimmedName) {
      throw new Error('A replacement player name is required for non-#1 elimination');
    }
    const normalizedId = trimmedName.toLowerCase();

    if (updatedPlayers[normalizedId]) {
      newPlayer = updatedPlayers[normalizedId];
    } else {
      newPlayer = {
        id: normalizedId,
        name: trimmedName,
        elo: 1000,
        gamesPlayed: 0,
        eliminations: 0,
        timesEliminated: 0,
        createdAt: Date.now(),
      };
      updatedPlayers[normalizedId] = newPlayer;
    }

    remaining.push(normalizedId);
    newCourt = remaining as [string, string, string, string];
  }

  // Keep each turn strictly zero-sum to prevent long-run rating inflation/deflation.
  const netDelta = eloChanges.reduce((sum, change) => roundToInternal(sum + change.delta), 0);
  if (netDelta !== 0) {
    const correctedEliminated = updatedPlayers[eliminatedId];
    correctedEliminated.elo = roundToInternal(correctedEliminated.elo - netDelta);

    const eliminatedChange = eloChanges.find(
      (change) => change.playerId === eliminatedId && change.reason === 'elimination_death'
    );
    if (eliminatedChange) {
      eliminatedChange.delta = roundToInternal(eliminatedChange.delta - netDelta);
      eliminatedChange.newElo = correctedEliminated.elo;
    } else {
      eloChanges.push({
        playerId: eliminatedId,
        previousElo: roundToInternal(correctedEliminated.elo + netDelta),
        newElo: correctedEliminated.elo,
        delta: roundToInternal(-netDelta),
        reason: 'elimination_death',
      });
    }
  }

  return { newCourt, updatedPlayers, newPlayer, eloChanges };
}
