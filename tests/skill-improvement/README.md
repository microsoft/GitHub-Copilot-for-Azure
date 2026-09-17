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

## What the limits mean

Assume a run has 10 prompts, 2 answer models, 2 conditions, 2 judges, and 2
improvement iterations.

- Baseline answers: `10 * 2 * 2 = 40`.
- Candidate answers: only skill-enabled conditions are rerun. With one
  skill-enabled condition, each iteration uses `10 * 2 * 1 = 20`.
- Maximum answers: `40 + (20 * 2) = 80`.
- Judge calls: `80 * 2 = 160`.

The engine refuses to start when this plan exceeds `maxAnswerGenerations` or
`maxJudgeCalls`.

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

For example, a baseline pass rate of 60% and candidate pass rate of 66% is a
`+6` point quality improvement. If `minimumQualityImprovementPoints` is `2`,
the overall improvement rule passes.

## Run locally

```powershell
cd tests

npm run skill-improvement -- validate `
  --config .\skill-improvement\specs\azure-kusto.yaml

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor local
```

Local execution runs Vally, judges, and Copilot CLI on the current machine. It
does not trigger GitHub Actions.

## Dispatch GitHub Actions locally

```powershell
cd tests

npm run skill-improvement -- run `
  --config .\skill-improvement\specs\azure-kusto.yaml `
  --executor github `
  --workflow-ref <branch-containing-the-workflow> `
  --baseline-ref <branch-to-evaluate> `
  --pr-base main `
  --create-draft-pr
```

The draft PR flag is only a request. A PR is not created unless a candidate
passes all acceptance rules. The workflow creates one result issue per run when
the specification uses `output.issue: always`.

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

Each run specification sets `evaluations.root` to a repository-relative
directory under `tests/skill-improvement/evals/`. Development and held-out
entries are filenames within that root; absolute paths, nested paths, traversal,
and paths that resolve outside the configured root are rejected.

Suites in this directory are opt-in inputs to the hill-climbing runner. They are
not discovered by the nightly integration workflow, which scans `evals/`.
The Azure Kusto improvement spec intentionally excludes the pre-existing
`evals/azure-skills/azure-kusto/eval.yaml` suite so the run has one isolated,
containment-checked evaluation root without copying or modifying the nightly
suite.

## Custom evaluator commands

By default, the runner directly launches
`npx -y @microsoft/vally-cli eval` and `grade`. A run specification can instead
declare separate generation and grading commands for a trusted repository npm
wrapper:

```yaml
evaluator:
  kind: command
  generate:
    executable: npm
    args:
      - run
      - test:vally
      - "--"
      - --suite
      - foundry-e2e
      - --model
      - "{answerModel}"
      - --runs
      - "{repetitions}"
      - --skip-grade
      - --output
      - jsonl
      - --output-dir
      - "{generationDirectory}"
    workingDirectory: .
    environment:
      VALLY_RUNS: "{repetitions}"
  grade:
    executable: npm
    args:
      - run
      - test:vally:grade
      - "--"
      - --suite
      - foundry-e2e
      - --judge-model
      - "{judgeModel}"
      - --run-dir
      - "{runDirectory}"
      - --output
      - jsonl
  output:
    format: vally-jsonl
    generationStdout: trajectories
    gradingStdin: trajectories
    gradingStdout: graded-trajectories
    runDirectoryMarker: eval-results.md
```

See
[`specs/npm-wrapper.example.yaml`](./specs/npm-wrapper.example.yaml) for a
complete illustrative run specification.

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
`NPM_CONFIG_SCRIPT_SHELL`, condition flags, or output settings. The process
environment remains inherited for authentication and CI; never put secrets in
the run specification.

The output contract is intentionally fixed:

- generation writes Vally trajectory JSONL to stdout;
- the engine captures stdout as `answers.jsonl` and stderr separately;
- generation creates exactly one child run directory containing
  `eval-results.md`;
- grading reads the generated JSONL from stdin and writes graded Vally JSONL
  to stdout;
- grading must return exactly one graded record per generated trajectory.

One-shot wrappers are incompatible: expose separate scripts so generated
answers can be reused across judges. The engine schedules one generation per
configured eval YAML; unrelated whole-suite batching requires a future
evaluation-unit and budgeting design.
