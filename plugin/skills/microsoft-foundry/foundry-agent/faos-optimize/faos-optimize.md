# FAOS (Foundry Agent Optimization Service) Optimize Python Agent

Convert existing Python agent code into a FAOS optimization-ready version by wiring runtime configuration knobs to the FAOS config contract. This workflow prepares source code for optimization, asks the user to review the changes, and then routes to Foundry deployment only after explicit user approval.

## When to Use This Skill

USE FOR: make my Python agent FAOS optimizable, add FAOS_Config, add `load_config`, enable optimization config, make this agent optimization-ready, convert Python agent for FAOS optimization, wire evaluator-driven optimization knobs, expose prompt/model/temperature for FAOS.

DO NOT USE FOR: non-Python agents, deploying an agent directly, running batch evaluations, prompt optimization of an already deployed agent without source-code changes, or general Foundry deployment. For deployment, use [deploy](../deploy/deploy.md). For evaluator runs and prompt optimization loops, use [observe](../observe/observe.md).

## Scope

- Python only for now.
- Works across Python frameworks and runtimes when there are identifiable instructions/model/options surfaces.
- The FAOS config contract is framework-neutral. Framework-specific work is limited to finding the correct insertion points and preserving the existing runtime.
- Do not switch frameworks, hosting adapters, protocols, or entrypoints unless the user explicitly asks.
- Do not deploy automatically. Always stop for review first, then suggest Foundry deployment.

## Quick Reference

| Property | Value |
| -------- | ----- |
| Supported language | Python |
| Required pattern | `from agent_optimization import load_config` |
| Required knobs | instructions, model |
| Optional knobs | temperature, skills directory, learned skills, tool/retrieval options when safe |
| Review gate | Mandatory before deploy |
| Next workflow | [deploy](../deploy/deploy.md) after user approval |

## Workflow

| Phase | Steps | Reference |
|-------|-------|-----------|
| Plan | Steps 1-7: Resolve root, check Python eligibility, resolve evaluator objective, build knob inventory, classify topology, map evaluators to knobs, present targets | [Plan Conversion](references/plan-conversion.md) |
| Apply | Steps 8-10: Apply Python FAOS config contract, add/reuse agent_optimization package, update dependencies | [Apply Conversion](references/apply-conversion.md) |
| Verify | Steps 11-12: Run checks, stop for review, suggest deploy | [Verify and Review](references/verify-and-review.md) |

## Guardrails

- Python only for now.
- The config contract is framework-neutral; insertion points are runtime-specific.
- Preserve existing frameworks, tools, hosting adapters, protocols, and entrypoints.
- Do not use one global config across all agents in a multi-agent system unless the existing architecture already uses one global prompt/model and the user approves.
- Do not wire temperature where unsupported or semantically risky.
- Prefer low-temperature planning/tool-calling defaults unless an evaluator objective suggests otherwise.
- Treat evaluator context as a targeting signal, not proof that every related knob should be changed.
- Keep all edits scoped to the selected agent root.
- Stop for review before deployment.
