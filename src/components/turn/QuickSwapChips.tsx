interface QuickSwapChipsProps {
  reserveNames: string[];
  recentNames: string[];
  onPick: (name: string) => void;
}

function Chip({ name, onPick }: { name: string; onPick: (name: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(name)}
      className="text-xs bg-gray-900 border border-gray-700 hover:border-amber-500 text-gray-300 hover:text-amber-300 px-2.5 py-1 rounded transition-colors"
    >
      {name}
    </button>
  );
}

export default function QuickSwapChips({ reserveNames, recentNames, onPick }: QuickSwapChipsProps) {
  const hasReserves = reserveNames.length > 0;
  const hasRecents = recentNames.length > 0;

  if (!hasReserves && !hasRecents) return null;

  return (
    <div className="space-y-2">
      {hasReserves && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Reserves</p>
          <div className="flex flex-wrap gap-1.5">
            {reserveNames.map((name) => (
              <Chip key={`reserve-${name}`} name={name} onPick={onPick} />
            ))}
          </div>
        </div>
      )}
      {hasRecents && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Recent Entrants</p>
          <div className="flex flex-wrap gap-1.5">
            {recentNames.map((name) => (
              <Chip key={`recent-${name}`} name={name} onPick={onPick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
