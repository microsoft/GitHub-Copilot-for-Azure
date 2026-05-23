# Scaffold Workflow

Use this workflow to make a Python agent optimizable before running Agent Optimizer in Foundry.

## Step 1: Resolve Target and Goal

Stay inside the selected agent root. Confirm the project is Python using `requirements.txt`, `pyproject.toml`, `setup.py`, or Python entrypoints.

Identify the optimization goal from user input, selected `evaluationSuites[]`, `.foundry/evaluators/*`, recent result summaries, datasets, or code/test comments. If the goal is unclear, proceed conservatively and explain that evaluator-specific targeting improves optimization quality.

## Step 2: Inventory Safe Targets

Scan for instructions, model selection, skill folders, function tool descriptions, topology, and hosting entrypoint. Record file path, symbol/name, role, current value, and whether it is safe to expose through the optimizer.

Classify topology as single-agent, orchestrator/supervisor, specialist tool-agent, peer multi-agent, or unknown runtime. Do not collapse role-specific prompts into one global prompt. Ask before editing when multiple scopes are plausible.

Use [Python Patterns](python-patterns.md#target-selection) to map evaluator/dataset goals to the smallest useful baseline.

## Step 3: Scaffold Baseline Files

Create `.agent_configs/baseline/` beside `agent.yaml`:

```text
.agent_configs/
  baseline/
    metadata.yaml
    instructions.md
    tools.json
    skills/<skill-name>/SKILL.md
```

`metadata.yaml` points to selected baseline files:

```yaml
model: gpt-4o
temperature: 0.7
instruction_file: instructions.md
skill_dir: skills
tool_file: tools.json
```

Write the selected baseline prompt to `instructions.md`. Include only relevant skills under `skills/`. Use `tools.json` only for function `tool_descriptions`; see [Python Patterns](python-patterns.md#tools-file).

Do not use code-level defaults as the optimization baseline.

## Step 4: Install and Wire SDK

Add `azure-ai-agentserver-optimization` to the project dependency file.

Wire the agent with no default parameters:

```python
from azure.ai.agentserver.optimization import load_config

config = load_config()
```

Map resolved values:

- Instructions -> `config.compose_instructions()`
- Model -> `config.model`
- Skills -> `config.skills_dir` with `load_skills_from_dir(...)` only when the runtime has a safe skill/tool mechanism
- Function tool descriptions -> `config.apply_tool_descriptions(tools)` when tool metadata can be patched safely

Document runtime-only env vars when needed: `OPTIMIZATION_CONFIG`, `OPTIMIZATION_CANDIDATE_ID`, `OPTIMIZATION_JOB_ID`, `OPTIMIZATION_RESOLVE_ENDPOINT`, and `OPTIMIZATION_LOCAL_DIR`. Do not add them all to `agent.yaml`; default local config path is `.agent_configs/`.

## Step 5: Verify and Stop

Run Python syntax checks, SDK import smoke test, baseline config smoke test with no-arg `load_config()`, workspace diagnostics, and cheap relevant project tests.

End with a review checkpoint. Summarize changed files, optimization targets, evaluator goals, global side effects, and verification. Do not deploy automatically.
