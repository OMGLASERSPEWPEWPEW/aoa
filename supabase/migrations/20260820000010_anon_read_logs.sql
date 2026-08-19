-- Allow MCP (anon role) to read log tables for observability
-- Pattern: familia's diagnostics table has anon SELECT and works via MCP

CREATE POLICY "anon_read_discovery_logs"
  ON discovery_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_read_scrape_logs"
  ON scrape_logs FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_read_ai_usage"
  ON ai_usage FOR SELECT
  TO anon
  USING (true);
