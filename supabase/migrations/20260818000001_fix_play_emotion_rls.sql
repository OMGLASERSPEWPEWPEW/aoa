-- Re-enable RLS on play_emotion_counts (was disabled in production)
ALTER TABLE public.play_emotion_counts ENABLE ROW LEVEL SECURITY;

-- Recreate the read-only policy (matches sibling emotion_counts tables)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'play_emotion_counts'
    AND policyname = 'Anyone can read play emotion counts'
  ) THEN
    CREATE POLICY "Anyone can read play emotion counts"
      ON public.play_emotion_counts FOR SELECT USING (true);
  END IF;
END $$;

-- Ensure grants match siblings
GRANT SELECT ON public.play_emotion_counts TO authenticated;
