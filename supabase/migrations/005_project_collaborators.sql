-- Project-level collaboration tables

-- Accepted collaborators on a project
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'editor'
                          CHECK (role IN ('owner','editor','viewer')),
  invited_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Pending email invitations (before the invitee signs up / accepts)
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'editor'
                          CHECK (role IN ('editor','viewer')),
  invited_by  uuid        NOT NULL REFERENCES auth.users(id),
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations   ENABLE ROW LEVEL SECURITY;

-- Project owner can do anything with collaborators
CREATE POLICY "Project owner manages collaborators"
  ON public.project_collaborators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Collaborators can read the list of other collaborators on their shared project
CREATE POLICY "Collaborators can read project collaborators"
  ON public.project_collaborators
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc2
      WHERE pc2.project_id = project_id
        AND pc2.user_id = auth.uid()
    )
  );

-- Project owner can manage invitations
CREATE POLICY "Project owner manages invitations"
  ON public.project_invitations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project ON public.project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user    ON public.project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project   ON public.project_invitations(project_id);
