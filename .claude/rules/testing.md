# Testing Rules (Loop System v2)

1. In graph loops, tests are written before implementation and committed failing.
2. Test files are frozen during implementation — changing a test to reach green requires stopping and getting author sign-off.
3. Data-shaped behavior (scraper extraction, classification, matching) gets fixtures (input file + expected output file). The fixture test is the evaluator.
4. Node completion requires a fresh-context verifier pass (Argus subagent with only the spec, diff, and evaluator), not the implementer's own claim.
