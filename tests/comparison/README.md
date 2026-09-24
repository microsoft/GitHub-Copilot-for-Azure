# Compare Claude Code with the Copilot runner

Use `npm run compare:clients` from `tests` for a controlled paired evaluation.
This is separate from `compare:run`, which schedules the existing Copilot-only
branch/model/with-skills CI matrix.

## Prerequisites

Build the plugins and configure the upstream Claude executor as described in
[the eval guide](../../evals/README.md#run-with-claude-code). Authenticate both
clients. The pairwise judge uses Copilot authentication.

Choose explicit model versions supported by each provider. The runner rejects
common floating aliases such as `sonnet` and `latest`, but cannot verify that
two provider-specific IDs resolve to identical weights. If they do not, label
the result as a client-and-model comparison.

Remove `MODEL_OVERRIDE` and `NO_SKILLS=true` from your environment. The runner
rejects them rather than silently overriding the requested experiment.

## Run

Use the same command in PowerShell or Bash (substitute your actual model IDs):

```shell
npm run compare:clients -- --eval-spec <eval-file> --copilot-model <copilot-model-id> --claude-model <claude-model-id> --judge-model <judge-model-id> --runs 5 --timeout 10m --fail-on-regression
```

For example, in PowerShell, the existing Azure AI suite can be collected without
a pairwise judge:

```powershell
npm run compare:clients -- --eval-spec ..\evals\azure-skills\azure-ai\eval.yaml --copilot-model "<copilot-model-id>" --claude-model "<claude-model-id>" --judge-model "<judge-model-id>" --runs 3 --skip-judge
```

`--skip-judge` skips only the final pairwise comparison: the eval's own graders
still run, including any LLM-backed graders. Without it, every stimulus must
have a nonempty `rubric`, for example:

```yaml
rubric:
  - Completes the user's requested task correctly.
  - Uses relevant skills and tools without unnecessary resource changes.
  - Reports failures accurately rather than claiming success.
```

## What the comparison profile controls

- Both clients use the same eval file, local fixtures, explicit judge model,
  trial count, one worker, timeout, and zero automatic retries. The runner
  randomizes which client goes first and records the order.
- Built plugin content is snapshotted once for both clients. Each stimulus
  loads only its sorted, deduplicated `requiredSkills` (or `skill` tag).
  Missing/ambiguous skills and sets exceeding Copilot's description budget fail.
- `earlyTerminate` is disabled on both clients with a warning, without editing
  the eval file. Both run until completion or the shared conversation deadline.
  Copilot follow-ups use the remaining budget, and timeouts fail the run rather
  than becoming successful partial trajectories.
- Prepared-workspace reuse is disabled for Copilot in this mode, so both clients
  receive fresh trial workspaces.
- `agent_environment.env` is forwarded to both clients. Only explicit
  `agent_environment.mcpServers` are enabled; the normal implicit Azure MCP
  server is **not** added. Declare the servers needed by your eval, pin their
  package versions, and use the same external credentials/resources.
- Claude uses strict MCP configuration, project-only settings, and an isolated
  config directory seeded with its auth file, not personal skills/settings.
  Upstream handles isolated multi-turn sessions. Copilot config discovery and
  its cross-session store are disabled. No permission bypass is added.
- Local eval/config/fixture hashes are checked between and after runs. Changed
  inputs, incomplete trial counts, and subprocess failures stop comparison.

Unsupported settings fail before launching the pair: screenshot tags,
`constraints.max_turns` (different counting semantics), `max_agent_duration`,
`reasoning_effort`, executor-specific config, `environment.skills`, unsupported
system-prompt shapes, and MCP `cwd`/`timeout` overrides. Use `requiredSkills`,
the shared timeout, and an append/replace string system prompt instead.

## Artifacts and CI

Each invocation creates a unique directory under `tests/results-comparison`
(override its parent with `--output-dir`). It contains:

- `plugins/`: the shared built-skill snapshot.
- `copilot/<run>/results.jsonl` and `claude/<run>/results.jsonl`, plus native
  Vally/JUnit artifacts.
- `comparison-run.json`: model IDs, settings, input hash, order, exact result
  paths, and status. Environment values and credentials are not included.
- `comparison.jsonl`: pairwise judge results, unless `--skip-judge` was used.

The runner never guesses the latest run from shared result directories.
It requires the requested number of trajectories for every stimulus on each
side. An operational failure returns nonzero; `--fail-on-regression` also
returns nonzero for a statistically significant negative comparison verdict.
Individual grader failures remain data for comparison rather than preventing
the second client from running.

For CI, run this command after setup and upload the entire comparison directory
with `if: always()`. It does not require modifying the existing nightly
Copilot-only workflows or dashboard.

## Interpretation

This controls eval inputs, not every property of the agent runtime. Native
system prompts, built-in tools, permission decisions, context management, token
accounting, and timing boundaries still differ. Treat token/time deltas as
diagnostic, not equivalent billing or a calibrated speed benchmark.

Fresh local workspaces do not reset cloud resources. Use isolated resources per
trial or deterministic reset steps, pin Git revisions and tool versions, avoid
client-specific instruction files, and prefer repeated trials over a single
sample. Never run deployment or destructive prompts against production for
this comparison.
