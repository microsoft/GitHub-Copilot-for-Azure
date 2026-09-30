# Compare Claude Code with the Copilot runner

Use `npm run compare:clients` from `tests` for a controlled paired evaluation.
This is separate from `compare:run`, which schedules the existing Copilot-only
branch/model/with-skills CI matrix.

To add another prompt, fixture, or live outcome, follow
[Add a comparison scenario](scenarios/README.md). It includes a copyable eval,
run commands, grading guidance, and the extra lifecycle work needed for live tests.

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
  Upstream handles isolated multi-turn sessions. Copilot uses a temporary home
  containing only its login metadata, with config discovery and its cross-session
  store disabled. Skills are explicitly enabled; actual skill paths/names and MCP
  server inventory are checked before sending the prompt. No permission bypass
  is added. Environment-token or `gh auth login` authentication also works.
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

## Live Foundry hello-world comparison

`compare:foundry-live` is a separate, explicitly authorized live experiment:

> Create and deploy a Microsoft Foundry hosted agent that returns a friendly hello-world greeting

The exact single-turn prompt is identical for both clients. Shared system context
authorizes a new Python/Responses hosted agent named `hello-world`, in a fresh
resource group per client, and supplies the region and scope through environment
variables. Only the `microsoft-foundry` skill is loaded. Azure CLI and azd are used;
no MCP server or ambient MCP configuration is enabled.

The eval is in `tests/comparison/live/hello-world.eval.yaml`, intentionally outside
normal `evals/` discovery and nightly per-skill runs. **Do not invoke that file
directly**: its custom grader and per-client scope come from this runner.

Prerequisites: the Claude setup above, both client logins, working Azure CLI and
azd authentication, the Foundry azd extension, and built plugins. Run
`az account show` to confirm the **default subscription**; the runner captures its
ID once without changing the default. The identity must be allowed to create
resource groups, Foundry projects/model deployments, and necessary scoped role
assignments. Subscription IDs and credentials are not committed to the eval.

From `tests`, in PowerShell:

```powershell
$env:CLAUDE_CLI_PATH = (Get-Command claude.exe -ErrorAction Stop).Source
$env:MODEL_OVERRIDE = $null
$env:NO_SKILLS = $null
# Set VALLY_CLAUDE_EXECUTOR_MODULE to your built upstream executor, as above.
npm run compare:foundry-live -- --execute --copilot-model claude-sonnet-5 --claude-model claude-sonnet-5 --judge-model gpt-5.5 --location northcentralus --timeout 30m
```

Substitute explicit model IDs your accounts support. `--execute` is mandatory.
There is exactly **one trial per client**; rerun the command for more independently
isolated pairs. Provisioning, hosted compute, model calls, and judging incur costs.
The assigned group is created immediately before its client runs and deleted
after its grader finishes, before the other client provisions. This reduces quota
contention; resource names differ, but both clients get the same starting state.

The independent `foundry-live-outcome` grader uses Azure CLI credentials, not
agent-produced files or claimed URLs. It discovers the single Foundry account and
project inside the ownership-marked group, checks successful project provisioning,
checks the named agent's hosted kind and active/deployed version, and sends
`Please greet me.` to its remote Responses endpoint. Only completed assistant
output containing a hello-world greeting passes. Prompt-only agents, merely
generated code, failed API calls, and echoed input do not pass.

Results are under `tests/results-comparison/foundry-live-*/`:

- `live-run.json`: assigned subscription/groups, per-client outcome and cleanup.
- `claude/live-outcome.json` and `copilot/live-outcome.json`: independent remote
  evidence or explicit failure reasons.
- `comparison-*/`: shared skill snapshot, trajectories, per-case grades, manifest,
  and pairwise judge output.

The runner attempts both clients when their eval processes finish normally, even
if one outcome grader fails. Operational subprocess failures stop the paired
runner after cleaning that client's group. Any independent outcome failure,
unconfirmed cleanup, or comparison process error produces a nonzero exit.
Per-case LLM grades and pairwise preference are additional evidence, not a
substitute for the independent outcome gate. One pair is not statistically
meaningful evidence of a general client advantage.

Cleanup checks the exact group name and ownership marker and waits for Azure to
confirm deletion. It runs on normal completion and caught failures, but cannot
guarantee cleanup after terminal closure, Ctrl+C, or machine failure. In that case,
inspect `live-run.json` and remove only its recorded, ownership-matching groups.
`azd provision` can replace resource-group tags. The shared instructions require
both clients to preserve and merge the run tag after provisioning. Before launching
either client, the harness also records a completed empty ARM deployment named
`vally-owner-<run-id>` with the owner ID as an output. This provisions no resources.
If azd removes the group tag, verification/cleanup can use this scoped deployment
marker instead. A conflicting tag, or missing/invalid markers, blocks automatic
deletion; the harness never silently retags a group. Inspect the manifest even
when the command fails, and establish ownership independently before manual
recovery.
Never run broad subscription cleanup. Soft-deleted account names may remain
reserved; future pairs use unique names.

This is **not an OS or RBAC sandbox**: both agents run as your local user, and the
system instruction is not an enforcement boundary. Prefer an identity restricted
to a disposable test subscription. The independent verifier checks the assigned
deployment, not a comprehensive audit of every action in the subscription.
