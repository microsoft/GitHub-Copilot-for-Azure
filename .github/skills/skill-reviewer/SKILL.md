---
name: skill-reviewer
description: "Review skill PRs with structured severity-rated feedback covering token budgets, routing conflicts, required sections, and repo conventions. WHEN: \"review skill\", \"review skill PR\", \"review this PR\", \"check skill quality\", \"skill PR feedback\"."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Skill PR Reviewer

Performs thorough, structured code reviews of skill PRs — severity-classified findings with actionable fixes, positive acknowledgment, and a summary table.

## When to Use

- Reviewing a PR that adds or modifies a skill under `plugin/skills/`
- Checking skill compliance before submitting a PR
- Auditing an existing skill for quality issues

## Review Output Format

Structure every review as:

1. `## Code Review — PR #<number>: <title>`
2. `### ✅ What Looks Good` — 3-5 genuine positives
3. Severity sections (🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low) — omit empty ones
4. Each finding: numbered title, **File(s)** with lines, **Issue** with evidence, **Suggested Fix**
5. `### Summary` — table of Priority × Count
6. `**Overall Assessment:**` — Approve / Comment / Request Changes

Number findings sequentially across all severities.

## Review Workflow

1. **Collect** — Identify all changed skill files (SKILL.md, references, tests, scripts)
2. **Check** — Run each category from the [review checklist](references/review-checklist.md)
3. **Classify** — Assign severity per the [severity guide](references/severity-classification.md)
4. **Analyze Routing** — Check triggers for conflicts per [routing analysis](references/routing-analysis.md)
5. **Draft** — Write the review in the output format above
6. **Validate** — Verify suggested fixes are actionable with accurate file/line references

## Error Handling

| Error | Remediation |
|-------|-------------|
| Cannot determine changed files | Ask user for the file list or PR number |
| Token counting unavailable | Estimate at ~4 chars per token |
| Skill not in skills.json | Flag as a High finding |

## References

- [Review Checklist](references/review-checklist.md) — Full checklist of what to verify
- [Severity Classification](references/severity-classification.md) — How to assign severity levels
- [Routing Analysis](references/routing-analysis.md) — Trigger overlap and routing conflict detection
