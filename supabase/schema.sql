-- Poker MTT Tracker: Supabase スキーマ
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください。

create table if not exists public.tournaments (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.hands (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  tournament_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists hands_user_tournament_idx on public.hands (user_id, tournament_id);
create index if not exists hands_user_updated_idx on public.hands (user_id, updated_at);
create index if not exists tournaments_user_updated_idx on public.tournaments (user_id, updated_at);

alter table public.tournaments enable row level security;
alter table public.hands enable row level security;

drop policy if exists own_tournaments on public.tournaments;
create policy own_tournaments on public.tournaments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_hands on public.hands;
create policy own_hands on public.hands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
