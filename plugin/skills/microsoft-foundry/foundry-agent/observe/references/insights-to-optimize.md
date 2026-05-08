# Insights-to-Optimize Loop

End-to-end workflow: automatically detect agent quality regressions via the Tracing Insights API, then fix them via FAOS optimization, then verify improvement.

## When to Use

Use this when you want a **fully automated quality improvement loop** — no manual KQL analysis, no manual prompt rewriting. The flow is:

1. Tracing Insights API detects anomalies in evaluation scores
2. Critical/Warning insights are converted to FAOS optimization criteria
3. FAOS rewrites agent instructions to address the regressions
4. Verification confirms token reduction and score improvement

**vs. manual eval loop (observe.md Step 4):** Use observe.md when you have a batch eval with specific failure clusters. Use this loop when you want insights auto-detected from production traces.

**Scope:** Prompt agents only (not hosted agents).

## Prerequisites

- App Insights connected to Foundry project with evaluation data (`gen_ai.evaluation.result` events)
- Agent created via Foundry Agents API (not legacy Assistants API)
- Agent's Responses API working (`POST /openai/responses` returns valid completions)

## Flow

1. **Tracing Insights API** (detect anomalies)
2. **Bridge** (convert insights to FAOS dataset)
3. **FAOS Optimize** (rewrite prompt)
4. **Create v2 agent** with optimized instructions
5. **Verify** (compare v1 vs v2 tokens and scores)

## Step 1: Call Tracing Insights API

See [Tracing Insights API reference](../../trace/references/tracing-insights-api.md) for full details.

Filter results to `Warning` and `Critical` severity insights.

## Step 2: Extract Traces from relatedSpans

Each insight in v1-beta2 includes `relatedSpans` with `operationId` values. Query App Insights to get the actual user queries and agent responses:

```kql
dependencies
| where operation_Id in ("<operationId1>", "<operationId2>")
| where customDimensions has "invoke_agent"
| project query = parse_json(customDimensions["gen_ai.input.messages"]),
          response = parse_json(customDimensions["gen_ai.output.messages"]),
          tokens = toint(customDimensions["gen_ai.usage.output_tokens"])
```

Use the extracted queries as FAOS dataset prompts. If `relatedSpans` is empty, fall back to manually crafted queries.

## Step 3: Convert Insights to FAOS Dataset

For each insight, map to a FAOS dataset item:

| Insight Signal | FAOS Criteria Instruction |
|---------------|---------------------------|
| TaskAdherence drop | "Agent should follow task instructions precisely and complete all requested items" |
| Intent Resolution drop | "Agent should correctly interpret user intent and ask clarifying questions" |
| Token spike | "Agent should give concise, focused responses without excessive verbosity" |
| Latency spike | "Agent should respond efficiently without unnecessary tool calls" |
| Error rate increase | "Agent should handle edge cases gracefully without errors" |

Generate 2-3 representative prompts per insight that exercise the problem area. Use the agent's domain context to make prompts realistic.

## Step 4: Call FAOS

See [FAOS Optimization reference](./faos-optimization.md) for endpoint details and workspace requirement.

Construct request body with the converted dataset and use `"strategies": ["instruction"]` to rewrite the system prompt.

## Step 5: Apply and Verify

1. Extract `best.config.systemPrompt` from FAOS response
2. Create a new agent (e.g., `<name>-v2`) or update existing agent with optimized instructions
3. Send the same test queries to both v1 and v2
4. Compare:
   - **Completion tokens** (expect 30-70% reduction from better instructions)
   - **Pass rate** on task adherence criteria
   - **Response quality** (spot-check a few responses)

## Example Summary Output

| Metric | v1 | v2 |
|--------|----|----|
| Completion tokens | 3195 | 1008 |
| Pass rate | 66.7% | 100% |
| Reduction | — | 68.5% |

## Decision Point

After verification, ask the user:
- **Keep v2** → Update production agent with optimized instructions
- **Keep v1** → Discard (insights may need more data)
- **Iterate** → Run another FAOS pass with adjusted criteria
