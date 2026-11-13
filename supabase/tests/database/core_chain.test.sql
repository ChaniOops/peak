-- Core demo chain against the seeded database:  npx supabase test db
-- phone walk -> live persistence -> Everest -> MovePoints -> challenge -> leaderboards,
-- plus QR verification, rewards and the RLS boundaries. Everything is rolled back.
begin;
select plan(44);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;

-- ---------------------------------------------------------------- demo setup
-- A joined CSE member with no steps this week: must NOT receive the team reward.
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-d000-000000000001', 'freerider@peak.test', '{"display_name":"Free Rider","department_id":"cse"}');
insert into public.challenge_members (challenge_id, user_id)
select id, '00000000-0000-4000-d000-000000000001' from public.challenges where slug = 'dept-step-summit';

select pg_temp.act_as('00000000-0000-4000-a000-000000000001');
create temp table t0 on commit drop as
  select (select points from public.get_individual_leaderboard('week', null, 1) where is_me) as pts,
         (select points from public.get_individual_leaderboard('week', null, 2) where rank = 2) as second_pts;

select is((select current_steps from public.get_everest()), 52965::bigint, 'demo Everest seeded at 52,965 steps');
select is((select steps_to_next_summit from public.get_everest()), 35::bigint, '35 steps to the summit');
select is((select target - progress from public.get_challenges() where slug = 'dept-step-summit'), 25::numeric,
          'CSE is 25 steps short of the Department Step Summit');
select is((select rank from public.get_individual_leaderboard('week', null, 1) where is_me), 3::bigint, 'demo starts 3rd this week');
select is((select second_pts - pts from t0), 30::bigint, 'demo is 30 points behind 2nd');
select ok(not (public.get_home() -> 'streak' ->> 'active_today')::boolean, 'demo not yet active today');
select ok(exists (select 1 from public.get_challenges() where joined) and exists (select 1 from public.get_challenges() where not joined),
          'challenges include joined and joinable');

-- ---------------------------------------------------------------- live walk that crosses thresholds, then is discarded
create temp table t_act on commit drop as select * from public.start_activity('walk');
select is((select status from t_act), 'live'::public.activity_status, 'start_activity creates a live walk');

reset role;
update public.activities set started_at = now() - interval '8 minutes' where id = (select id from t_act);
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

select is((select steps from public.push_activity((select id from t_act), 450, 340, 270)), 450, 'push_activity stores cumulative steps');
select is((select steps from public.push_activity((select id from t_act), 300, null, 280)), 450, 'steps never go backwards');
select ok((select steps from public.push_activity((select id from t_act), 999999, null, 290)) <= 8 * 60 * 3.5,
          'cadence clamp caps impossible steps');
select is((select steps from public.push_activity((select id from t_act), 450, 340, 300)), 1680, 'clamped value is kept (monotonic)');

select is((public.get_home() -> 'live_activity' ->> 'id')::uuid, (select id from t_act), 'Home sees the live activity');
select is((select summit_count from public.get_everest()), 1, 'Everest shows the summit live');
select ok((select progress >= target and not completed from public.get_challenges() where slug = 'dept-step-summit'),
          'team challenge shows crossed live but is not completed while live');

reset role;
select is(private.settle_user('00000000-0000-4000-b000-000000000006') -> 'completed_challenges', '[]'::jsonb,
          'a CSE teammate settling meanwhile cannot complete it from live steps');
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

select lives_ok($$ select public.discard_activity((select id from t_act)) $$, 'discard the threshold-crossing walk');
select is((select current_steps from public.get_everest()), 52965::bigint, 'discard: Everest back to 52,965');
select is((select points from public.get_individual_leaderboard('week', null, 1) where is_me), (select pts from t0),
          'discard: points back to start');
reset role;
select is((select count(*) from public.user_badges where user_id = '00000000-0000-4000-a000-000000000001' and badge_id = 'summit'),
          0::bigint, 'discard: no Summit badge');
select is((select count(*) from public.challenge_completions cc join public.challenges c on c.id = cc.challenge_id
            where c.slug = 'dept-step-summit'), 0::bigint, 'discard: no team challenge completion');
select is((select count(*) from public.points_ledger where reason = 'team_challenge'
              or source_key = 'activity:' || (select id from t_act)), 0::bigint, 'discard: no team reward or activity points');

-- ---------------------------------------------------------------- the demo walk: ~35 genuine steps
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');
create temp table t_walk on commit drop as select * from public.start_activity('walk');
reset role;
update public.activities set started_at = now() - interval '30 seconds' where id = (select id from t_walk);
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

select is((select steps from public.push_activity((select id from t_walk), 36, 27, 30)), 36, '36 steps over 30 s accepted');
select is((select summit_count from public.get_everest()), 1, 'Everest crosses 1.0x live');
select is((select points from public.get_individual_leaderboard('week', null, 1) where is_me), (select pts from t0),
          'no live points for 36 steps (< 100)');

create temp table t_sum on commit drop as select public.finish_activity((select id from t_walk)) as s;
select is((select s -> 'activity' ->> 'status' from t_sum), 'completed', 'finish_activity completes');
select is((select (s -> 'points' ->> 'total')::int from t_sum), 50, 'demo walk earns exactly the +50 team reward');
select is((select s -> 'completed_challenges' -> 0 ->> 'slug' from t_sum), 'dept-step-summit', 'walk completes the CSE team challenge');
select ok((select s -> 'new_badges' @> '[{"id":"summit"}]' from t_sum), 'Summit badge awarded on finish');
select is((select rank from public.get_individual_leaderboard('week', null, 1) where is_me), 2::bigint, 'demo overtakes into 2nd');

reset role;
select cmp_ok((select count(*) from public.points_ledger where reason = 'team_challenge'), '>=', 2::bigint,
              'CSE contributors also rewarded');
select is((select count(*) from public.points_ledger l join public.challenges c on l.source_key = 'challenge:' || c.id
            where l.reason = 'team_challenge'
              and private.user_metric(l.user_id, c.metric, c.activity_type, c.starts_at, c.ends_at, false) = 0),
          0::bigint, 'every team reward went to an actual contributor');
select is((select count(*) from public.points_ledger where user_id = '00000000-0000-4000-d000-000000000001'), 0::bigint,
          'joined member with zero steps gets no team reward');
create temp table t_n on commit drop as select count(*) as n from public.points_ledger;
select is(private.settle_user('00000000-0000-4000-a000-000000000001') -> 'completed_challenges', '[]'::jsonb,
          're-settling awards nothing new');
select is((select count(*) from public.points_ledger), (select n from t_n), 'ledger unchanged after re-settle (idempotent)');
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

-- ---------------------------------------------------------------- QR + verification
select is((select status from public.check_in('peak:checkin:FUTSAL26')), 'checked_in'::public.participation_status,
          'QR check-in -> checked_in');
select throws_ok($$ select public.get_event_checkin('00000000-0000-4000-c000-000000000001') $$,
                 'not_event_organiser', 'students cannot read the QR code');
select pg_temp.act_as('00000000-0000-4000-a000-000000000002');
select is((select status from public.verify_participant('00000000-0000-4000-c000-000000000001',
                                                        '00000000-0000-4000-a000-000000000001', true)),
          'verified'::public.participation_status, 'organiser verifies');
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');
select ok(exists (select 1 from public.points_ledger where reason = 'event' and source_key = 'event:00000000-0000-4000-c000-000000000001'),
          'verified participation awarded event points');

-- ---------------------------------------------------------------- rewards
select lives_ok($$ select public.redeem_reward((select id from public.rewards where title = 'Sports store 15% off')) $$, 'redeem reward');
select is((select rank from public.get_individual_leaderboard('week', null, 1) where is_me), 2::bigint, 'spending does not change rank');

-- ---------------------------------------------------------------- RLS
select pg_temp.act_as('00000000-0000-4000-b000-000000000005');
select is((select count(*) from public.activities where user_id = '00000000-0000-4000-a000-000000000001'), 0::bigint,
          'others cannot read demo activities');
select is((select count(*) from public.activity_points), 0::bigint, 'others cannot read GPS routes');
select throws_ok($$ insert into public.points_ledger (user_id, reason, source_key, amount)
                    values ('00000000-0000-4000-b000-000000000005', 'event', 'hack', 1000) $$,
                 '42501', null, 'clients cannot write the ledger');

select * from finish();
rollback;
