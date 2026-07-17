-- ============================================================
-- Best Pen Agency Influenzar — Supabase schema
-- Paste this whole file into Supabase Dashboard → SQL Editor →
-- New Query → Run. Safe to run once on a fresh project.
-- ============================================================

-- 1. PROFILES TABLE
-- One row per user. Holds their display name, their own unique
-- referral code (auto-generated), and which code (if any) referred
-- them in. This is separate from auth.users, which Supabase manages.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  referral_code text unique not null,
  referred_by_code text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Logged-in users can read their own profile row.
create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

-- Logged-in users can update their own profile row (e.g. later, name edits).
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id);


-- 2. AUTO-GENERATE A REFERRAL CODE FOR EVERY NEW USER
-- Runs automatically the moment someone signs up. Reads "name" and
-- "referred_by_code" from the signup form's metadata, generates a
-- random 8-character referral code, retries on the rare collision.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no confusing 0/O/1/I
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.profiles where referral_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, referral_code, referred_by_code)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    public.generate_referral_code(),
    nullif(new.raw_user_meta_data->>'referred_by_code', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. PUBLIC REFERRAL-CODE LOOKUP (for the register page's live check)
-- Exposes ONLY the referral_code column, to anyone, so the signup
-- form can verify a code exists before letting someone submit it —
-- without exposing any user's name or email to anonymous visitors.
create or replace view public.referral_lookup as
select referral_code from public.profiles;

grant select on public.referral_lookup to anon, authenticated;


-- 4. SERVICES PURCHASED (empty for now — filled in later when you
-- wire up real orders/invoices; the dashboard already reads from
-- this table and will just show "no services yet" until rows exist)
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_name text not null,
  amount numeric,
  status text default 'completed',
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "Users can view their own purchases"
on public.purchases for select
to authenticated
using (auth.uid() = user_id);
