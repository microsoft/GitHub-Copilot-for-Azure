# Skill Submission Checklist

Use this checklist before submitting a new skill or updating an existing one.

## Frontmatter Validation

- [ ] `name` field is present and 1-64 characters
- [ ] `name` uses only lowercase letters, numbers, and hyphens
- [ ] `name` does not start or end with a hyphen
- [ ] `name` matches the parent directory name
- [ ] `description` field is present and 1-1024 characters
- [ ] `description` explains WHAT the skill does
- [ ] `description` explains WHEN to use it (activation triggers)

## Token Budget

- [ ] SKILL.md is under 500 tokens (soft limit)
- [ ] SKILL.md is under 5000 tokens (hard limit per spec)
- [ ] SKILL.md is under 500 lines
- [ ] Reference files are each under 1000 tokens
- [ ] Run `npm run check` from `scripts/` directory

## Structure

- [ ] SKILL.md exists in the skill root directory
- [ ] Optional `references/` directory for detailed docs
- [ ] Optional `scripts/` directory for executable code
- [ ] Optional `assets/` directory for templates/data
- [ ] File references use relative paths from skill root
- [ ] No deeply nested reference chains

## Content Quality

- [ ] Instructions are action-oriented (step-by-step)
- [ ] Tables used for dense information
- [ ] No decorative emojis (only functional ones if needed)
- [ ] No repeated content across sections
- [ ] Complex details moved to `references/` files
- [ ] Code examples are minimal and purposeful

## Azure-Specific (for this repo)

- [ ] Prefers Azure MCP tools over direct CLI commands
- [ ] Uses `azd` where applicable
- [ ] Lists relevant MCP tools in a "Tools Used" section
- [ ] Includes troubleshooting section for common issues
- [ ] Scripts include both bash and PowerShell versions (if non-trivial)

## Testing

- [ ] Skill activates correctly when relevant prompts are used
- [ ] Referenced files exist and are accessible
- [ ] Scripts execute without errors
- [ ] MCP tools mentioned are available and documented

## Final Steps

```bash
# Run token check
cd scripts
npm run check

# Generate updated metadata (optional)
npm run tokens
```

If any checks fail, see [GUIDELINES.md](GUIDELINES.md) for guidance.
