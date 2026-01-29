# Skill Writing Guidelines

This guide provides best practices for writing Agent Skills, based on the [Agent Skills Specification](https://agentskills.io/specification).

## Quick Reference

| Constraint | Limit | Notes |
|------------|-------|-------|
| `name` field | 1-64 chars | Lowercase, hyphens only, no consecutive hyphens |
| `description` field | 1-1024 chars | Describe what AND when to use |
| SKILL.md body | < 5000 tokens | ~500 lines max |
| Reference files | < 1000 tokens | Load on demand |

## Frontmatter Requirements

### Required Fields

```yaml
---
name: my-skill-name
description: A clear description of what this skill does and when to use it.
---
```

**`name` rules:**
- 1-64 characters
- Lowercase letters, numbers, and hyphens only (`a-z`, `0-9`, `-`)
- Must not start or end with `-`
- Must not contain consecutive hyphens (`--`)
- Must match the parent directory name

**`description` rules:**
- 1-1024 characters
- Should describe BOTH what the skill does AND when to use it
- Include keywords that help agents identify relevant tasks

### Optional Fields

```yaml
---
name: my-skill-name
description: Description here.
license: Apache-2.0
compatibility: Requires az CLI and docker
metadata:
  author: your-org
  version: "1.0"
---
```

## Progressive Disclosure

Skills use a three-tier loading model to manage context efficiently:

| Tier | Content | Token Budget | When Loaded |
|------|---------|--------------|-------------|
| **Metadata** | `name` + `description` | ~100 tokens | Startup (all skills) |
| **Instructions** | SKILL.md body | < 5000 tokens | On activation |
| **Resources** | `references/`, `scripts/`, `assets/` | As needed | On demand |

### What This Means

1. **Keep SKILL.md lean** - The entire file loads when activated
2. **Move details to references/** - Only loaded when explicitly needed
3. **Split large content** - Multiple smaller files > one large file

## Directory Structure

```
my-skill/
├── SKILL.md              # Required: main instructions
├── references/           # Optional: detailed documentation
│   ├── API-REFERENCE.md
│   └── EXAMPLES.md
├── scripts/              # Optional: executable code
│   └── helper.sh
└── assets/               # Optional: templates, data files
    └── template.json
```

## Token Budget Guidelines

| File Type | Soft Limit | Hard Limit | Action if Exceeded |
|-----------|------------|------------|-------------------|
| SKILL.md | 500 tokens | 5000 tokens | Split into references |
| references/*.md | 1000 tokens | 2000 tokens | Split further |
| docs/*.md | 1500 tokens | 3000 tokens | Restructure |

## Writing Effective Skills

### DO: Write Clear Activation Triggers

```yaml
# Good - specific keywords and scenarios
description: Performs Azure compliance assessments using azqr. Use when users 
  ask to check compliance, assess Azure resources, run azqr, or review security posture.
```

```yaml
# Bad - too vague
description: Helps with Azure stuff.
```

### DO: Use Tables for Dense Information

```markdown
| Command | Purpose | Example |
|---------|---------|---------|
| `az login` | Authenticate | `az login --tenant ID` |
| `az account set` | Set subscription | `az account set -s NAME` |
```

### DO: Keep Instructions Action-Oriented

```markdown
## Workflow

1. **Verify prerequisites** - Check az CLI is installed
2. **Authenticate** - Run `az login`
3. **Execute scan** - Use the MCP tool with parameters
```

### DON'T: Use Token-Wasting Patterns

See [ANTI-PATTERNS.md](../markdown-token-optimizer/references/ANTI-PATTERNS.md) for details.

- ❌ Decorative emojis throughout text
- ❌ Repeated headers with same content
- ❌ Verbose explanations for simple concepts
- ❌ Inline code examples that could be referenced

## File References

When referencing other files, use relative paths from the skill root:

```markdown
See [the API reference](references/API-REFERENCE.md) for details.

Run the setup script:
scripts/setup.sh
```

Keep references one level deep. Avoid chains like `references/detail/more/file.md`.

## Validation

Before submitting, verify your skill with the token checker:

```bash
cd scripts
npm run check -- ../plugin/skills/my-skill/SKILL.md
```

Or run the full validation:

```bash
npm run check
```

## Resources

- [Agent Skills Specification](https://agentskills.io/specification)
- [What Are Skills](https://agentskills.io/what-are-skills)
- [Example Skills](https://github.com/anthropics/skills)
- [Reference Library](https://github.com/agentskills/agentskills/tree/main/skills-ref)
