# Skill improvement runner

The skill improvement runner evaluates a skill, asks a bounded improvement
agent to edit only that skill, evaluates each candidate, and keeps a candidate
only when it satisfies the configured acceptance rules.

The same engine runs locally and in the manual **Skill Improvement** workflow.

## Terminology

- **Baseline**: the immutable branch, tag, or commit being evaluated before any
  generated changes. It contains the existing skill.
- **Condition**: one skill and MCP setup, such as skill enabled with MCP enabled.
- **Improvement agent**: a non-interactive Copilot CLI session that receives
  development failures and may edit only the target skill directory.
- **Accepted candidate**: a generated skill change that satisfies every
  configured quality, regression, invocation, and size rule.

`accepted-candidate-only` means a draft pull request is created only for an
accepted candidate. A completed workflow still creates a result issue when
`output.issue` is `always`, even if no candidate is accepted.

`output.issue: always` creates one new result issue for every manual workflow
run. The issue contains a bounded summary; the full report and trajectories are
stored in the workflow artifact.

## Limits

Before starting, the engine calculates baseline, candidate-iteration, and
held-out generations across prompts, conditions, models, repetitions, and
judges. It refuses plans exceeding answer or judge limits.

| Limit | Effect |
| --- | --- |
| `maxIterations` | Maximum candidate edits the improvement agent may attempt. |
| `maxAnswerGenerations` | Maximum responses produced by answer models. |
| `maxJudgeCalls` | Maximum independent grades of saved responses. |
| `maxDurationMinutes` | Wall-clock limit for the complete run. |
| `maxConcurrentJobs` | Maximum Vally generation or grading processes running together. |
| `maxSkillTokenIncreasePercent` | Maximum estimated Markdown token growth versus the baseline skill. |

## Acceptance calculations

Each saved response is graded by every configured judge. The runner uses:

- majority vote for pass/fail;
- median judge score for the response score;
- pass-rate difference in percentage points as the primary improvement metric;
- per-answer-model and per-eval pass-rate differences as regression checks;
- skill invocation as a separate behavioral requirement;
- average generated-answer tokens as an efficiency diagnostic.

## Commands

Run all commands from `tests` with `--config <repository-file>`.

| Command | Audience and behavior | Options and outputs |
| --- | --- | --- |
| `validate` | Human or CI preflight. Resolves evals, calculates worst-case usage, and enforces limits without invoking models. | Prints normalized spec and plan JSON. |
| `run --executor local` | Human entry point and default executor. Runs the engine locally. | Optional `--baseline-ref` and `--output`; otherwise uses the spec baseline and a timestamped output directory. |
| `run --executor github` | Human dispatcher. Queues the Skill Improvement workflow; it does not run Vally locally. | Optional `--workflow-ref`, `--baseline-ref`, `--pr-base`, and `--create-draft-pr`. |
| `execute` | Workflow/internal entry point. Runs the engine directly without dispatch. | Requires `--output`; accepts `--baseline-ref`. Writes reports, trajectories, judgments, patches, snapshots, issue summary, and workflow metadata. |

```powershell
npm run skill-improvement -- validate `
  --config .\skill-improvement\specs\azure-kusto.yaml

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor github `
  --workflow-ref <workflow-branch> `
  --baseline-ref <evaluated-ref> `
  --pr-base main `
  --create-draft-pr

npm run skill-improvement -- execute `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --baseline-ref main `
  --output .\skill-improvement-runs\manual
```

Adapters affect generation and grading inside local `run` or `execute`;
GitHub `run` dispatches the spec unchanged. Draft PR creation is only attempted
for an accepted candidate. `output.issue: always` creates a result issue even
when no candidate passes.

## Answer and judge separation

Vally first runs with `--skip-grade` to save trajectories. Each saved
trajectory is then re-graded with `vally grade --judge-model` for every
configured judge. Changing judges therefore does not require regenerating
answers.

The improvement agent receives development failures, judge evidence, answer
excerpts, and rejection reasons from earlier iterations. Held-out results are
not included in that failure packet.

Each iteration preserves both `candidate.patch` and a complete
`candidate-skill/` copy before validation and acceptance. Rejected candidates
therefore remain available for inspection after the temporary worktree is
removed.

## Opt-in evaluation suites

`evaluations.root` must be under `tests/skill-improvement/evals/`; development
and held-out entries are filenames inside it. Absolute, nested, traversing, or
escaping paths are rejected. These suites are opt-in and are not discovered by
the nightly workflow, which scans top-level `evals/`.

## Custom evaluator commands

By default, the runner directly launches
`npx -y @microsoft/vally-cli eval` and `grade`. A spec can instead declare
generation and grading commands for a trusted npm wrapper:

See the complete split-stage Foundry-style configuration in
[`specs/npm-wrapper.example.yaml`](./specs/npm-wrapper.example.yaml) for a
generate/grade commands, working directories, environment, placeholders, and
the fixed output contract.

The engine always launches the executable and argument array without a shell.
Custom commands currently support only the fixed npm form
`npm run --silent <safe-script-name> -- <args>`. The runner supplies
`--silent` so npm lifecycle banners cannot contaminate JSONL stdout. The
repository's npm script is trusted code, but configured values remain literal
argv elements: the runner never turns them into a command string, performs
shell expansion, or uses
`shell: true`, `cmd.exe /c`, PowerShell command construction, or `eval`.

Each argument or environment value is a literal or one whole placeholder.
Both stages allow `{evalPath}`, `{evalFile}`, `{answerModel}`,
`{repetitions}`, `{generationDirectory}`, `{targetPlugin}`, `{targetSkill}`,
`{conditionName}`, and `{pluginOutputRoot}`. Grading also allows
`{judgeModel}`, `{answerFile}`, `{runDirectory}`, and
`{judgmentDirectory}`. Embedded forms such as `"model={answerModel}"` are
rejected, preserving one-value-in/one-value-out expansion.

`workingDirectory` is relative to the evaluation repository. Absolute paths,
parent traversal, and links that resolve outside the repository are rejected.
Environment overrides cannot replace execution-control or engine-owned
variables such as `PATH`, `ComSpec`, `SHELL`, `NODE_OPTIONS`,
`NODE_PATH`, `NPM_CONFIG_*`, condition flags, or output settings. The process
environment remains inherited for authentication and CI; never put secrets in
the run specification.

The output contract is intentionally fixed:

- generation writes Vally trajectory JSONL to stdout;
- the engine captures stdout as `answers.jsonl` and stderr separately;
- generation creates exactly one child run directory containing
  `eval-results.md`;
- generated trajectory count matches configured stimuli times repetitions;
- grading reads the generated JSONL from stdin and writes graded Vally JSONL
  to stdout;
- grading must return exactly one graded record per generated trajectory.

One-shot wrappers are incompatible: expose separate scripts so generated
answers can be reused across judges. The engine schedules one generation per
configured eval YAML; unrelated whole-suite batching requires a future
evaluation-unit and budgeting design.
