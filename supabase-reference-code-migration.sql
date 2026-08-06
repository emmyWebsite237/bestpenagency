-- ============================================================
-- BestPenAgency — Order reference codes
-- Run in Supabase Dashboard → SQL Editor → New Query → Run.
-- Builds on supabase-orders-schema.sql (run that first if you
-- haven't already).
-- ============================================================

-- 1. Add the reference code column.
alter table public.service_orders
  add column if not exists reference_code text unique;

-- 2. Generate a random 15-character reference code, retrying on
-- the rare collision. Same safe character set as referral codes
-- (no confusing 0/O/1/I).
create or replace function public.generate_reference_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..15 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.service_orders where reference_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- 3. Auto-fill it the moment a new order is inserted — the client
-- never has to generate or send one, it just reads back what got
-- created (via .select() after .insert()).
create or replace function public.set_order_reference_code()
returns trigger
language plpgsql
as $$
begin
  if new.reference_code is null then
    new.reference_code := public.generate_reference_code();
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_created on public.service_orders;
create trigger on_order_created
  before insert on public.service_orders
  for each row execute procedure public.set_order_reference_code();

-- 4. Safe public lookup — "Already requested a service? Enter your
-- reference code" needs to check a code WITHOUT giving anonymous
-- visitors the ability to browse/enumerate every order. A function
-- that only matches an exact code (not a broad SELECT policy) is
-- what makes that safe.
create or replace function public.get_order_by_reference(p_reference_code text)
returns table (
  reference_code text,
  service_name text,
  status text,
  customer_name text
)
language sql
security definer
set search_path = public
as $$
  select reference_code, service_name, status, customer_name
  from public.service_orders
  where reference_code = upper(trim(p_reference_code));
$$;

grant execute on function public.get_order_by_reference(text) to anon, authenticated;
