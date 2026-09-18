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
| `execute` | GitHub Actions/automation entry point. Runs the engine directly without dispatch; most users should use `run`. | Requires `--output`; accepts `--baseline-ref`. Writes reports, trajectories, judgments, patches, snapshots, issue summary, and workflow metadata. |

```powershell
npm run skill-improvement -- validate `
  --config .\skill-improvement\specs\azure-kusto.yaml

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor local

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor github `
  --workflow-ref <workflow-branch> `
  --baseline-ref <evaluated-ref> `
  --pr-base main `
  --create-draft-pr

# Automation or direct-engine debugging only
npm run skill-improvement -- execute `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --baseline-ref main `
  --output .\skill-improvement-runs\manual
```

Adapters affect generation and grading inside local `run` or `execute`;
GitHub `run` dispatches the spec unchanged.

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

Custom evaluators are opt-in compatibility adapters for repositories that
already expose evaluation through trusted npm scripts, including Foundry-style
wrappers. The engine still owns planning, limits, conditions, artifacts,
comparisons, and acceptance. Existing specs and default Azure Skill runs
continue to launch `npx -y @microsoft/vally-cli eval` and `grade` directly.

See the complete split-stage Foundry-style configuration in
[`specs/npm-wrapper.example.yaml`](./specs/npm-wrapper.example.yaml) for the
commands, complete placeholder list, working directories, environment, and
output contract. Placeholders must occupy a whole argument or environment
value; embedded forms such as `"model={answerModel}"` are rejected.

Adapters support only trusted npm scripts invoked as argv, never through a
shell or command string. Working directories must resolve inside the
repository, and configured environment values cannot override protected
execution or engine state. The inherited environment remains available for
authentication and CI; never put secrets in the run specification.

The output contract is intentionally fixed:

- generation writes Vally trajectory JSONL to stdout and creates one run
  directory containing `eval-results.md`;
- the engine saves stdout as `answers.jsonl`, with stderr separate, and verifies
  the configured trajectory count;
- grading reads saved JSONL from stdin, writes graded Vally JSONL to stdout,
  and returns one graded record per trajectory.

Generation and grading remain separate so saved answers can be reused across
judges. One-shot wrappers are therefore incompatible and must expose separate
scripts.
