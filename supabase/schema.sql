-- Run this in Supabase SQL editor.
create table if not exists public.user_game_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
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
