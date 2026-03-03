import type { CourtPosition, Player, EloChange } from '../types';
import {
  calculateEliminationElo,
  calculateEliminationVsAverageElo,
  calculateSurvivalBonus,
} from './elo.ts';

export interface TurnResult {
  newCourt: [string, string, string, string];
  updatedPlayers: Record<string, Player>;
  newPlayer: Player | null;
  eloChanges: EloChange[];
}

export function processTurn(
  court: [string, string, string, string],
  players: Record<string, Player>,
  eliminatedPos: CourtPosition,
  killerPos: CourtPosition,
  newPlayerName?: string,
  requireKiller: boolean = true
): TurnResult {
  const updatedPlayers: Record<string, Player> = {};
  for (const key in players) {
    updatedPlayers[key] = { ...players[key] };
  }

  const eliminatedId = court[eliminatedPos];
  const killerId = court[killerPos];

  const eloChanges: EloChange[] = [];
  if (requireKiller) {
    // 1. Elimination ELO (killer-based mode)
    const { killerDelta, eliminatedDelta } = calculateEliminationElo(
      updatedPlayers[killerId].elo,
      updatedPlayers[eliminatedId].elo
    );

    const killerPrev = updatedPlayers[killerId].elo;
    updatedPlayers[killerId].elo += killerDelta;
    updatedPlayers[killerId].eliminations += 1;
    eloChanges.push({
      playerId: killerId,
      previousElo: killerPrev,
      newElo: updatedPlayers[killerId].elo,
      delta: killerDelta,
      reason: 'elimination_kill',
    });

    const elimPrev = updatedPlayers[eliminatedId].elo;
    updatedPlayers[eliminatedId].elo += eliminatedDelta;
    updatedPlayers[eliminatedId].timesEliminated += 1;
    eloChanges.push({
      playerId: eliminatedId,
      previousElo: elimPrev,
      newElo: updatedPlayers[eliminatedId].elo,
      delta: eliminatedDelta,
      reason: 'elimination_death',
    });

    // 2. Survival bonuses for bystanders (not killer, not eliminated)
    const avgRating =
      court.map((id) => players[id].elo).reduce((a, b) => a + b, 0) / 4;

    for (let i = 0; i < 4; i++) {
      const pid = court[i];
      if (pid === eliminatedId || pid === killerId) continue;

      const isPos1 = i === 0;
      const bonus = calculateSurvivalBonus(
        updatedPlayers[pid].elo,
        avgRating,
        isPos1
      );
      if (bonus !== 0) {
        const prev = updatedPlayers[pid].elo;
        updatedPlayers[pid].elo += bonus;
        eloChanges.push({
          playerId: pid,
          previousElo: prev,
          newElo: updatedPlayers[pid].elo,
          delta: bonus,
          reason: 'survival',
        });
      }
    }

    // Tune scoring so killer gain is 3x the total passive survivor gain each turn.
    const survivorTotal = eloChanges
      .filter((change) => change.reason === 'survival')
      .reduce((sum, change) => sum + change.delta, 0);
    const targetKillerDelta = Math.round(survivorTotal * 3);

    const killerChange = eloChanges.find(
      (change) => change.playerId === killerId && change.reason === 'elimination_kill'
    );
    if (killerChange) {
      const killerAdjustment = targetKillerDelta - killerChange.delta;
      if (killerAdjustment !== 0) {
        updatedPlayers[killerId].elo += killerAdjustment;
        killerChange.delta += killerAdjustment;
        killerChange.newElo = updatedPlayers[killerId].elo;
      }
    }
  } else {
    // No-killer mode:
    // eliminated player is scored against the average of the 3 survivors,
    // and any ELO loss is split across those 3 survivors.
    const survivorIds = court.filter((id) => id !== eliminatedId);
    const survivorAvg =
      survivorIds.reduce((sum, id) => sum + updatedPlayers[id].elo, 0) / survivorIds.length;

    const { eliminatedDelta, survivorPool } = calculateEliminationVsAverageElo(
      updatedPlayers[eliminatedId].elo,
      survivorAvg
    );

    const elimPrev = updatedPlayers[eliminatedId].elo;
    updatedPlayers[eliminatedId].elo += eliminatedDelta;
    updatedPlayers[eliminatedId].timesEliminated += 1;
    eloChanges.push({
      playerId: eliminatedId,
      previousElo: elimPrev,
      newElo: updatedPlayers[eliminatedId].elo,
      delta: eliminatedDelta,
      reason: 'elimination_death',
    });

    const baseShare = Math.floor(survivorPool / survivorIds.length);
    const remainder = survivorPool % survivorIds.length;

    survivorIds.forEach((id, idx) => {
      const share = baseShare + (idx < remainder ? 1 : 0);
      if (share === 0) return;
      const prev = updatedPlayers[id].elo;
      updatedPlayers[id].elo += share;
      eloChanges.push({
        playerId: id,
        previousElo: prev,
        newElo: updatedPlayers[id].elo,
        delta: share,
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

    const trimmedName = newPlayerName!.trim();
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
  const netDelta = eloChanges.reduce((sum, change) => sum + change.delta, 0);
  if (netDelta !== 0) {
    const correctedEliminated = updatedPlayers[eliminatedId];
    correctedEliminated.elo -= netDelta;

    const eliminatedChange = eloChanges.find(
      (change) => change.playerId === eliminatedId && change.reason === 'elimination_death'
    );
    if (eliminatedChange) {
      eliminatedChange.delta -= netDelta;
      eliminatedChange.newElo = correctedEliminated.elo;
    } else {
      eloChanges.push({
        playerId: eliminatedId,
        previousElo: correctedEliminated.elo + netDelta,
        newElo: correctedEliminated.elo,
        delta: -netDelta,
        reason: 'elimination_death',
      });
    }
  }

  return { newCourt, updatedPlayers, newPlayer, eloChanges };
}
