import { useMemo, useRef, useState } from 'react';
import { formatRating } from '../../lib/rating';
import AutocompleteInput from './AutocompleteInput';

interface ReserveLineItem {
  id: string;
  name: string;
  elo: number;
}

interface ReserveLinePanelProps {
  reserveLine: ReserveLineItem[];
  reserveHoldPlayerNames: string[];
  addSuggestions: string[];
  onAddName: (name: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (playerId: string, holdTop: boolean) => void;
  onClearHold: (playerId?: string) => void;
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
    onAddName(value);
    setDraftName('');
  };

  return (
    <section className="reserve-line-panel bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-2xl font-semibold">Reserves Line</h3>
        <span className="text-lg text-gray-500">Drag rows to reorder</span>
      </div>

      {holdMessage && (
        <div className="rounded-md border border-amber-700/70 bg-amber-950/30 p-2 text-sm text-amber-200 space-y-2">
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
        {reserveLine.length === 0 && <p className="text-sm text-gray-500">No one in line.</p>}
        {reserveLine.map((player, index) => (
          <div key={`${player.id}-${index}`} className="space-y-1">
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
              className={`flex items-center gap-2 rounded-md border px-3 py-2 transition-colors ${
                draggingIndex === index
                  ? 'border-amber-500 bg-amber-500/10 opacity-70'
                  : 'border-gray-700 bg-gray-800'
              }`}
            >
              <span className="text-sm text-gray-500 w-6">{index + 1}</span>
              <span className="text-base font-medium flex-1 truncate">{player.name}</span>
              <span className="text-base font-mono text-gray-300">{formatRating(player.elo)}</span>
              <span className="text-xs text-gray-500">⋮⋮</span>
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-gray-200"
                onClick={() => onRemove(player.id, false)}
              >
                Leave
              </button>
              <button
                type="button"
                className="text-sm text-amber-400 hover:text-amber-300"
                onClick={() => onRemove(player.id, true)}
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

      <div className="space-y-2 pt-2 border-t border-gray-700">
        <AutocompleteInput
          value={draftName}
          onChange={setDraftName}
          suggestions={addSuggestions}
          onConfirm={(override) => commitAdd(override)}
          onReset={() => setDraftName('')}
          canSubmit={draftName.trim().length > 0}
          inputRef={addInputRef}
        />
      </div>
    </section>
  );
}
