# Skill improvement runner

This bounded runner evaluates a baseline, asks Copilot CLI to edit only the
target Skill directory, reruns candidate evaluations, and accepts a candidate
only when every configured quality, regression, invocation, and Skill-size gate
passes. The same TypeScript engine runs locally and in the manual **Skill
Improvement** workflow.

## Four-arm study

The Azure Kusto baseline uses four separately reported arms:

| Arm | Target Skill | Azure MCP |
| --- | --- | --- |
| Agent only | Disabled | Disabled |
| Skill only | Enabled | Disabled |
| MCP only | Disabled | Enabled |
| Skill + MCP | Enabled | Enabled |

The baseline runs all four arms with exact target-Skill isolation. Candidate
iterations rerun only **Skill only** and **Skill + MCP**; unchanged no-Skill
controls are reused. Limits count all baseline arms plus Skill-enabled
candidate runs and every configured judge.

## Decisions and evidence

Pass/fail uses judge majority and response score uses the median judge score.
Acceptance uses pass-rate improvement, per-model and per-eval regression
limits, target-Skill invocation, and estimated **Skill Markdown token growth**.
Average generated-answer token change is diagnostic only, not the Skill-size
gate.

Each run writes:

- `report-summary.md`: decision-first Actions/job summary with separate baseline
  arms, candidate pass rates, all rejection/validation reasons, acceptance
  gates, and changed outcomes/regressions;
- `report.md` and `report.json`: detailed results;
- raw generation/judgment JSONL, agent output, relative candidate patches, and
  Skill snapshots.

The workflow always appends `report-summary.md` to `GITHUB_STEP_SUMMARY` and
retains the complete GitHub artifact for 30 days. `output.issue: never` creates
no issue; `output.issue: always` remains an explicit opt-in. Draft PR creation
still requires an accepted candidate and does not require a result issue.

Normal users do not configure a report location. When the centrally
administered repository variable `REPORT_STORAGE_ACCOUNT` exists, **Publish
report to Azure Storage** automatically sends a repository-standard
best-effort-redacted copy of the complete run output using OIDC and
`--auth-mode login` to:

`${REPORT_STORAGE_ACCOUNT}/skill-improvement-runs/<UTC-date>/<GitHub-run-id>/<skill>/`

If the central account variable is absent, Azure Storage publishing is skipped
and the complete 30-day GitHub artifact remains available.

The workflow creates the container if needed and enforces public access off.
Access is RBAC-based; no keys, SAS tokens, connection strings, or public URLs
are emitted. Raw trajectories can contain prompts, outputs, and tool evidence.
Pattern-based redaction reduces known secret exposure but is not comprehensive,
so restrict container access and configure lifecycle/retention according to
repository policy.

## Commands

From `tests`:

```powershell
npm run skill-improvement -- validate `
  --config .\skill-improvement\specs\azure-kusto.yaml

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor local
```

Local execution runs paid evaluations, judges, and the improvement agent; do
not run it for ordinary unit validation.

To dispatch the workflow, use `--executor github` with
`--workflow-ref <branch-containing-workflow>` and optional `--baseline-ref`,
`--pr-base`, and `--create-draft-pr`. The PR flag is only a request; no PR is
created unless every acceptance gate passes.

The workflow calls the internal `execute` command with an explicit `--output`
directory. Vally first saves answers with `--skip-grade`, then re-grades those
trajectories with each judge. The improvement agent receives development
failures and prior rejection reasons, never held-out evidence.

Run specifications may reference only filenames inside a repository-relative
`tests/skill-improvement/evals/<name>` root. These suites are opt-in and are not
discovered by the nightly `evals/` integration workflow.
