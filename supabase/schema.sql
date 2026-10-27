-- ============================================================================
-- Permainan Tradisional Malaysia: database
-- Run once in Supabase → SQL Editor → New query → paste everything → Run.
-- Safe to run again (it only creates what is missing / replaces views).
-- ============================================================================

-- ---------------------------------------------------------------- profiles
-- One row per player (Google, email or guest). Made by the game after the
-- character is created.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  gender text not null check (gender in ('lelaki', 'perempuan')),
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: everyone can read" on public.profiles;
create policy "profiles: everyone can read" on public.profiles
  for select using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------- game records
-- Wins / losses / draws and best score for each game, per player.
create table if not exists public.game_records (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null,
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  best integer not null default 0 check (best >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.game_records enable row level security;

drop policy if exists "records: everyone can read" on public.game_records;
create policy "records: everyone can read" on public.game_records
  for select using (true);

drop policy if exists "records: insert own" on public.game_records;
create policy "records: insert own" on public.game_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "records: update own" on public.game_records;
create policy "records: update own" on public.game_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- play events
-- Every visit to the kampung, game opened, game started and game finished.
-- Players can only add their own; only you (in the dashboard) read them.
create table if not exists public.play_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game_id text,
  kind text not null check (kind in ('visit', 'open', 'start', 'finish')),
  created_at timestamptz not null default now()
);

create index if not exists play_events_game_kind on public.play_events (game_id, kind);
create index if not exists play_events_created on public.play_events (created_at);

alter table public.play_events enable row level security;

drop policy if exists "events: insert own" on public.play_events;
create policy "events: insert own" on public.play_events
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------- leaderboard
-- Top players for each game: most wins, then best score.
create or replace view public.leaderboard
with (security_invoker = on) as
select
  r.game_id,
  r.user_id,
  p.name,
  p.gender,
  p.is_guest,
  r.wins,
  r.losses,
  r.draws,
  r.best,
  rank() over (partition by r.game_id order by r.wins desc, r.best desc) as rank
from public.game_records r
join public.profiles p on p.id = r.user_id
where r.wins + r.losses + r.draws > 0;

grant select on public.leaderboard to anon, authenticated;

-- ---------------------------------------------------------------- your stats
-- For you in the dashboard (SQL Editor): select * from game_stats;
-- Not readable from the game (no grant to anon / authenticated).
create or replace view public.game_stats as
select
  coalesce(game_id, '(kampung)') as game,
  kind,
  count(distinct user_id) as pemain_unik,
  count(*) as jumlah_kali
from public.play_events
group by 1, 2
order by 1, 2;

revoke all on public.game_stats from anon, authenticated;

-- ---------------------------------------------------------------- race times
-- Lumba Basikal: each player's best lap per litar, the bike it was set on,
-- and how many races / wins on that litar. A time can only get better.
create table if not exists public.race_times (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id text not null default 'lumba-basikal',
  track_id text not null check (char_length(track_id) between 1 and 24),
  best_ms integer not null check (best_ms between 20000 and 3600000),
  bike_id text not null check (char_length(bike_id) between 1 and 24),
  races integer not null default 1 check (races >= 0),
  wins integer not null default 0 check (wins >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id, track_id)
);

alter table public.race_times enable row level security;

drop policy if exists "race times: everyone can read" on public.race_times;
create policy "race times: everyone can read" on public.race_times
  for select using (true);

drop policy if exists "race times: insert own" on public.race_times;
create policy "race times: insert own" on public.race_times
  for insert with check (auth.uid() = user_id);

drop policy if exists "race times: update own" on public.race_times;
create policy "race times: update own" on public.race_times
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- an update never makes the best time worse, and counts never go down
create or replace function public.race_times_keep_best()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.best_ms > old.best_ms then
    new.best_ms := old.best_ms;
    new.bike_id := old.bike_id;
  end if;
  new.races := greatest(new.races, old.races);
  new.wins := greatest(new.wins, old.wins);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists race_times_keep_best on public.race_times;
create trigger race_times_keep_best
  before update on public.race_times
  for each row execute function public.race_times_keep_best();

-- fastest first, per litar
create or replace view public.race_leaderboard
with (security_invoker = on) as
select
  t.game_id,
  t.track_id,
  t.user_id,
  p.name,
  p.gender,
  p.is_guest,
  t.best_ms,
  t.bike_id,
  t.races,
  t.wins,
  rank() over (partition by t.game_id, t.track_id order by t.best_ms asc) as rank
from public.race_times t
join public.profiles p on p.id = t.user_id;

grant select on public.race_leaderboard to anon, authenticated;
