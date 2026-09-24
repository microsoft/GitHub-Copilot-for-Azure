# Evals

See [vally-eval](../.github/skills/vally-eval/SKILL.md) on how to run vally eval suites in this repo.

For a controlled Claude/Copilot comparison, use
[`npm run compare:clients`](../tests/comparison/README.md). It aligns skill
selection, stopping policy, environment/MCP configuration, and run settings.

## Run with Claude Code

The test wrapper defaults to the existing Copilot executor. Pass
`--executor claude-cli` to run the same evals with Claude Code instead.
[The adapter](../tests/vally/claude-executor.ts) delegates process execution,
multi-turn sessions, and trajectory parsing to the upstream
[Vally Claude CLI executor](https://github.com/microsoft/vally/tree/main/plugins/executors/vally-executor-claude-cli).
It stages built skills as `.claude/skills` in each trial workspace, configures
Azure MCP, and adds the skill-activation events needed by our routing graders.

### Setup

Use Node.js 22.14+ (or 24+), Git, and an authenticated
[Claude Code CLI](https://code.claude.com/docs/en/setup). Run `claude --version`
and sign in with `claude` before testing, or configure `ANTHROPIC_API_KEY` in
your environment. On Windows, use the native Claude executable; if it is not
on PATH, set `CLAUDE_CLI_PATH` to its absolute path, not a `.cmd`/`.ps1` shim.
Never put credentials in eval files.

From this repository's root:

```shell
npm ci
npm run build
npm --prefix tests ci
```

The upstream executor is currently marked private and is not available from
this repository's npm feed. Build it in a separate Vally checkout. The adapter
was developed against upstream commit
`23ecce600f1eb4107593c82deb57682256312764` (executor 0.2.0, Vally 0.16.x).
The following commands work in Bash and PowerShell:

```shell
git clone https://github.com/microsoft/vally.git ../vally
git -C ../vally checkout 23ecce600f1eb4107593c82deb57682256312764
npm --prefix ../vally ci
npm --prefix ../vally run build --workspace @microsoft/vally-executor-claude-cli
```

Point the adapter at the built module, then enter this repo's `tests` directory.

**PowerShell** (from the repository root):

```powershell
$env:VALLY_CLAUDE_EXECUTOR_MODULE = (Resolve-Path ..\vally\plugins\executors\vally-executor-claude-cli\dist\index.js).Path
Set-Location tests
```

**Bash** (from the repository root):

```bash
export VALLY_CLAUDE_EXECUTOR_MODULE="$(cd ../vally && pwd)/plugins/executors/vally-executor-claude-cli/dist/index.js"
cd tests
```

If the upstream package becomes available in your npm feed, installing
`@microsoft/vally-executor-claude-cli` in `tests` also works without the environment
variable.

### Commands

Run this from `tests` in either shell:

```shell
npm run test:vally -- --executor claude-cli --plugin azure-skills --skill azure-ai --tag tier=smoke --runs 1 --workers 1 --model sonnet --require-pass
```

Remove `--tag tier=smoke` to run every eval for the selected skill. Use
`--model opus` or another Claude-supported model ID to change models.
The Claude default is `sonnet`, overriding Copilot-specific model IDs in eval
files. `MODEL_OVERRIDE`, when set, takes precedence over `--model`.

Run the adapter's deterministic unit tests without Claude authentication:

```shell
npm test -- vally/__tests__/claude-executor.test.ts
```

### Behavior and limitations

- Results are native Vally artifacts under `tests/results-claude/`, separate
  from Copilot's `tests/results/`. Claude runs do not generate Copilot SDK
  markdown reports, screenshots, or dashboard `testResults.json` files.
- `requiredSkills`, `NO_SKILLS`, `VALLY_RUNNER_EXACT_SKILL`,
  `VALLY_PLUGIN_OUTPUT_ROOT`, and `VALLY_RUNNER_DISABLE_AZURE_MCP` behave like
  the Copilot runner. Built skills are required unless `NO_SKILLS=true`.
  Workspace skills retain their unqualified names for existing graders.
- `systemPrompt` supports JSON `{ "mode": "append" | "replace", "content": "..." }`.
  Other prompt shapes and `takeScreenshot` fail explicitly.
  `constraints.max_turns` maps to Claude's `--max-turns`.
- Upstream does not support our `earlyTerminate` callbacks. The adapter warns
  and lets Claude run to completion or the configured timeout instead.
  Routing tests may therefore run longer and perform more actions than with
  Copilot. Use a disposable environment and a test Azure subscription for
  deployment evals; upstream uses Claude's automatic permission mode.
- Claude authentication is separate from Copilot authentication. Evals with
  LLM-backed graders may additionally need their configured judge credentials.
  Azure-resource evals also require the appropriate Azure login and permissions.
- Multi-turn session handling belongs to upstream. It isolates the Claude
  config directory and seeds stored credentials/settings; place required
  custom agents and other config in the trial workspace.