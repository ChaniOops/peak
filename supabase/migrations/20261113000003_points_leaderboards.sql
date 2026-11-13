-- MovePoints engine (append-only, idempotent ledger) and leaderboards.
--
-- Rules:
--   performance   walk 1 pt / 100 steps, run 10 pt / km, cycle 4 pt / km
--                 tracked base points capped at 200 per campus day; activities < 2 min earn 0
--   consistency   +10 first qualifying activity of the day (>= 10 min or >= 1,000 steps)
--                 +5 x streak days (from day 2), capped at +35
--   improvement   +25 personal best (steps for walk, distance for run/cycle)
--   participation verified events (events migration)
--   team          challenge completions (challenges migration)
--
-- Every award has a unique (user_id, reason, source_key), so re-running anything is safe.
-- The only row that changes after insert is a LIVE activity's provisional 'activity' row,
-- which is settled when the activity completes (or deleted when discarded).

create type public.point_reason as enum (
  'activity', 'daily_active', 'streak', 'personal_best', 'event', 'challenge', 'team_challenge'
);

create type public.leaderboard_period as enum ('week', 'all');

create table public.points_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reason     public.point_reason not null,
  source_key text not null,                 -- e.g. 'activity:<uuid>', 'day:2026-11-13', 'challenge:<uuid>'
  amount     integer not null check (amount >= 0),
  earned_at  timestamptz not null default now(),  -- drives weekly windows
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reason, source_key)
);

create index points_ledger_earned_idx on public.points_ledger (earned_at);
create index points_ledger_user_earned_idx on public.points_ledger (user_id, earned_at);

alter table public.points_ledger enable row level security;

create policy "owner reads own ledger"
  on public.points_ledger for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.points_ledger from anon, authenticated;

alter publication supabase_realtime add table public.points_ledger;

-- ---------------------------------------------------------------------------
-- Public refresh trigger: a payload-free broadcast on topic 'leaderboard'
-- whenever anyone's points change. Clients re-fetch leaderboards/home on it.
-- Set `app.seeding = on` to silence it during bulk seeding.
-- ---------------------------------------------------------------------------

create or replace function private.broadcast_leaderboard_pulse()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.seeding', true), '') = 'on' then
    return null;
  end if;
  begin
    perform realtime.send(jsonb_build_object('at', now()), 'changed', 'leaderboard', false);
  exception when others then
    null;  -- realtime must never break points
  end;
  return null;
end $$;

create trigger points_ledger_pulse
  after insert or update or delete on public.points_ledger
  for each statement execute function private.broadcast_leaderboard_pulse();

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------

create or replace function private.activity_base_points(t public.activity_type, steps integer, distance_m double precision)
returns integer
language sql immutable
set search_path = ''
as $$
  select case t when 'walk'  then steps / 100
                when 'run'   then floor(distance_m / 100)::int    -- 10 per km
                when 'cycle' then floor(distance_m / 250)::int    -- 4 per km
         end
$$;

create or replace function private.daily_activity_cap() returns integer
language sql immutable set search_path = '' as $$ select 200 $$;

create or replace function private.sync_activity_points(p_activity_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  a    public.activities;
  k    text := 'activity:' || p_activity_id;
  day  date;
  raw  integer;
  used integer;
  pts  integer;
begin
  select * into a from public.activities where id = p_activity_id;

  if a.status = 'discarded' then
    delete from public.points_ledger where user_id = a.user_id and reason = 'activity' and source_key = k;
    update public.activities set points = 0 where id = a.id and points <> 0;
    return;
  end if;

  raw := private.activity_base_points(a.type, a.steps, a.distance_m);
  if a.status = 'completed' and a.active_s < 120 then
    raw := 0;
  end if;

  day := public.campus_date(a.started_at);
  select coalesce(sum(l.amount), 0) into used
    from public.points_ledger l
   where l.user_id = a.user_id and l.reason = 'activity' and l.source_key <> k
     and l.earned_at >= public.campus_day_start(day)
     and l.earned_at <  public.campus_day_start(day + 1);

  pts := least(raw, greatest(private.daily_activity_cap() - used, 0));

  insert into public.points_ledger (user_id, reason, source_key, amount, earned_at)
  values (a.user_id, 'activity', k, pts, a.started_at)
  on conflict (user_id, reason, source_key)
  do update set amount = excluded.amount, updated_at = now()
     where public.points_ledger.amount <> excluded.amount;

  update public.activities set points = pts where id = a.id and points <> pts;
end $$;

-- Consecutive active days ending on p_day (0 if p_day itself was not active).
create or replace function private.streak_days(p_user uuid, p_day date)
returns integer
language sql stable
set search_path = ''
as $$
  with days as (
    select distinct public.campus_date(earned_at) as d
      from public.points_ledger
     where user_id = p_user and reason = 'daily_active'
       and earned_at < public.campus_day_start(p_day + 1)
  ), r as (
    select p_day - d as gap, row_number() over (order by d desc) - 1 as rn from days
  )
  select count(*)::int from r where gap = rn
$$;

-- Current streak as shown on Home: still alive if the user was active yesterday.
create or replace function private.current_streak(p_user uuid)
returns integer
language sql stable
set search_path = ''
as $$
  select greatest(private.streak_days(p_user, public.campus_date()),
                  private.streak_days(p_user, public.campus_date() - 1))
$$;

-- First qualifying action of a campus day: +10, plus the streak bonus.
create or replace function private.award_daily_bonus(p_user uuid, p_at timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  day     date := public.campus_date(p_at);
  k       text := 'day:' || day;
  new_id  bigint;
  streak  integer;
  s_bonus integer := 0;
begin
  insert into public.points_ledger (user_id, reason, source_key, amount, earned_at)
  values (p_user, 'daily_active', k, 10, p_at)
  on conflict do nothing
  returning id into new_id;

  if new_id is null then
    return jsonb_build_object('daily', 0, 'streak', 0, 'streak_days', private.streak_days(p_user, day));
  end if;

  streak := private.streak_days(p_user, day);
  if streak >= 2 then
    s_bonus := least(5 * streak, 35);
    insert into public.points_ledger (user_id, reason, source_key, amount, earned_at)
    values (p_user, 'streak', k, s_bonus, p_at)
    on conflict do nothing;
  end if;

  return jsonb_build_object('daily', 10, 'streak', s_bonus, 'streak_days', streak);
end $$;

-- Challenges and badges hook (redefined by later migrations).
create or replace function private.settle_user(p_user uuid)
returns jsonb language plpgsql set search_path = '' as $$
begin
  return jsonb_build_object('completed_challenges', '[]'::jsonb, 'new_badges', '[]'::jsonb, 'challenge_points', 0);
end $$;

create or replace function private.after_activity_completed(p_activity_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  a       public.activities;
  daily   jsonb := jsonb_build_object('daily', 0, 'streak', 0);
  metric  double precision;
  prev    double precision;
  n_prev  integer;
  pb      integer := 0;
  settled jsonb;
begin
  select * into a from public.activities where id = p_activity_id;

  if a.points > 0 and (a.active_s >= 600 or a.steps >= 1000) then
    daily := private.award_daily_bonus(a.user_id, coalesce(a.ended_at, a.started_at));
  end if;

  metric := case a.type when 'walk' then a.steps else a.distance_m end;
  select max(case a.type when 'walk' then x.steps else x.distance_m end), count(*)
    into prev, n_prev
    from public.activities x
   where x.user_id = a.user_id and x.type = a.type and x.status = 'completed'
     and x.id <> a.id and x.started_at < a.started_at;

  if a.points > 0 and n_prev > 0 and metric > prev then
    insert into public.points_ledger (user_id, reason, source_key, amount, earned_at)
    values (a.user_id, 'personal_best', 'activity:' || a.id, 25, a.started_at)
    on conflict do nothing;
    pb := 25;
  end if;

  settled := private.settle_user(a.user_id);

  return jsonb_build_object(
    'activity', to_jsonb(a),
    'points', jsonb_build_object(
      'base',          a.points,
      'daily',         (daily ->> 'daily')::int,
      'streak',        (daily ->> 'streak')::int,
      'personal_best', pb,
      'challenges',    (settled ->> 'challenge_points')::int,
      'total',         a.points + (daily ->> 'daily')::int + (daily ->> 'streak')::int + pb
                       + (settled ->> 'challenge_points')::int
    ),
    'is_personal_best',     pb > 0,
    'streak_days',          private.current_streak(a.user_id),
    'completed_challenges', settled -> 'completed_challenges',
    'new_badges',           settled -> 'new_badges'
  );
end $$;

-- Spendable balance (rewards migration subtracts redemptions).
create or replace function private.spendable_points(p_user uuid)
returns bigint language sql stable set search_path = '' as $$
  select coalesce(sum(amount), 0)::bigint from public.points_ledger where user_id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Leaderboards (earned points only; spending never changes rank)
-- ---------------------------------------------------------------------------

create or replace function private.period_start(p public.leaderboard_period)
returns timestamptz language sql stable set search_path = '' as $$
  select case p when 'week' then public.campus_week_start() else '-infinity'::timestamptz end
$$;

-- Points per ranked user (students + organisers) since a timestamp.
create or replace function private.user_points_since(p_since timestamptz)
returns table (user_id uuid, display_name text, department_id text, points bigint)
language sql stable
set search_path = ''
as $$
  select p.id, p.display_name, p.department_id, coalesce(sum(l.amount), 0)::bigint
    from public.profiles p
    left join public.points_ledger l on l.user_id = p.id and l.earned_at >= p_since
   where p.role in ('student', 'organiser')
   group by p.id
$$;

create or replace function public.get_individual_leaderboard(
  p_period        public.leaderboard_period default 'week',
  p_department_id text default null,
  p_limit         integer default 50
) returns table (
  rank            bigint,
  user_id         uuid,
  display_name    text,
  department_id   text,
  department_name text,
  points          bigint,
  is_me           boolean
)
language sql stable security definer
set search_path = ''
as $$
  with ranked as (
    select u.*, d.name as department_name,
           rank() over (order by u.points desc) as rk,
           row_number() over (order by u.points desc, u.display_name) as rn
      from private.user_points_since(private.period_start(p_period)) u
      left join public.departments d on d.id = u.department_id
     where p_department_id is null or u.department_id = p_department_id
  )
  select rk, user_id, display_name, department_id, department_name, points, user_id = auth.uid()
    from ranked
   where rn <= p_limit or user_id = auth.uid()
   order by rn
$$;

-- Ranked by average points per member, then participation %.
create or replace function public.get_department_leaderboard(
  p_period public.leaderboard_period default 'week'
) returns table (
  rank              bigint,
  department_id     text,
  name              text,
  members           bigint,
  active_members    bigint,
  participation_pct numeric,
  total_points      bigint,
  avg_points        numeric,
  is_mine           boolean
)
language sql stable security definer
set search_path = ''
as $$
  with agg as (
    select d.id, d.name,
           count(u.user_id) as members,
           count(u.user_id) filter (where u.points > 0) as active,
           coalesce(sum(u.points), 0)::bigint as total
      from public.departments d
      left join private.user_points_since(private.period_start(p_period)) u on u.department_id = d.id
     group by d.id
  ), scored as (
    select *,
           coalesce(round(total::numeric / nullif(members, 0), 1), 0) as avg_pts,
           coalesce(round(100.0 * active / nullif(members, 0)), 0) as part_pct
      from agg
  )
  select rank() over (order by avg_pts desc, part_pct desc), id, name, members, active, part_pct, total, avg_pts,
         id = (select p.department_id from public.profiles p where p.id = auth.uid())
    from scored
   order by 1, name
$$;
