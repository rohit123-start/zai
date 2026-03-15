-- Allow project collaborators to access the projects and related data they've
-- been invited to.

-- ─── projects ─────────────────────────────────────────────────────────────────

-- Collaborators can read projects they have been added to
CREATE POLICY IF NOT EXISTS "Collaborators can read their projects"
  ON public.projects
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = id
        AND pc.user_id = auth.uid()
    )
  );

-- ─── project_pages ────────────────────────────────────────────────────────────

-- Collaborators can read project pages
CREATE POLICY IF NOT EXISTS "Collaborators can read project pages"
  ON public.project_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.uid()
          )
        )
    )
  );

-- Editors can insert/update project pages
CREATE POLICY IF NOT EXISTS "Editors can write project pages"
  ON public.project_pages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.uid()
              AND pc.role = 'editor'
          )
        )
    )
  );

CREATE POLICY IF NOT EXISTS "Editors can update project pages"
  ON public.project_pages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.uid()
              AND pc.role = 'editor'
          )
        )
    )
  );

-- ─── project_files ────────────────────────────────────────────────────────────

-- Collaborators can read project files
CREATE POLICY IF NOT EXISTS "Collaborators can read project files"
  ON public.project_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.uid()
          )
        )
    )
  );

-- Editors can write project files
CREATE POLICY IF NOT EXISTS "Editors can write project files"
  ON public.project_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.uid()
              AND pc.role = 'editor'
          )
        )
    )
  );

CREATE POLICY IF NOT EXISTS "Editors can update project files"
  ON public.project_files
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.uid()
              AND pc.role = 'editor'
          )
        )
    )
  );
