import { useGameStore } from '../../store/gameStore';
import type { CourtPosition } from '../../types';
import PositionCard from './PositionCard';

export type SelectionPhase =
  | 'select_killer'
  | 'select_eliminated'
  | 'input_new_player'
  | 'ready_to_confirm';

const phasePrompts: Record<SelectionPhase, string> = {
  select_killer: 'Press 1–4: Who got the kill?',
  select_eliminated: 'Press 1–4: Who was eliminated?',
  input_new_player: 'Enter new player name, then press Enter',
  ready_to_confirm: 'Press Enter to confirm',
};

interface Props {
  killerPos: CourtPosition | null;
  eliminatedPos: CourtPosition | null;
  onPositionClick: (pos: CourtPosition) => void;
  phase: SelectionPhase;
  interactive?: boolean;
}

export default function CourtDisplay({
  killerPos,
  eliminatedPos,
  onPositionClick,
  phase,
  interactive = true,
}: Props) {
  const court = useGameStore((s) => s.court);
  const players = useGameStore((s) => s.players);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const requireKiller = useGameStore((s) => s.requireKiller);
  const prompt = !requireKiller && phase === 'select_eliminated'
    ? 'Press 1–4: Who was eliminated?'
    : phasePrompts[phase];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Turn #{turnNumber + 1}
        </h2>
        <span className="text-xs text-gray-500">{prompt}</span>
      </div>
      {court.map((playerId, i) => {
        const player = players[playerId];
        if (!player) return null;
        const pos = i as CourtPosition;
        const selectionState =
          pos === killerPos
            ? 'killer' as const
            : pos === eliminatedPos
              ? 'eliminated' as const
              : 'none' as const;
        return (
          <PositionCard
            key={playerId}
            position={i + 1}
            player={player}
            selectionState={selectionState}
            interactive={interactive}
            onClick={() => onPositionClick(pos)}
          />
        );
      })}
    </div>
  );
}
