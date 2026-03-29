-- ── Migration 016: Pipeline Runs v3 ──────────────────────────────────────────
-- Adds three new step output columns (01.5a, 01.5b, 01.5c) plus an execution_log
-- array for real-time per-step tracing.
-- Also widens the status CHECK to include the new stopped_* variants.

-- ── 1. New step output columns ────────────────────────────────────────────────

ALTER TABLE public.pipeline_runs
  ADD COLUMN IF NOT EXISTS step_015a_output jsonb,  -- Classification (Haiku): industry/app_type match + complexity_inferred
  ADD COLUMN IF NOT EXISTS step_015b_output jsonb,  -- Domain DNA extraction (Haiku): entities, vocab, screen hints, features
  ADD COLUMN IF NOT EXISTS step_015c_output jsonb;  -- Context quality gate (code): score, result, thin_areas

-- ── 2. Execution log — append-only, one entry per pipeline step ──────────────
-- Each element is a jsonb object:
-- {
--   "step":        "01.5a",
--   "ts":          "2026-03-29T10:12:34.000Z",
--   "status":      "ok" | "warn" | "error" | "skipped",
--   "duration_ms": 1240,
--   "msg":         "human-readable summary",
--   "tokens":      { "in": 480, "out": 220 },   -- optional
--   "meta":        { ... }                        -- optional step-specific data
-- }

ALTER TABLE public.pipeline_runs
  ADD COLUMN IF NOT EXISTS execution_log jsonb[] NOT NULL DEFAULT '{}';

-- ── 3. Widen status CHECK to accept new stop/failed variants ─────────────────
-- The original CHECK only allowed: running, complete, failed
-- We now also need:  stopped_step01, stopped_step015a, stopped_step015b

ALTER TABLE public.pipeline_runs
  DROP CONSTRAINT IF EXISTS pipeline_runs_status_check;

ALTER TABLE public.pipeline_runs
  ADD CONSTRAINT pipeline_runs_status_check
  CHECK (status IN (
    'running',
    'classified',
    'complete',
    'failed',
    'stopped_step01',
    'stopped_step015a',
    'stopped_step015b'
  ));

-- ── 4. Update column comment on total_tokens to document new step keys ────────
COMMENT ON COLUMN public.pipeline_runs.total_tokens IS
  '{ step_015a: {in,out}, step_015b: {in,out}, step_08: {in,out,calls}, step_097: {in,out} }';

-- ── 5. Index on status for admin dashboards ───────────────────────────────────
CREATE INDEX IF NOT EXISTS pipeline_runs_status_idx
  ON public.pipeline_runs (status, created_at DESC);

-- ── 6. RPC: append one log entry to execution_log[] atomically ───────────────
-- Called from the pipeline server as a fire-and-forget after each step.
-- Using a stored procedure keeps the update atomic and avoids a read-modify-write.

CREATE OR REPLACE FUNCTION public.pipeline_run_append_log(
  run_id uuid,
  entry  jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.pipeline_runs
  SET    execution_log = execution_log || ARRAY[entry]
  WHERE  id = run_id;
$$;

-- Grant execute to service_role (used by the pipeline server)
GRANT EXECUTE ON FUNCTION public.pipeline_run_append_log(uuid, jsonb)
  TO service_role;
