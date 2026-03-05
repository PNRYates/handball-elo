-- Run this in Supabase SQL editor for a fresh install.
-- For existing installs, run the migration section at the bottom instead.

create table if not exists public.user_game_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id text not null default 'default',
  workspace_name text not null default 'Default',
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

alter table public.user_game_state enable row level security;

create policy "Users can read own game state"
  on public.user_game_state
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own game state"
  on public.user_game_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own game state"
  on public.user_game_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own game state"
  on public.user_game_state
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.published_workspaces (
  slug text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id text not null,
  workspace_name text not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

alter table public.published_workspaces enable row level security;

create policy "Anyone can read published workspaces"
  on public.published_workspaces
  for select
  to anon, authenticated
  using (true);

create policy "Users can publish own workspaces"
  on public.published_workspaces
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own published workspaces"
  on public.published_workspaces
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own published workspaces"
  on public.published_workspaces
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION — run this block if upgrading an existing install (not fresh setup)
-- ─────────────────────────────────────────────────────────────────────────────
-- alter table public.user_game_state
--   add column if not exists workspace_id text not null default 'default',
--   add column if not exists workspace_name text not null default 'Default';
--
-- alter table public.user_game_state drop constraint if exists user_game_state_pkey;
-- alter table public.user_game_state add primary key (user_id, workspace_id);
--
-- create policy "Users can delete own game state"
--   on public.user_game_state
--   for delete
--   to authenticated
--   using (auth.uid() = user_id);
