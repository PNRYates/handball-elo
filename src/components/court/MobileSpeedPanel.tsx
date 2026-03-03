interface MobileSpeedPanelProps {
  requireKiller: boolean;
  killerPos: 0 | 1 | 2 | 3 | null;
  eliminatedPos: 0 | 1 | 2 | 3 | null;
  showBigButtons: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onPickKiller: (pos: 0 | 1 | 2 | 3) => void;
  onPickEliminated: (pos: 0 | 1 | 2 | 3) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export default function MobileSpeedPanel({
  requireKiller,
  killerPos,
  eliminatedPos,
  showBigButtons,
  canUndo,
  canRedo,
  onPickKiller,
  onPickEliminated,
  onUndo,
  onRedo,
}: MobileSpeedPanelProps) {
  const selectingKiller = requireKiller && killerPos === null;
  const positions: Array<0 | 1 | 2 | 3> = [0, 1, 2, 3];

  return (
    <div className={`space-y-2 ${showBigButtons ? '' : 'md:hidden'}`}>
      {showBigButtons && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-3">
          <p className="text-xs text-gray-500">{selectingKiller ? 'Tap killer first' : 'Tap who got out'}</p>
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
        </div>
      )}
      <div className={`flex justify-end gap-2 ${showBigButtons ? '' : ''}`}>
      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        aria-label="Undo"
        title="Undo"
        className="w-9 h-9 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 flex items-center justify-center disabled:text-gray-600 disabled:cursor-not-allowed"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4.5 h-4.5">
          <path
            d="M8 8V4L3 9l5 5v-4h6a5 5 0 1 1-4.47 7.23"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
        <button
        type="button"
        disabled={!canRedo}
        onClick={onRedo}
        aria-label="Redo"
        title="Redo"
        className="w-9 h-9 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 flex items-center justify-center disabled:text-gray-600 disabled:cursor-not-allowed"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4.5 h-4.5">
          <path
            d="M16 8V4l5 5-5 5v-4h-6a5 5 0 1 0 4.47 7.23"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      </div>
    </div>
  );
}
