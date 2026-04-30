# GitHub Copilot for Azure — Repository Instructions

This repo is a plugin containing agent skills (markdown-based knowledge packages) for Azure. Plugin source is under `plugin/`; the build produces versioned output in `output/`.

## Repository Layout

```
plugin/                   # Plugin source (skills, hooks, MCP config, manifests)
  .plugin/plugin.json     # GitHub Copilot plugin manifest
  .cursor-plugin/         # Cursor plugin manifest
  .claude-plugin/         # Claude plugin manifest
  skills/<name>/          # Individual skill directories
    SKILL.md              # Skill definition (required)
    version.json          # NBGV per-skill version config
    references/           # On-demand reference docs
  hooks/                  # Agent hooks
  .mcp.json               # MCP server declarations
  version.json            # NBGV plugin-level version config

output/                   # Build output (git-ignored) — stamped, ready to deploy
scripts/                  # Dev tooling: token analysis, frontmatter/reference validators
tests/                    # Jest test suite (unit, trigger, integration)
.github/
  instructions/           # Copilot instruction files for skill authoring
  skills/                 # Repo-local agent skills (not shipped in plugin)
  workflows/              # CI/CD workflows
docs/                     # Documentation (versioning, specs, diagrams)
eng/                      # Engineering scripts (test subscription cleanup)
gulpfile.ts               # Build pipeline
.token-limits.json        # Token budget config
.waza.yaml                # Waza eval framework config
```

## Building

```bash
npm install          # Install root + scripts deps (postinstall handles scripts/)
npm run build        # Copies plugin/ → output/, stamps NBGV versions, generates CHANGELOG.md
```

## Versioning Rules

This repo uses **Nerdbank.GitVersioning (NBGV)**. Versions are computed automatically from git commit history.

- **Never manually edit version numbers** in `plugin.json` or SKILL.md frontmatter under `plugin/`
- Source files must always use `"0.0.0-placeholder"` — the build stamps real versions
- Each skill has its own `version.json` with `pathFilters: ["."]`; only commits touching that skill's directory increment its version
- For skills outside `plugin/` (e.g., `.github/skills/`), set a real semver version and bump it in the same PR that modifies the skill
- Use conventional commit-style PR titles (`feat:`, `fix:`, `feature:`) — the build generates `CHANGELOG.md` from these

## Validating Changes

### Token and Structure Validators (from repo root)

```bash
npm run tokens check          # Check token limits against .token-limits.json
npm run tokens compare        # Compare token counts vs main
```

### Frontmatter and Reference Validation (from scripts/)

```bash
cd scripts
npm run frontmatter           # Validate skill YAML frontmatter against agentskills.io spec
npm run references            # Validate markdown links stay within skill directories
```

### Unit and Trigger Tests (from tests/)

```bash
cd tests
npm install
npm test                                    # Run all tests
npm test -- --testPathPatterns=<skill-name>  # Run tests for a single skill
npm run test:unit                            # Unit tests only
npm run typecheck                            # TypeScript type checking
npm run lint                                 # ESLint
```

### Integration Tests

Integration tests require the Copilot SDK and run against a live agent:

```bash
cd tests
npm run test:integration -- <skill-name>
```

Skip integration tests when the SDK is unavailable:
```bash
SKIP_INTEGRATION_TESTS=true npm test -- --testPathPatterns=<skill-name>
```

## Adding a New Skill

> ⚠️ The char-count budget for skill descriptions is close to the Copilot CLI limit. Adding new skills risks truncation. Consider extending an existing skill first.

### Steps

1. **Create the skill directory**: `plugin/skills/<your-skill-name>/`

2. **Add `version.json`**:
   ```json
   {
     "version": "1.1",
     "pathFilters": ["."]
   }
   ```

3. **Write `SKILL.md`** with required frontmatter:
   ```yaml
   ---
   name: your-skill-name
   description: "What the skill does and when to use it. Include trigger phrases."
   license: MIT
   metadata:
     author: Microsoft
     version: "0.0.0-placeholder"
   ---
   ```
   - `name` must match the directory name (lowercase, hyphens only, 1-64 chars)
   - `version` must be `"0.0.0-placeholder"` — NBGV stamps the real version at build time
   - `description` must be 1-1024 chars, explaining WHAT and WHEN with trigger phrases

4. **Required sections** in SKILL.md: Quick Reference, When to Use This Skill, MCP Tools, Workflow/Steps, Error Handling

5. **Move detailed content** to `references/` subdirectory — keep SKILL.md under 500 tokens (soft limit)

6. **Add to `tests/skills.json`**: Add your skill name to the `skills` array and assign it to an integration test schedule slot

7. **Scaffold tests**: Copy `tests/_template` to `tests/<your-skill-name>/` and update `SKILL_NAME` in each test file

8. **Validate**:
   ```bash
   npm run build                              # Verify version stamping works
   cd scripts && npm run frontmatter          # Validate frontmatter
   cd scripts && npm run references           # Validate markdown links
   cd tests && npm test -- --testPathPatterns=<your-skill-name>
   ```

### Token Limits

| File Pattern           | Soft Limit | Notes                            |
|------------------------|------------|----------------------------------|
| `SKILL.md`             | 500 tokens | Move detail to `references/`     |
| `references/**/*.md`   | 1000 tokens| Split large references           |
| `*.md` (other)         | 2000 tokens| General markdown                 |

Token estimation: ~4 characters ≈ 1 token. Limits are configured in `.token-limits.json`.

### Skill Authoring Guidelines

- Follow the [agentskills.io specification](https://agentskills.io/specification)
- See `.github/instructions/skill-files.instructions.md` for detailed formatting rules
- See `.github/skills/skill-authoring/SKILL.md` for the full authoring guide
- Prefer Azure MCP tools over direct CLI commands when available
- Use progressive disclosure: frontmatter → SKILL.md → references
- Descriptions over 200 chars in frontmatter must use folded YAML (`>-`)
- Markdown links must not escape the skill directory (validated by `npm run references`)

## CI Checks on Pull Requests

PRs against `main` must pass these checks — run the corresponding local commands before pushing:

| CI Job | What it validates | Local equivalent |
|--------|-------------------|------------------|
| ESLint | Linting + typechecking `scripts/` and `tests/` | `cd tests && npm run lint && npm run typecheck` |
| Token Analysis | Token counts and limits for markdown files | `npm run tokens check` |
| Skill Structure | Frontmatter, `tests/skills.json` sync, markdown references | `npm run build && cd scripts && npm run frontmatter && npm run references` |
| Plugin Version Check | `plugin.json` versions remain `0.0.0-placeholder` | Ensure you never edit version fields |
| Skill Tests | Unit and trigger tests for changed skills | `cd tests && npm test` |

## Commit and PR Conventions

- Use conventional commit-style PR titles: `feat:`, `fix:`, `feature:` (these populate the auto-generated changelog)
- If modifying skill descriptions, verify routing correctness with integration tests
- For skills under `plugin/`, never bump the frontmatter version — it uses `0.0.0-placeholder`
- For skills under `.github/skills/`, bump the frontmatter version in the same PR

## Available Agent Skills

The repo includes agent skills under `.github/skills/` that can help with development tasks:

| Skill | When to invoke |
|-------|----------------|
| `skill-authoring` | Creating or modifying SKILL.md files |
| `skill-reviewer` | Reviewing skill PRs for compliance |
| `markdown-token-optimizer` | Reducing token count in markdown files |
| `sensei` | Iteratively improving skill frontmatter compliance |
| `analyze-test-run` | Investigating GitHub Actions test run failures |
| `file-test-bug` | Filing GitHub issues for test failures |
| `submit-skill-fix-pr` | Submitting PRs with validated skill fixes |
