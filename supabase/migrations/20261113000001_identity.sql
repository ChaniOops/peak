-- Identity: departments, profiles, roles, time helpers.
--
-- Conventions used across all migrations:
--   * public  = what the app talks to (tables behind RLS + RPCs).
--   * private = engine internals; not exposed through the API, no grants to app roles.
--   * Writes to anything points-related go through SECURITY DEFINER RPCs only.
--   * Campus time is Asia/Kolkata; weeks start Monday 00:00 IST.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Time helpers
-- ---------------------------------------------------------------------------

create or replace function public.campus_date(ts timestamptz default now())
returns date
language sql stable
set search_path = ''
as $$ select (ts at time zone 'Asia/Kolkata')::date $$;

-- Monday 00:00 IST of the week containing ts.
create or replace function public.campus_week_start(ts timestamptz default now())
returns timestamptz
language sql stable
set search_path = ''
as $$ select date_trunc('week', ts at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' $$;

-- Start (00:00 IST) of a campus date.
create or replace function public.campus_day_start(d date)
returns timestamptz
language sql stable
set search_path = ''
as $$ select d::timestamp at time zone 'Asia/Kolkata' $$;

-- ---------------------------------------------------------------------------
-- Departments & profiles
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('student', 'organiser', 'admin');

create table public.departments (
  id   text primary key,            -- short code, e.g. 'cse'
  name text not null
);

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  department_id text references public.departments (id),
  role          public.user_role not null default 'student',
  created_at    timestamptz not null default now()
);

create index profiles_department_idx on public.profiles (department_id);

alter table public.departments enable row level security;
alter table public.profiles    enable row level security;

create policy "departments are readable"
  on public.departments for select to authenticated using (true);

-- Profiles only hold what leaderboards/social display need (name, department, role).
create policy "profiles are readable"
  on public.profiles for select to authenticated using (true);

create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Users may change their name and department, never their role.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, department_id) on public.profiles to authenticated;
revoke insert, update, delete on public.departments from anon, authenticated;

-- Departments are also needed on the sign-up screen, before a session exists.
create policy "departments are readable before sign-in"
  on public.departments for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_role_is(r public.user_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = r)
$$;

create or replace function private.require_user()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return uid;
end $$;

-- ---------------------------------------------------------------------------
-- Profile creation on sign-up.
-- Client passes options.data = { display_name, department_id } to auth.signUp().
-- ---------------------------------------------------------------------------

create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  dept text  := meta ->> 'department_id';
begin
  insert into public.profiles (id, display_name, department_id)
  values (
    new.id,
    coalesce(nullif(trim(meta ->> 'display_name'), ''), split_part(coalesce(new.email, 'Student'), '@', 1)),
    (select d.id from public.departments d where d.id = dept)
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
