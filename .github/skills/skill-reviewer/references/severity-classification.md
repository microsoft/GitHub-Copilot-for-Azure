# Severity Classification Guide

Assign each finding exactly one severity. When in doubt, choose the higher severity.

## 🔴 Critical

Blocks correctness, breaks routing, or wastes massive context budget.

| Pattern | Example |
|---------|---------|
| Token budget exceeded 5×+ | `constraints.md` at 13,303 tokens (limit 2,000) |
| All references loaded every flow | "You MUST read resources.md in full" with 29K total tokens |
| Routing broken | Trigger phrases directly conflict with existing skill |
| Frontmatter invalid | `name` has uppercase, consecutive hyphens, or doesn't match directory |
| Security issue | Hardcoded credentials, secrets in code blocks |

## 🟠 High

Violates required conventions or creates reliability risk.

| Pattern | Example |
|---------|---------|
| Missing required SKILL.md sections | No Quick Reference, no Error Handling table |
| Token budget exceeded 2-5× | Reference file at 3,500 tokens (limit 1,000) |
| No selective reference loading | Skill loads all 11 files (~29K tokens) instead of using recipe routing |
| Missing test registration | Skill not in `tests/skills.json` |
| Version not bumped | Modified skill without incrementing `metadata.version` |
| Description exceeds 60 words | 107 words in description (guideline is ≤60) |

## 🟡 Medium

Inconsistencies, maintainability issues, or missing best practices.

| Pattern | Example |
|---------|---------|
| DRY violation | MCP tool guidance duplicated in SKILL.md and a reference |
| Missing user checkpoint | No confirmation after research phase before investing in planning |
| Inconsistent data | Marker detection tables differ between coordinating skills |
| Incomplete examples | Sample plan has 2 resources instead of realistic 5-6 |
| Token budget exceeded 1-2× | Reference file at 1,500 tokens (limit 1,000) |
| Generic trigger phrases | "deploy to Azure" without skill-specific qualifier |

## 🟢 Low

Style, polish, and minor guideline deviations.

| Pattern | Example |
|---------|---------|
| Emoji in headings | `## ⚠️ MANDATORY WORKFLOW` instead of `## Workflow` |
| Missing script variants | Bash commands without PowerShell equivalents |
| Code blocks without language | ``` instead of ```bash |
| Minor formatting | Inconsistent table alignment, extra blank lines |

## Overall Assessment Decision

| Condition | Assessment |
|-----------|------------|
| Any Critical findings | **Request Changes** |
| ≥2 High findings | **Request Changes** |
| 1 High + ≥2 Medium | **Request Changes** |
| 1 High or ≤3 Medium only | **Comment** |
| Only Low findings | **Approve** (with suggestions) |
| No findings | **Approve** |
