---
name: skill-reviewer
description: "Review skill PRs with structured severity-rated feedback covering token budgets, routing conflicts, required sections, and repo conventions. WHEN: \"review skill\", \"review skill PR\", \"review skill changes\", \"check skill quality\", \"skill PR feedback\"."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.3"
---

# Skill PR Reviewer

Performs thorough, structured code reviews of skill PRs — severity-classified findings with actionable fixes, positive acknowledgment, and a summary table.

## When to Use

- Reviewing a PR that adds or modifies a skill under `plugin/skills/` or `.github/skills/`
- Checking skill compliance before submitting a PR
- Auditing an existing skill for quality issues

> 💡 **Note:** `.github/skills/` meta-skills have different conventions — checklist sections 8-9 apply only to `plugin/skills/` service skills.

## Review Workflow

1. **Collect** — Identify all changed skill files (SKILL.md, references, tests, scripts)
2. **Check** — Run each category from the [review checklist](references/review-checklist.md)
3. **Classify** — Assign severity per the [severity guide](references/severity-classification.md)
4. **Analyze Routing** — Check triggers for conflicts per [routing analysis](references/routing-analysis.md)
5. **Draft** — Write the review per the [output format](references/output-format.md)
6. **Validate** — Verify suggested fixes are actionable with accurate file/line references

## Error Handling

| Error | Remediation |
|-------|-------------|
| Cannot determine changed files | Ask user for the file list or PR number |
| Token counting unavailable | Estimate at ~4 chars per token |

## References

- [Review Checklist](references/review-checklist.md)
- [Severity Classification](references/severity-classification.md)
- [Routing Analysis](references/routing-analysis.md)
- [Output Format](references/output-format.md)
