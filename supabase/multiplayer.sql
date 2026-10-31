-- Also part of schema.sql (kept separate so it can be run on its own).
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

-- ---------------------------------------------------------------- multiplayer: rooms that survive a phone in the background
-- Live messages can be missed (a phone that went to WhatsApp to share the
-- link drops its connection), so a room keeps what matters in the table:
-- each player's bike, and the line-up the host started with.

alter table public.match_players add column if not exists bike text;

create or replace function public.set_my_bike(p_match uuid, p_bike text)
returns void
language sql security definer set search_path = public as $$
  update match_players set bike = left(p_bike, 32) where match_id = p_match and user_id = auth.uid()
$$;

-- Join with a code: two-player games (dam, congkak) fill the guest's seat and
-- start; rooms (lumba-basikal, any size) take the next free seat and wait
-- for the host to start.
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
  if max_seats(m.game_id) = 2 then
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

-- The host starts a room, keeping the line-up (AI included) with it.
drop function if exists public.start_match(uuid);
create or replace function public.start_match(p_id uuid, p_roster jsonb default null)
returns public.matches
language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
begin
  update matches set
      status = 'playing',
      started_at = now(),
      settings = case when p_roster is null then settings else settings || jsonb_build_object('roster', p_roster) end
    where id = p_id and host = auth.uid() and status = 'waiting'
    returning * into m;
  if not found then raise exception 'match closed'; end if;
  return m;
end;
$$;

revoke all on function public.set_my_bike(uuid, text) from public, anon;
revoke all on function public.start_match(uuid, jsonb) from public, anon;
grant execute on function public.set_my_bike(uuid, text) to authenticated;
grant execute on function public.start_match(uuid, jsonb) to authenticated;
