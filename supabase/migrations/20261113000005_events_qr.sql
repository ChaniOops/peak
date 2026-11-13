-- Organised campus sports: events, QR check-in, organiser verification.
--
-- Flow:
--   organiser screen  get_event_checkin(event_id)  -> { code, qr_payload }   (static per event)
--   student scans     check_in(scanned_text)       -> checked_in (no points yet)
--   organiser         verify_participant(event_id, user_id, approve) / verify_all_checked_in(event_id)
--                     -> verified: +events.points, daily/streak bonus, challenges/badges settle
-- The organiser's confirmation is the trust gate; the QR only proves presence-ish.

create type public.event_sport as enum ('futsal', 'pickleball', 'badminton', 'other');
create type public.participation_status as enum ('registered', 'checked_in', 'verified', 'rejected');

create table public.events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  sport        public.event_sport not null,
  description  text not null default '',
  venue        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null check (ends_at > starts_at),
  capacity     integer check (capacity > 0),
  points       integer not null default 50 check (points >= 0),
  organiser_id uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index events_starts_idx on public.events (starts_at);

create table public.event_secrets (
  event_id     uuid primary key references public.events (id) on delete cascade,
  checkin_code text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex'))
);

create table public.event_participants (
  event_id      uuid not null references public.events (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.participation_status not null default 'registered',
  registered_at timestamptz not null default now(),
  checked_in_at timestamptz,
  verified_at   timestamptz,
  verified_by   uuid references public.profiles (id) on delete set null,
  primary key (event_id, user_id)
);

create index event_participants_user_idx on public.event_participants (user_id);

alter table public.events             enable row level security;
alter table public.event_secrets      enable row level security;
alter table public.event_participants enable row level security;

create policy "events are readable"
  on public.events for select to authenticated using (true);

-- Students see their own rows; organisers see their event's rows (for the live check-in list).
create policy "participants visible to self and organiser"
  on public.event_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.events e where e.id = event_id and e.organiser_id = (select auth.uid()))
    or public.current_role_is('admin')
  );

revoke insert, update, delete on public.events, public.event_secrets, public.event_participants from anon, authenticated;
revoke select on public.event_secrets from anon, authenticated;

alter publication supabase_realtime add table public.event_participants;

create or replace function private.create_event_secret()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.event_secrets (event_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger events_create_secret
  after insert on public.events
  for each row execute function private.create_event_secret();

-- ---------------------------------------------------------------------------
-- Internals
-- ---------------------------------------------------------------------------

create or replace function private.require_event_manager(p_event_id uuid)
returns public.events
language plpgsql stable
set search_path = ''
as $$
declare e public.events;
begin
  select * into e from public.events where id = p_event_id;
  if not found then
    raise exception 'event_not_found' using errcode = 'P0002';
  end if;
  if e.organiser_id is distinct from private.require_user() and not public.current_role_is('admin') then
    raise exception 'not_event_organiser' using errcode = '42501';
  end if;
  return e;
end $$;

-- Verify or reject one checked-in participant at p_at. Idempotent for already-verified rows.
create or replace function private.decide_participant(
  p_event_id uuid, p_user uuid, p_approve boolean, p_by uuid, p_at timestamptz default now()
) returns public.event_participants
language plpgsql
set search_path = ''
as $$
declare
  ep public.event_participants;
  e  public.events;
begin
  select * into ep from public.event_participants where event_id = p_event_id and user_id = p_user for update;
  if not found then
    raise exception 'participant_not_found' using errcode = 'P0002';
  end if;
  if ep.status = 'verified' and p_approve then
    return ep;
  end if;
  if ep.status <> 'checked_in' then
    raise exception 'participant_not_checked_in';
  end if;

  if not p_approve then
    update public.event_participants set status = 'rejected', verified_at = p_at, verified_by = p_by
     where event_id = p_event_id and user_id = p_user returning * into ep;
    return ep;
  end if;

  select * into e from public.events where id = p_event_id;
  update public.event_participants set status = 'verified', verified_at = p_at, verified_by = p_by
   where event_id = p_event_id and user_id = p_user returning * into ep;

  insert into public.points_ledger (user_id, reason, source_key, amount, earned_at)
  values (p_user, 'event', 'event:' || p_event_id, e.points, p_at)
  on conflict do nothing;

  perform private.award_daily_bonus(p_user, p_at);
  perform private.settle_user(p_user);
  return ep;
end $$;

-- Challenge metric: verified events now count.
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
       where a.user_id = p_user and a.status in ('live', 'completed')
         and a.started_at >= p_from and a.started_at < p_to
         and (p_type is null or a.type = p_type))
  end
$$;

-- ---------------------------------------------------------------------------
-- Student RPCs
-- ---------------------------------------------------------------------------

-- Upcoming, ongoing and last-24h events with the caller's status.
create or replace function public.get_events()
returns table (
  id                uuid,
  title             text,
  sport             public.event_sport,
  description       text,
  venue             text,
  starts_at         timestamptz,
  ends_at           timestamptz,
  capacity          integer,
  points            integer,
  organiser_id      uuid,
  organiser_name    text,
  participant_count bigint,
  checked_in_count  bigint,
  my_status         public.participation_status,
  can_manage        boolean
)
language sql stable security definer
set search_path = ''
as $$
  select e.id, e.title, e.sport, e.description, e.venue, e.starts_at, e.ends_at, e.capacity, e.points,
         e.organiser_id, o.display_name,
         (select count(*) from public.event_participants x where x.event_id = e.id and x.status <> 'rejected'),
         (select count(*) from public.event_participants x where x.event_id = e.id and x.status in ('checked_in', 'verified')),
         (select x.status from public.event_participants x where x.event_id = e.id and x.user_id = auth.uid()),
         e.organiser_id = auth.uid() or public.current_role_is('admin')
    from public.events e
    left join public.profiles o on o.id = e.organiser_id
   where e.ends_at > now() - interval '1 day'
   order by e.starts_at
$$;

create or replace function public.register_event(p_event_id uuid)
returns public.event_participants
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  e   public.events;
  ep  public.event_participants;
begin
  select * into e from public.events where id = p_event_id for update;
  if not found or e.ends_at <= now() then
    raise exception 'event_not_open' using errcode = 'P0002';
  end if;
  select * into ep from public.event_participants where event_id = e.id and user_id = uid;
  if found then
    return ep;
  end if;
  if e.capacity is not null and (select count(*) from public.event_participants x
                                  where x.event_id = e.id and x.status <> 'rejected') >= e.capacity then
    raise exception 'event_full';
  end if;
  insert into public.event_participants (event_id, user_id) values (e.id, uid) returning * into ep;
  return ep;
end $$;

-- Accepts the raw scanned text ('peak:checkin:AB12CD34') or just the code typed by hand.
-- Valid from 30 min before start until 30 min after the end. No points until verified.
create or replace function public.check_in(p_code text)
returns table (event_id uuid, title text, status public.participation_status)
language plpgsql security definer
set search_path = ''
as $$
declare
  uid  uuid := private.require_user();
  code text := upper(regexp_replace(trim(coalesce(p_code, '')), '^.*[:/=]', ''));
  e    public.events;
  ep   public.event_participants;
begin
  select ev.* into e from public.events ev join public.event_secrets s on s.event_id = ev.id
   where s.checkin_code = code;
  if not found then
    raise exception 'invalid_checkin_code' using errcode = 'P0002';
  end if;
  if now() < e.starts_at - interval '30 minutes' or now() > e.ends_at + interval '30 minutes' then
    raise exception 'checkin_window_closed';
  end if;

  select * into ep from public.event_participants x where x.event_id = e.id and x.user_id = uid;
  if found and ep.status = 'rejected' then
    raise exception 'checkin_rejected';
  end if;

  if not found or ep.status = 'registered' then
    insert into public.event_participants as x (event_id, user_id, status, checked_in_at)
    values (e.id, uid, 'checked_in', now())
    on conflict on constraint event_participants_pkey do update set status = 'checked_in', checked_in_at = now()
    returning * into ep;
  end if;

  return query select e.id, e.title, ep.status;
end $$;

-- ---------------------------------------------------------------------------
-- Organiser RPCs (event organiser or admin)
-- ---------------------------------------------------------------------------

create or replace function public.get_event_checkin(p_event_id uuid)
returns table (event_id uuid, code text, qr_payload text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_event_manager(p_event_id);
  return query
    select s.event_id, s.checkin_code, 'peak:checkin:' || s.checkin_code
      from public.event_secrets s where s.event_id = p_event_id;
end $$;

create or replace function public.get_event_participants(p_event_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  department_id   text,
  status          public.participation_status,
  registered_at   timestamptz,
  checked_in_at   timestamptz,
  verified_at     timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_event_manager(p_event_id);
  return query
    select ep.user_id, p.display_name, p.department_id, ep.status, ep.registered_at, ep.checked_in_at, ep.verified_at
      from public.event_participants ep join public.profiles p on p.id = ep.user_id
     where ep.event_id = p_event_id
     order by (ep.status = 'checked_in') desc, ep.checked_in_at nulls last, p.display_name;
end $$;

create or replace function public.verify_participant(p_event_id uuid, p_user_id uuid, p_approve boolean default true)
returns public.event_participants
language plpgsql security definer
set search_path = ''
as $$
declare uid uuid := private.require_user();
begin
  perform private.require_event_manager(p_event_id);
  if p_user_id = uid and not public.current_role_is('admin') then
    raise exception 'cannot_verify_self' using errcode = '42501';
  end if;
  return private.decide_participant(p_event_id, p_user_id, p_approve, uid);
end $$;

-- Approves everyone currently checked in. Returns how many were verified.
create or replace function public.verify_all_checked_in(p_event_id uuid)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  r   record;
  n   integer := 0;
begin
  perform private.require_event_manager(p_event_id);
  for r in select ep.user_id from public.event_participants ep
            where ep.event_id = p_event_id and ep.status = 'checked_in' and ep.user_id <> uid
  loop
    perform private.decide_participant(p_event_id, r.user_id, true, uid);
    n := n + 1;
  end loop;
  return n;
end $$;
