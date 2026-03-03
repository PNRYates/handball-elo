export default function InstructionsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold mb-1">Instructions</h1>
        <p className="text-sm text-gray-500">Quick guide for recording turns and reading scores.</p>
      </div>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
        <h2 className="font-medium">Starting a game</h2>
        <p className="text-sm text-gray-400">Go to Court and enter 4 unique player names for positions #1 to #4.</p>
        <p className="text-sm text-gray-400">Returning players keep their existing ELO.</p>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
        <h2 className="font-medium">Recording a turn</h2>
        <p className="text-sm text-gray-400">Default mode: select killer first, then eliminated player.</p>
        <p className="text-sm text-gray-400">If eliminated player is not #1, enter who comes in at #4.</p>
        <p className="text-sm text-gray-400">Confirm to apply ELO changes and move court positions.</p>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
        <h2 className="font-medium">No-killer mode</h2>
        <p className="text-sm text-gray-400">In Settings, you can turn off the killer requirement.</p>
        <p className="text-sm text-gray-400">Then you only choose who got eliminated; the app auto-assigns killer logic for scoring.</p>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
        <h2 className="font-medium">Keyboard shortcuts</h2>
        <p className="text-sm text-gray-400">Press 1-4 to select court positions.</p>
        <p className="text-sm text-gray-400">Press Enter to confirm when ready.</p>
        <p className="text-sm text-gray-400">Press Esc to reset current turn selection.</p>
      </section>

      <section className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
        <h2 className="font-medium">Other pages</h2>
        <p className="text-sm text-gray-400">Leaderboard: rankings and rename players.</p>
        <p className="text-sm text-gray-400">History: full turn-by-turn log for current and past games.</p>
        <p className="text-sm text-gray-400">Analysis: position percentages and player aggression metrics.</p>
      </section>
    </div>
  );
}
