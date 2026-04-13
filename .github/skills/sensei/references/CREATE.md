# Creating a New Skill

Guidelines for writing Agent Skills that comply with the [agentskills.io specification](https://agentskills.io/specification).

## Frontmatter Template

```yaml
---
name: skill-name
description: "[ACTION VERB] [UNIQUE_DOMAIN]. [One clarifying sentence]. WHEN: \"trigger 1\", \"trigger 2\", \"trigger 3\"."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---
```

## Constraints

| Field | Rule |
|-------|------|
| `name` | 1-64 chars, lowercase + hyphens, match directory name |
| `description` | 1-1024 chars, ≤60 words, explain WHAT and WHEN |
| Trigger format | Use `WHEN:` with quoted phrases (preferred over `USE FOR:`) |
| `DO NOT USE FOR` | Only when disambiguation-critical (trigger overlap with broader skill) |
| Scalar style | Inline double-quoted strings only (no `>-` folded scalars) |
| SKILL.md | <500 tokens (soft), <5000 (hard) |
| references/*.md | <1000 tokens each |

## Structure

```
.github/skills/{skill-name}/
├── SKILL.md           # Required — instructions
├── references/        # Optional — detailed docs (JIT-loaded)
└── scripts/           # Optional — executable code
```

## Progressive Disclosure

- Metadata (~100 tokens) loads at startup
- SKILL.md (<5000 tokens) loads on activation
- References load **only when explicitly linked** (`[text](references/file.md)`)
- Link to files, not folders
- Write self-contained reference files (no caching between requests)

## Pre-Submission Checklist

### Frontmatter
- [ ] `name` lowercase + hyphens, matches directory, 1-64 chars
- [ ] `name` does not start with `claude-` or `anthropic-`
- [ ] `description` ≤60 words, uses `WHEN:` trigger phrases
- [ ] `description` uses inline double-quoted string
- [ ] No XML angle brackets in frontmatter
- [ ] `license`, `metadata.version` present

### Token Budget
- [ ] SKILL.md under 500 tokens (soft limit)
- [ ] SKILL.md under 5000 tokens (hard limit)
- [ ] Reference files each under 1000 tokens
- [ ] Run `cd scripts && npm run tokens -- check`

### Link Integrity
- [ ] All markdown links resolve to existing files
- [ ] All files in `references/` are linked (no orphans)
- [ ] Run `cd scripts && npm run references`

### Content Quality
- [ ] Action-oriented instructions (step-by-step)
- [ ] Has examples section
- [ ] Has error handling table
- [ ] Tables used for dense information
- [ ] No decorative emojis (only ✅, ❌, ⚠️ as status indicators)

## Validation Commands

```bash
cd scripts
npm run references              # Validate all skill links
npm run tokens -- check         # Check token limits
npm run frontmatter             # Validate frontmatter
```
