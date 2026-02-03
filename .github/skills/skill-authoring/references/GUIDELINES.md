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

### Critical: How References Load

References load **only when explicitly linked** - NOT when the skill activates:

- ✅ `See [error guide](references/errors.md)` → Agent loads `errors.md`
- ❌ "Error docs are in references/" → Agent won't find or load files

Per the [spec clarification](https://github.com/agentskills/agentskills/issues/97):
- References are **re-read each time referenced** (no caching)
- Write references as **self-contained units**
- The **entire file** loads when referenced (not just sections)

## Directory Structure

```
my-skill/
├── SKILL.md              # Required: main instructions
├── references/           # Optional: detailed documentation
│   ├── api-reference.md  # Lowercase with hyphens
│   └── examples.md       # Lowercase with hyphens
├── templates/            # Optional: output templates (for report generation)
│   └── report-template.md
├── scripts/              # Optional: executable code
│   └── helper.sh
└── assets/               # Optional: templates, data files
    └── template.json
```

### References Folder

The `references/` folder contains detailed documentation that is loaded on-demand to keep the main SKILL.md file lean:

- **Purpose**: Additional context, examples, troubleshooting guides, or technical details
- **When to use**: When SKILL.md content exceeds token budget or when details are rarely needed
- **Naming convention**: Use lowercase letters with hyphens (e.g., `api-reference.md`, `troubleshooting.md`)
- **Examples**: `error-handling.md`, `validation-commands.md`, `oauth-flows.md`

### Templates Folder

The `templates/` folder contains structured output formats used when the skill generates reports or formatted responses:

- **Purpose**: Predefined structures for consistent report generation
- **When to use**: When the skill needs to format output in a specific way (e.g., cost reports, analysis summaries)
- **Naming convention**: Use lowercase letters with hyphens (e.g., `report-template.md`, `cost-analysis.md`)
- **Examples**: `redis-subscription-level-report.md`, `detailed-cache-analysis.md`

## Advanced: Recipes and Services Patterns

For skills supporting multiple tools or cloud services, use structured subfolders:

### Recipes Pattern

Use when skill supports multiple implementation approaches (deployment tools, IaC options):

```
skill-name/
├── SKILL.md
└── references/
    ├── recipes/
    │   ├── azd/           # Azure Developer CLI
    │   │   ├── README.md
    │   │   └── errors.md
    │   ├── bicep/         # Bicep IaC
    │   │   ├── README.md
    │   │   └── patterns.md
    │   └── terraform/     # Terraform IaC
    └── common.md          # Shared across recipes
```

**Link selectively in SKILL.md:**
```markdown
## Choose Deployment Method
- [Azure Developer CLI](references/recipes/azd/README.md) - Recommended
- [Bicep](references/recipes/bicep/README.md) - IaC-first
- [Terraform](references/recipes/terraform/README.md) - Multi-cloud
```

This ensures only the chosen recipe loads, not all options.

### Services Pattern

Use when skill works with multiple cloud services:

```
skill-name/
├── SKILL.md
└── references/
    └── services/
        ├── container-apps.md
        ├── static-web-apps.md
        ├── functions.md
        └── cosmos-db.md
```

Each service file should be self-contained with its own config, Bicep, and troubleshooting.

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
# Run from the scripts directory
cd scripts
npm run tokens -- check plugin/skills/my-skill/SKILL.md
```

Or run the full validation:

```bash
cd scripts
npm run tokens -- check
```

## Resources

- [Agent Skills Specification](https://agentskills.io/specification)
- [What Are Skills](https://agentskills.io/what-are-skills)
- [Reference Loading Clarification (Issue #97)](https://github.com/agentskills/agentskills/issues/97)
- [Skill Token Limits (Issue #1130)](https://github.com/github/copilot-cli/issues/1130)
- [Example Skills](https://github.com/anthropics/skills)
- [Reference Library](https://github.com/agentskills/agentskills/tree/main/skills-ref)
