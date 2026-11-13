-- Core demo chain against the seeded database:  npx supabase test db
-- phone walk -> live persistence -> Everest -> MovePoints -> challenge -> leaderboards,
-- plus QR verification, rewards and the RLS boundaries. Everything is rolled back.
begin;
select plan(30);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;

-- ---------------------------------------------------------------- demo setup
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

select is((select current_steps from public.get_everest()), 52400::bigint, 'demo Everest seeded 600 steps short of summit');
select is((select summit_count from public.get_everest()), 0, 'no summit yet');
select is((select target - progress from public.get_challenges() where slug = 'dept-step-summit'), 400::numeric,
          'CSE is 400 steps short of the Department Step Summit');
select is((select rank from public.get_individual_leaderboard('week', null, 1) where is_me), 3::bigint, 'demo starts 3rd this week');
select ok(not (public.get_home() -> 'streak' ->> 'active_today')::boolean, 'demo not yet active today');
select ok(exists (select 1 from public.get_challenges() where joined) and exists (select 1 from public.get_challenges() where not joined),
          'challenges include joined and joinable');

-- ---------------------------------------------------------------- live walk
create temp table t_act on commit drop as select * from public.start_activity('walk');
grant select on t_act to authenticated;
select is((select status from t_act), 'live'::public.activity_status, 'start_activity creates a live walk');

reset role;
update public.activities set started_at = now() - interval '8 minutes' where id = (select id from t_act);
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

select is((select steps from public.push_activity((select id from t_act), 450, 340, 270)), 450, 'push_activity stores cumulative steps');
select is((select steps from public.push_activity((select id from t_act), 300, null, 280)), 450, 'steps never go backwards');
select ok((select steps from public.push_activity((select id from t_act), 999999, null, 290)) <= 8 * 60 * 3.5,
          'cadence clamp caps impossible steps');
select is((select steps from public.push_activity((select id from t_act), 450, 340, 300)), 1680, 'clamped value is kept (monotonic)');

reset role;
update public.activities set steps = 450 where id = (select id from t_act);  -- back to a realistic walk
select private.sync_activity_points((select id from t_act));
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');

select is((public.get_home() -> 'live_activity' ->> 'id')::uuid, (select id from t_act), 'Home sees the live activity');
select is((select current_steps from public.get_everest()), 52850::bigint, 'Everest includes live steps');
select is((select points from public.get_individual_leaderboard('week', null, 1) where is_me), 767::bigint,
          'leaderboard includes live provisional points');

-- ---------------------------------------------------------------- finish
create temp table t_sum on commit drop as select public.finish_activity((select id from t_act), 650, 490, 420) as s;
grant select on t_sum to authenticated;

select is((select s -> 'activity' ->> 'status' from t_sum), 'completed', 'finish_activity completes');
select is((select (s -> 'points' ->> 'base')::int from t_sum), 6, '650 steps = 6 base MovePoints');
select is((select s -> 'completed_challenges' -> 0 ->> 'slug' from t_sum), 'dept-step-summit', 'walk completes the CSE team challenge');
select ok((select s -> 'new_badges' @> '[{"id":"summit"}]' from t_sum), 'Summit badge awarded');
select is((select summit_count from public.get_everest()), 1, 'Everest summited (1.0x)');
select is((select rank from public.get_individual_leaderboard('week', null, 1) where is_me), 2::bigint, 'demo overtakes into 2nd');

reset role;
select cmp_ok((select count(*) from public.points_ledger where reason = 'team_challenge'), '>=', 2::bigint,
              'CSE teammates also rewarded');
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
