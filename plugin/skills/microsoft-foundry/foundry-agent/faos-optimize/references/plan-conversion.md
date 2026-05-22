# FAOS Conversion -- Plan

Planning phase for FAOS agent optimization conversion. Part of the [FAOS Optimize skill](../faos-optimize.md).

## Step 1: Resolve Target Agent Root

Use the parent Microsoft Foundry project context resolution rules. If the user provides a path, use that path directly. Otherwise discover `.foundry/agent-metadata*.yaml` or agent source indicators in the workspace.

After selecting an agent root, stay inside that root. Do not scan sibling agent folders unless the user explicitly switches target roots.

## Step 2: Confirm Python Eligibility

Detect Python using one or more of:

- `requirements.txt`
- `pyproject.toml`
- `setup.py`
- `*.py` entrypoints

If the target is not Python, stop and explain that FAOS source-code conversion is Python-only for now. If the target contains multiple languages, modify only the Python agent entrypoint unless the user approves a broader change.

## Step 3: Resolve Evaluator Objective

FAOS optimizes behavior against evaluator signals, so first identify what the code should become optimizable for.

Inspect these sources, in order, when available:

1. User-stated evaluator objective, for example `tool_call_accuracy`, `intent_resolution`, or `relevance`
2. Selected `.foundry/agent-metadata*.yaml` `evaluationSuites[]`, legacy `testSuites[]`, or legacy `testCases[]`
3. `.foundry/evaluators/*.yaml`
4. `.foundry/results/**` summaries or recent failure analysis files
5. Existing code comments, README guidance, or test names describing target behavior

If evaluator context is unknown, continue with a conservative base conversion and tell the user that evaluator-specific targeting may produce better FAOS results.

## Step 4: Build Python Knob Inventory

Scan the selected agent root for configurable behavior surfaces. Prefer semantic reads of source files over broad string replacement.

Look for:

- Instructions: `instructions=`, `system_prompt`, `SYSTEM_PROMPT`, `prompt=`, `system_message`, `developer_message`
- Model selection: `model=`, `deployment=`, `MODEL_DEPLOYMENT_NAME`, `AZURE_OPENAI_DEPLOYMENT`, framework-specific model fields
- Generation options: `temperature`, `top_p`, `max_tokens`, `response_format`, `tool_choice`, `parallel_tool_calls`
- Agent topology: `Agent(`, `agents=[...]`, `handoffs`, `supervisor`, `router`, `planner`, `executor`, `critic`, `synthesizer`, `WorkflowBuilder`, `StateGraph`
- Tool/retrieval surfaces: tool decorators, tool descriptions, argument schemas, retriever settings, index names, search limits
- Hosting entrypoint: FastAPI/Flask apps, `ResponsesHostServer`, uvicorn, custom response loops, LangGraph servers

Create an internal inventory with file path, symbol/name, role, current default, and whether it is safe to expose through FAOS config.

## Step 5: Classify Agent Topology

Classify the architecture before editing:

| Topology | Default FAOS targeting |
| -------- | ---------------------- |
| Single agent | Wire config directly to the agent's instructions/model/options |
| Multi-agent with obvious orchestrator/supervisor | Target the orchestrator by default, unless evaluator context points elsewhere |
| Multi-agent with specialist tool agent | Target the specialist/tool path when evaluators focus on tool or task behavior |
| Multi-agent peer architecture with no orchestrator | Present a plan and ask before editing |
| Unknown Python runtime | Add only the minimal config loader and propose exact manual wiring points |

Do not collapse multiple role-specific prompts into a single global `SYSTEM_PROMPT`. Preserve specialist prompts as defaults unless the user asks to optimize them together.

## Step 6: Map Evaluators to Candidate Knobs

Use evaluator context to select the smallest meaningful optimization scope.

| Evaluator signal | Prefer these knobs first |
| ---------------- | ------------------------ |
| `relevance` | final response instructions, answer synthesis prompt, model choice |
| `task_adherence` | primary task instructions, specialist instructions, response constraints |
| `intent_resolution` | router/orchestrator prompt, classifier prompt, planner prompt, handoff descriptions |
| `builtin.tool_call_accuracy` | tool-calling agent instructions, tool descriptions, argument schema descriptions, tool-choice/planner settings, low-temperature planning behavior |
| `indirect_attack` | safety instructions, instruction hierarchy, tool input handling, retrieved/tool-content treatment rules |
| groundedness/citation quality | retrieval instructions, answer synthesis prompt, citation formatting, retrieval parameters when exposed safely |
| latency/cost | model selection, max tokens, number of agent hops, tool/retrieval limits |

If evaluators point to different subsystems, prefer a targeted set of named config hooks over one global config. Flag any knob whose change would affect all agents, such as a shared model client.

## Step 7: Present Proposed FAOS Targets

Before editing, summarize:

- Selected agent root
- Python entrypoint(s)
- Detected topology
- Known evaluator objectives
- Proposed FAOS targets and why
- Knobs that will remain unchanged
- Files that will be modified or added

If there is exactly one safe target, proceed unless the user asked for an approval checkpoint. If there are multiple plausible targets, ask the user which scope to optimize before editing.

Example review summary:

```text
Detected evaluator targets:
- builtin.tool_call_accuracy
- intent_resolution

Detected topology:
- router_agent routes user requests
- weather_agent owns get_weather tool
- final_answer_agent synthesizes output

Proposed FAOS targets:
- router_agent instructions: improves intent resolution
- weather_agent instructions/tool schema: improves tool-call accuracy
- preserve final_answer_agent for now
```
