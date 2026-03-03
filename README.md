# Handball Elo Tracker

A React + TypeScript web app for tracking handball rotations, Elo changes, and long-term performance analytics.

## What This App Does

- Records handball turns with Elo updates
- Supports two scoring modes:
  - Killer required
  - No-killer mode (eliminated player's loss split across survivors)
- Stores full game state per user in Supabase (Postgres)
- Authenticates users with Google OAuth
- Provides analytics dashboard for:
  - Performance trends
  - Head-to-head intelligence
  - Position strategy insights

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Styling: Tailwind CSS 4
- State: Zustand
- Routing: React Router
- Backend services: Supabase Auth + PostgREST (via `fetch`)
- Testing: Node built-in test runner (`node --test`)

## Repository Structure

```text
src/
  components/
    court/          # Court UI, position cards, optional speed controls
    setup/          # New-game setup UI
    turn/           # Turn recorder, autocomplete, reserve chips
    ui/             # Shared UI (navbar)
  lib/
    elo.ts          # Elo formulas
    gameEngine.ts   # Turn processing and Elo application
    analyticsEngine.ts # Pure analytics aggregations
    supabaseRest.ts # Auth/session/REST client
    useRemoteSync.ts# Load/save store state to Supabase
  pages/
    CourtPage.tsx
    LeaderboardPage.tsx
    HistoryPage.tsx
    AnalysisPage.tsx
    InstructionsPage.tsx
    SettingsPage.tsx
  store/
    gameStore.ts    # Core state/actions, undo/redo stacks, user settings
  types/
    index.ts        # Domain types (Player, Turn, CompletedGame)
    analytics.ts    # Analytics filter/result types

tests/
  elo.test.ts
  gameEngine.test.ts
  store.test.ts
  analyticsEngine.test.ts

supabase/
  schema.sql        # Table + RLS policies
```

## Core Domain Model

### Players
Each player has:
- `id`, `name`
- `elo`
- cumulative counters (`gamesPlayed`, `eliminations`, `timesEliminated`)

### Court
- 4 slots: positions `#1` to `#4`
- each turn references `courtBefore` and `courtAfter`

### Turn
A turn stores:
- killer/eliminated ids and positions
- Elo change list (`eloChanges`)
- optional entrant (`newPlayerId`)
- timestamps + turn index

### Completed Game
Stores:
- full turn list
- start/end timestamps
- starting/final court snapshots

## Game Flow and Elo Logic

### Standard mode (killer required)
1. Select killer
2. Select eliminated
3. If eliminated is not `#1`, select/enter replacement for `#4`
4. Confirm turn

### No-killer mode
- Select only eliminated player
- Eliminated player is scored against average survivor Elo
- Eliminated Elo loss is distributed across the 3 survivors

### Rotation rules
- Eliminated at `#1`: second chance, moved to `#4`
- Eliminated at `#2/#3/#4`: removed, replacement enters at `#4`

## State Management (Zustand)

`src/store/gameStore.ts` contains:
- live state (`players`, `court`, `turns`, `gameHistory`, etc.)
- user preferences (`theme`, `requireKiller`, big-turn-buttons toggle, reserve-buttons toggle)
- undo/redo stacks for current game turns
- recent entrant cache for quick replacement chips
- safe hydration and persisted-state sanitization

## Persistence and Sync

State is saved server-side per authenticated user in Supabase table:
- `public.user_game_state`

Sync behavior:
- Auth boot resolves session/user
- App hydrates state from Supabase on login
- Store changes are debounced and upserted
- Sync status shown in top nav (`Loading`, `Saving`, `Synced`, `Sync error`)

## Authentication

Implemented in `src/lib/supabaseRest.ts`:
- Google OAuth redirect flow
- session parsing from URL hash
- token refresh and local session storage
- logout endpoint call + session clear

## Analytics Dashboard

`src/pages/AnalysisPage.tsx` + `src/lib/analyticsEngine.ts` provide:

### Filters
- All-time (default)
- Current game
- Last 5 games
- Last 10 games
- Custom game-id range
- Include current game toggle
- Minimum turns threshold

### Performance
- Net Elo trend lines across filtered timeline
- Form metrics (last 10/20 turns)
- Momentum and volatility

### Head-to-head
- Pairwise kill/death outcomes
- Net Elo exchange by matchup
- Sortable rivalry table

### Position strategy
- Elimination rate by square
- Kill conversion by square
- Rotation efficiency (avg Elo delta)
- Entry impact (first 3 turns after entering at `#4`)
- Safe/pressure square indicators

## Settings

Current user-facing settings include:
- Light/dark theme
- Require selecting killer
- Show big turn buttons
- Show reserve selection buttons

## Scripts

```bash
npm run dev       # Start Vite dev server
npm run build     # Type-check + production build
npm run preview   # Preview production build
npm run lint      # ESLint
npm test          # Node test runner over tests/*.test.ts
```

## Testing

### Current test suites
- `elo.test.ts`: Elo formula invariants
- `gameEngine.test.ts`: turn processing and mode-specific behavior
- `store.test.ts`: undo/redo and store-level invariants
- `analyticsEngine.test.ts`: filtering and analytics aggregations

Run all tests:

```bash
npm test
```

## Supabase Setup

1. Create a Supabase project
2. Run `supabase/schema.sql` in SQL editor
3. Enable Google provider in `Authentication -> Providers`
4. Configure redirect URLs in `Authentication -> URL Configuration`
5. Copy project URL + anon/publishable key

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_HASH_ROUTER=true` only if host cannot do SPA rewrites

## Deployment

### Static hosting (recommended)
- Build output: `dist`
- Works with GitHub Pages, Netlify, Cloudflare Pages, Vercel
- For GitHub Pages project sites, keep hash router enabled unless rewrite fallback is configured

### Docker / Unraid

```bash
docker compose -f docker-compose.unraid.yml up --build -d
```

Served via nginx using SPA fallback config.

## Operational Notes

- User data is isolated by Supabase RLS policies
- Logging out removes local session but does not delete remote saved state
- If sync fails, UI remains usable and surfaces sync error state
- Analytics are read-only and computed from stored turns/games (no extra backend tables)
