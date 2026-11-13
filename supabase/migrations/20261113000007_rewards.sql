-- Rewards and redemptions. Spending reduces the spendable balance only;
-- earned points (and therefore leaderboards) are never reduced.

create type public.redemption_status as enum ('pending', 'fulfilled', 'cancelled');

create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  cost        integer not null check (cost > 0),
  stock       integer check (stock >= 0),   -- null = unlimited
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.redemptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reward_id    uuid not null references public.rewards (id),
  cost         integer not null check (cost > 0),
  status       public.redemption_status not null default 'pending',
  code         text not null unique default upper(encode(extensions.gen_random_bytes(3), 'hex')),  -- shown at the counter
  created_at   timestamptz not null default now(),
  fulfilled_at timestamptz
);

create index redemptions_user_idx on public.redemptions (user_id);

alter table public.rewards     enable row level security;
alter table public.redemptions enable row level security;

create policy "rewards are readable"
  on public.rewards for select to authenticated using (true);

create policy "owner reads own redemptions"
  on public.redemptions for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.rewards, public.redemptions from anon, authenticated;

create or replace function private.spendable_points(p_user uuid)
returns bigint
language sql stable
set search_path = ''
as $$
  select (select coalesce(sum(amount), 0) from public.points_ledger where user_id = p_user)
       - (select coalesce(sum(cost), 0) from public.redemptions where user_id = p_user and status <> 'cancelled')
$$;

create or replace function public.redeem_reward(p_reward_id uuid)
returns public.redemptions
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_user();
  rw  public.rewards;
  rd  public.redemptions;
begin
  -- Serialise this user's redemptions so the balance check can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('redeem:' || uid::text, 0));

  select * into rw from public.rewards where id = p_reward_id and active for update;
  if not found then
    raise exception 'reward_not_found' using errcode = 'P0002';
  end if;
  if rw.stock is not null and rw.stock <= 0 then
    raise exception 'reward_out_of_stock';
  end if;
  if private.spendable_points(uid) < rw.cost then
    raise exception 'insufficient_points';
  end if;

  update public.rewards set stock = stock - 1 where id = rw.id and stock is not null;
  insert into public.redemptions (user_id, reward_id, cost) values (uid, rw.id, rw.cost) returning * into rd;
  return rd;
end $$;
