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
  select p_game in ('dam')
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
