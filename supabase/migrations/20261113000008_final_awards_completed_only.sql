-- Final awards are decided on completed activities only.
--
-- Live activities still count towards *displayed* progress (get_challenges, get_everest, get_home),
-- so Home/Everest move during tracking. But challenge completions, team rewards and badges are
-- only granted from completed activities, so a live activity that crosses a threshold and is then
-- discarded leaves nothing permanent behind (even if someone else settles while it is live).
--
-- Department/campus rewards go to joined members who actually contributed (> 0 in the window).

drop function private.user_metric(uuid, public.challenge_metric, public.activity_type, timestamptz, timestamptz);

create function private.user_metric(
  p_user uuid, p_metric public.challenge_metric, p_type public.activity_type,
  p_from timestamptz, p_to timestamptz, p_include_live boolean default true
) returns numeric
language sql stable
set search_path = ''
as $$
  select case
    when p_metric = 'points' then (
      select coalesce(sum(l.amount), 0)::numeric from public.points_ledger l
       where l.user_id = p_user and l.earned_at >= p_from and l.earned_at < p_to
         and l.reason not in ('challenge', 'team_challenge')
         and (p_include_live or not exists (
               select 1 from public.activities a
                where l.reason = 'activity' and l.source_key = 'activity:' || a.id and a.status = 'live')))
    when p_metric = 'verified_events' then (
      select count(*)::numeric from public.event_participants ep
       where ep.user_id = p_user and ep.status = 'verified'
         and ep.verified_at >= p_from and ep.verified_at < p_to)
    else (
      select coalesce(case p_metric
               when 'steps'          then sum(a.steps)::numeric
               when 'distance_m'     then round(sum(a.distance_m)::numeric, 1)
               when 'active_minutes' then floor(sum(a.active_s) / 60.0)
               when 'sessions'       then count(*) filter (where a.status = 'completed' and a.active_s >= 120)
             end, 0)
        from public.activities a
       where a.user_id = p_user
         and (a.status = 'completed' or (p_include_live and a.status = 'live'))
         and a.started_at >= p_from and a.started_at < p_to
         and (p_type is null or a.type = p_type))
  end
$$;

drop function private.challenge_progress(public.challenges, uuid);

create function private.challenge_progress(c public.challenges, p_user uuid, p_include_live boolean default true)
returns numeric
language sql stable
set search_path = ''
as $$
  select case c.scope
    when 'individual' then private.user_metric(p_user, c.metric, c.activity_type, c.starts_at, c.ends_at, p_include_live)
    else coalesce((
      select sum(private.user_metric(m.user_id, c.metric, c.activity_type, c.starts_at, c.ends_at, p_include_live))
        from public.challenge_members m
        join public.profiles p on p.id = m.user_id
       where m.challenge_id = c.id
         and (c.scope = 'campus'
              or p.department_id = (select me.department_id from public.profiles me where me.id = p_user))
    ), 0)
  end
$$;

create or replace function private.evaluate_challenges(p_user uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  c        public.challenges;
  dept     text := (select department_id from public.profiles where id = p_user);
  done     public.challenge_completions;
  r_reason public.point_reason;
  new_id   bigint;
  list     jsonb := '[]'::jsonb;
  total    integer := 0;
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
    if done.id is null and private.challenge_progress(c, p_user, false) >= c.target then
      insert into public.challenge_completions (challenge_id, user_id, department_id)
      values (c.id,
              case when c.scope = 'individual' then p_user end,
              case when c.scope = 'department' then dept end)
      on conflict do nothing;

      -- Team completion: reward the other joined members of the team who contributed.
      if c.scope <> 'individual' then
        insert into public.points_ledger (user_id, reason, source_key, amount)
        select m.user_id, 'team_challenge', 'challenge:' || c.id, c.reward_points
          from public.challenge_members m
          join public.profiles p on p.id = m.user_id
         where m.challenge_id = c.id and m.user_id <> p_user
           and (c.scope = 'campus' or p.department_id = dept)
           and private.user_metric(m.user_id, c.metric, c.activity_type, c.starts_at, c.ends_at, false) > 0
        on conflict do nothing;
      end if;

      done := private.challenge_completion(c, p_user);
    end if;

    -- Own reward: individual completions, or team completions this user contributed to
    -- (covers members who contribute after the team already completed).
    if done.id is not null
       and (c.scope = 'individual'
            or private.user_metric(p_user, c.metric, c.activity_type, c.starts_at, c.ends_at, false) > 0) then
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
      select 1 from public.activities where user_id = p_user and status = 'completed'
       group by public.campus_date(started_at) having sum(steps) >= 10000)
    union all
    select 'streak_3' where streak >= 3
    union all
    select 'streak_7' where streak >= 7
    union all
    select 'summit' where exists (
      select 1 from public.activities where user_id = p_user and status = 'completed'
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
