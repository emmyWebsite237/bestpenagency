-- ============================================================
-- Bestpen Influenzar — Onboarding fields migration
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run.
-- Safe to run once, after supabase-schema.sql has already been run.
-- ============================================================

alter table public.profiles
  add column if not exists username text,
  add column if not exists gender text,
  add column if not exists avatar_url text,
  add column if not exists date_of_birth date,
  add column if not exists address text,
  add column if not exists onboarding_completed boolean not null default false;

-- Nothing else changes: the existing RLS policies ("Users can view/update
-- their own profile") already cover these new columns automatically, since
-- policies apply at the row level, not per-column.
