---
title: Activity Log
type: log
---

# Activity Log

| Date | Action | Page | Notes |
|------|--------|------|-------|
| 2026-04-10 | init | - | Project wiki initialized |
| 2026-04-10 | ingest | context/stack.md | Compiled stack + architecture from CLAUDE.md |
| 2026-04-22 | audit-fix | web/src/ (6 files) | L99 bug audit — safe SWR fetcher, hydration mismatch, notes data-loss, silent duplicate count, missing useCallback deps. Commit 4185021, deployed to Vercel. |
| 2026-04-23 | handoff | wiki/, web/PYTHON-REWRITE-PLAN.md, .gitignore | Housekeeping commit — wiki scaffolding + Python (Botasaurus) rewrite plan landed; local tooling dirs (.claude/, graphify-out/, .next/, raw/) now gitignored. No source changes; tsc clean, vitest 57/57. |
