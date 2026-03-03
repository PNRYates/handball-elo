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
    <div className="md:hidden flex justify-end gap-2">
      <button
        type="button"
        disabled={!canUndo}
        onClick={onUndo}
        aria-label="Undo"
        title="Undo"
        className="w-9 h-9 rounded-lg text-base border border-gray-700 bg-gray-900 text-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
      >
        ↶
      </button>
      <button
        type="button"
        disabled={!canRedo}
        onClick={onRedo}
        aria-label="Redo"
        title="Redo"
        className="w-9 h-9 rounded-lg text-base border border-gray-700 bg-gray-900 text-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
      >
        ↷
      </button>
    </div>
  );
}
