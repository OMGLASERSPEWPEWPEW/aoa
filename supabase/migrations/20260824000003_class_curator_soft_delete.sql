-- Step 17b: Public reads must not see soft-deleted sessions
-- Admins can still see them (for the SHOW REMOVED toggle)

-- Update the existing select policy to filter deleted_at for non-admins
DO $$ BEGIN
  DROP POLICY IF EXISTS class_sessions_select ON public.class_sessions;
  CREATE POLICY class_sessions_select ON public.class_sessions
    FOR SELECT USING (deleted_at IS NULL OR public.is_admin());
EXCEPTION WHEN undefined_object THEN
  CREATE POLICY class_sessions_select ON public.class_sessions
    FOR SELECT USING (deleted_at IS NULL OR public.is_admin());
END $$;
