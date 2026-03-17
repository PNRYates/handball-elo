import { useMemo, useRef, useState } from 'react';
import AutocompleteInput from './AutocompleteInput';

interface ReserveLinePanelProps {
  reserveLine: string[];
  reserveHoldPlayerNames: string[];
  addSuggestions: string[];
  onAddName: (name: string, index?: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (name: string, holdTop: boolean) => void;
  onClearHold: (name?: string) => void;
}

export default function ReserveLinePanel({
  reserveLine,
  reserveHoldPlayerNames,
  addSuggestions,
  onAddName,
  onMove,
  onRemove,
  onClearHold,
}: ReserveLinePanelProps) {
  const [draftName, setDraftName] = useState('');
  const [insertAtFront, setInsertAtFront] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const holdMessage = useMemo(() => {
    if (reserveHoldPlayerNames.length === 0) return null;
    return `${reserveHoldPlayerNames.join(', ')} ${reserveHoldPlayerNames.length === 1 ? 'is' : 'are'} holding #1 reserve until returning.`;
  }, [reserveHoldPlayerNames]);

  const commitAdd = (nameOverride?: string) => {
    const value = (nameOverride ?? draftName).trim();
    if (!value) return;
    onAddName(value, insertAtFront ? 0 : undefined);
    setDraftName('');
  };

  return (
    <section className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Reserves Line</h3>
        <span className="text-xs text-gray-500">Drag rows to reorder</span>
      </div>

      {holdMessage && (
        <div className="rounded-md border border-amber-700/70 bg-amber-950/30 p-2 text-xs text-amber-200 space-y-2">
          <p>{holdMessage}</p>
          <div className="flex flex-wrap gap-2">
            {reserveHoldPlayerNames.map((name) => (
              <button
                key={`unhold-${name}`}
                type="button"
                className="underline"
                onClick={() => onClearHold(name.toLowerCase())}
              >
                Remove hold: {name}
              </button>
            ))}
            <button type="button" className="underline" onClick={() => onClearHold()}>Clear all holds</button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {reserveLine.length === 0 && <p className="text-xs text-gray-500">No one in line.</p>}
        {reserveLine.map((name, index) => (
          <div key={`${name}-${index}`} className="space-y-1">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingIndex !== null) setDropIndex(index);
              }}
              onDragLeave={() => setDropIndex((cur) => (cur === index ? null : cur))}
              onDrop={() => {
                if (draggingIndex === null) return;
                onMove(draggingIndex, index);
                setDraggingIndex(null);
                setDropIndex(null);
              }}
              className={`h-2 rounded ${dropIndex === index ? 'bg-amber-500/50' : 'bg-transparent'}`}
            />
            <div
              draggable
              onDragStart={() => setDraggingIndex(index)}
              onDragEnd={() => {
                setDraggingIndex(null);
                setDropIndex(null);
              }}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                draggingIndex === index
                  ? 'border-amber-500 bg-amber-500/10 opacity-70'
                  : 'border-gray-700 bg-gray-900/70'
              }`}
            >
              <span className="text-xs text-gray-500 w-5">{index + 1}</span>
              <span className="text-sm flex-1 truncate">{name}</span>
              <span className="text-xs text-gray-500">⋮⋮</span>
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
          </div>
        ))}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingIndex !== null) setDropIndex(reserveLine.length);
          }}
          onDrop={() => {
            if (draggingIndex === null) return;
            onMove(draggingIndex, reserveLine.length - 1);
            setDraggingIndex(null);
            setDropIndex(null);
          }}
          className={`h-2 rounded ${dropIndex === reserveLine.length ? 'bg-amber-500/50' : 'bg-transparent'}`}
        />
      </div>

      <div className="space-y-2 pt-1 border-t border-gray-700">
        <AutocompleteInput
          value={draftName}
          onChange={setDraftName}
          suggestions={addSuggestions}
          onConfirm={(override) => commitAdd(override)}
          onReset={() => setDraftName('')}
          canSubmit={draftName.trim().length > 0}
          inputRef={addInputRef}
        />
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={insertAtFront}
            onChange={(e) => setInsertAtFront(e.target.checked)}
          />
          Insert at front (#1) instead of back
        </label>
      </div>
    </section>
  );
}
