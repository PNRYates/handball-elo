interface MobileSpeedPanelProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export default function MobileSpeedPanel({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: MobileSpeedPanelProps) {
  return (
    <div className="space-y-2 md:hidden">
      <div className="flex justify-end gap-2">
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
