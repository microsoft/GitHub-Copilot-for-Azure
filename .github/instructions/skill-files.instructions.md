---
applyTo: plugins/*/skills/**/SKILL.md
---

# Skill File Authoring Guidelines

You are editing an Agent Skill file that provides instructions to AI agents. Follow these expectations when creating or modifying SKILL.md files.

## Frontmatter Requirements

Every SKILL.md must include YAML frontmatter with:

```yaml
---
name: skill-name
description: "Detailed description including trigger phrases and use cases."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---
```

- **name**: 1-64 characters, lowercase letters and hyphens only, must match directory name
- **description**: 1-1024 characters, explain WHAT the skill does and WHEN to use it. Include trigger phrases.
- **license**: Required for all skills. Use `MIT` unless there is a documented exception.
- **metadata.author**: Recommended value is `Microsoft`.
- **metadata.version**: Set to `"0.0.0-placeholder"` for new skills. For skills under `plugins/`, versions are stamped automatically at build time by NBGV — use `"0.0.0-placeholder"` in source. For skills elsewhere (e.g., `.github/skills/`), set a real X.Y.Z version and bump it in the same PR that modifies the skill.

## Size Limits

Keep the main SKILL.md concise. Move detailed documentation to files under the `references/` subfolder.

## Optional Sections

1. **Prerequisite** - Expected environmental conditions for the skill to operate (e.g. files in the workspace, local CLI tools, type of projects, etc.)
2. **Error Handling** - Table of errors, messages, and remediation. When the workflow is complicated and has a high chance of getting errors, use this section to provide troubleshooting guidance. Simple workflows don't need an explicit error handling section.

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

## Integration Tests

Every skill must have its test cases written under `evals/<owning-plugin>/<skill-name>`. The test cases must be implemented as Vally eval suites. See [vally-eval](../skills/vally-eval/SKILL.md) on the requirements of the eval suites.

## Owners

The entry must include at least two distinct GitHub aliases from the skill's authoring team, plus `@RickWinter` as the fallback repository owner.

The directory containing the skill's eval suites must also have a `CODEOWNERS` entry with the same owners as the skill directory.

## Related Resources

- Reference the [skill-authoring skill](../skills/skill-authoring/SKILL.md) for detailed guidelines
- Follow the [agentskills.io specification](https://agentskills.io/specification)
