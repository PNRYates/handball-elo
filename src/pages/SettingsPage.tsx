import { useGameStore } from '../store/gameStore';

interface SettingsPageProps {
  onLoadSampleData?: () => void;
}

export default function SettingsPage({ onLoadSampleData }: SettingsPageProps) {
  const theme = useGameStore((s) => s.theme);
  const requireKiller = useGameStore((s) => s.requireKiller);
  const showReserveButtons = useGameStore((s) => s.showReserveButtons);
  const setTheme = useGameStore((s) => s.setTheme);
  const setRequireKiller = useGameStore((s) => s.setRequireKiller);
  const setShowReserveButtons = useGameStore((s) => s.setShowReserveButtons);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Settings</h1>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Theme</h2>
          <p className="text-xs text-gray-500 mt-0.5">Switch between light and dark mode.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              theme === 'dark'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
              theme === 'light'
                ? 'bg-amber-600 text-white border-amber-500'
                : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            Light
          </button>
        </div>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Turn Input</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Disable killer selection if you only want to record who was eliminated.
          </p>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm">Require selecting killer</span>
          <button
            type="button"
            role="switch"
            aria-checked={requireKiller}
            onClick={() => setRequireKiller(!requireKiller)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              requireKiller ? 'bg-amber-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                requireKiller ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        {!requireKiller && (
          <p className="text-xs text-amber-400">
            Eliminated player is rated vs average survivor skill, and the loss is split across survivors.
          </p>
        )}

        <label className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm">Show reserve selection buttons</span>
          <button
            type="button"
            role="switch"
            aria-checked={showReserveButtons}
            onClick={() => setShowReserveButtons(!showReserveButtons)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${
              showReserveButtons ? 'bg-amber-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                showReserveButtons ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
        <p className="text-xs text-gray-500">
          Shows quick-tap reserve and recent entrant chips during replacement entry.
        </p>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
        <div>
          <h2 className="font-medium">Sample Dataset</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Load a pre-built sample history so you can explore charts and stats quickly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onLoadSampleData?.()}
          className="px-3 py-2 rounded-lg border text-sm bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
        >
          Switch to sample data
        </button>
      </section>
    </div>
  );
}
