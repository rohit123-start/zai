-- ─────────────────────────────────────────────────────────────────────────────
-- 001_admin.sql
-- Run this in your Supabase project → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. user_profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  access     text NOT NULL DEFAULT 'read'   CHECK (access IN ('read', 'write')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Admins can read all profiles; users can read their own
CREATE POLICY "profiles_select" ON public.user_profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Only admins can update profiles (via service role from API, not RLS needed there)
CREATE POLICY "profiles_update" ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Only admins can delete profiles
CREATE POLICY "profiles_delete" ON public.user_profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Service role inserts are done via trigger (SECURITY DEFINER), no policy needed


-- ── 2. invitations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  access      text NOT NULL DEFAULT 'read'   CHECK (access IN ('read', 'write')),
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, status)          -- prevent duplicate pending invites to same email
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can see and manage all invitations
CREATE POLICY "invitations_all_admin" ON public.invitations
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );


-- ── 3. Auto-create profile on new user sign-up (trigger) ─────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite  invitations%ROWTYPE;
  cnt     int;
BEGIN
  -- Check for a pending invitation for this email
  SELECT * INTO invite
  FROM invitations
  WHERE email = NEW.email AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO user_profiles (user_id, email, role, access)
    VALUES (NEW.id, NEW.email, invite.role, invite.access);

    UPDATE invitations SET status = 'accepted' WHERE id = invite.id;
  ELSE
    -- First ever user → admin with write access
    SELECT COUNT(*) INTO cnt FROM user_profiles;
    IF cnt = 0 THEN
      INSERT INTO user_profiles (user_id, email, role, access)
      VALUES (NEW.id, NEW.email, 'admin', 'write');
    ELSE
      INSERT INTO user_profiles (user_id, email, role, access)
      VALUES (NEW.id, NEW.email, 'member', 'read');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger so re-running the migration is idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 4. Back-fill profiles for users who signed up before this migration ───────
INSERT INTO public.user_profiles (user_id, email, role, access)
SELECT
  u.id,
  u.email,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY u.created_at) = 1 THEN 'admin' ELSE 'member' END,
  CASE WHEN ROW_NUMBER() OVER (ORDER BY u.created_at) = 1 THEN 'write' ELSE 'read'  END
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id
);
