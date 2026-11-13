-- Badges: fixed set, rules hard-coded per id, evaluated whenever a user is settled
-- (activity completed, event verified, challenge joined). Awards are idempotent.

create table public.badges (
  id          text primary key,
  name        text not null,
  description text not null,
  icon_key    text not null,
  sort        integer not null default 0
);

create table public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.badges      enable row level security;
alter table public.user_badges enable row level security;

create policy "badges are readable"
  on public.badges for select to authenticated using (true);

create policy "owner reads own badges"
  on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.badges, public.user_badges from anon, authenticated;

alter publication supabase_realtime add table public.user_badges;

insert into public.badges (id, name, description, icon_key, sort) values
  ('first_steps',   'First Steps',  'Completed your first tracked activity.',                 'first_steps',   10),
  ('ten_k_day',     '10K Day',      'Walked 10,000 steps in a single day.',                   'ten_k_day',     20),
  ('streak_3',      'On a Roll',    'Active three days in a row.',                            'streak_3',      30),
  ('streak_7',      'Unbreakable',  'Active seven days in a row.',                            'streak_7',      40),
  ('summit',        'Summit',       'Reached 53,000 steps in one week — one Everest.',        'summit',        50),
  ('personal_best', 'New Best',     'Beat your own best walk, run or ride.',                  'personal_best', 60),
  ('first_match',   'Game On',      'Verified at your first organised game.',                 'first_match',   70),
  ('team_player',   'Team Player',  'Completed a department or campus challenge together.',   'team_player',   80);

create or replace function private.evaluate_badges(p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  streak integer := private.current_streak(p_user);
  result jsonb;
begin
  with earned (badge_id) as (
    select 'first_steps' where exists (
      select 1 from public.activities where user_id = p_user and status = 'completed')
    union all
    select 'ten_k_day' where exists (
      select 1 from public.activities where user_id = p_user and status in ('live', 'completed')
       group by public.campus_date(started_at) having sum(steps) >= 10000)
    union all
    select 'streak_3' where streak >= 3
    union all
    select 'streak_7' where streak >= 7
    union all
    select 'summit' where exists (
      select 1 from public.activities where user_id = p_user and status in ('live', 'completed')
       group by public.campus_week_start(started_at) having sum(steps) >= private.everest_target_steps())
    union all
    select 'personal_best' where exists (
      select 1 from public.points_ledger where user_id = p_user and reason = 'personal_best')
    union all
    select 'first_match' where exists (
      select 1 from public.event_participants where user_id = p_user and status = 'verified')
    union all
    select 'team_player' where exists (
      select 1 from public.points_ledger where user_id = p_user and reason = 'team_challenge')
  ), ins as (
    insert into public.user_badges (user_id, badge_id)
    select p_user, e.badge_id from earned e
    on conflict do nothing
    returning badge_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'description', b.description,
                                               'icon_key', b.icon_key) order by b.sort), '[]'::jsonb)
    into result
    from ins join public.badges b on b.id = ins.badge_id;
  return result;
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
    'new_badges',           private.evaluate_badges(p_user),
    'challenge_points',     (ch ->> 'points')::int);
end $$;

-- All badges with the caller's earned state (for the You tab).
create or replace function public.get_badges()
returns table (id text, name text, description text, icon_key text, earned boolean, awarded_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select b.id, b.name, b.description, b.icon_key, ub.badge_id is not null, ub.awarded_at
    from public.badges b
    left join public.user_badges ub on ub.badge_id = b.id and ub.user_id = private.require_user()
   order by b.sort
$$;
