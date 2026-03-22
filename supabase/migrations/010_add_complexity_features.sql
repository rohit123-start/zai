-- Add complexity and features columns to the projects table
-- complexity: MVP | Startup | Scale
-- features: selected feature chips (Authentication, Payments, etc.)

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS complexity text NOT NULL DEFAULT 'MVP',
  ADD COLUMN IF NOT EXISTS features   text[] NOT NULL DEFAULT '{}';
