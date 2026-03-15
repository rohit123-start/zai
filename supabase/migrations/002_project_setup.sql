-- ─────────────────────────────────────────────────────────────────────────────
-- 002_project_setup.sql
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_type   text,          -- 'existing_app' | 'new_idea'
  ADD COLUMN IF NOT EXISTS app_type       text,          -- e.g. 'Booking & Appointments'
  ADD COLUMN IF NOT EXISTS industry       text,          -- e.g. 'Beauty & Wellness'
  ADD COLUMN IF NOT EXISTS primary_action text,          -- one-liner: what users come to do
  ADD COLUMN IF NOT EXISTS target_user    text,          -- who the app is for
  ADD COLUMN IF NOT EXISTS platform       text[],        -- ['ios','android','web']
  ADD COLUMN IF NOT EXISTS core_features  text,          -- free-form feature list
  ADD COLUMN IF NOT EXISTS setup_notes    text,          -- optional extra notes
  ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;
