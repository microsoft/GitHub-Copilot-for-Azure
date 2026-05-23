# Agent Optimizer in Foundry — Scaffold Python Agent

Prepare an existing Python agent for Agent Optimizer in Foundry by scaffolding source-code wiring and `.agent_configs/baseline/`. This skill covers the pre-optimization scaffold step, not running optimization itself.

## When to Use This Skill

USE FOR: make my Python agent optimizable with Agent Optimizer in Foundry, scaffold optimizer config, add `load_config`, prepare `.agent_configs`, choose evaluator-driven optimization targets, expose instruction/model/skill/function-tool targets.

DO NOT USE FOR: non-Python agents, deploying an agent directly, running batch evaluations, prompt optimization of an already deployed agent, or general Foundry deployment. For deployment, use [deploy](../deploy/deploy.md). For evaluator runs and prompt optimization loops, use [observe](../observe/observe.md).

## Quick Reference

| Property | Value |
| -------- | ----- |
| Phase | Scaffold before actual optimization |
| Supported language | Python |
| Required package | `azure-ai-agentserver-optimization` |
| Required import | `from azure.ai.agentserver.optimization import load_config` |
| Required baseline | `.agent_configs/baseline/` beside `agent.yaml` |
| Supported targets | instruction, model, skill folder, function tool descriptions |
| Detailed scaffold steps | [Scaffold Workflow](references/scaffold.md) |
| Python/file patterns | [Python Patterns](references/python-patterns.md) |

## High-Level Lifecycle

1. **Scaffold:** Make the agent optimizable by following [Scaffold Workflow](references/scaffold.md). This adds the SDK package, no-arg `load_config()`, and `.agent_configs/baseline/` files.
2. **Run locally:** Start the scaffolded agent locally, for example with `azd ai agent run`, then test it with the local invoke flow from [invoke](../invoke/invoke.md).
3. **Deploy new version:** After review and local validation, deploy the scaffolded code as a new agent version with [deploy](../deploy/deploy.md), then invoke it again.
4. **Upcoming optimize in Foundry UI:** Use Foundry UI to run optimization and inspect richer candidate details.
5. **Upcoming apply best candidate:** Apply the selected candidate and deploy through the safe rollout workflow when available.

## Workflow

1. Resolve the target agent root and confirm it is a Python agent.
2. Read [Scaffold Workflow](references/scaffold.md) and use evaluator/dataset goals to choose scaffold targets.
3. Apply [Python Patterns](references/python-patterns.md) for SDK import, baseline files, `tools.json`, and runtime wiring.
4. Stop for review. Summarize changed files, selected optimization targets, local validation, and any global side effects.
5. After user approval, run locally, then route to [deploy](../deploy/deploy.md) and [invoke](../invoke/invoke.md).

## Guardrails

- Treat this skill as scaffold-only; do not run optimization here.
- Preserve existing frameworks, tools, hosting adapters, protocols, and entrypoints.
- Do not use one global scaffold across multi-agent roles unless the architecture already has one global prompt/model or the user approves.
- Keep edits scoped to the selected agent root.
- Do not deploy automatically; stop for review first.
