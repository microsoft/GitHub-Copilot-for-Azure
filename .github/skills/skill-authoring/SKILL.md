---
name: skill-authoring
description: "Guidelines for writing Agent Skills. TRIGGERS: create a skill, new skill, write a skill, skill template, skill structure, review skill, skill PR, skill compliance, agentskills spec, SKILL.md format, skill frontmatter, skill best practices"
---

# Skill Authoring Guide

This skill provides guidance for writing Agent Skills that comply with the [agentskills.io specification](https://agentskills.io/specification).

## When to Use

- Creating a new skill for this repository
- Reviewing a skill PR for compliance
- Checking if an existing skill follows best practices
- Understanding token budgets and progressive disclosure

## Constraints

- `name`: 1-64 chars, lowercase + hyphens, match directory
- `description`: 1-1024 chars, explain WHAT and WHEN
- SKILL.md: <500 tokens (soft), <5000 (hard)
- references/*.md: <1000 tokens each

## Structure

- `SKILL.md` (required) - Instructions
- `references/` (optional) - Detailed docs
- `scripts/` (optional) - Executable code

Frontmatter: `name` (lowercase-hyphens), `description` (WHAT + WHEN)

## Progressive Disclosure

Metadata (~100 tokens) loads at startup. SKILL.md (<5000 tokens) loads on activation. References load **only when explicitly linked** (not on activation). Keep SKILL.md lean.

## Reference Loading

References are JIT (just-in-time) loaded:
- Only files explicitly linked via `[text](references/file.md)` load
- Each file loads in full (not sections)
- No caching between requests - write self-contained files
- Use recipes/services patterns for multi-option skills

See [REFERENCE-LOADING.md](references/REFERENCE-LOADING.md) for details.

## Validation

```bash
# Run from the scripts directory
cd scripts
npm run tokens -- check plugin/skills/my-skill/SKILL.md
```

## Reference Documentation

- [GUIDELINES.md](references/GUIDELINES.md) - Detailed writing guidelines
- [REFERENCE-LOADING.md](references/REFERENCE-LOADING.md) - How references load and token efficiency
- [CHECKLIST.md](references/CHECKLIST.md) - Pre-submission checklist
- [agentskills.io/specification](https://agentskills.io/specification) - Official spec
