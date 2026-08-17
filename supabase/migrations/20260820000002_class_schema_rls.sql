-- F70: RLS policies for class tables

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_interest ENABLE ROW LEVEL SECURITY;

-- Schools: public read
CREATE POLICY "schools_select" ON public.schools FOR SELECT USING (true);

-- Class sessions: public read
CREATE POLICY "class_sessions_select" ON public.class_sessions FOR SELECT USING (true);

-- Class teachers: public read
CREATE POLICY "class_teachers_select" ON public.class_teachers FOR SELECT USING (true);

-- Class interest: user-scoped read/write
CREATE POLICY "class_interest_select" ON public.class_interest
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "class_interest_insert" ON public.class_interest
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "class_interest_update" ON public.class_interest
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "class_interest_delete" ON public.class_interest
  FOR DELETE USING (auth.uid() = user_id);
