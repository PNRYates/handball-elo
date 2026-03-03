import type { CourtPosition } from '../../types';

interface MobileSpeedPanelProps {
  requireKiller: boolean;
  killerPos: CourtPosition | null;
  eliminatedPos: CourtPosition | null;
  canUndo: boolean;
  canRedo: boolean;
  onPickKiller: (pos: CourtPosition) => void;
  onPickEliminated: (pos: CourtPosition) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const positions: CourtPosition[] = [0, 1, 2, 3];

export default function MobileSpeedPanel({
  requireKiller,
  killerPos,
  eliminatedPos,
  canUndo,
  canRedo,
  onPickKiller,
  onPickEliminated,
  onUndo,
  onRedo,
}: MobileSpeedPanelProps) {
  const selectingKiller = requireKiller && killerPos === null;

  return (
    <div className="md:hidden bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-3">
      <p className="text-xs text-gray-500">
        {selectingKiller ? 'Tap killer first' : 'Tap who got out'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {positions.map((pos) => {
          const selected = selectingKiller ? killerPos === pos : eliminatedPos === pos;
          const disabled = !selectingKiller && requireKiller && killerPos === pos;
          return (
            <button
              key={pos}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (selectingKiller) {
                  onPickKiller(pos);
                } else {
                  onPickEliminated(pos);
                }
              }}
              className={`py-3.5 rounded-lg text-sm font-semibold border transition-colors ${
                selected
                  ? 'bg-amber-600 text-white border-amber-500'
                  : disabled
                    ? 'bg-gray-900 text-gray-600 border-gray-700 cursor-not-allowed'
                    : 'bg-gray-900 text-gray-200 border-gray-700 hover:border-amber-500'
              }`}
            >
              {selectingKiller ? `KILL #${pos + 1}` : `OUT #${pos + 1}`}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className="py-2.5 rounded-lg text-sm border border-gray-700 bg-gray-900 text-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className="py-2.5 rounded-lg text-sm border border-gray-700 bg-gray-900 text-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
        >
          Redo
        </button>
      </div>
    </div>
  );
}
