# Writing Effective Skills

## Progressive Disclosure

Skills use a three-tier loading model:

| Tier | Content | When Loaded |
|------|---------|-------------|
| **Metadata** | `name` + `description` | Startup (all skills) |
| **Instructions** | SKILL.md body | On activation |
| **Resources** | `references/`, `scripts/` | On demand |

**Key principle:** Keep SKILL.md lean, move details to references.

## How References Load

References load **only when explicitly linked** - NOT when the skill activates:

- ✅ `See [error guide](references/errors.md)` → Agent loads file
- ❌ "Error docs are in references/" → Agent won't find files

Per [agentskills Issue #97](https://github.com/agentskills/agentskills/issues/97):
- References are re-read each time (no caching)
- Write each reference as a **self-contained unit**
- The **entire file** loads when referenced (not sections)

## DO: Use Tables for Dense Information

```markdown
| Command | Purpose | Example |
|---------|---------|---------|
| `az login` | Authenticate | `az login --tenant ID` |
| `az account set` | Set subscription | `az account set -s NAME` |
```

## DO: Keep Instructions Action-Oriented

```markdown
## Workflow

1. **Verify prerequisites** - Check az CLI is installed
2. **Authenticate** - Run `az login`
3. **Execute scan** - Use the MCP tool with parameters
```

## DON'T: Use Token-Wasting Patterns

- ❌ Decorative emojis throughout text
- ❌ Repeated headers with same content
- ❌ Verbose explanations for simple concepts
- ❌ Inline code examples that could be referenced

## File References

Use relative paths from the skill root:

```markdown
See [the API reference](references/api-reference.md) for details.
```

Keep references one level deep. Avoid chains like `references/detail/more/file.md`.
