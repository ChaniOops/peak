-- Two live QR demo events (Futsal FUTSAL26, Pickleball PICKLE26) against the seeded database:
--   npx supabase test db
-- Each code checks into its own event only; organiser decisions are independent. Rolled back.
begin;
select plan(27);

create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true)
$$;

-- demo student / organiser / Futsal / Pickleball
create temp table ids on commit drop as select
  '00000000-0000-4000-a000-000000000001'::uuid as demo,
  '00000000-0000-4000-a000-000000000002'::uuid as org,
  '00000000-0000-4000-c000-000000000001'::uuid as futsal,
  '00000000-0000-4000-c000-000000000003'::uuid as pickle;
grant select on ids to authenticated;

-- ---------------------------------------------------------------- seeded window
select ok((select bool_and(now() between starts_at - interval '30 minutes' and ends_at + interval '30 minutes'
                           and ends_at > now() + interval '5 hours')
             from public.events where id in ((select futsal from ids), (select pickle from ids))),
          'both demo events are check-in-able for hours after a reset');
select is((select organiser_id from public.events where id = (select pickle from ids)), (select org from ids),
          'Pickleball is organised by organiser@peak.test');

-- ---------------------------------------------------------------- registration
select pg_temp.act_as((select demo from ids));
select is((select status from public.register_event((select futsal from ids))), 'registered'::public.participation_status,
          'demo registered for Futsal');
select is((select status from public.register_event((select pickle from ids))), 'registered'::public.participation_status,
          'demo registers for Pickleball');
select throws_ok($$ select public.get_event_checkin('00000000-0000-4000-c000-000000000003') $$,
                 'not_event_organiser', 'students cannot read the Pickleball QR');

-- ---------------------------------------------------------------- organiser QR codes
select pg_temp.act_as((select org from ids));
select is((select qr_payload from public.get_event_checkin((select futsal from ids))), 'peak:checkin:FUTSAL26', 'Futsal QR payload');
select is((select qr_payload from public.get_event_checkin((select pickle from ids))), 'peak:checkin:PICKLE26', 'Pickleball QR payload');

-- ---------------------------------------------------------------- scans hit only their own event
select pg_temp.act_as((select demo from ids));
select is((select event_id from public.check_in('peak:checkin:PICKLE26')), (select pickle from ids), 'PICKLE26 -> Pickleball');
select is((select my_status from public.get_events() where id = (select futsal from ids)), 'registered'::public.participation_status,
          'Futsal untouched by PICKLE26');
select is((select event_id from public.check_in('peak:checkin:FUTSAL26')), (select futsal from ids), 'FUTSAL26 -> Futsal');
select is((select my_status from public.get_events() where id = (select pickle from ids)), 'checked_in'::public.participation_status,
          'Pickleball still checked in after FUTSAL26');

-- ---------------------------------------------------------------- pending approvals on each organiser page
select pg_temp.act_as((select org from ids));
select is((select status from public.get_event_participants((select futsal from ids)) where user_id = (select demo from ids)),
          'checked_in'::public.participation_status, 'Futsal organiser page: demo pending');
select is((select status from public.get_event_participants((select pickle from ids)) where user_id = (select demo from ids)),
          'checked_in'::public.participation_status, 'Pickleball organiser page: demo pending');

-- ---------------------------------------------------------------- independent decisions
select is((select status from public.verify_participant((select pickle from ids), (select demo from ids), true)),
          'verified'::public.participation_status, 'organiser confirms Pickleball');
select is((select status from public.get_event_participants((select futsal from ids)) where user_id = (select demo from ids)),
          'checked_in'::public.participation_status, 'Futsal still pending after Pickleball confirm');
select is((select status from public.verify_participant((select futsal from ids), (select demo from ids), false)),
          'rejected'::public.participation_status, 'organiser rejects Futsal');
select is((select status from public.get_event_participants((select pickle from ids)) where user_id = (select demo from ids)),
          'verified'::public.participation_status, 'Pickleball stays verified after Futsal reject');

reset role;
select is((select amount from public.points_ledger
            where user_id = (select demo from ids) and source_key = 'event:' || (select pickle from ids)), 40,
          'Pickleball awards its own 40 points');
select is((select count(*) from public.points_ledger
            where user_id = (select demo from ids) and source_key = 'event:' || (select futsal from ids)), 0::bigint,
          'rejected Futsal awards nothing');

-- ---------------------------------------------------------------- rejection is final, confirm is idempotent
select pg_temp.act_as((select demo from ids));
select throws_ok($$ select public.check_in('peak:checkin:FUTSAL26') $$, 'checkin_rejected', 'rejected student cannot re-scan Futsal');
select throws_ok($$ select public.check_in('FUTSAL26') $$, 'checkin_rejected', '... nor by typing the code');
select is((select my_status from public.get_events() where id = (select futsal from ids)), 'rejected'::public.participation_status,
          'Futsal stays rejected');
select is((select status from public.check_in('peak:checkin:PICKLE26')), 'verified'::public.participation_status,
          're-scanning a verified event does not reset it');

select pg_temp.act_as((select org from ids));
select throws_ok($$ select public.verify_participant('00000000-0000-4000-c000-000000000001',
                                                     '00000000-0000-4000-a000-000000000001', true) $$,
                 'participant_not_checked_in', 'a rejected participant cannot later be confirmed');
select lives_ok($$ select public.verify_participant('00000000-0000-4000-c000-000000000003',
                                                    '00000000-0000-4000-a000-000000000001', true) $$,
                'confirming Pickleball again is a no-op');
reset role;
select is((select count(*) from public.points_ledger
            where user_id = (select demo from ids) and source_key = 'event:' || (select pickle from ids)), 1::bigint,
          'Pickleball points awarded once');

-- ---------------------------------------------------------------- ownership unchanged
select pg_temp.act_as('00000000-0000-4000-b000-000000000005');
select throws_ok($$ select public.verify_participant('00000000-0000-4000-c000-000000000003',
                                                     '00000000-0000-4000-a000-000000000001', false) $$,
                 'not_event_organiser', 'non-organisers cannot decide Pickleball');

select * from finish();
rollback;
