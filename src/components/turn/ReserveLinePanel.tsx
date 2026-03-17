import { useMemo, useState } from 'react';

interface ReserveLinePanelProps {
  reserveLine: string[];
  reserveHoldPlayerName: string | null;
  suggestedReserveName: string | null;
  onUseSuggested: () => void;
  onAddName: (name: string, index?: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (name: string, holdTop: boolean) => void;
  onClearHold: () => void;
}

export default function ReserveLinePanel({
  reserveLine,
  reserveHoldPlayerName,
  suggestedReserveName,
  onUseSuggested,
  onAddName,
  onMove,
  onRemove,
  onClearHold,
}: ReserveLinePanelProps) {
  const [draftName, setDraftName] = useState('');
  const [insertAtFront, setInsertAtFront] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const holdMessage = useMemo(() => {
    if (!reserveHoldPlayerName) return null;
    return `${reserveHoldPlayerName} is holding #1 reserve until they return.`;
  }, [reserveHoldPlayerName]);

  return (
    <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Reserves Line</h3>
        <span className="text-xs text-gray-500">Drag to reorder</span>
      </div>

      {suggestedReserveName && (
        <button
          type="button"
          onClick={onUseSuggested}
          className="w-full text-sm bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-200 rounded-md px-3 py-2"
        >
          Promote #1 reserve: {suggestedReserveName}
        </button>
      )}

      {holdMessage && (
        <div className="rounded-md border border-amber-700/70 bg-amber-950/30 p-2 text-xs text-amber-200 flex items-center justify-between gap-2">
          <span>{holdMessage}</span>
          <button type="button" className="underline" onClick={onClearHold}>Clear</button>
        </div>
      )}

      <div className="space-y-2">
        {reserveLine.length === 0 && <p className="text-xs text-gray-500">No one in line.</p>}
        {reserveLine.map((name, index) => (
          <div
            key={`${name}-${index}`}
            draggable
            onDragStart={() => setDraggingIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingIndex === null) return;
              onMove(draggingIndex, index);
              setDraggingIndex(null);
            }}
            onDragEnd={() => setDraggingIndex(null)}
            className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900/70 px-2 py-1.5"
          >
            <span className="text-xs text-gray-500 w-5">{index + 1}</span>
            <span className="text-sm flex-1 truncate">{name}</span>
            <button
              type="button"
              className="text-[11px] text-gray-400 hover:text-gray-200"
              onClick={() => onRemove(name, false)}
            >
              Leave
            </button>
            <button
              type="button"
              className="text-[11px] text-amber-400 hover:text-amber-300"
              onClick={() => onRemove(name, true)}
            >
              Hold #1
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-1 border-t border-gray-700">
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Add name to reserve line"
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={insertAtFront}
            onChange={(e) => setInsertAtFront(e.target.checked)}
          />
          Insert at front (#1) instead of back
        </label>
        <button
          type="button"
          onClick={() => {
            onAddName(draftName, insertAtFront ? 0 : undefined);
            setDraftName('');
          }}
          className="w-full text-sm bg-gray-900 border border-gray-700 hover:border-gray-500 rounded px-3 py-2"
        >
          Add to line
        </button>
      </div>
    </section>
  );
}
