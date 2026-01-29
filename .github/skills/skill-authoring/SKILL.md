---
name: skill-authoring
description: Guidelines for writing Agent Skills in this repository. Use when creating new skills, reviewing skill PRs, or checking skill structure compliance. Covers frontmatter requirements, token budgets, directory structure, and best practices per agentskills.io specification.
---

# Skill Authoring Guide

This skill provides guidance for writing Agent Skills that comply with the [agentskills.io specification](https://agentskills.io/specification).

## When to Use

- Creating a new skill for this repository
- Reviewing a skill PR for compliance
- Checking if an existing skill follows best practices
- Understanding token budgets and progressive disclosure

## Quick Reference

| Constraint | Limit |
|------------|-------|
| `name` field | 1-64 chars, lowercase + hyphens |
| `description` field | 1-1024 chars |
| SKILL.md body | < 500 tokens (soft), < 5000 (hard) |
| Reference files | < 1000 tokens each |
| SKILL.md lines | < 500 lines |

## Required Structure

```
my-skill/
├── SKILL.md              # Required
├── references/           # Optional: detailed docs
├── scripts/              # Optional: executable code
└── assets/               # Optional: templates
```

## Frontmatter Template

```yaml
---
name: my-skill-name
description: What this skill does and when to use it.
---
```

**Name rules:** lowercase, hyphens, no `--`, must match directory name.

**Description:** Explain WHAT it does AND WHEN to activate it.

## Progressive Disclosure

| Tier | Budget | When Loaded |
|------|--------|-------------|
| Metadata (name + description) | ~100 tokens | Startup |
| Instructions (SKILL.md body) | < 5000 tokens | On activation |
| Resources (references/) | As needed | On demand |

Keep SKILL.md lean. Move detailed content to `references/`.

## Validation

```bash
cd scripts
npm run check -- ../plugin/skills/my-skill/SKILL.md
```

## Reference Documentation

- [GUIDELINES.md](references/GUIDELINES.md) - Detailed writing guidelines
- [CHECKLIST.md](references/CHECKLIST.md) - Pre-submission checklist
- [agentskills.io/specification](https://agentskills.io/specification) - Official spec
