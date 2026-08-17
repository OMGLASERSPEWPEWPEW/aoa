# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---


## 2026-08-16 — Versioning Discipline and the Main-Branch Question

### What Happened Today

Ten commits landed on main today, spanning four version bumps: 0.14.0 through 0.16.1. The work covered scraper strategy tree refactoring (0.14.1), a class discovery dashboard with UI and gateway changes (0.15.0), a full map layer with dual-mode markers and filters (0.16.0), and a theme-token fix for dark overlay backgrounds (0.16.1). Every code-touching commit was paired with a version bump. A new versioning rule was codified in `.claude/rules/versioning.md`, and the `/cap` skill now enforces bump compliance before committing.

### Versioning Discipline: What Went Right

The semver classification was accurate throughout the day. Patch bumps (0.14.1, 0.16.1) were correctly applied to bug fixes and refactors that did not add user-facing capabilities. Minor bumps (0.15.0, 0.16.0) were reserved for genuine new features — the class discovery dashboard and the map classes layer. This is the kind of discipline that makes a changelog trustworthy. Users reading the patch notes can distinguish "something new appeared" from "something broken was fixed" purely by the version number.

The addition of `/cap` as an enforcement gate is significant. Before today, version bumps were a convention — followed when remembered, skipped when forgotten. Now they are a checkpoint. The `/cap` skill compares the current `package.json` version against what was last deployed and blocks commits that change `src/` or `supabase/functions/` without a bump. This is the difference between a guideline and a guardrail. Guidelines drift. Guardrails hold.

### Commit Grouping: Atomic and Readable

The commit messages follow a consistent `type(scope): description` format with version tags in parentheses on build bumps. Infra commits (journals, memory heaps) are cleanly separated from feature commits. Documentation commits (PRDs, graphs, ADRs) are grouped apart from code commits. This separation matters for two reasons: first, `git log --oneline` reads like a narrative rather than a wall of noise; second, reverting a feature does not accidentally roll back documentation or vice versa.

One pattern worth noting: the version bump commit (`chore(build): bump version to X.Y.Z`) is a separate commit from the feature commit. This is deliberate. It means the changelog update and `package.json` change are isolated. If a feature needs reverting, the bump commit also reverts cleanly without tangling with code changes.

### Branch Strategy: The Elephant in the Room

All ten commits landed directly on main. No feature branches. No pull requests. For a solo developer iterating rapidly on a pre-launch product, this is pragmatic — the overhead of branch-per-feature is real when there is no team to review PRs. But it carries risk. A bad commit to main means the live PWA (deployed via Vercel on push) is immediately broken for the user testing on their iPhone.

The current mitigation is the `/cap` skill — it runs checks before committing. But it does not replace the safety net of a staging branch. My recommendation, which I will advocate for when the project approaches its launch phase, is a simple two-branch model: `develop` for daily work, `main` for production-ready code. Feature branches remain optional for solo work, but the develop/main split gives a buffer between "committed" and "deployed."

For now, the velocity-over-ceremony tradeoff is appropriate. The project is in Phase 4 of a 7-phase build. Breaking changes are expected. The user tests on live and redirects quickly. But this should be revisited before Phase 6 (Launch).

### Commitments

1. **Monitor version bump accuracy** — watch for cases where patch should have been minor or vice versa.
2. **Advocate for develop/main split** when the project enters Phase 6 pre-launch stabilization.
3. **Track untracked file debt** — several files (design zips, test files, a migration) are sitting untracked across sessions. These should either be committed or added to `.gitignore` to keep `git status` clean.
4. **Document the /cap workflow** — the skill is now a core part of the commit pipeline and deserves a brief entry in the project README or contributing guide.
