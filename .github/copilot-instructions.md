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
evals/                    # Vally test suites
tests/                    # Jest test suite (unit, trigger, integration)
.github/
  instructions/           # Copilot instruction files for skill authoring
  skills/                 # Repo-local agent skills (not shipped in plugin)
  workflows/              # CI/CD workflows
docs/                     # Documentation (versioning, specs, diagrams)
eng/                      # Engineering scripts (test subscription cleanup)
gulpfile.ts               # Build pipeline
.token-limits.json        # Token budget config
.vally.yaml                # Vally eval framework config
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
- Use conventional commit-style PR titles (e.g. `feat:`, `fix:`, `feature:`) — the build generates `CHANGELOG.md` from these

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

## Authoring Scripts in Skills

Some skills ship helper scripts (under a skill's `scripts/` or `references/**/scripts/` directory). These guidelines help avoid common problems in the scripts.

### General Guidelines

- **Always ship both `.sh` (bash) and `.ps1` (PowerShell) versions** of a script. Keep their behavior, options, output format, and exit codes in sync.
- **Document exit codes in a header comment** and keep it accurate: the convention is `0` = success/all passed, `1` = a check failed, `2` = usage/argument error. Update the comment whenever the code changes, and keep both scripts' headers consistent.
- **Provide both bash and PowerShell invocation examples** wherever a script is referenced in docs — never show only one shell.
- **Make `--dry-run`/preview output match what actually runs.** If a pipe or step is conditional (e.g. only pipe to `tcpdump` when it's installed), the previewed command must reflect the same condition.
- **Don't double-report results.** Pick one source of truth (inline per-step lines *or* a final summary table), not both. Remove dead/unused variables and helpers.
- **Treat errors as errors.** For critical checks (especially pre-provision scans), a read error, missing file, or failed CLI call must produce a non-zero exit — never silently fall through to a misleading "not applicable" / "already configured" / "fix required" verdict.

### PowerShell Scripts

- **Do not set `$ErrorActionPreference = 'Stop'` at script scope.** It makes `Write-Error` terminating and can bypass your explicit `exit` codes. Leave the default (`Continue`) and, where you need a hard stop, use `-ErrorAction Stop` on the specific call inside a `try/catch`. Also don't add a redundant `$ErrorActionPreference = 'Continue'` line — that's already the default.
- **Check `$LASTEXITCODE` after native commands** (`az`, `kubectl`, `terraform`, etc.). Non-zero exits from native executables do *not* raise PowerShell errors, so capture output and test `$LASTEXITCODE` explicitly instead of assuming success.
- **Avoid `[Parameter(Mandatory)]`.** In non-interactive scenarios PowerShell will block prompting for the value. Instead, check the parameter explicitly (e.g. `[string]::IsNullOrWhiteSpace(...)`) and exit `2` with a clear message.
- **Stay compatible with Windows PowerShell 5.1**, not just PowerShell 7. Avoid 7-only features/parameters such as `Invoke-WebRequest -SkipHttpErrorCheck`; read HTTP status from the caught exception's `Response.StatusCode` instead.
- Prefer `Write-Error` (stderr) over `Write-Host` for genuine error conditions so failures surface in CI/log collectors, while still exiting non-zero.

### Bash Scripts

- **Target Bash 3.2** (macOS default) — do not assume Bash 4+. Avoid `declare -A` (associative arrays), `mapfile`, and similar. Use portable alternatives like `while IFS= read -r` loops and small `grep`/`sed` helpers. Use `#!/usr/bin/env bash`.
- **Never use `eval`** to run a command string (injection risk + brittle quoting). Pass the command as arguments and invoke via `"$@"`, or pass a function name.
- **With `set -e`, capture command output via command substitution** (`OUT=$(cmd ...)`), not process substitution (`done < <(cmd ...)`), so a failing command reliably aborts instead of producing a misleading downstream error.
- **Use fixed-string grep (`grep -F`/`-Fq`) for literal matches** and handle grep's read-error exit code (`2`) explicitly — don't let it be treated as "no match".
- **Guard argument parsing.** For value-consuming options, verify a value is present before `shift 2` — otherwise, under `set -euo pipefail`, a missing value causes an unbound-variable/`shift count` error or an infinite loop. Reject unknown/mistyped `--options` with usage instead of silently treating them as positional args. Validate expected types (e.g. `--tail` must be a positive integer) and exit `2` with a clear message on bad input.
- **`usage()`/`--help` should exit `0`** (asking for help is not an error); reserve non-zero exits for actual argument errors.
- **`set -o pipefail` is not inherited by a new Bash process** (e.g. a pipeline run inside `bash -c "..."`). Re-declare it inside that process so a failing command in the pipeline is still surfaced.
- **Don't hold large command output in a variable on success** (e.g. `terraform plan`). Redirect to a temp file and only read it back on failure.
- **Exclude the shebang from `--help` output.** A `usage()` that prints lines starting with `#` will echo `#!/usr/bin/env bash`; filter it (e.g. `grep -v '^#!'`) or stop at the first non-comment line.
- **Don't swallow failures of critical steps with `|| true`** (e.g. `az account set`). Record an explicit PASS/FAIL so a failed step fails the overall run.

### Deterministic CLI Parsing

- **Don't parse CLI JSON with `grep`/`sed`.** Use the tool's own query support (e.g. `az account show --query name -o tsv`) and key decisions off the command's exit code.
- **Keep CLI install hints in the repo's standard call form**, e.g. `mcp_azure_mcp_extension_cli_install(cli-type: "az")`, so they match the rest of the skill and stay copy/pasteable.

### Referencing Scripts from Markdown

- **Use Markdown links** to the script files, not bare text or bare command names.
- **Don't present a script as if it were on `PATH`** (e.g. `run-ig ...`). Reference the explicit path (`scripts/run-ig.sh` / `scripts/run-ig.ps1`).
- **State the working directory** any relative path assumes. Prefer skill-root-relative paths (`./scripts/...`) and note that commands run from the skill root.
- **Note that PowerShell parameter names differ** (PascalCase, e.g. `-Gadget`, `-Namespace`) so readers don't copy bash `--flag` syntax into `.ps1` calls.
- Markdown links still must not escape the skill directory.

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
