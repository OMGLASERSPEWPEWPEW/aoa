-- Cost tracking RPCs for admin dashboard
-- SECURITY DEFINER so admins can see all usage (including scraper with null user_id)

CREATE OR REPLACE FUNCTION public.get_ai_cost_total(p_days integer DEFAULT 30)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  FROM ai_usage
  WHERE created_at > now() - (p_days || ' days')::interval;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_cost_by_model(p_days integer DEFAULT 30)
RETURNS TABLE (
  model text,
  call_count bigint,
  total_input_tokens bigint,
  total_output_tokens bigint,
  total_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    model,
    count(*) AS call_count,
    COALESCE(SUM(input_tokens), 0)::bigint AS total_input_tokens,
    COALESCE(SUM(output_tokens), 0)::bigint AS total_output_tokens,
    COALESCE(SUM(estimated_cost_usd), 0) AS total_cost
  FROM ai_usage
  WHERE created_at > now() - (p_days || ' days')::interval
  GROUP BY model
  ORDER BY total_cost DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_cost_by_feature(p_days integer DEFAULT 30)
RETURNS TABLE (
  feature text,
  call_count bigint,
  total_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(feature, 'unknown') AS feature,
    count(*) AS call_count,
    COALESCE(SUM(estimated_cost_usd), 0) AS total_cost
  FROM ai_usage
  WHERE created_at > now() - (p_days || ' days')::interval
  GROUP BY feature
  ORDER BY total_cost DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_daily_cost(p_days integer DEFAULT 14)
RETURNS TABLE (
  day text,
  call_count bigint,
  total_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') AS day,
    count(*) AS call_count,
    COALESCE(SUM(estimated_cost_usd), 0) AS total_cost
  FROM ai_usage
  WHERE created_at > now() - (p_days || ' days')::interval
  GROUP BY day
  ORDER BY day DESC;
$$;
