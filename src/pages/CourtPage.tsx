import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import type { CourtPosition } from '../types';
import type { SelectionPhase } from '../components/court/CourtDisplay';
import InitialSetup from '../components/setup/InitialSetup';
import CourtDisplay from '../components/court/CourtDisplay';
import TurnRecorder from '../components/turn/TurnRecorder';

export default function CourtPage() {
  const gameInProgress = useGameStore((s) => s.gameInProgress);
  const court = useGameStore((s) => s.court);
  const players = useGameStore((s) => s.players);
  const turns = useGameStore((s) => s.turns);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const recordTurn = useGameStore((s) => s.recordTurn);
  const undoLastTurn = useGameStore((s) => s.undoLastTurn);
  const endGame = useGameStore((s) => s.endGame);
  const lastSnapshot = useGameStore((s) => s._lastSnapshot);

  const [killerPos, setKillerPos] = useState<CourtPosition | null>(null);
  const [eliminatedPos, setEliminatedPos] = useState<CourtPosition | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const needsNewPlayer = eliminatedPos !== null && eliminatedPos !== 0;
  const phase: SelectionPhase =
    killerPos === null
      ? 'select_killer'
      : eliminatedPos === null
        ? 'select_eliminated'
        : needsNewPlayer
          ? 'input_new_player'
          : 'ready_to_confirm';

  const newPlayerOnCourt =
    newPlayerName.trim().length > 0 &&
    court.includes(newPlayerName.trim().toLowerCase());
  const canSubmit =
    killerPos !== null &&
    eliminatedPos !== null &&
    killerPos !== eliminatedPos &&
    (!needsNewPlayer || (newPlayerName.trim().length > 0 && !newPlayerOnCourt));

  const reserves = Object.values(players)
    .filter((p) => !court.includes(p.id))
    .sort((a, b) => b.elo - a.elo)
    .map((p) => p.name);

  const resetSelection = useCallback(() => {
    setKillerPos(null);
    setEliminatedPos(null);
    setNewPlayerName('');
  }, []);

  // Auto-reset on turn advance
  useEffect(() => {
    resetSelection();
  }, [turnNumber, resetSelection]);

  const handleConfirm = useCallback(
    (nameOverride?: string) => {
      const name = nameOverride ?? newPlayerName.trim();
      if (killerPos === null || eliminatedPos === null) return;
      if (killerPos === eliminatedPos) return;
      if (needsNewPlayer && !name) return;
      if (needsNewPlayer && court.includes(name.toLowerCase())) return;
      recordTurn(
        eliminatedPos,
        killerPos,
        needsNewPlayer ? name : undefined
      );
    },
    [killerPos, eliminatedPos, needsNewPlayer, newPlayerName, court, recordTurn]
  );

  const handlePositionPress = useCallback(
    (pos: CourtPosition) => {
      if (killerPos === null) {
        setKillerPos(pos);
      } else if (eliminatedPos === null) {
        if (pos === killerPos) return;
        setEliminatedPos(pos);
        if (pos !== 0) {
          setTimeout(() => inputRef.current?.focus(), 0);
        }
      }
    },
    [killerPos, eliminatedPos]
  );

  // Global keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        e.preventDefault();
        resetSelection();
        (document.activeElement as HTMLElement)?.blur?.();
        return;
      }

      if (e.key === 'Enter' && !isInputFocused && phase === 'ready_to_confirm') {
        e.preventDefault();
        handleConfirm();
        return;
      }

      if (!isInputFocused && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const pos = (parseInt(e.key) - 1) as CourtPosition;
        handlePositionPress(pos);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [canSubmit, phase, handleConfirm, handlePositionPress, resetSelection]);

  if (!gameInProgress) {
    return <InitialSetup />;
  }

  return (
    <div className="space-y-4">
      <CourtDisplay
        killerPos={killerPos}
        eliminatedPos={eliminatedPos}
        onPositionClick={handlePositionPress}
        phase={phase}
      />
      <TurnRecorder
        killerPos={killerPos}
        eliminatedPos={eliminatedPos}
        newPlayerName={newPlayerName}
        onNewPlayerNameChange={setNewPlayerName}
        onConfirm={handleConfirm}
        onReset={resetSelection}
        canSubmit={canSubmit}
        needsNewPlayer={needsNewPlayer}
        phase={phase}
        inputRef={inputRef}
        reserves={reserves}
      />
      <div className="flex gap-2">
        {lastSnapshot && turns.length > 0 && (
          <button
            onClick={undoLastTurn}
            className="flex-1 text-sm bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-400 py-2 rounded-lg transition-colors"
          >
            Undo Last Turn
          </button>
        )}
        <button
          onClick={() => {
            if (turns.length === 0 || window.confirm('End this game and save it to history?')) {
              endGame();
            }
          }}
          className="flex-1 text-sm bg-gray-800 border border-gray-700 hover:border-amber-600 text-gray-400 py-2 rounded-lg transition-colors"
        >
          End Game
        </button>
      </div>
    </div>
  );
}
