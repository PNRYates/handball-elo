import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import type { CourtPosition } from '../types';
import type { SelectionPhase } from '../components/court/CourtDisplay';
import InitialSetup from '../components/setup/InitialSetup';
import CourtDisplay from '../components/court/CourtDisplay';
import TurnRecorder from '../components/turn/TurnRecorder';
import MobileSpeedPanel from '../components/court/MobileSpeedPanel';

export default function CourtPage() {
  const requireKiller = useGameStore((s) => s.requireKiller);
  const showReserveButtons = useGameStore((s) => s.showReserveButtons);
  const gameInProgress = useGameStore((s) => s.gameInProgress);
  const court = useGameStore((s) => s.court);
  const players = useGameStore((s) => s.players);
  const turns = useGameStore((s) => s.turns);
  const recordTurn = useGameStore((s) => s.recordTurn);
  const undoLastTurn = useGameStore((s) => s.undoLastTurn);
  const redoLastTurn = useGameStore((s) => s.redoLastTurn);
  const endGame = useGameStore((s) => s.endGame);
  const undoStack = useGameStore((s) => s.undoStack);
  const redoStack = useGameStore((s) => s.redoStack);
  const recentEntrants = useGameStore((s) => s.recentEntrants);

  const [killerPos, setKillerPos] = useState<CourtPosition | null>(null);
  const [eliminatedPos, setEliminatedPos] = useState<CourtPosition | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived state
  const needsNewPlayer = eliminatedPos !== null && eliminatedPos !== 0;
  const phase: SelectionPhase =
    requireKiller
      ? killerPos === null
        ? 'select_killer'
        : eliminatedPos === null
          ? 'select_eliminated'
          : needsNewPlayer
            ? 'input_new_player'
            : 'ready_to_confirm'
      : eliminatedPos === null
        ? 'select_eliminated'
        : needsNewPlayer
          ? 'input_new_player'
          : 'ready_to_confirm';

  const newPlayerOnCourt =
    newPlayerName.trim().length > 0 &&
    court.includes(newPlayerName.trim().toLowerCase());
  const fallbackKillerPos = (eliminatedPos === 0 ? 1 : 0) as CourtPosition;
  const effectiveKillerPos = requireKiller ? killerPos : (eliminatedPos !== null ? fallbackKillerPos : null);
  const canSubmit =
    effectiveKillerPos !== null &&
    eliminatedPos !== null &&
    effectiveKillerPos !== eliminatedPos &&
    (!needsNewPlayer || (newPlayerName.trim().length > 0 && !newPlayerOnCourt));

  const reserves = Object.values(players)
    .filter((p) => !court.includes(p.id))
    .sort((a, b) => b.elo - a.elo)
    .map((p) => p.name);
  const reserveSet = new Set(reserves.map((n) => n.toLowerCase()));
  const recentEntrantNames = recentEntrants
    .map((id) => players[id]?.name ?? id)
    .filter((name) => {
      const id = name.toLowerCase();
      return !court.includes(id) && !reserveSet.has(id);
    });
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const showSpeedPanel = isMobile;
  const showQuickSwap = showReserveButtons;

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const resetSelection = useCallback(() => {
    setKillerPos(null);
    setEliminatedPos(null);
    setNewPlayerName('');
  }, []);

  useEffect(() => {
    return useGameStore.subscribe((nextState, prevState) => {
      if (nextState.turnNumber !== prevState.turnNumber) {
        resetSelection();
      }
    });
  }, [resetSelection]);

  const handleConfirm = useCallback(
    (nameOverride?: string) => {
      const name = nameOverride ?? newPlayerName.trim();
      if (effectiveKillerPos === null || eliminatedPos === null) return;
      if (effectiveKillerPos === eliminatedPos) return;
      if (needsNewPlayer && !name) return;
      if (needsNewPlayer && court.includes(name.toLowerCase())) return;
      recordTurn(
        eliminatedPos,
        effectiveKillerPos,
        needsNewPlayer ? name : undefined
      );
    },
    [effectiveKillerPos, eliminatedPos, needsNewPlayer, newPlayerName, court, recordTurn]
  );

  const handlePositionPress = useCallback(
    (pos: CourtPosition) => {
      if (!requireKiller) {
        if (eliminatedPos !== null) return;
        setEliminatedPos(pos);
        if (pos !== 0) {
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        return;
      }

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
    [requireKiller, killerPos, eliminatedPos]
  );

  const handleQuickSwapPick = useCallback(
    (name: string) => {
      setNewPlayerName(name);
      queueMicrotask(() => {
        handleConfirm(name);
      });
    },
    [handleConfirm]
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
      {showSpeedPanel && (
        <MobileSpeedPanel
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undoLastTurn}
          onRedo={redoLastTurn}
        />
      )}
      <CourtDisplay
        killerPos={requireKiller ? killerPos : null}
        eliminatedPos={eliminatedPos}
        onPositionClick={handlePositionPress}
        phase={phase}
      />
      <TurnRecorder
        killerPos={effectiveKillerPos}
        eliminatedPos={eliminatedPos}
        requireKiller={requireKiller}
        newPlayerName={newPlayerName}
        onNewPlayerNameChange={setNewPlayerName}
        onConfirm={handleConfirm}
        onReset={resetSelection}
        canSubmit={canSubmit}
        needsNewPlayer={needsNewPlayer}
        phase={phase}
        inputRef={inputRef}
        reserves={reserves}
        recentEntrants={recentEntrantNames}
        onQuickSwapPick={handleQuickSwapPick}
        showQuickSwap={showQuickSwap}
      />
      <div className="flex gap-2">
        {!isMobile && (
          <>
            <button
              type="button"
              disabled={!canUndo}
              onClick={undoLastTurn}
              className="flex-1 text-sm bg-gray-800 border border-gray-700 text-gray-300 py-2 rounded-lg transition-colors hover:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:border-gray-700"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4">
                  <path
                    d="M8 8V4L3 9l5 5v-4h6a5 5 0 1 1-4.47 7.23"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Undo
              </span>
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redoLastTurn}
              className="flex-1 text-sm bg-gray-800 border border-gray-700 text-gray-300 py-2 rounded-lg transition-colors hover:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:border-gray-700"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4">
                  <path
                    d="M16 8V4l5 5-5 5v-4h-6a5 5 0 1 0 4.47 7.23"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Redo
              </span>
            </button>
          </>
        )}
        <button
          onClick={() => {
            if (turns.length === 0 || window.confirm('End this game and save it to history?')) {
              endGame();
            }
          }}
          className={`${isMobile ? 'w-full' : 'flex-1'} text-sm bg-gray-800 border border-gray-700 hover:border-amber-600 text-gray-400 py-2 rounded-lg transition-colors`}
        >
          End Game
        </button>
      </div>
    </div>
  );
}
