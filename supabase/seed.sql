-- Demo seed. All timestamps are relative to now(), so re-seed on demo day:
--   local:  npx supabase db reset
--   hosted: npx supabase db reset --linked
--
-- Accounts (password for all: peak-demo-2026)
--   demo@peak.test       student, CSE  - the account used for the live phone demo
--   organiser@peak.test  organiser     - verifies event check-ins
--   admin@peak.test      admin
--   student01..27@peak.test background students
--
-- Every seeded activity is pushed through the real points engine, so ledger,
-- streaks, personal bests, challenges and leaderboards are all consistent.

select set_config('app.seeding', 'on', false);
select setseed(0.2026);

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------
insert into public.departments (id, name) values
  ('cse',  'Computer Science & Engineering'),
  ('ece',  'Electronics & Communication'),
  ('ee',   'Electrical Engineering'),
  ('me',   'Mechanical Engineering'),
  ('ce',   'Civil Engineering'),
  ('mgmt', 'Management Studies');

-- ---------------------------------------------------------------------------
-- Users (auth.users + auth.identities; profiles come from the sign-up trigger)
-- ---------------------------------------------------------------------------
create temporary table seed_users (id uuid, email text, name text, dept text, role public.user_role, activity_level float8);

insert into seed_users values
  ('00000000-0000-4000-a000-000000000001', 'demo@peak.test',      'Ankur Gogoi',  'cse', 'student',   0),
  ('00000000-0000-4000-a000-000000000002', 'organiser@peak.test', 'Priya Saikia', 'ece', 'organiser', 0.5),
  ('00000000-0000-4000-a000-000000000003', 'admin@peak.test',     'Peak Admin',   null,  'admin',     0);

insert into seed_users
select ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
       'student' || lpad(n::text, 2, '0') || '@peak.test',
       name,
       (array['cse', 'ece', 'ee', 'me', 'ce', 'mgmt'])[1 + (n % 6)],
       'student',
       -- spread of engagement: some daily movers, some occasional
       0.25 + 0.65 * random()
from unnest(array[
  'Rituparna Bora', 'Dhruba Kalita', 'Nilakshi Deka', 'Pranjal Hazarika', 'Ishita Sarma',
  'Bikram Baruah', 'Moonmi Das', 'Jyotirmoy Phukan', 'Anindita Choudhury', 'Rahul Medhi',
  'Sneha Talukdar', 'Kaustav Borah', 'Pallabi Nath', 'Hrishikesh Gohain', 'Tanvi Mahanta',
  'Abhijit Bhuyan', 'Riya Rajkhowa', 'Debashish Sonowal', 'Kangkana Dutta', 'Manash Pathak',
  'Barnali Bhattacharya', 'Sourav Konwar', 'Ankita Bordoloi', 'Partha Chetia', 'Mridusmita Lahkar',
  'Arup Neog', 'Simran Ahmed'
]) with ordinality as t (name, n);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('peak-demo-2026', extensions.gen_salt('bf')), now() - interval '30 days',
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_strip_nulls(jsonb_build_object('display_name', u.name, 'department_id', u.dept)),
       now() - interval '30 days', now(),
       '', '', '', '', '', '', '', ''
from seed_users u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from seed_users u;

update public.profiles p set role = u.role from seed_users u where p.id = u.id and u.role <> 'student';

-- ---------------------------------------------------------------------------
-- Challenges (this campus week) and memberships
-- ---------------------------------------------------------------------------
insert into public.challenges (slug, title, description, metric, activity_type, scope, target, starts_at, ends_at, reward_points)
select v.slug, v.title, v.description, v.metric::public.challenge_metric, v.activity_type::public.activity_type,
       v.scope::public.challenge_scope, v.target, public.campus_week_start(), public.campus_week_start() + interval '7 days', v.reward
from (values
  ('run-15k',          'Run 15 km this week',       'Log 15 km of tracked runs before Sunday night.',                  'distance_m',      'run',   'individual', 15000,      100),
  ('dept-step-summit', 'Department Step Summit',    'Every joined member''s steps count towards your department''s total.', 'steps',     null,    'department', 1000000000, 50),
  ('campus-ride-500',  'Campus rides 500 km',       'Together, ride 500 km across campus this week.',                  'distance_m',      'cycle', 'campus',     500000,     40),
  ('five-sessions',    'Five sessions this week',   'Complete five tracked sessions of 2+ minutes.',                    'sessions',        null,    'individual', 5,          50),
  ('play-two',         'Play two verified games',   'Check in to two organised games and get verified by the organiser.', 'verified_events', null,  'individual', 2,          60)
) as v (slug, title, description, metric, activity_type, scope, target, reward);
-- dept-step-summit gets its real target after activities are processed (see below).

-- Demo account: joined run-15k + dept-step-summit; five-sessions / play-two / campus-ride-500 left to join live.
insert into public.challenge_members (challenge_id, user_id, joined_at)
select c.id, '00000000-0000-4000-a000-000000000001', public.campus_week_start() + interval '2 hours'
from public.challenges c where c.slug in ('run-15k', 'dept-step-summit');

insert into public.challenge_members (challenge_id, user_id, joined_at)
select c.id, u.id, public.campus_week_start() + interval '3 hours'
from public.challenges c cross join seed_users u
where u.role <> 'admin' and u.id <> '00000000-0000-4000-a000-000000000001'
  and abs(hashtext(c.slug || u.email)) % 100 < case c.slug when 'dept-step-summit' then 75 when 'campus-ride-500' then 45
                                                            when 'five-sessions' then 40 when 'run-15k' then 30 else 20 end;

-- ---------------------------------------------------------------------------
-- Background activity: 14 days, deterministic pseudo-random
-- ---------------------------------------------------------------------------
create temporary table seed_acts (id uuid default gen_random_uuid(), user_id uuid, type public.activity_type,
                                  started_at timestamptz, active_s int, steps int, distance_m float8);

do $$
declare
  u record;
  d int;
  r float8;
  t public.activity_type;
  st timestamptz;
  dur int; stp int; dist float8;
begin
  for u in select * from seed_users where activity_level > 0 order by id loop
    for d in reverse 13..0 loop
      continue when random() > u.activity_level;
      r := random();
      t := case when r < 0.6 then 'walk' when r < 0.85 then 'run' else 'cycle' end;
      st := public.campus_day_start(public.campus_date() - d) + make_interval(hours => 6 + floor(random() * 13)::int, mins => floor(random() * 60)::int);
      if t = 'walk' then
        stp := 2500 + floor(random() * 8500)::int; dist := stp * 0.75; dur := (stp / 1.7)::int;
      elsif t = 'run' then
        dist := 2000 + floor(random() * 6000); dur := (dist / (2.6 + random()))::int; stp := (dist / 1.2)::int;
      else
        dist := 5000 + floor(random() * 13000); dur := (dist / (4 + 2 * random()))::int; stp := 0;
      end if;
      continue when st + make_interval(secs => dur) > now() - interval '20 minutes';
      insert into seed_acts (user_id, type, started_at, active_s, steps, distance_m) values (u.id, t, st, dur, stp, dist);
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Demo account history: an unbroken daily streak (not yet active today), and this week's
-- Everest sitting 600 steps short of the 53,000-step summit.
-- ---------------------------------------------------------------------------
do $$
declare
  demo   uuid := '00000000-0000-4000-a000-000000000001';
  gap    int  := 600;                                    -- steps left to summit
  today  date := public.campus_date();
  wk     date := public.campus_date(public.campus_week_start());
  n_days int  := greatest(today - wk, 0);               -- full days this week before today
  remain int  := 53000 - gap;
  d      date;
  i      int  := 0;
  stp    int;
begin
  -- Last week (outside Everest window) - gives history and personal bests to beat.
  for d in select generate_series(today - 9, least(wk - 1, today - 6), interval '1 day')::date loop
    insert into seed_acts (user_id, type, started_at, active_s, steps, distance_m)
    values (demo, 'walk', public.campus_day_start(d) + interval '17 hours', 4200, 7000, 5250);
  end loop;

  -- Two runs this week (4 km + 5 km = 9 km of the 15 km run challenge).
  if n_days >= 2 then
    insert into seed_acts (user_id, type, started_at, active_s, steps, distance_m) values
      (demo, 'run', public.campus_day_start(wk) + interval '6 hours 30 minutes', 1500, 3300, 4000),
      (demo, 'run', public.campus_day_start(wk + 1) + interval '6 hours 30 minutes', 1800, 4200, 5000);
    remain := remain - 3300 - 4200;
  end if;

  -- Rest of this week's steps as daily walks (or one walk earlier today if the week just began).
  if n_days = 0 then
    insert into seed_acts (user_id, type, started_at, active_s, steps, distance_m)
    values (demo, 'walk', greatest(public.campus_week_start(), now() - interval '3 hours'), 3600, remain, remain * 0.75);
  else
    for d in select generate_series(wk, today - 1, interval '1 day')::date loop
      i := i + 1;
      stp := remain / n_days;
      if i = n_days then stp := remain - stp * (n_days - 1); end if;
      insert into seed_acts (user_id, type, started_at, active_s, steps, distance_m)
      values (demo, 'walk', public.campus_day_start(d) + interval '17 hours', (stp / 1.7)::int, stp, stp * 0.75);
    end loop;
  end if;

  -- Days before this week needed to keep the 5-day streak alive (if the week is young).
  for d in select generate_series(today - 5, wk - 1, interval '1 day')::date loop
    continue when exists (select 1 from seed_acts a where a.user_id = demo and public.campus_date(a.started_at) = d);
    insert into seed_acts (user_id, type, started_at, active_s, steps, distance_m)
    values (demo, 'walk', public.campus_day_start(d) + interval '17 hours', 3600, 6000, 4500);
  end loop;
end $$;

insert into public.activities (id, user_id, type, status, started_at, ended_at, last_push_at, active_s, steps, distance_m)
select id, user_id, type, 'completed', started_at, started_at + make_interval(secs => active_s),
       started_at + make_interval(secs => active_s), active_s, steps, distance_m
from seed_acts;

-- A stored GPS route for the demo account's most recent run (2 laps of a ~400 m-radius loop).
insert into public.activity_points (activity_id, seq, lat, lng, accuracy_m, recorded_at)
select a.id, g,
       26.1880 + 0.0036 * sin(2 * pi() * g / 60.0),
       91.6915 + 0.0040 * cos(2 * pi() * g / 60.0),
       6, a.started_at + make_interval(secs => g * 15)
from (select id, started_at from public.activities
       where user_id = '00000000-0000-4000-a000-000000000001' and type = 'run'
       order by started_at desc limit 1) a,
     generate_series(0, 120) g;

-- Run every seeded activity through the engine, oldest first.
do $$
declare a record;
begin
  for a in select id from public.activities order by started_at loop
    perform private.sync_activity_points(a.id);
    perform private.after_activity_completed(a.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Events (organised by organiser@peak.test). The live futsal event's QR code is FUTSAL26
-- (payload 'peak:checkin:FUTSAL26'); the demo account is registered but not checked in.
-- ---------------------------------------------------------------------------
insert into public.events (id, title, sport, description, venue, starts_at, ends_at, capacity, points, organiser_id)
select v.id::uuid, v.title, v.sport::public.event_sport, v.description, v.venue, v.starts_at, v.ends_at, v.capacity, v.points,
       '00000000-0000-4000-a000-000000000002'
from (values
  ('00000000-0000-4000-c000-000000000001', 'Futsal 5-a-side: Evening Kickoff', 'futsal',
   'Mixed-department 5-a-side. Scan the organiser''s QR at the turf, play, get verified.', 'Main Sports Complex, Turf 1',
   now() - interval '20 minutes', now() + interval '100 minutes', 20, 50),
  ('00000000-0000-4000-c000-000000000002', 'Inter-department Futsal League', 'futsal',
   'League night: CSE vs ECE, ME vs CE.', 'Main Sports Complex, Turf 1',
   public.campus_day_start(public.campus_date() - 1) + interval '18 hours',
   public.campus_day_start(public.campus_date() - 1) + interval '20 hours', 30, 50),
  ('00000000-0000-4000-c000-000000000003', 'Pickleball Open Play', 'pickleball',
   'Paddles provided. All levels welcome.', 'Indoor Court B',
   public.campus_day_start(public.campus_date() + 1) + interval '7 hours',
   public.campus_day_start(public.campus_date() + 1) + interval '9 hours', 16, 40),
  ('00000000-0000-4000-c000-000000000004', 'Badminton Doubles Ladder', 'badminton',
   'Bring a partner or get paired on court.', 'Badminton Hall',
   public.campus_day_start(public.campus_date() + 2) + interval '17 hours 30 minutes',
   public.campus_day_start(public.campus_date() + 2) + interval '19 hours 30 minutes', 24, 40),
  ('00000000-0000-4000-c000-000000000005', 'Riverside Fun Run', 'other',
   'Easy social 5 km along the riverfront. Verified attendance only.', 'Campus Main Gate',
   public.campus_day_start(public.campus_date() + 5) + interval '6 hours 30 minutes',
   public.campus_day_start(public.campus_date() + 5) + interval '8 hours', null, 60)
) as v (id, title, sport, description, venue, starts_at, ends_at, capacity, points);

update public.event_secrets set checkin_code = 'FUTSAL26' where event_id = '00000000-0000-4000-c000-000000000001';

create temporary table seed_bg as
select id, row_number() over (order by email) as n from seed_users where email like 'student%';

-- Live futsal: demo registered; 4 checked in (pending organiser), 2 already verified.
insert into public.event_participants (event_id, user_id, status, registered_at, checked_in_at)
select '00000000-0000-4000-c000-000000000001'::uuid, '00000000-0000-4000-a000-000000000001'::uuid, 'registered'::public.participation_status, now() - interval '1 day', null::timestamptz
union all
select '00000000-0000-4000-c000-000000000001', id, 'checked_in', now() - interval '1 day', now() - interval '15 minutes' + make_interval(mins => n::int)
from seed_bg where n between 1 and 6;

-- Yesterday's league: 10 players, all checked in.
insert into public.event_participants (event_id, user_id, status, registered_at, checked_in_at)
select '00000000-0000-4000-c000-000000000002', id, 'checked_in', now() - interval '3 days',
       public.campus_day_start(public.campus_date() - 1) + interval '17 hours 50 minutes'
from seed_bg where n between 7 and 16;

-- Upcoming registrations.
insert into public.event_participants (event_id, user_id)
select '00000000-0000-4000-c000-000000000003'::uuid, id from seed_bg where n % 5 = 0
union all
select '00000000-0000-4000-c000-000000000004', id from seed_bg where n % 6 = 1;

-- Organiser verifications through the real engine.
do $$
declare r record;
begin
  for r in select user_id from public.event_participants
            where event_id = '00000000-0000-4000-c000-000000000002' order by user_id loop
    perform private.decide_participant('00000000-0000-4000-c000-000000000002', r.user_id, true,
      '00000000-0000-4000-a000-000000000002', public.campus_day_start(public.campus_date() - 1) + interval '20 hours 5 minutes');
  end loop;
  for r in select ep.user_id from public.event_participants ep join seed_bg b on b.id = ep.user_id
            where ep.event_id = '00000000-0000-4000-c000-000000000001' and b.n in (5, 6) loop
    perform private.decide_participant('00000000-0000-4000-c000-000000000001', r.user_id, true,
      '00000000-0000-4000-a000-000000000002', now() - interval '5 minutes');
  end loop;
end $$;

drop table seed_bg;

-- Department Step Summit: CSE sits 400 steps short (a demo walk completes it for the whole team);
-- other departments get the same round target.
do $$
declare
  c   public.challenges := (select c from public.challenges c where slug = 'dept-step-summit');
  p   numeric := private.challenge_progress(c, '00000000-0000-4000-a000-000000000001');
  tgt numeric := ceil((p + 1500) / 5000) * 5000;
  filler uuid;
begin
  update public.challenges set target = tgt where id = c.id;
  -- Top up one joined CSE teammate's latest walk this week so CSE is exactly 400 short.
  select a.id into filler
    from public.activities a
    join public.challenge_members m on m.user_id = a.user_id and m.challenge_id = c.id
    join public.profiles pr on pr.id = a.user_id and pr.department_id = 'cse'
   where a.type = 'walk' and a.started_at >= c.starts_at and a.user_id <> '00000000-0000-4000-a000-000000000001'
   order by a.started_at desc limit 1;
  if filler is not null then
    update public.activities set steps = steps + (tgt - 400 - p)::int where id = filler;
    perform private.sync_activity_points(filler);
  end if;
end $$;

-- Leaderboard drama: one rival clearly #1, another just ahead of the demo account, so the
-- live demo walk (base points + CSE team bonus) visibly overtakes them. Rivals are outside CSE
-- so the Department Step Summit gap stays exact. Top-ups only add steps to existing walks.
do $$
declare
  demo uuid := '00000000-0000-4000-a000-000000000001';
  wk   timestamptz := public.campus_week_start();
  d    bigint := (select sum(amount) from public.points_ledger where user_id = demo and earned_at >= wk);
  rival record;
  w     record;
  need  int;
  room  int;
  add   int;
  n     int := 0;
  dd    date;
  new_id uuid;
begin
  for rival in
    select l.user_id, sum(l.amount) as pts
      from public.points_ledger l join public.profiles p on p.id = l.user_id
     where l.earned_at >= wk and l.user_id <> demo and p.department_id <> 'cse'
     group by l.user_id order by 2 desc limit 2
  loop
    n := n + 1;
    -- Make sure the rival walked every day this week (more daily-cap room to top up).
    for dd in select generate_series(public.campus_date(wk), public.campus_date() - 1, interval '1 day')::date loop
      continue when exists (select 1 from public.activities a where a.user_id = rival.user_id and a.type = 'walk'
                              and public.campus_date(a.started_at) = dd);
      insert into public.activities (user_id, type, status, started_at, ended_at, last_push_at, active_s, steps, distance_m)
      values (rival.user_id, 'walk', 'completed', public.campus_day_start(dd) + interval '18 hours',
              public.campus_day_start(dd) + interval '18 hours 30 minutes', public.campus_day_start(dd) + interval '18 hours 30 minutes',
              1800, 3000, 2250)
      returning id into new_id;
      perform private.sync_activity_points(new_id);
      perform private.after_activity_completed(new_id);
    end loop;
    need := (d + case n when 1 then 220 else 30 end
             - (select sum(amount) from public.points_ledger where user_id = rival.user_id and earned_at >= wk))::int;
    for w in
      select a.id, a.started_at from public.activities a
       where a.user_id = rival.user_id and a.type = 'walk' and a.started_at >= wk
       order by a.started_at desc
    loop
      exit when need <= 0;
      room := 200 - (select coalesce(sum(l.amount), 0) from public.points_ledger l
                      where l.user_id = rival.user_id and l.reason = 'activity'
                        and public.campus_date(l.earned_at) = public.campus_date(w.started_at));
      add := least(need, greatest(room, 0));
      continue when add = 0;
      update public.activities set steps = steps + add * 100,
                                   distance_m = distance_m + add * 75,
                                   active_s = active_s + add * 59
       where id = w.id;
      perform private.sync_activity_points(w.id);
      need := need - add;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Rewards (spending never changes leaderboard rank)
-- ---------------------------------------------------------------------------
insert into public.rewards (title, description, cost, stock, sort) values
  ('Canteen chai & snack',       'One chai and a snack at the central canteen.',         150,  null, 10),
  ('Gym slot priority (1 week)', 'Book gym slots a day before everyone else.',           250,  20,   20),
  ('Sports store 15% off',       'One-time 15% discount at the campus sports store.',    400,  30,   30),
  ('Peak water bottle',          'Insulated steel bottle.',                              600,  15,   40),
  ('Peak dri-fit tee',           'Limited run of the Peak training tee.',                1200, 10,   50);

insert into public.redemptions (user_id, reward_id, cost, status, created_at, fulfilled_at)
select '00000000-0000-4000-a000-000000000001', r.id, r.cost, 'fulfilled', now() - interval '3 days', now() - interval '3 days'
from public.rewards r where r.title = 'Canteen chai & snack';

drop table seed_acts;
drop table seed_users;
select set_config('app.seeding', 'off', false);
