# Review Checklist

Run every check against the changed files. Each failed check becomes a finding.

## 1. Frontmatter

| Check | Rule |
|-------|------|
| `name` | 1-64 chars, lowercase + hyphens, matches directory name |
| `description` | 1-1024 chars, ≤60 words, includes WHAT + WHEN triggers |
| `license` | Must be `MIT` |
| `metadata.author` | Recommended: `Microsoft`; warn if missing or not `Microsoft` |
| `metadata.version` | Semver (`X.Y.Z`), `"1.0.0"` for new skills, bumped if skill modified |
| Trigger format | Uses `WHEN:` with quoted phrases (preferred over `USE FOR:`) |
| `DO NOT USE FOR` | Only present if disambiguation-critical (overlaps broader skill) |

## 2. Token Budgets

| File | Soft Limit | Hard Limit |
|------|-----------|------------|
| SKILL.md | 500 tokens | 5,000 tokens |
| Each reference file | 1,000 tokens | 2,000 tokens |

Estimate tokens at ~4 characters per token. When available, use `cd scripts && npm run tokens -- check` to verify.

Flag files that exceed limits. For large files, recommend splitting by category with an index README.md.

## 3. Required SKILL.md Sections

### Service skills (`plugin/skills/`)

Every service skill SKILL.md must contain:

1. **Quick Reference** — Summary table (Best for, Primary capabilities, MCP tools)
2. **When to Use This Skill** — Activation scenarios list
3. **MCP Tools** — Table with tool names and purposes
4. **Workflow/Steps** — Numbered or phased steps
5. **Error Handling** — Table with Error, Message, Remediation columns

### Meta-skills (`.github/skills/`)

Meta-skills require only:

1. **When to Use** — Activation scenarios list
2. **Workflow/Steps** — Numbered or phased steps
3. **Error Handling** — Table with Error, Message, Remediation columns

## 4. Progressive Disclosure

- SKILL.md should NOT contain `read X in full` directives for large files
- References must be JIT-loaded via explicit links (`[text](references/file.md)`)
- Link to files, not folders
- Check for selective loading patterns (recipe-based routing) vs loading all references every flow
- Calculate total token load for a typical flow

## 5. Routing and Triggers

See [routing-analysis.md](routing-analysis.md) for detailed checks.

- Trigger phrases must be specific to this skill's domain
- No generic phrases that overlap with existing skills
- Verify against `tests/skills.json` registered skill list

## 6. Content Quality

| Check | Rule |
|-------|------|
| Broken links | All `[text](path)` references resolve to existing files |
| Orphaned files | All files in `references/` are linked from SKILL.md or another reference |
| DRY violations | No duplicated guidance across SKILL.md and references |
| Code blocks | Must specify language (```bash, ```yaml, etc.) |
| Emoji | Only ✅, ❌, ⚠️ as status indicators; no decorative emoji in headings |
| Placeholders | Marked as `<placeholder-name>` |

## 7. Cross-Platform

- Non-trivial shell scripts must have both Bash and PowerShell variants
- Trivial one-liners may use Bash only

## 8. MCP Tools

- Prefer Azure MCP tools over direct CLI commands
- Tool names follow `mcp_azure_mcp_<tool>` convention
- Include parameters table with Required/Optional indicators

## 9. Tests

| Check | Rule |
|-------|------|
| Registered | Skill listed in `tests/skills.json` |
| Trigger tests | `tests/{skill-name}/triggers.test.ts` exists with shouldTrigger/shouldNotTrigger arrays |
| Unit tests | `tests/{skill-name}/unit.test.ts` exists |
| Snapshots | Updated if description changed |

## 10. Positive Acknowledgment

Always identify 3-5 genuine strengths before listing findings. Examples:
- Well-designed workflow with clear phase gates
- Thorough error handling
- Good use of selective reference loading
- Strong trigger phrase specificity
- Follows established repo conventions
