-- Tracked activities (walk via DeviceMotion, run/cycle via GPS) and live state.
--
-- Client flow:
--   start_activity(type)                       -> live activity row
--   push_activity(id, steps, distance_m, active_s, route)   every ~5 s, CUMULATIVE totals
--   finish_activity(id, [final totals], [route])            -> summary jsonb
--   discard_activity(id)
--
-- Totals are cumulative so a lost or repeated push is harmless. The server clamps
-- everything against wall-clock time and per-type limits.

create type public.activity_type   as enum ('walk', 'run', 'cycle');
create type public.activity_status as enum ('live', 'completed', 'discarded');

create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  type         public.activity_type   not null,
  status       public.activity_status not null default 'live',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  last_push_at timestamptz,
  active_s     integer not null default 0 check (active_s >= 0),
  steps        integer not null default 0 check (steps >= 0),
  distance_m   double precision not null default 0 check (distance_m >= 0),
  points       integer not null default 0 check (points >= 0),  -- base MovePoints (provisional while live)
  created_at   timestamptz not null default now()
);

create unique index activities_one_live_per_user on public.activities (user_id) where status = 'live';
create index activities_user_started_idx on public.activities (user_id, started_at desc);
create index activities_started_idx on public.activities (started_at);

-- GPS route samples (run/cycle). Owner-readable only.
create table public.activity_points (
  activity_id uuid not null references public.activities (id) on delete cascade,
  seq         integer not null,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real,
  recorded_at timestamptz not null,
  primary key (activity_id, seq)
);

alter table public.activities      enable row level security;
alter table public.activity_points enable row level security;

create policy "owner reads activities"
  on public.activities for select to authenticated
  using (user_id = (select auth.uid()));

create policy "owner reads route points"
  on public.activity_points for select to authenticated
  using (exists (select 1 from public.activities a
                 where a.id = activity_id and a.user_id = (select auth.uid())));

-- All writes go through the RPCs below.
revoke insert, update, delete on public.activities, public.activity_points from anon, authenticated;

-- Realtime: owner receives their own live activity updates (RLS applies).
alter publication supabase_realtime add table public.activities;

-- ---------------------------------------------------------------------------
-- Limits
-- ---------------------------------------------------------------------------

-- Max plausible average speed (m/s) per activity type.
create or replace function private.max_speed_mps(t public.activity_type)
returns double precision
language sql immutable
set search_path = ''
as $$
  select case t when 'walk' then 2.5    -- 9 km/h
                when 'run'  then 7.0    -- ~25 km/h
                when 'cycle' then 12.5  -- 45 km/h
         end
$$;

-- Max plausible cadence (steps/s).
create or replace function private.max_cadence(t public.activity_type)
returns double precision
language sql immutable
set search_path = ''
as $$ select case t when 'cycle' then 0.0 else 3.5 end $$;

create or replace function private.haversine_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns double precision
language sql immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

-- Distance along the stored route, ignoring segments faster than the type's speed cap
-- (GPS jumps) and samples with very poor accuracy.
create or replace function private.route_distance_m(p_activity_id uuid, t public.activity_type)
returns double precision
language sql stable
set search_path = ''
as $$
  with pts as (
    select lat, lng, recorded_at,
           lag(lat) over w as plat, lag(lng) over w as plng, lag(recorded_at) over w as pt
    from public.activity_points
    where activity_id = p_activity_id and coalesce(accuracy_m, 0) <= 50
    window w as (order by seq)
  ), seg as (
    select private.haversine_m(plat, plng, lat, lng) as d,
           greatest(extract(epoch from recorded_at - pt), 1) as dt
    from pts where plat is not null
  )
  select coalesce(sum(d) filter (where d / dt <= private.max_speed_mps(t)), 0) from seg
$$;

-- ---------------------------------------------------------------------------
-- Hooks redefined by later migrations (points, challenges, badges).
-- ---------------------------------------------------------------------------

-- Recompute this activity's base MovePoints (live or final).
create or replace function private.sync_activity_points(p_activity_id uuid)
returns void language plpgsql set search_path = '' as $$ begin end $$;

-- Runs once when an activity completes; returns the post-activity summary.
create or replace function private.after_activity_completed(p_activity_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
begin
  return jsonb_build_object('activity', (select to_jsonb(a) from public.activities a where a.id = p_activity_id));
end $$;

-- ---------------------------------------------------------------------------
-- Internal mutation helpers
-- ---------------------------------------------------------------------------

-- Apply cumulative totals + new route samples to a live activity, with clamps.
create or replace function private.apply_activity_push(
  p_activity_id uuid,
  p_steps       integer,
  p_distance_m  double precision,
  p_active_s    integer,
  p_route       jsonb
) returns void
language plpgsql
set search_path = ''
as $$
declare
  a      public.activities;
  wall_s double precision;
  next_seq integer;
begin
  select * into a from public.activities where id = p_activity_id for update;
  wall_s := greatest(extract(epoch from now() - a.started_at), 0);

  if p_route is not null and jsonb_typeof(p_route) = 'array' and jsonb_array_length(p_route) > 0 then
    select coalesce(max(seq), 0) into next_seq from public.activity_points where activity_id = a.id;
    insert into public.activity_points (activity_id, seq, lat, lng, accuracy_m, recorded_at)
    select a.id, next_seq + r.ord,
           (r.p ->> 'lat')::float8, (r.p ->> 'lng')::float8,
           (r.p ->> 'accuracy')::real,
           least(coalesce((r.p ->> 't')::timestamptz, now()), now())
    from jsonb_array_elements(p_route) with ordinality as r (p, ord)
    where (r.p ->> 'lat') is not null and (r.p ->> 'lng') is not null
      and (r.p ->> 'lat')::float8 between -90 and 90
      and (r.p ->> 'lng')::float8 between -180 and 180;
  end if;

  update public.activities set
    active_s   = greatest(active_s, least(coalesce(p_active_s, active_s), floor(wall_s)::int)),
    steps      = greatest(steps, least(coalesce(p_steps, steps), floor(wall_s * private.max_cadence(a.type))::int)),
    distance_m = greatest(distance_m, least(coalesce(p_distance_m, distance_m), wall_s * private.max_speed_mps(a.type))),
    last_push_at = now()
  where id = a.id;

  perform private.sync_activity_points(a.id);
end $$;

-- Finalise a live activity: authoritative distance for GPS types, mark completed, run hooks.
create or replace function private.complete_activity(p_activity_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  a public.activities;
  route_m double precision;
  n_points integer;
begin
  select * into a from public.activities where id = p_activity_id for update;
  if a.status <> 'live' then
    raise exception 'activity_not_live';
  end if;

  if a.type in ('run', 'cycle') then
    select count(*) into n_points from public.activity_points where activity_id = a.id;
    if n_points >= 2 then
      route_m := private.route_distance_m(a.id, a.type);
      update public.activities set distance_m = route_m where id = a.id;
    end if;
  end if;

  update public.activities set
    status   = 'completed',
    ended_at = now(),
    active_s = least(active_s, floor(extract(epoch from now() - started_at))::int)
  where id = a.id;

  perform private.sync_activity_points(a.id);
  return private.after_activity_completed(a.id);
end $$;

create or replace function private.owned_live_activity(p_activity_id uuid)
returns public.activities
language plpgsql
set search_path = ''
as $$
declare a public.activities;
begin
  select * into a from public.activities
   where id = p_activity_id and user_id = private.require_user();
  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'live' then
    raise exception 'activity_not_live';
  end if;
  return a;
end $$;

-- ---------------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------------

-- Starts a new live activity. Any activity still live for this user is completed first
-- (e.g. app reload) so it never blocks the user. Check get_home().live_activity to resume instead.
create or replace function public.start_activity(p_type public.activity_type)
returns public.activities
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  stale_id uuid;
  a public.activities;
begin
  select id into stale_id from public.activities where user_id = uid and status = 'live';
  if stale_id is not null then
    perform private.complete_activity(stale_id);
  end if;

  insert into public.activities (user_id, type) values (uid, p_type) returning * into a;
  return a;
end $$;

-- p_route: [{ "lat": 26.14, "lng": 91.73, "accuracy": 8, "t": "2026-11-13T10:00:00Z" }, ...]
-- (only NEW samples since the last push). Returns the updated activity row.
create or replace function public.push_activity(
  p_activity_id uuid,
  p_steps       integer default null,
  p_distance_m  double precision default null,
  p_active_s    integer default null,
  p_route       jsonb default '[]'::jsonb
) returns public.activities
language plpgsql security definer
set search_path = ''
as $$
declare a public.activities;
begin
  perform private.owned_live_activity(p_activity_id);
  perform private.apply_activity_push(p_activity_id, p_steps, p_distance_m, p_active_s, p_route);
  select * into a from public.activities where id = p_activity_id;
  return a;
end $$;

-- Optionally takes the final totals/route (same semantics as push_activity) so the client
-- can stop with a single call. Returns the post-activity summary.
create or replace function public.finish_activity(
  p_activity_id uuid,
  p_steps       integer default null,
  p_distance_m  double precision default null,
  p_active_s    integer default null,
  p_route       jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.owned_live_activity(p_activity_id);
  perform private.apply_activity_push(p_activity_id, p_steps, p_distance_m, p_active_s, p_route);
  return private.complete_activity(p_activity_id);
end $$;

create or replace function public.discard_activity(p_activity_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.owned_live_activity(p_activity_id);
  update public.activities set status = 'discarded', ended_at = now() where id = p_activity_id;
  perform private.sync_activity_points(p_activity_id);
end $$;
