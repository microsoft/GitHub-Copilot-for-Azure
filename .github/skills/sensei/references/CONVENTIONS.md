# Azure Skills frontmatter conventions

## Basic format

Per the [agentskills.io spec](https://agentskills.io/specification), required and optional fields:

The frontmatter has the following format.

```yaml
---
name: skill-name
description: "[ACTION VERB] [UNIQUE_DOMAIN]. [One clarifying sentence]. WHEN: trigger 1, trigger 2, trigger 3."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---
```

## Rules

Skill name must:
- Has only Lowercase alphanumeric + hyphens
- Has no consecutive hyphens (`--`)
- Not start or end with hyphen `-`
- Match parent directory name
- Has 1-64 characters

Description length must be >= 150 characters and <= 1024 characters. Description must contain trigger phrases ("WHEN:"). Description should avoid having anti-triggers ("DO NOT USE FOR:"), see Anti-trigger rule section below.

The license must be MIT. The author must be "Microsoft". The version must be "0.0.0-placeholder".

There may be additional properties. Leave it up to the author to make sure they are correct.

Use inline double-quoted strings for descriptions. Do NOT use `>-` folded scalars (incompatible with skills.sh). Do NOT use `|` literal blocks (preserves newlines). Keep total description under 1024 characters.

### Anti-trigger rule

⚠️ **"DO NOT USE FOR:" carries context-dependent risk.** In multi-skill environments (10+ skills with overlapping domains), anti-trigger clauses introduce the very keywords that cause wrong-skill activation on Claude Sonnet and fast-pattern-matching models ([evidence](https://gist.github.com/kvenkatrajan/52e6e77f5560ca30640490b4cc65d109)). For small, isolated skill sets (1-5 skills), the risk is low. When in doubt, use positive routing with `WHEN:` and distinctive quoted phrases.

**Exception:** `DO NOT USE FOR:` is **REQUIRED** when a specialized skill's triggers overlap with a broader skill (e.g., `azure-prepare` on "deploy to Azure"). Without the negative discriminator, the broader skill captures prompts that should route to the specialized one. Use routing test result to determine if a `DO NOT USE FOR:` clause is needed.
