-- ─────────────────────────────────────────────────────────────────────────────
-- 003_visual_direction.sql
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS style_pack          text,
  ADD COLUMN IF NOT EXISTS font_pairing        text,
  ADD COLUMN IF NOT EXISTS inspiration_images  jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reference_urls      text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brain               jsonb;

-- Optional: create a public storage bucket for project assets
-- Do this in Supabase Dashboard → Storage → New bucket
-- Name: project-assets  Public: true
