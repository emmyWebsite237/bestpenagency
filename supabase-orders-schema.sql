-- ============================================================
-- BestPenAgency — Service requests + referral tracking
-- Run in Supabase Dashboard → SQL Editor → New Query → Run.
-- Assumes public.profiles (with referral_code) already exists
-- from the earlier Influenzar schema.
-- ============================================================

-- 1. REFERRAL TAPS
-- One row per (referral_code, device) the FIRST time that device
-- ever lands on the site carrying that code. This is what makes a
-- referral count go up the instant a link is tapped — before any
-- order ever happens. The unique constraint means repeat visits
-- from the same device don't inflate the count.
create table if not exists public.referral_taps (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null references public.profiles(referral_code),
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (referral_code, device_id)
);

alter table public.referral_taps enable row level security;

-- Anyone (including anonymous visitors) can log a tap.
drop policy if exists "Anyone can log a referral tap" on public.referral_taps;
create policy "Anyone can log a referral tap"
  on public.referral_taps for insert
  to anon, authenticated
  with check (true);

-- A referrer can see only taps that belong to their own code.
drop policy if exists "Referrers can view own taps" on public.referral_taps;
create policy "Referrers can view own taps"
  on public.referral_taps for select
  to authenticated
  using (referral_code = (select referral_code from public.profiles where id = auth.uid()));


-- 2. SERVICE ORDERS (guest requests — no account needed)
-- One row per "Request This Service" form submission. amount and
-- commission_amount stay null until an admin fills in the agreed
-- price and marks it rendered (the approval workflow itself is a
-- separate conversation — this just stores the data cleanly for it).
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  service_name text not null,
  details text,
  device_id text,
  referral_code text references public.profiles(referral_code),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'rendered', 'cancelled')),
  amount numeric,
  commission_amount numeric,
  created_at timestamptz not null default now(),
  rendered_at timestamptz
);

alter table public.service_orders enable row level security;

-- Anyone (guests) can submit a request.
drop policy if exists "Anyone can submit a service request" on public.service_orders;
create policy "Anyone can submit a service request"
  on public.service_orders for insert
  to anon, authenticated
  with check (true);

-- A referrer can see only orders tied to their own referral code
-- (so their future "Referrals"/"Earnings" pages have something real
-- to read from once that UI gets built).
drop policy if exists "Referrers can view own referred orders" on public.service_orders;
create policy "Referrers can view own referred orders"
  on public.service_orders for select
  to authenticated
  using (referral_code = (select referral_code from public.profiles where id = auth.uid()));

-- Note: there is deliberately no admin/update policy yet — marking
-- an order "rendered" and setting its amount is a separate decision
-- still to be made (who does it, from where). Until then, do that
-- part directly from Supabase's Table Editor using your project's
-- own dashboard access, which bypasses RLS entirely.


-- 3. AUTO-CALCULATE COMMISSION WHEN AN ORDER IS MARKED RENDERED
-- Whoever/whatever eventually flips status to 'rendered', this
-- trigger does the math automatically: 10% of the agreed amount,
-- and stamps rendered_at. No manual commission entry needed.
create or replace function public.calculate_commission()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'rendered' and old.status is distinct from 'rendered' then
    new.rendered_at := now();
    if new.amount is not null and new.referral_code is not null then
      new.commission_amount := round(new.amount * 0.10, 2);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_rendered on public.service_orders;
create trigger on_order_rendered
  before update on public.service_orders
  for each row execute procedure public.calculate_commission();
