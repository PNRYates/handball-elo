import type { Player } from '../../types';

type SelectionState = 'none' | 'killer' | 'eliminated';

const positionColors: Record<number, string> = {
  1: 'border-gray-600 bg-gray-800',
  2: 'border-gray-600 bg-gray-800',
  3: 'border-gray-600 bg-gray-800',
  4: 'border-gray-600 bg-gray-800',
};

const positionLabels: Record<number, string> = {
  1: 'bg-gray-600',
  2: 'bg-gray-600',
  3: 'bg-gray-600',
  4: 'bg-gray-600',
};

const selectionStyles: Record<SelectionState, string> = {
  none: '',
  killer: 'border-green-400 bg-green-500/15 ring-1 ring-green-500/50',
  eliminated: 'border-red-400 bg-red-500/15 ring-1 ring-red-500/50',
};

interface Props {
  position: number;
  player: Player;
  selectionState?: SelectionState;
  onClick?: () => void;
  interactive?: boolean;
}

export default function PositionCard({
  position,
  player,
  selectionState = 'none',
  onClick,
  interactive = true,
}: Props) {
  const baseStyle =
    selectionState === 'none' ? positionColors[position] : selectionStyles[selectionState];

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={`w-full border rounded-lg p-3 flex items-center gap-3 transition-all text-left ${
        interactive ? 'cursor-pointer' : 'cursor-default'
      } ${baseStyle}`}
    >
      <span
        className={`${positionLabels[position]} text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0`}
      >
        {position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{player.name}</div>
      </div>
      {selectionState !== 'none' && (
        <span
          className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
            selectionState === 'killer' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {selectionState === 'killer' ? 'KILL' : 'OUT'}
        </span>
      )}
      <div className="text-right shrink-0">
        <div className="text-sm font-mono font-bold">{player.elo}</div>
      </div>
    </button>
  );
}
