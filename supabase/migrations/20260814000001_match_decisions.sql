CREATE TABLE IF NOT EXISTS public.match_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  our_venue_name text NOT NULL,
  our_venue_id uuid REFERENCES public.venues(id),
  external_venue_name text NOT NULL,
  source text NOT NULL,
  heuristic_score numeric(4,3),
  ai_verdict boolean,
  ai_confidence numeric(3,2),
  final_decision text NOT NULL CHECK (final_decision IN ('matched', 'rejected', 'ai_matched', 'ai_rejected')),
  human_override boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_decisions_pair ON public.match_decisions(our_venue_name, external_venue_name, source);

ALTER TABLE public.match_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read match decisions" ON public.match_decisions FOR SELECT USING (true);
CREATE POLICY "Service role can insert match decisions" ON public.match_decisions FOR INSERT WITH CHECK (true);
