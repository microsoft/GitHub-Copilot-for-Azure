# Run evaluations with Claude

These instructions use the local `yunjchoi/vally-claude-executor` worktree:

```text
C:\Users\yunjchoi\GitHub-Copilot-for-Azure-claude
```

Use a reviewed eval specification for Claude-only or paired evaluations.
The dedicated live Foundry comparison below creates and verifies real resources.

## 1. Open the worktree and build

Use a dedicated PowerShell terminal:

```powershell
Set-Location C:\Users\yunjchoi\GitHub-Copilot-for-Azure-claude
git branch --show-current
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }
```

The branch should be `yunjchoi/vally-claude-executor`. Dependencies and the
upstream Vally Claude executor have already been installed/built on this machine.
For setup on another machine, see [the eval setup guide](evals/README.md#run-with-claude-code).

The test package declares `tsx`, which launches its TypeScript runners, as a
development dependency. If a runner reports that `tsx` is missing, restore test
dependencies from the repository root with `npm --prefix tests ci --include=dev`.
No global installation or on-demand `npx` download is needed for these commands.

## 2. Configure the executor and authentication

Point to the existing upstream executor build:

```powershell
$vally = "C:\Users\yunjchoi\.copilot\session-state\689f4844-27b7-4b24-a815-7e26f938eaa6\files\vally"
$env:VALLY_CLAUDE_EXECUTOR_MODULE = (Resolve-Path "$vally\plugins\executors\vally-executor-claude-cli\dist\index.js").Path

# Remove overrides that conflict with the comparison policy.
$env:MODEL_OVERRIDE = $null
$env:NO_SKILLS = $null

$env:CLAUDE_CLI_PATH = (Get-Command claude.exe -ErrorAction Stop).Source
& $env:CLAUDE_CLI_PATH --version
if ($LASTEXITCODE -ne 0) { throw "Claude executable failed." }
```

This locates the native executable automatically, avoiding npm `.cmd`/`.ps1`
wrappers. If `Get-Command` fails, install the native Claude Code executable or
add its directory to PATH before continuing. Run this setup in the same terminal
as the tests. It also replaces any stale placeholder value in `CLAUDE_CLI_PATH`.

Sign in through `claude` and `copilot` if needed. When using an explicit native
path, launch `& $env:CLAUDE_CLI_PATH` to sign in to Claude.

**Both authentications are needed:** Claude executes the prompts; Copilot runs
the LLM graders. Azure login is required for live deployment cases, not for
non-deploying offline cases. Never put credentials in eval files.

## 3. Run a reviewed eval with Claude

Replace the eval path with an existing specification and the model placeholders
with explicit model IDs available to your accounts. Review the eval's side
effects and prerequisites before running. Use the same PowerShell terminal as
the setup steps.

```powershell
Set-Location C:\Users\yunjchoi\GitHub-Copilot-for-Azure-claude\tests

$claudeModel = "<explicit-Claude-model-ID>"
$judgeModel = "<Copilot-supported-judge-model-ID>"
$evalSpec = "<path-to-reviewed-eval.yaml>"

$previousComparisonPolicy = $env:VALLY_FAIR_COMPARISON
$env:VALLY_FAIR_COMPARISON = "true"
try {
    npm run test:vally -- `
        --executor claude-cli `
        --eval-spec $evalSpec `
        --model $claudeModel `
        --judge-model $judgeModel `
        --runs 1 --workers 1 --max-retries 0 --timeout 5m `
        --require-pass --junit

    if ($LASTEXITCODE -ne 0) { throw "Evaluation failed; inspect the results." }
} finally {
    $env:VALLY_FAIR_COMPARISON = $previousComparisonPolicy
}
```

`--runs 1` runs each selected stimulus once.
`--require-pass` makes grading failures return a nonzero exit code.

The comparison policy gives the agent the exact shared skill pool and enables
only explicitly configured MCP servers. Do not combine `--suite` with
`--eval-spec` or `--skill`. For the live Foundry hello-world eval, use the
dedicated runner below instead so ownership, verification, and cleanup are wired.

## 4. Run the Claude-versus-Copilot comparison

From the same `tests` directory, with the executor and model variables above
configured:

```powershell
$copilotModel = "<explicit-Copilot-model-ID>"

npm run compare:clients -- `
    --eval-spec $evalSpec `
    --copilot-model $copilotModel `
    --claude-model $claudeModel `
    --judge-model $judgeModel `
    --runs 3 --timeout 5m --fail-on-regression

if ($LASTEXITCODE -ne 0) { throw "Client comparison failed." }
```

This runs each selected stimulus three times per client, plus per-case and
pairwise judging. The runner applies the shared comparison policy automatically,
snapshots the built skills, and randomizes which client runs first.

Use equivalent model versions where available. Otherwise, interpret this as a
comparison of both client and model differences. The paired runner rejects
floating aliases such as `sonnet` and `latest`.

`--fail-on-regression` gates significant relative regressions, not absolute
grader failures. Use the single-client `--require-pass` run when every grader
must pass. `--skip-judge` skips only pairwise judging; the per-case LLM graders
still run and incur usage.

See [the comparison guide](tests/comparison/README.md) for the full policy and
remaining differences between runtimes.

## 5. Find the results

Paths below are relative to the repository root:

| Run | Output location | Contents |
| --- | --- | --- |
| Claude only | `tests\results-claude\` | Per-run trajectories and grader results in `results.jsonl`, plus JUnit output. |
| Paired comparison | `tests\results-comparison\comparison-*\` | Both clients' results, `comparison-run.json`, and `comparison.jsonl`. |

The comparison manifest records the model IDs, trial settings, execution order,
and exact result paths. `comparison.jsonl` is omitted when using `--skip-judge`.

## Safety and scope

These runs incur model and judge usage. Their scope and side effects depend on
the selected eval; inspect its prompts, environment, and graders first.

Use a disposable environment without production credentials, production data,
or writable remotes. The offline instructions and graders are **not a security
sandbox** and do not technically block commands or network access.

Successful trajectory grading alone does not establish that a real application
was deployed. Use independent remote verification for live deployment outcomes.

## Separate live Foundry deployment comparison

For real deployments of the hello-world hosted agent, use the dedicated live
runner. It uses your default Azure subscription,
creates one isolated resource group per client, verifies a remote greeting, and
deletes the owned groups after saving evidence.

After configuring the native Claude path, upstream executor module, model IDs,
and Azure/azd authentication, run from `tests`:

```powershell
npm run compare:foundry-live -- --execute --copilot-model claude-sonnet-5 --claude-model claude-sonnet-5 --judge-model gpt-5.5 --location northcentralus --timeout 30m
if ($LASTEXITCODE -ne 0) { throw "Live comparison failed; inspect live-run.json and live-outcome.json." }
```

This incurs Azure and model charges. See the
[live comparison guide](tests/comparison/README.md#live-foundry-hello-world-comparison)
for permissions, independent verification, output paths, and cleanup limitations.

### Completed local live comparison

The completed pair in `tests\results-comparison\foundry-live-28q7aO` used
`claude-sonnet-5` for both clients and `gpt-5.5` for judging.

| Client | Independent deployment/greeting | Overall graders | Agent wall time |
| --- | --- | --- | --- |
| Claude Code | Pass | 4/4 (100%) | 818 seconds |
| Copilot CLI runner | Pass | 3/4 (75%) | 617 seconds |

Copilot failed the scope rubric because it submitted server-side evaluation
generation despite the shared instruction not to. Both trial resource groups
were confirmed deleted. The pairwise judge slightly preferred Claude, but this
single pair does not establish a general advantage. Per-criterion position-swap
checks were unverified and defaulted to ties; use the independent evidence and
individual grades rather than treating the preference as conclusive.

The command exited zero because both independent deployment checks and cleanup
succeeded; this does **not** mean every rubric passed. Inspect the per-client
`eval-results.md` as well as `live-run.json`. Trajectories were saved, but Vally
could not capture workspace patches because the generated samples contained
nested Git repositories without commits. Token and turn counts are not directly
comparable across the two native runtimes.
