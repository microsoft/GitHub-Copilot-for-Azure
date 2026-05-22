# Trace-to-Dataset Pipeline -- Harvest Production Traces as Test Cases

Extract production traces from App Insights using KQL, transform them into evaluation dataset format, and persist as versioned datasets. This is the core workflow for turning real-world agent failures into reproducible test cases.

## [!] Do NOT

- Do NOT use `parse_json(customDimensions)` -- `customDimensions` is already a `dynamic` column in App Insights KQL. Access properties directly: `customDimensions["gen_ai.response.id"]`.

## Related References

- [Eval Correlation](../../trace/references/eval-correlation.md) (in `foundry-agent/trace/references/`) -- look up eval scores by response/conversation ID via `customEvents`
- [KQL Templates](../../trace/references/kql-templates.md) (in `foundry-agent/trace/references/`) -- general trace query patterns and attribute mappings

## Prerequisites

- App Insights resource resolved (see [trace skill](../../trace/trace.md) Before Starting)
- Agent root, selected metadata file, environment, and project endpoint available from `.foundry/agent-metadata*.yaml`
- Time range confirmed with user (default: last 7 days)

When a repo contains multiple agent roots, this workflow updates only the selected agent root's `.foundry/datasets/`, `.foundry/results/`, and metadata files. Do **not** merge sibling agent folders.

> Tip: **Run all KQL queries** using **`monitor_resource_log_query`** (Azure MCP tool) against the App Insights resource. This is preferred over delegating to the `azure-kusto` skill.

> [!] **Always pass `subscription` explicitly** to Azure MCP tools -- they don't extract it from resource IDs.

## Overview

```
App Insights traces
    |
    v
[1] KQL Harvest Query (filter by error/latency/eval score)
    |
    v
[2] Schema Transform (trace -> JSONL format)
    |
    v
[3] Human Review (show candidates, let user approve/edit/reject)
    |
    v
[4] Persist Dataset (local JSONL files)
    |
    v
[5] Sync to Foundry (optional -- upload to project-connected storage)
```

## Key Concept: Linking Evaluation Results to Traces

> Tip: **Evaluation results live in `customEvents`, not in `dependencies`.** Foundry writes eval scores to App Insights as `customEvents` with `name == "gen_ai.evaluation.result"`. Agent traces (spans) live in `dependencies`. The link between them is **`gen_ai.response.id`** -- this field appears on both tables.

| Table | Contains | Join Key |
|-------|----------|----------|
| `dependencies` | Agent traces (spans, tool calls, LLM calls) | `customDimensions["gen_ai.response.id"]` |
| `customEvents` | Evaluation results (scores, labels, explanations) | `customDimensions["gen_ai.response.id"]` |

**To harvest traces with eval scores**, join `customEvents` -> `dependencies` on `responseId`. The Low-Eval Harvest template in [KQL Harvest Templates](trace-harvest-kql.md) shows this pattern. For standalone eval lookups, see [Eval Correlation](../../trace/references/eval-correlation.md) (in `foundry-agent/trace/references/`).

## Step 1 -- Choose a Harvest Template

Select the appropriate KQL template based on user intent. See [KQL Harvest Templates](trace-harvest-kql.md) for the full template gallery covering error, low-eval, latency, combined, sampling, and hosted-agent harvest patterns.

## Step 2 -- Schema Transform

Transform harvested traces into JSONL dataset format. Each line in the JSONL file must contain:

| Field | Required | Source |
|-------|----------|--------|
| `query` | [x] | User input -- extract from `gen_ai.input.messages` on `invoke_agent` dependency spans |
| `response` | Optional | Agent output -- extract from `gen_ai.output.messages` on `invoke_agent` dependency spans |
| `context` | Optional | Tool results or retrieved documents from the trace |
| `ground_truth` | Optional | Expected correct answer (add during curation) |
| `metadata` | Optional | Source info: `{"source": "trace", "conversationId": "...", "harvestRule": "error"}` |

### Extracting Input/Output from Traces

The full input/output content lives on `invoke_agent` dependency spans in `gen_ai.input.messages` and `gen_ai.output.messages`. These contain complete message arrays:

```json
// gen_ai.input.messages structure:
[{"role": "user", "parts": [{"type": "text", "content": "How do I reset my password?"}]}]

// gen_ai.output.messages structure:
[{"role": "assistant", "parts": [{"type": "text", "content": "To reset your password..."}]}]
```

Query to extract input/output for a specific conversation:

```kql
dependencies
| where customDimensions["gen_ai.conversation.id"] == "<conversation-id>"
| where customDimensions["gen_ai.operation.name"] in ("invoke_agent", "execute_agent", "chat", "create_response")
| extend
    responseId = tostring(customDimensions["gen_ai.response.id"]),
    operation = tostring(customDimensions["gen_ai.operation.name"]),
    inputMessages = tostring(customDimensions["gen_ai.input.messages"]),
    outputMessages = tostring(customDimensions["gen_ai.output.messages"])
| order by timestamp asc
| take 10
```

Extract the `query` from the last user-role entry in `gen_ai.input.messages` and the `response` from `gen_ai.output.messages`. Save extracted data to a local JSONL file:

```
.foundry/datasets/<agent-name>-traces-candidates-<date>.jsonl
```

## Step 3 -- Human Review (Curation)

> [!] **MANDATORY:** Never auto-commit harvested traces to a dataset. Always show candidates to the user first.

Present the harvested candidates as a table:

| # | Conversation ID | Error Type | Duration | Eval Score | Query (preview) |
|---|----------------|------------|----------|------------|----------------|
| 1 | conv-abc-123 | TimeoutError | 12.3s | 2.0 | "How do I reset my..." |
| 2 | conv-def-456 | None | 8.7s | 1.5 | "What's the status of..." |
| 3 | conv-ghi-789 | ValidationError | 0.4s | 3.0 | "Can you help me with..." |

Ask the user:
- *"Which candidates should I include in the dataset? (all / select by number / filter by criteria)"*
- *"Would you like to add ground_truth reference answers for any of these?"*
- *"What should I name this dataset version?"*

## Step 4 -- Persist Dataset (Local JSONL)

Save approved candidates to `.foundry/datasets/<agent-name>-<source>-v<N>.jsonl`:

```json
{"query": "How do I reset my password?", "context": "User account management", "metadata": {"source": "trace", "conversationId": "conv-abc-123", "harvestRule": "error"}}
{"query": "What's the status of my order?", "response": "...", "ground_truth": "Order #12345 shipped on...", "metadata": {"source": "trace", "conversationId": "conv-def-456", "harvestRule": "latency"}}
```

### Update Manifest

After persisting, update `.foundry/datasets/manifest.json` with lineage information:

```json
{
  "datasets": [
    {
      "name": "support-bot-prod-traces",
      "file": "support-bot-prod-traces-v3.jsonl",
      "version": "v3",
      "source": "trace-harvest",
      "harvestRule": "error+latency",
      "timeRange": "2025-02-01 to 2025-02-07",
      "exampleCount": 47,
      "createdAt": "2025-02-08T10:00:00Z",
      "reviewedBy": "user"
    }
  ]
}
```

## Next Steps

After creating a dataset:
- **Sync to Foundry** -> [Sync Datasets to Foundry](trace-sync-foundry.md) (recommended for shared/CI use)
- **Run evaluation** -> [observe skill Step 2](../../observe/references/evaluate-step.md)
- **Version and tag** -> [Dataset Versioning](dataset-versioning.md)
- **Organize into splits** -> [Dataset Organization](dataset-organization.md)

## Step 5 -- Sync Local Cache with Foundry (Optional)

To make local datasets available for server-side evaluations, shared access, and CI/CD pipelines, follow [Sync Datasets to Foundry](trace-sync-foundry.md).
