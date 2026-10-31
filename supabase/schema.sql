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

-- ---------------------------------------------------------------- progression
-- One row per finished game (progress_events): XP and the bounds it must stay
-- in are checked here, and a session can only ever be counted once.
create table if not exists public.progress_events (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 64),
  game_id text not null check (game_id in ('congkak', 'dam', 'sepak-raga', 'ting-ting', 'lumba-basikal')),
  won boolean not null,
  performance real not null check (performance between 0 and 1),
  difficulty real not null check (difficulty between 0.1 and 0.95),
  xp integer not null check (xp between 0 and 700),
  game_xp integer not null check (game_xp between 0 and 300 and game_xp <= xp),
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.progress_events enable row level security;

drop policy if exists "progress events: read own" on public.progress_events;
create policy "progress events: read own" on public.progress_events
  for select using (auth.uid() = user_id);

drop policy if exists "progress events: insert own" on public.progress_events;
create policy "progress events: insert own" on public.progress_events
  for insert with check (auth.uid() = user_id);

-- a real game takes a while: more than 6 results a minute is a replay, not play
-- (games played offline are sent later and simply wait their turn)
create or replace function public.progress_events_pace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    select count(*) from public.progress_events
    where user_id = new.user_id and created_at > now() - interval '60 seconds'
  ) >= 6 then
    raise exception 'too fast' using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists progress_events_pace on public.progress_events;
create trigger progress_events_pace
  before insert on public.progress_events
  for each row execute function public.progress_events_pace();

-- Each player's progress (player_progress): totals the leaderboard shows, and
-- the rest of the profile (skill, records, challenges…) as JSON. XP never goes
-- down, can't run ahead of the games actually recorded (plus a one-off
-- allowance for records kept before progression existed), and the level is
-- always worked out from the XP here.
create table if not exists public.player_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  overall_level integer not null default 1,
  game_xp jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

drop policy if exists "progress: everyone can read" on public.player_progress;
create policy "progress: everyone can read" on public.player_progress
  for select using (true);

drop policy if exists "progress: insert own" on public.player_progress;
create policy "progress: insert own" on public.player_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress: update own" on public.player_progress;
create policy "progress: update own" on public.player_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.player_progress_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  earned integer;
begin
  select coalesce(sum(xp), 0) into earned from public.progress_events where user_id = new.user_id;
  -- 15000: the most the earlier records can seed (5 games × 2500) plus achievements and bonuses
  new.total_xp := least(new.total_xp, earned + 15000);
  if tg_op = 'UPDATE' then
    new.total_xp := greatest(new.total_xp, old.total_xp);
  end if;
  new.overall_level := floor(power(new.total_xp / 100.0, 1 / 1.35))::integer + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists player_progress_check on public.player_progress;
create trigger player_progress_check
  before insert or update on public.player_progress
  for each row execute function public.player_progress_check();

-- highest overall level first
create or replace view public.progress_leaderboard
with (security_invoker = on) as
select
  g.user_id,
  p.name,
  p.gender,
  p.is_guest,
  g.total_xp,
  g.overall_level,
  rank() over (order by g.total_xp desc) as rank
from public.player_progress g
join public.profiles p on p.id = g.user_id
where g.total_xp > 0;

grant select on public.progress_leaderboard to anon, authenticated;

-- ---------------------------------------------------------------- multiplayer
-- Online 1v1 matches between two players (phase 1: invite by code / link).
-- A match: who hosts (seat 0) and who joined (seat 1), which game, a shared
-- random seed, and how it ended. Every move is a row in match_moves (in
-- order), so a player who reloads can catch up. Moves also travel live over
-- Supabase Realtime (channel `match:<id>`); the table is the record.
-- Rows are only written through the functions below.

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game_id text not null,
  seed integer not null,
  host uuid not null references public.profiles (id) on delete cascade,
  guest uuid references public.profiles (id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'done', 'abandoned')),
  opponent_kind text not null default 'human' check (opponent_kind in ('human', 'ai')),
  winner_seat smallint check (winner_seat in (0, 1)),
  result jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create index if not exists matches_host_idx on public.matches (host, created_at desc);
create index if not exists matches_guest_idx on public.matches (guest, created_at desc);

alter table public.matches enable row level security;

drop policy if exists "matches: players read" on public.matches;
create policy "matches: players read" on public.matches
  for select using (auth.uid() in (host, guest));

create table if not exists public.match_moves (
  match_id uuid not null references public.matches (id) on delete cascade,
  seq integer not null check (seq >= 0),
  seat smallint not null check (seat in (0, 1)),
  move jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, seq)
);

alter table public.match_moves enable row level security;

drop policy if exists "moves: players read" on public.match_moves;
create policy "moves: players read" on public.match_moves
  for select using (
    exists (select 1 from public.matches m where m.id = match_id and auth.uid() in (m.host, m.guest))
  );

-- a player adds their own moves, only while the match is on
drop policy if exists "moves: player adds own" on public.match_moves;
create policy "moves: player adds own" on public.match_moves
  for insert with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'playing'
        and ((seat = 0 and m.host = auth.uid()) or (seat = 1 and m.guest = auth.uid()))
    )
  );

-- games that can be played online so far
create or replace function public.online_game(p_game text)
returns boolean language sql immutable as $$
  select p_game in ('dam', 'congkak', 'lumba-basikal')
$$;

-- Host a match: a fresh 6-letter code (no 0/O/1/I/L to misread) and a seed.
-- Any older invite of yours that nobody joined is closed.
create or replace function public.create_match(p_game text)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
  m public.matches;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'no profile'; end if;
  if not online_game(p_game) then raise exception 'game not online'; end if;
  update matches set status = 'abandoned', ended_at = now()
    where host = auth.uid() and status = 'waiting';
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into matches (code, game_id, seed, host)
        values (c, p_game, floor(random() * 2147483647)::int, auth.uid())
        returning * into m;
      return m;
    exception when unique_violation then
      -- that code is taken: roll another
    end;
  end loop;
end;
$$;

-- Join with a code. Someone already in the match (a reload) just gets it back.
create or replace function public.join_match(p_code text)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'no profile'; end if;
  select * into m from matches where code = upper(trim(p_code)) for update;
  if not found then raise exception 'no such match'; end if;
  if auth.uid() in (m.host, m.guest) then return m; end if;
  if m.status <> 'waiting' or m.created_at < now() - interval '24 hours' then raise exception 'match closed'; end if;
  update matches set guest = auth.uid(), status = 'playing', started_at = now()
    where id = m.id
    returning * into m;
  return m;
end;
$$;

-- The game is over (either player may report it; the first report stands).
create or replace function public.finish_match(p_id uuid, p_winner smallint, p_result jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update matches set status = 'done', winner_seat = p_winner, result = p_result, ended_at = now()
    where id = p_id and status = 'playing' and auth.uid() in (host, guest);
end;
$$;

-- Walk away: an open invite is closed; a match in play is lost by whoever left.
create or replace function public.leave_match(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update matches set
      status = 'abandoned',
      ended_at = now(),
      winner_seat = case when status = 'playing' then (case when auth.uid() = host then 1 else 0 end) end
    where id = p_id and status in ('waiting', 'playing') and auth.uid() in (host, guest);
end;
$$;

revoke all on function public.create_match(text) from public, anon;
revoke all on function public.join_match(text) from public, anon;
revoke all on function public.finish_match(uuid, smallint, jsonb) from public, anon;
revoke all on function public.leave_match(uuid) from public, anon;
grant execute on function public.create_match(text) to authenticated;
grant execute on function public.join_match(text) to authenticated;
grant execute on function public.finish_match(uuid, smallint, jsonb) to authenticated;
grant execute on function public.leave_match(uuid) to authenticated;

-- ---------------------------------------------------------------- multiplayer: rooms of up to 8
-- Lumba Basikal races take 2–8 players. Every player in a match has a row in
-- match_players (seat 0 is the host); `capacity` is how many seats the host
-- opened and `settings` holds the host's choices (the track). Two-player
-- games (dam, congkak) use the same rows, and still keep host / guest.

alter table public.matches add column if not exists capacity smallint not null default 2;
alter table public.matches add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.matches drop constraint if exists matches_capacity_check;
alter table public.matches add constraint matches_capacity_check check (capacity between 2 and 8);

create table if not exists public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  seat smallint not null check (seat between 0 and 7),
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (match_id, seat),
  unique (match_id, user_id)
);

alter table public.match_players enable row level security;

-- (a function, so the policy on match_players doesn't read match_players through itself)
create or replace function public.is_match_player(p_match uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from match_players where match_id = p_match and user_id = auth.uid())
$$;

drop policy if exists "match players: players read" on public.match_players;
create policy "match players: players read" on public.match_players
  for select using (public.is_match_player(match_id));

drop policy if exists "matches: players read" on public.matches;
create policy "matches: players read" on public.matches
  for select using (auth.uid() in (host, guest) or public.is_match_player(id));

create or replace function public.online_game(p_game text)
returns boolean language sql immutable as $$
  select p_game in ('dam', 'congkak', 'lumba-basikal')
$$;

-- games with more than two seats, and how many they allow
create or replace function public.max_seats(p_game text)
returns smallint language sql immutable as $$
  select (case when p_game = 'lumba-basikal' then 8 else 2 end)::smallint
$$;

drop function if exists public.create_match(text);
create or replace function public.create_match(p_game text, p_capacity integer default 2, p_settings jsonb default '{}'::jsonb)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
  m public.matches;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'no profile'; end if;
  if not online_game(p_game) then raise exception 'game not online'; end if;
  if p_capacity < 2 or p_capacity > max_seats(p_game) then raise exception 'bad capacity'; end if;
  update matches set status = 'abandoned', ended_at = now()
    where host = auth.uid() and status = 'waiting';
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into matches (code, game_id, seed, host, capacity, settings)
        values (c, p_game, floor(random() * 2147483647)::int, auth.uid(), p_capacity, coalesce(p_settings, '{}'::jsonb))
        returning * into m;
      insert into match_players (match_id, seat, user_id) values (m.id, 0, auth.uid());
      return m;
    exception when unique_violation then
      -- that code is taken: roll another
    end;
  end loop;
end;
$$;

-- Join with a code: two-player games fill the guest's seat and start; bigger
-- rooms take the next free seat and wait for the host to start.
create or replace function public.join_match(p_code text)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  free_seat smallint;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'no profile'; end if;
  select * into m from matches where code = upper(trim(p_code)) for update;
  if not found then raise exception 'no such match'; end if;
  if auth.uid() in (m.host, m.guest) or exists (select 1 from match_players where match_id = m.id and user_id = auth.uid()) then
    return m;
  end if;
  if m.status <> 'waiting' or m.created_at < now() - interval '24 hours' then raise exception 'match closed'; end if;
  if m.capacity = 2 then
    update matches set guest = auth.uid(), status = 'playing', started_at = now()
      where id = m.id
      returning * into m;
    insert into match_players (match_id, seat, user_id) values (m.id, 1, auth.uid()) on conflict do nothing;
    return m;
  end if;
  select s into free_seat
    from generate_series(1, m.capacity - 1) as s
    where s not in (select seat from match_players where match_id = m.id)
    order by s limit 1;
  if free_seat is null then raise exception 'match full'; end if;
  insert into match_players (match_id, seat, user_id) values (m.id, free_seat, auth.uid());
  return m;
end;
$$;

-- The host starts a room (empty seats are filled by the game).
create or replace function public.start_match(p_id uuid)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
begin
  update matches set status = 'playing', started_at = now()
    where id = p_id and host = auth.uid() and status = 'waiting'
    returning * into m;
  if not found then raise exception 'match closed'; end if;
  return m;
end;
$$;

-- Walk away. Two players: an open invite is closed, a match in play is lost
-- by whoever left. A room: the host closes it; anyone else just gives up
-- their seat while it's still waiting (during a race the others mark them out).
create or replace function public.leave_match(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update matches set
      status = 'abandoned',
      ended_at = now(),
      winner_seat = case when status = 'playing' and capacity = 2 then (case when auth.uid() = host then 1 else 0 end) end
    where id = p_id and status in ('waiting', 'playing')
      and (auth.uid() = host or (capacity = 2 and auth.uid() = guest));
  delete from match_players mp
    using matches m
    where mp.match_id = p_id and m.id = p_id and mp.user_id = auth.uid() and mp.seat <> 0
      and m.capacity > 2 and m.status = 'waiting';
end;
$$;

-- older two-player matches get their rows too
insert into public.match_players (match_id, seat, user_id)
  select id, 0, host from public.matches on conflict do nothing;
insert into public.match_players (match_id, seat, user_id)
  select id, 1, guest from public.matches where guest is not null on conflict do nothing;

revoke all on function public.create_match(text, integer, jsonb) from public, anon;
revoke all on function public.start_match(uuid) from public, anon;
revoke all on function public.is_match_player(uuid) from public, anon;
grant execute on function public.create_match(text, integer, jsonb) to authenticated;
grant execute on function public.start_match(uuid) to authenticated;
grant execute on function public.is_match_player(uuid) to authenticated;

-- the winner can be any seat in a room (0–7)
alter table public.matches drop constraint if exists matches_winner_seat_check;
alter table public.matches add constraint matches_winner_seat_check check (winner_seat between 0 and 7);
