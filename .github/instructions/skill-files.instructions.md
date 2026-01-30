---
applyTo: plugin/skills/**/SKILL.md
---

# Skill File Authoring Guidelines

You are editing an Agent Skill file that provides instructions to AI agents. Follow these expectations when creating or modifying SKILL.md files.

## Frontmatter Requirements

Every SKILL.md must include YAML frontmatter with:

```yaml
---
name: skill-name
description: Detailed description including trigger phrases and use cases.
---
```

- **name**: 1-64 characters, lowercase letters and hyphens only, must match directory name
- **description**: 1-1024 characters, explain WHAT the skill does and WHEN to use it. Include trigger phrases.

## Size Limits

Keep the main SKILL.md concise. Move detailed documentation to files under the `references/` subfolder.

## Required Sections

1. **Quick Reference** - Summary table with key properties (MCP tools, CLI commands, best for)
2. **When to Use This Skill** - Clear list of activation scenarios
3. **MCP Tools** - Table of available MCP commands with parameters
4. **Workflow/Steps** - Numbered or phased step-by-step processes
5. **Error Handling** - Table of errors, messages, and remediation

## Formatting Standards

- Use tables for commands, properties, and comparisons
- Use ASCII decision trees for complex routing logic
- Always specify language in code blocks (```bash, ```javascript, ```yaml, etc.)
- Use callouts: `> 💡 **Tip:**` and `> ⚠️ **Warning:**`
- Only use emoji for status indicators (✅, ❌, ⚠️), avoid decorative emojis
- Mark placeholders clearly as `<placeholder-name>`

## MCP Tool Preference

- **Prefer Azure MCP tools** over direct CLI commands when available
- Document MCP tool usage with JavaScript examples
- Include tool parameters in tables with Required/Optional indicators

## Progressive Disclosure

Structure content for progressive loading:
1. Frontmatter metadata (~100 tokens) loads at startup
2. SKILL.md content (<5000 tokens) loads on skill activation
3. Reference files load on demand when linked

## Cross-Platform Compatibility

If including executable scripts:
- Provide both bash (`.sh`) and PowerShell (`.ps1`) versions for non-trivial scripts
- Trivial one-liners may use bash only

## Related Resources

- Reference the [skill-authoring skill](.github/skills/skill-authoring/SKILL.md) for detailed guidelines
- Follow the [agentskills.io specification](https://agentskills.io/specification)
