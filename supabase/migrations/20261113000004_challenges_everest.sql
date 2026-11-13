-- Joinable challenges, personal weekly Everest (53,000 steps = 1 summit), and get_home().
--
-- Challenge progress is counted over the challenge window (started_at within
-- [starts_at, ends_at)), including the user's live activity, so it moves during tracking.
--   individual  -> the user's own total
--   department  -> sum over joined members of the user's department
--   campus      -> sum over all joined members
-- Completion is evaluated when an activity completes, an event is verified, or on join.
-- Department/campus rewards go to every joined member (including later joiners).

create type public.challenge_metric as enum ('steps', 'distance_m', 'active_minutes', 'sessions', 'points', 'verified_events');
create type public.challenge_scope  as enum ('individual', 'department', 'campus');

create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  description   text not null default '',
  metric        public.challenge_metric not null,
  activity_type public.activity_type,          -- null = any tracked type
  scope         public.challenge_scope not null default 'individual',
  target        numeric not null check (target > 0),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null check (ends_at > starts_at),
  reward_points integer not null default 0 check (reward_points >= 0),
  created_at    timestamptz not null default now()
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index challenge_members_user_idx on public.challenge_members (user_id);

-- One row per completed subject: (challenge, user) | (challenge, department) | (challenge) for campus.
create table public.challenge_completions (
  id            bigint generated always as identity primary key,
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete cascade,
  department_id text references public.departments (id),
  completed_at  timestamptz not null default now(),
  unique nulls not distinct (challenge_id, user_id, department_id)
);

alter table public.challenges            enable row level security;
alter table public.challenge_members     enable row level security;
alter table public.challenge_completions enable row level security;

create policy "challenges are readable"
  on public.challenges for select to authenticated using (true);

create policy "owner reads own memberships"
  on public.challenge_members for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.challenges, public.challenge_members, public.challenge_completions
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------

-- A user's value for a metric within a window. Reward points from challenges are
-- excluded from the 'points' metric so challenges never feed themselves.
-- ('verified_events' is filled in by the events migration.)
create or replace function private.user_metric(
  p_user uuid, p_metric public.challenge_metric, p_type public.activity_type,
  p_from timestamptz, p_to timestamptz
) returns numeric
language sql stable
set search_path = ''
as $$
  select case
    when p_metric = 'points' then (
      select coalesce(sum(l.amount), 0)::numeric from public.points_ledger l
       where l.user_id = p_user and l.earned_at >= p_from and l.earned_at < p_to
         and l.reason not in ('challenge', 'team_challenge'))
    when p_metric = 'verified_events' then 0::numeric
    else (
      select coalesce(case p_metric
               when 'steps'          then sum(a.steps)::numeric
               when 'distance_m'     then round(sum(a.distance_m)::numeric, 1)
               when 'active_minutes' then floor(sum(a.active_s) / 60.0)
               when 'sessions'       then count(*) filter (where a.status = 'completed' and a.active_s >= 120)
             end, 0)
        from public.activities a
       where a.user_id = p_user and a.status in ('live', 'completed')
         and a.started_at >= p_from and a.started_at < p_to
         and (p_type is null or a.type = p_type))
  end
$$;

-- Progress of challenge c from p_user's point of view.
create or replace function private.challenge_progress(c public.challenges, p_user uuid)
returns numeric
language sql stable
set search_path = ''
as $$
  select case c.scope
    when 'individual' then private.user_metric(p_user, c.metric, c.activity_type, c.starts_at, c.ends_at)
    else coalesce((
      select sum(private.user_metric(m.user_id, c.metric, c.activity_type, c.starts_at, c.ends_at))
        from public.challenge_members m
        join public.profiles p on p.id = m.user_id
       where m.challenge_id = c.id
         and (c.scope = 'campus'
              or p.department_id = (select me.department_id from public.profiles me where me.id = p_user))
    ), 0)
  end
$$;

create or replace function private.challenge_completion(c public.challenges, p_user uuid)
returns public.challenge_completions
language sql stable
set search_path = ''
as $$
  select cc.* from public.challenge_completions cc
   where cc.challenge_id = c.id
     and case c.scope
           when 'individual' then cc.user_id = p_user
           when 'department' then cc.user_id is null and cc.department_id =
                                  (select p.department_id from public.profiles p where p.id = p_user)
           else cc.user_id is null and cc.department_id is null
         end
$$;

-- Complete any reached challenges the user has joined and pay out (idempotent).
-- Returns { list: [...newly rewarded for p_user], points: int }.
create or replace function private.evaluate_challenges(p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c       public.challenges;
  dept    text := (select department_id from public.profiles where id = p_user);
  done    public.challenge_completions;
  r_reason public.point_reason;
  new_id  bigint;
  list    jsonb := '[]'::jsonb;
  total   integer := 0;
begin
  for c in
    select ch.* from public.challenges ch
      join public.challenge_members m on m.challenge_id = ch.id and m.user_id = p_user
     where ch.starts_at <= now() and ch.ends_at + interval '6 hours' > now()
  loop
    if c.scope = 'department' and dept is null then
      continue;
    end if;

    done := private.challenge_completion(c, p_user);
    if done.id is null and private.challenge_progress(c, p_user) >= c.target then
      insert into public.challenge_completions (challenge_id, user_id, department_id)
      values (c.id,
              case when c.scope = 'individual' then p_user end,
              case when c.scope = 'department' then dept end)
      on conflict do nothing;

      -- Team completion: reward every other joined member of the team now.
      if c.scope <> 'individual' then
        insert into public.points_ledger (user_id, reason, source_key, amount)
        select m.user_id, 'team_challenge', 'challenge:' || c.id, c.reward_points
          from public.challenge_members m
          join public.profiles p on p.id = m.user_id
         where m.challenge_id = c.id and m.user_id <> p_user
           and (c.scope = 'campus' or p.department_id = dept)
        on conflict do nothing;
      end if;

      done := private.challenge_completion(c, p_user);
    end if;

    if done.id is not null then
      r_reason := case when c.scope = 'individual' then 'challenge' else 'team_challenge' end::public.point_reason;
      new_id := null;
      insert into public.points_ledger (user_id, reason, source_key, amount)
      values (p_user, r_reason, 'challenge:' || c.id, c.reward_points)
      on conflict do nothing
      returning id into new_id;

      if new_id is not null then
        total := total + c.reward_points;
        list := list || jsonb_build_object(
          'challenge_id', c.id, 'slug', c.slug, 'title', c.title,
          'scope', c.scope, 'reward_points', c.reward_points);
      end if;
    end if;
  end loop;

  return jsonb_build_object('list', list, 'points', total);
end $$;

create or replace function private.settle_user(p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare ch jsonb := private.evaluate_challenges(p_user);
begin
  return jsonb_build_object(
    'completed_challenges', ch -> 'list',
    'new_badges',           '[]'::jsonb,
    'challenge_points',     (ch ->> 'points')::int);
end $$;

-- ---------------------------------------------------------------------------
-- Challenge RPCs
-- ---------------------------------------------------------------------------

-- Active and upcoming challenges with the caller's joined state and progress.
-- progress is the user's / their department's / the campus's total depending on scope;
-- my_contribution is always the caller's own share.
create or replace function public.get_challenges()
returns table (
  id              uuid,
  slug            text,
  title           text,
  description     text,
  metric          public.challenge_metric,
  activity_type   public.activity_type,
  scope           public.challenge_scope,
  target          numeric,
  starts_at       timestamptz,
  ends_at         timestamptz,
  reward_points   integer,
  joined          boolean,
  joined_at       timestamptz,
  member_count    bigint,
  progress        numeric,
  progress_ratio  numeric,
  my_contribution numeric,
  completed       boolean,
  completed_at    timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
declare uid uuid := private.require_user();
begin
  return query
  with base as (
    select c as ch, m.joined_at as j,
           (select count(*) from public.challenge_members x where x.challenge_id = c.id) as n,
           private.challenge_progress(c, uid) as prog,
           private.user_metric(uid, c.metric, c.activity_type, c.starts_at, c.ends_at) as mine,
           private.challenge_completion(c, uid) as done
      from public.challenges c
      left join public.challenge_members m on m.challenge_id = c.id and m.user_id = uid
     where c.ends_at > now()
  )
  select (b.ch).id, (b.ch).slug, (b.ch).title, (b.ch).description, (b.ch).metric, (b.ch).activity_type,
         (b.ch).scope, (b.ch).target, (b.ch).starts_at, (b.ch).ends_at, (b.ch).reward_points,
         b.j is not null, b.j, b.n, b.prog, round(b.prog / (b.ch).target, 4), b.mine,
         (b.done).id is not null, (b.done).completed_at
    from base b
   order by b.j is null, (b.ch).ends_at, (b.ch).title;
end $$;

-- Returns { completed_challenges, new_badges, challenge_points } (joining can complete instantly).
create or replace function public.join_challenge(p_challenge_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare uid uuid := private.require_user();
begin
  if not exists (select 1 from public.challenges where id = p_challenge_id and ends_at > now()) then
    raise exception 'challenge_not_open' using errcode = 'P0002';
  end if;
  insert into public.challenge_members (challenge_id, user_id) values (p_challenge_id, uid)
  on conflict do nothing;
  return private.settle_user(uid);
end $$;

-- Rewards already earned are kept.
create or replace function public.leave_challenge(p_challenge_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.challenge_members where challenge_id = p_challenge_id and user_id = private.require_user()
$$;

-- ---------------------------------------------------------------------------
-- Everest: personal weekly step journey. 53,000 steps = 1 summit; it keeps going past 1.0×.
-- Motivational metaphor only: steps are NOT converted to metres.
-- ---------------------------------------------------------------------------

create or replace function private.everest_target_steps() returns integer
language sql immutable set search_path = '' as $$ select 53000 $$;

create or replace function public.get_everest()
returns table (
  week_start           timestamptz,
  current_steps        bigint,
  target_steps         integer,
  progress_ratio       numeric,   -- 0.78 = 78% to summit, 1.2 = 1.2× Everest
  summit_count         integer,   -- completed summits this week
  steps_to_next_summit bigint
)
language sql stable security definer
set search_path = ''
as $$
  with s as (
    select public.campus_week_start() as ws, private.everest_target_steps() as t,
           coalesce(sum(a.steps), 0)::bigint as steps
      from public.activities a
     where a.user_id = private.require_user() and a.status in ('live', 'completed')
       and a.started_at >= public.campus_week_start()
  )
  select ws, steps, t, round(steps::numeric / t, 4), (steps / t)::int, (steps / t + 1) * t - steps from s
$$;

-- ---------------------------------------------------------------------------
-- Home
-- ---------------------------------------------------------------------------

create or replace function public.get_home()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  uid   uuid := private.require_user();
  today timestamptz := public.campus_day_start(public.campus_date());
  week  timestamptz := public.campus_week_start();
begin
  return jsonb_build_object(
    'profile', (
      select jsonb_build_object('id', p.id, 'display_name', p.display_name, 'role', p.role,
                                'department_id', p.department_id, 'department_name', d.name)
        from public.profiles p left join public.departments d on d.id = p.department_id
       where p.id = uid),
    'points', (
      select jsonb_build_object(
               'total', coalesce(sum(l.amount), 0),
               'week',  coalesce(sum(l.amount) filter (where l.earned_at >= week), 0),
               'today', coalesce(sum(l.amount) filter (where l.earned_at >= today), 0),
               'spendable', private.spendable_points(uid))
        from public.points_ledger l where l.user_id = uid),
    'rank', jsonb_build_object(
      'individual_week', (select r.rank from public.get_individual_leaderboard('week', null, 1) r where r.is_me),
      'department_week', (select r.rank from public.get_department_leaderboard('week') r where r.is_mine)),
    'streak', jsonb_build_object(
      'days', private.current_streak(uid),
      'active_today', exists (select 1 from public.points_ledger l
                               where l.user_id = uid and l.reason = 'daily_active' and l.earned_at >= today)),
    'today', (
      select jsonb_build_object(
               'steps', coalesce(sum(a.steps), 0),
               'distance_m', round(coalesce(sum(a.distance_m), 0)::numeric, 1),
               'active_minutes', floor(coalesce(sum(a.active_s), 0) / 60.0),
               'activities', count(*))
        from public.activities a
       where a.user_id = uid and a.status in ('live', 'completed') and a.started_at >= today),
    'everest', (select to_jsonb(e) from public.get_everest() e),
    'live_activity', (select to_jsonb(a) from public.activities a where a.user_id = uid and a.status = 'live'),
    'joined_challenges', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.get_challenges() c where c.joined)
  );
end $$;
