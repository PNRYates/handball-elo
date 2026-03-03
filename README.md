# Handball ELO

React + TypeScript app for tracking handball ELO with:
- Google OAuth login
- Postgres-backed state (Supabase)
- Static or Docker hosting

## 1. Supabase setup

1. Create a Supabase project.
2. In `SQL Editor`, run [`supabase/schema.sql`](./supabase/schema.sql).
3. In `Authentication -> Providers`, enable Google provider.
4. Add your site URLs in `Authentication -> URL Configuration`:
   - Local dev: `http://localhost:5173`
   - Production: your final site URL (for example `https://your-domain.com`)
5. Copy project URL and anon key from `Project Settings -> API`.

## 2. App config

Create `.env` from `.env.example` and fill values:

```bash
cp .env.example .env
```

Set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_HASH_ROUTER=true` only if your static host cannot do SPA rewrites

## 3. Local run

```bash
npm install
npm run dev
```

## 4. Hosting options

### Option A: static host (free)

Works well on Netlify, Cloudflare Pages, Vercel, and GitHub Pages.

Build command:

```bash
npm run build
```

Publish directory: `dist`

For GitHub Pages, set `VITE_USE_HASH_ROUTER=true` unless you configure rewrite fallback to `index.html`.

### Option B: Docker on Unraid

Build and run locally:

```bash
docker compose -f docker-compose.unraid.yml up --build -d
```

The app will be available on `http://<unraid-ip>:8080`.

## 5. Important notes

- The app now syncs game state to `public.user_game_state` per authenticated user.
- Logging out clears the local auth session but keeps server data.
- If sync fails, UI shows `Sync error` in the top bar.
