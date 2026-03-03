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
      className="text-[clamp(0.72rem,2.6vw,0.92rem)] bg-gray-900 border border-gray-700 hover:border-amber-500 text-gray-300 hover:text-amber-300 px-[clamp(0.55rem,2.2vw,0.9rem)] py-[clamp(0.35rem,1.4vw,0.6rem)] rounded-md transition-colors whitespace-nowrap max-w-full truncate"
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
          <div className="flex flex-wrap gap-2">
            {reserveNames.map((name) => (
              <Chip key={`reserve-${name}`} name={name} onPick={onPick} />
            ))}
          </div>
        </div>
      )}
      {hasRecents && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Recent Entrants</p>
          <div className="flex flex-wrap gap-2">
            {recentNames.map((name) => (
              <Chip key={`recent-${name}`} name={name} onPick={onPick} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
