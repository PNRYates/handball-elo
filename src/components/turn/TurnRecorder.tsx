import type { RefObject } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { CourtPosition } from '../../types';
import type { SelectionPhase } from '../court/CourtDisplay';
import AutocompleteInput from './AutocompleteInput';

interface Props {
  killerPos: CourtPosition | null;
  eliminatedPos: CourtPosition | null;
  requireKiller: boolean;
  newPlayerName: string;
  onNewPlayerNameChange: (name: string) => void;
  onConfirm: (nameOverride?: string) => void;
  onReset: () => void;
  canSubmit: boolean;
  needsNewPlayer: boolean;
  phase: SelectionPhase;
  inputRef: RefObject<HTMLInputElement | null>;
  reserves: string[];
}

export default function TurnRecorder({
  killerPos,
  eliminatedPos,
  requireKiller,
  newPlayerName,
  onNewPlayerNameChange,
  onConfirm,
  onReset,
  canSubmit,
  needsNewPlayer,
  phase,
  inputRef,
  reserves,
}: Props) {
  const court = useGameStore((s) => s.court);
  const players = useGameStore((s) => s.players);

  // Nothing to show until at least eliminated selected (and killer if required)
  if (eliminatedPos === null) return null;
  if (requireKiller && killerPos === null) return null;

  const killer = killerPos !== null ? players[court[killerPos]] : null;
  const eliminated = players[court[eliminatedPos]];
  if (!eliminated) return null;
  if (requireKiller && !killer) return null;

  const isReturningPlayer =
    newPlayerName.trim().length > 0 &&
    players[newPlayerName.trim().toLowerCase()] !== undefined;
  const newPlayerOnCourt =
    newPlayerName.trim().length > 0 &&
    court.includes(newPlayerName.trim().toLowerCase());

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-3">
      {/* Summary */}
      <p className="text-sm">
        {requireKiller && killer ? (
          <>
            <span className="text-green-400 font-medium">{killer.name}</span>
            <span className="text-gray-500"> eliminated </span>
          </>
        ) : (
          <span className="text-gray-500">Eliminated: </span>
        )}
        <span className="text-red-400 font-medium">{eliminated.name}</span>
        <span className="text-gray-600"> (#{eliminatedPos + 1})</span>
        {eliminatedPos === 0 && (
          <span className="text-amber-500 text-xs ml-2">second chance → #4</span>
        )}
      </p>

      {/* New player input */}
      {needsNewPlayer && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            New player entering at #4
          </label>
          <AutocompleteInput
            value={newPlayerName}
            onChange={onNewPlayerNameChange}
            suggestions={reserves}
            onConfirm={onConfirm}
            onReset={onReset}
            canSubmit={canSubmit}
            inputRef={inputRef}
          />
          {isReturningPlayer && !newPlayerOnCourt && (
            <p className="text-xs text-amber-400 mt-1">
              Returning player ({players[newPlayerName.trim().toLowerCase()].elo} ELO)
            </p>
          )}
          {newPlayerOnCourt && (
            <p className="text-xs text-red-400 mt-1">
              This player is already on the court
            </p>
          )}
        </div>
      )}

      {/* Confirm button (visible for discoverability, but Enter works too) */}
      {phase === 'ready_to_confirm' && (
        <button
          onClick={() => onConfirm()}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          Confirm (Enter)
        </button>
      )}

      {/* Esc hint */}
      <p className="text-[10px] text-gray-600 text-center">
        Esc to cancel
      </p>
    </div>
  );
}
