# Add a Claude/Copilot comparison scenario

Use this guide to compare both clients on a new prompt with shared context and
grading. Most scenarios need only an eval YAML, not a new executor or runner.
See the [comparison guide](../README.md) for runtime controls and limitations.

## 1. Set up once

From the repository root, restore dependencies and build the skills:

```shell
npm ci
npm run build
npm --prefix tests ci
```

Follow [Claude executor setup](../../../evals/README.md#run-with-claude-code)
to build the pinned upstream Vally executor and set
`VALLY_CLAUDE_EXECUTOR_MODULE` to its absolute `dist/index.js` path.
Set `CLAUDE_CLI_PATH` to the native Claude executable if it is not on PATH.
Authenticate Claude and Copilot: Copilot also supplies the LLM judge.
Never put keys or login files in the eval or fixtures.

Select explicit client and judge model IDs supported by their providers.
Use equivalent client model versions where possible; otherwise the experiment
compares both client and model differences.

## 2. Choose discovery and execution scope

| Scenario | Suggested location | Execution |
| --- | --- | --- |
| Manually selected, non-deploying comparison | `tests/comparison/scenarios/<name>.eval.yaml` | `compare:clients` |
| Eval intentionally included in normal skill discovery | `evals/azure-skills/<skill>/<name>.eval.yaml` | Existing per-skill runs and optionally `compare:clients` |
| Live or destructive scenario | Separate opt-in directory and lifecycle wrapper, like `tests/comparison/live` | Dedicated wrapper |

The first location stays outside normal `evals` discovery. Adding a file under
`evals` can make it run in existing per-skill/nightly jobs; do not put a paid
deployment experiment there accidentally. No suite registration is needed when
passing a concrete file through `--eval-spec`.

## 3. Write the prompt and grading contract

For a non-deploying example, save this as
`tests/comparison/scenarios/service-selection.eval.yaml`. This is a new,
illustrative scenario, not a replay of user telemetry.

```yaml
name: service-selection-comparison
description: Compare grounded service-selection advice without deployment.
tags:
  skill: azure-ai
defaults:
  runs: 1
  timeout: "5m"
agent_environment:
  mcpServers: {}
scoring:
  threshold: 1
stimuli:
  - name: Recommend an image text extraction service
    prompt: >-
      I need to extract printed text from product-label images.
      Recommend an Azure service and explain two limitations I should
      evaluate before adopting it. Do not create resources or write code.
    tags:
      requiredSkills: [azure-ai]
      systemPrompt: >-
        {"mode":"append","content":"This is a non-deploying evaluation. You may read the provided skill documentation. Do not access cloud resources, run setup scripts, install dependencies, modify files, or request credentials. Distinguish recommendations from actions actually performed."}
    rubric:
      - Recommends an Azure OCR-capable service suitable for printed image text.
      - Explains two concrete limitations relevant to product-label images.
      - Does not claim deployment, image processing, or validation occurred.
    graders:
      - type: completed
      - type: skill-invocation
        config:
          required: [azure-ai]
      - type: prompt
        config:
          scoring: binary
          threshold: 1
          prompt: >-
            Evaluate the response and recorded actions against every rubric
            criterion. Require a suitable recommendation, two concrete
            limitations, and truthful reporting without resource changes.
```

Adapt the example rather than only replacing its prompt:

- Give every stimulus a unique, stable name. The runner pairs results by stimulus
  identity and checks the expected number of trials.
- Set `requiredSkills` to the complete shared candidate pool. For a routing
  experiment, include plausible competing skills; the invocation grader's
  `required` list specifies which must actually be invoked, not all candidates.
- Put shared facts and boundaries in the prompt or the JSON-string
  `tags.systemPrompt`. Avoid client-specific instructions or answer leakage.
- Give every stimulus a nonempty `rubric` for pairwise judging. Use graders for
  absolute pass/fail and the rubric for comparative quality. An LLM judgment is
  not independent proof that deployed software works.
- Add more stimuli for edge cases with explicit expected behavior. Check that
  each selected skill exists in the built output.

## 4. Add reproducible inputs when needed

Use Vally's `agent_environment.files` entries (`src` and `dest`) for local
fixtures. Source paths resolve relative to the eval file; the shared runner
hashes those inputs and gives both clients fresh trial workspaces. Keep fixtures
small, deterministic, approved for publication, and free of credentials.
See the [eval authoring reference](../../../.github/skills/vally-eval/SKILL.md)
for the full environment schema.

Nonsecret shared variables go in `agent_environment.env`. Declare required MCP
servers explicitly in `agent_environment.mcpServers`, pin their package
versions, and provide credentials at runtime. No implicit Azure MCP server is
added in comparison mode.

Use the shared timeout rather than native turn limits. The paired runner rejects
`max_turns`, screenshot tags, `reasoning_effort`, executor-specific configuration,
`environment.skills`, and MCP `cwd`/`timeout` overrides. It disables
`earlyTerminate` for fairness. Do not bypass these checks to make one client pass.

## 5. Run both clients

From the repository's `tests` directory, after setup above:

```powershell
$env:MODEL_OVERRIDE = $null
$env:NO_SKILLS = $null
npm run compare:clients -- --eval-spec .\comparison\scenarios\service-selection.eval.yaml --copilot-model "<copilot-model-id>" --claude-model "<claude-model-id>" --judge-model "<judge-model-id>" --runs 1 --timeout 5m
if ($LASTEXITCODE -ne 0) { throw "Comparison failed; inspect the run artifacts." }
```

In Bash, from the same directory:

```bash
unset MODEL_OVERRIDE NO_SKILLS
npm run compare:clients -- --eval-spec ./comparison/scenarios/service-selection.eval.yaml --copilot-model "<copilot-model-id>" --claude-model "<claude-model-id>" --judge-model "<judge-model-id>" --runs 1 --timeout 5m
```

Replace all model placeholders. Start with one trial to check the setup, then
increase `--runs` (for example, to 5) for repeated measurements. These commands
make paid model/judge calls even when the scenario does not deploy resources.
There is no comparison dry-run option.

The runner snapshots skills, randomizes which client executes first, and runs
them sequentially with one worker and no retries. It enables the shared policy
automatically. Pass one eval file per invocation, not `--suite` or `--skill`.
Repeat the command for separate scenarios.

`--skip-judge` skips only pairwise judging, not per-case LLM graders.
`--fail-on-regression` gates significant relative regressions and cannot combine
with `--skip-judge`. Neither a normal zero exit nor a relative-regression gate
means every absolute grader passed.

## 6. Review evidence

Use the exact directory printed under `tests/results-comparison/comparison-*`.
Inspect `comparison-run.json`, each client's `results.jsonl` and grader output,
and `comparison.jsonl` for pairwise judgments.

With the report-generation changes installed, `comparison-report.md` and
`comparison-report.json` summarize quality, active time, tool calls, native
turns, tokens, and assessment. See [interpretation caveats](../README.md#interpretation).
One pair is exploratory evidence, not a general performance conclusion.
Native turns and token accounting are not directly interchangeable.

Review raw artifacts for sensitive command output before sharing. Keep them
ignored; never force-add credential files, generated environments, or trajectories.

## 7. Extend to live outcomes

Do not turn the example into a live deployment merely by changing its prompt.
The generic runner does not provision isolation or clean cloud resources.
Follow the existing [live runner](../live/run.ts),
[independent verifier](../live/azure.ts), and
[custom grader](../live/outcome-grader.ts) as a design reference:

1. Require explicit paid-operation authorization and a disposable subscription.
   Create a fresh, uniquely owned resource scope immediately before each client.
2. Supply identical scope rules through shared context, with separate resource
   names for each client. Local workspaces alone do not isolate remote state.
3. Implement outcome checks outside agent control: discover the assigned
   resource, verify its actual state, invoke it, and assert the scenario-specific
   output. Do not trust an agent-written success file or arbitrary claimed URL.
4. Register the custom grader in the wrapper with an absolute plugin path.
   `compare:clients` does not expose a generic `--grader-plugin` flag.
5. Save evidence, verify ownership before deletion, and confirm cleanup on both
   successful and failed runs. Provide recovery for cancellation/runner death.
6. Gate required quality checks as well as deployment and cleanup. Add mocked
   lifecycle tests for failed creation, execution, verification, and cleanup
   before making paid calls.

The current `compare:foundry-live` command hardcodes its hello-world eval and
one trial per client. It does not accept an arbitrary scenario path. A different
live scenario needs an adapted lifecycle wrapper and verifier; it is not a
drop-in YAML replacement. Preserve the existing test rather than repurposing it.
Scope prompts are not an OS/RBAC sandbox: use least-privilege credentials.
