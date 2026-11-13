# Azure Diagnostics Harbor smoke test

One genuine Vally-exported Harbor task and a manual MSBench **submission starter**:
[`pipelines/azure-diagnostics-harbor.yml`](../../../pipelines/azure-diagnostics-harbor.yml).
It uses the task in this repository, not a clone of another benchmark repo or the
upstream eval suite at runtime. There is no CI/PR trigger or schedule. This ad-hoc
`--dataset` example does not need a managed Registry publication.

## Provenance and scope

Source: [pinned Azure Diagnostics eval](https://github.com/microsoft/GitHub-Copilot-for-Azure/blob/5aaa005e426258cbd1924f36dddc29815abac632/evals/azure-skills/azure-diagnostics/eval.yaml#L32).
The selected stimulus is **Container App restart troubleshooting**:
"My Azure Container App keeps restarting, how do I troubleshoot it?"
The reduced input is [`source/eval.yaml`](source/eval.yaml).
The complete diagnostics skill is vendored in the task environment from
`plugins/azure-skills/skills/azure-diagnostics/` at that same upstream commit,
with its [MIT license](UPSTREAM-LICENSE) (copied byte-for-byte from
`plugins/azure-skills/LICENSE` at that commit).

Generated using actual `vally export`, **Vally CLI/core 0.21.0** and
**`@microsoft/vally-exporter-harbor` 0.1.0-alpha.9**. The exporter records its
version in `task.toml`; its Dockerfile pins the in-container Vally CLI.
The task tree is an unchanged copy of the previously generated export.
Skills are staged in `.agents/skills` and `.claude/skills`; tests and solution
are outside the agent-visible Docker build context.

Both original graders are preserved: actual `azure-diagnostics` activation and
absence of fatal/unhandled-exception output. Each contributes half the score;
both must pass the retained 0.8 threshold. A textual mention is not activation.
The timeout is 600 seconds. Deliberate differences from the original executor:
one attempt instead of five, no custom executor or tag-based early termination,
and no automatic model selection. No Azure fixtures or MCP servers are provided.
This tests routing, not live resource diagnostics.

## ADO setup (pipeline owner)

1. Review, commit and publish these files to this GitHub repository yourself.
   The cloud worker cannot read this uncommitted worktree.
2. Create a YAML pipeline selecting `pipelines/azure-diagnostics-harbor.yml`.
   Use an approved Linux agent with Python 3.12 and PowerShell Core; replace
   `pool.vmImage` if hosted agents are unavailable. Authorize the package feed
   and ARM service connection only for the intended pipeline.
3. Configure the variables below, select an approved concrete model/backend,
   and queue manually with **dryRun=true** first.

| ADO variable | Required value |
| --- | --- |
| `MSBENCH_ARTIFACT_FEED` | Authorized project/feed containing `msbench-cli`; grant Build Service feed Read. |
| `MSBENCH_CLI_VERSION` | Approved exact CLI version supporting Harbor-native rows (locally checked with 0.3.70); not `latest`. |
| `AZURE_SERVICE_CONNECTION` | Approved ARM connection, preferably workload identity federation, with CES submission/encryption access. |
| `HARBOR_CONTAINER_REGISTRY` | Explicit approved ACR hostname accessible to the selected backend, even for this Dockerfile-built task. |
| `GITHUB_COPILOT_INTEGRATION_ID` | Approved test integration ID, secret variable for live submission only. |
| `CAPI_HMAC_KEY` | Secret variable for that test integration, live submission only. |

These are separate access boundaries:

- The ARM service connection authenticates the **submitter**, not task checkout
  or model access. No existing production connection/Key Vault is reused.
- The CES worker needs an approved [CES App](https://github.com/apps/ces-app)
  installation for **microsoft/GitHub-Copilot-for-Azure**, including this exact
  repository in its selection. Public repository access does not bypass this.
  Do not add Azure DevOps `task_repo_client_id`/tenant/auth fields or a PAT.
- The selected CES backend must be able to acquire the `github-copilot-cli`
  agent package and access the approved ACR. Model access requires the approved
  integration and model independently; the default model is only an example.

The helper validates `Build.Repository.Uri` against this GitHub repository and
the checkout's `origin`, and `Build.SourceVersion` against its actual `HEAD`.
It writes one BOM-free JSONL row with `task_repo_type=github`,
`task_repo=https://github.com/microsoft/GitHub-Copilot-for-Azure`,
`task_path=benchmarks/msbench/azure-diagnostics/tasks/container-app-restart-troubleshooting`
and the full lowercase 40-character build commit. Live submission also rejects
missing committed task content or local task changes. That commit must already
exist remotely and be accessible to CES App; no local check proves this.
No credentials are stored in the dataset or image.

[`models.yaml`](../../../pipelines/scripts/azure-diagnostics-harbor/models.yaml)
selects the `copilot-direct` index at `https://api.githubcopilot.com`.
The helper writes an explicit profile for the chosen model, avoiding ad-hoc
live model discovery. It does not assert model availability.

## Dry run versus execution

Dry run resolves CLI configuration **without submitting** and without forwarding
CAPI credentials. The helper temporarily removes both CAPI variables, restoring
them afterward, and explicitly declines the CLI's missing-forwarding prompt.
It may download/execute local agent plugin code and still
requires access to the package feed/Registry. Expected missing-auth warnings
are not a reason to forward credentials.

Before setting **dryRun=false**, approve the backend, ACR and least-privilege
test credentials. Benchmark code and the evaluated agent can read secrets
forwarded through `--encrypted-env`: encryption protects transport, not against
agent access. Real submission starts one potentially paid remote run; do not
use production secrets.

Artifacts include the dataset, generated model map, submission log and unique
`events-*.jsonl`. Live success adds `run_ids.json` and the
`RunBenchmarks.RUN_IDS` output, parsed from structured `run_started` events,
not console text. An ambiguous/failed submission may already have launched a
run: inspect these files before retrying, using a fresh artifact directory.

Like the reference pipeline, `--no-wait` means green indicates **submission**,
not a passed test. Inspect completion with
`msbench-cli status --backend <selected-backend> --run_id <id>` and the resulting
report/reward. This change creates no live ADO pipeline and submits no remote run.

## Local checks and regeneration

From the repository root, in PowerShell:

```powershell
pwsh -File pipelines\scripts\azure-diagnostics-harbor\Test-Smoke.ps1
Push-Location benchmarks\msbench\azure-diagnostics\source
npm ci --ignore-scripts
node --test verify.test.mjs
npm run export
Pop-Location
```

In Bash, from the repository root:

```bash
pwsh -File pipelines/scripts/azure-diagnostics-harbor/Test-Smoke.ps1
cd benchmarks/msbench/azure-diagnostics/source
npm ci --ignore-scripts
node --test verify.test.mjs
npm run export
```

[`Test-Smoke.ps1`](../../../pipelines/scripts/azure-diagnostics-harbor/Test-Smoke.ps1)
mocks the MSBench CLI and live task-commit readiness, retaining real Git identity
checks. It tests dataset mapping, rejected source/configuration, dry-run secret
isolation/restoration, failures and structured run IDs. It never submits.
The Node tests run the **real exported verifier and Vally graders** against
offline ATIF fixtures: activation/tool activation, missing activation, mere
mention and fatal output. They do not call an LLM or Azure.

Export writes ignored `regenerated-tasks/` rather than overwriting the vendored
input skill. Review that diff before replacing the checked-in task; regeneration
uses the vendored skill, not upstream `main`.
The generated oracle's empty response passes the negative-output assertion;
it validates grader plumbing, not a real troubleshooting solution.

Local checks cannot establish CES App access, remote commit availability,
agent package acquisition, worker image build/network access, model execution,
skill telemetry or remote grading. ADO server-side YAML expansion and cloud
execution remain the pipeline owner's validation steps.

Local validation of this copy passed the mocked PowerShell checks, all eight
Node tests, actual Vally export (all 62 task files regenerated byte-for-byte),
shell executable permissions and LF checks. The unchanged task tree is
`0f49b6b99b4f03d9fcb5488f65745d893c2b7bb2`.
The existing local Docker image returned reward exactly `1` against this copy
with networking disabled, both with default paths and `OUTPUT_DIR=/output`.
The image was reused, not rebuilt here.

MSBench CLI 0.3.70 also resolved exactly one instance with a `run_planned` event
and no run ID in a credential-free, network-blocked local dry run. That check
used a session-local Python launcher to pre-import `azure.core.exceptions`,
isolate Windows config paths and select an already-installed agent plugin via
`MSBENCH_SPECIAL_AGENT_PATH`. Those host workarounds are not pipeline settings
and do not verify Registry acquisition. The example ACR was an offline-only
input, not a provisioned or approved registry.
The repository token check reported eight existing over-budget files under
`plugins/`; none was changed by this example.
