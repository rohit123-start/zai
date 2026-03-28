-- Pipeline runs — stores every step's output for verification and debugging

CREATE TABLE IF NOT EXISTS public.pipeline_runs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL,
  status             text        NOT NULL DEFAULT 'running'
                                 CHECK (status IN ('running','complete','failed')),
  retry_count        int         NOT NULL DEFAULT 0,

  -- Step outputs (jsonb for structured data, text for large HTML)
  step_01_input      jsonb,   -- raw S1 + S2 form data
  step_015_output    jsonb,   -- Haiku intent parse result
  step_02_output     jsonb,   -- theme/font dictionary pick
  step_03_output     jsonb,   -- structured user context (validated)
  step_04_output     jsonb,   -- loaded brain files (industry, product, feature modules, theme tokens)
  step_05_output     jsonb,   -- merged screen list after feature module merge
  step_06_output     jsonb,   -- resolved context (copy, layout, nav states, constraints)
  step_07_output     jsonb,   -- full generation context payload
  step_08_html       text,    -- Sonnet raw HTML output (all screens)
  step_095_output    jsonb,   -- structural validation report
  step_097_output    jsonb,   -- Haiku quality check report (score, checks, warnings)
  step_098_html      text,    -- Sonnet targeted fix HTML (if triggered)
  final_html         text,    -- delivered HTML
  screens            text[],  -- final screen inventory list
  error_log          jsonb,   -- error details on failure

  -- Token and timing telemetry
  duration_ms        int,
  total_tokens       jsonb,   -- { step_015: {in,out}, step_08: {in,out}, step_097: {in,out}, step_098: {in,out} }

  created_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz
);

-- Index for fast lookup by project
CREATE INDEX IF NOT EXISTS pipeline_runs_project_id_idx
  ON public.pipeline_runs (project_id, created_at DESC);

-- RLS: users can see their own pipeline runs
ALTER TABLE public.pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pipeline runs"
  ON public.pipeline_runs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can do all"
  ON public.pipeline_runs FOR ALL
  USING (true)
  WITH CHECK (true);
