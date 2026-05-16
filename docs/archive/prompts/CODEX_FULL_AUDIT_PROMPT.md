# Prompt For Codex Full Audit

You are auditing `/Users/abstractmapping/projects/landroid` on branch
`codex/full-line-audit-2026-05-14`.

First read, in order:

1. `AGENTS.md`
2. `PROJECT_CONTEXT.md`
3. `docs/README.md`
4. `FULL_AUDIT_COORDINATION.md`
5. `CONTINUATION-PROMPT.md`

Your task is a report-only, line-by-line audit plus an opportunity backlog. Do
not fix code, do not commit, do not push, and do not rewrite existing reports.
Write your final report to:

```text
AUDIT_REPORT_CODEX_FULL_2026-05-14.md
```

Audit every in-scope file described in `FULL_AUDIT_COORDINATION.md`. Classify
every file as audited, generated skipped, binary/artifact skipped, or deferred.
Use the required personas from `FULL_AUDIT_COORDINATION.md` and add any extra
personas needed for completeness.

Required report behavior:

- Every factual claim must cite `file:line`.
- Findings must be severity-ranked and evidence-backed.
- Include what passed, what was deferred, what was skipped, and what was merely
  assumed.
- Include improvements, additions, fixes, redundancies, and roadmap ideas in a
  clearly separate opportunity backlog so speculative ideas are not confused
  with confirmed defects.
- Pay special attention to the upcoming mapping/document database workstream,
  AI PDF workflow detection/extraction, ArcGIS traverse-file output, and whether
  3D Desk Map information exploration is feasible or premature.
- Treat old audit reports as leads only; independently verify in current source.
- Run relevant read-only validation commands where practical, including at least
  `npm run deploy:check`, `npm run lint`, `npm test`, backend proxy tests, and
  `git diff --check`. If a command is skipped, explain why.
- Hosted checks may be run with user/network approval if available:
  `bash scripts/smoke-test-hosted.sh`.

Use this severity scale:

- P0: must fix before any further hosted testing.
- P1: must fix before inviting additional testers or relying on AI/cloud use.
- P2: should fix before broader beta or real project data.
- P3: cleanup, docs, maintainability, or follow-up.

End with a comparison-ready table:

| Area | Verdict | Top Risk | Evidence | Recommended Next Action |
| --- | --- | --- | --- | --- |

If your runtime supports subagents, you may spawn multiple read-only agents for
distinct audit slices. Keep the work report-only and integrate all results into
one deduplicated final report.

Remember: report only. No source fixes.
