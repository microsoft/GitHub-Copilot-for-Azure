# Foundry Data Generation API

Managed service that produces training datasets from source material using configurable recipes. Runs as a Foundry job; returns SFT or DPO JSONL.

Doc: <https://learn.microsoft.com/azure/ai-foundry/how-to/fine-tuning-data-generation>

## Capability Matrix

| Source    | Recipe         | Scenarios   | Notes                                                                  |
|-----------|----------------|-------------|------------------------------------------------------------------------|
| `file`    | `SimpleQnA`    | `sft`       | Short factual Q&A from doc chunks. Saturates ~100–150 / source.        |
| `file`    | `QnA`          | `sft`       | Longer multi-hop Q&A grounded in doc context.                          |
| `file`    | `Conversation` | `sft`,`dpo` | Multi-turn dialogues seeded by doc topics.                             |
| `openapi` | `ToolUse`      | `sft`       | Single-turn tool calls. Input is OpenAPI 3.0 with tool defs.           |
| `traces`  | (passthrough)  | `sft`       | Distillation pairs from a hosted agent's App Insights traces.          |

`scenario=dpo` adds a `rejected` field per row (a deliberately weaker response from the same teacher) — see `references/dataset-formats.md`.

## API Surface (`generate_dataset.py`)

```bash
python scripts/generate_dataset.py \
    --source <file|openapi|traces> \
    --recipe <SimpleQnA|QnA|Conversation|ToolUse> \
    --scenario <sft|dpo> \
    --teacher <model-deployment> \
    --max-samples <int> \
    --name <job-name-prefix> \
    --output <out.jsonl> \
    [--source-id file-xyz | --source-file path | --agent-name X --agent-version N --hours H]
```

Source-specific args:

| Source    | Required                                                        |
|-----------|-----------------------------------------------------------------|
| `file`    | `--source-id file-xxx` (uploaded file) **or** `--source-file path` (uploads first) |
| `openapi` | `--source-file path` (OpenAPI 3.0 JSON or YAML)                 |
| `traces`  | `--agent-name`, `--agent-version`, `--hours`                    |

The script polls `client.fine_tuning.datagen.jobs.retrieve(job_id)` every 10 s. Statuses: `QUEUED → IN_PROGRESS → SUCCEEDED | FAILED | CANCELLED`. On `SUCCEEDED`, downloads the result file.

## Recipe Semantics

### SimpleQnA

Single-turn Q&A. Each row: one user question + one assistant answer grounded in a span from the source. Best for FAQ-style tasks.

**Saturation:** A single job on a single source file produces ~100–150 unique questions regardless of `max_samples`. The underlying span-selection is bounded. To exceed this, chunk the source — `chunk_and_generate.py` parallelizes across chunks then dedupes.

### QnA

Multi-hop Q&A. Each row may require combining facts from multiple spans. Higher teacher token cost per row than SimpleQnA. No documented saturation cap.

### Conversation

Multi-turn dialogue (3–10 turns). The `system` message describes the agent persona derived from the source. `dpo` scenario adds a `rejected` final assistant turn.

### ToolUse

Single user turn → one or more assistant tool calls → tool responses → final assistant text. Tool schema comes from the OpenAPI source. Output JSONL is directly Azure-FT-compatible for tool-using SFT.

If you only have OpenAI tool definitions (the `tools=[...]` array), convert first:

```bash
python scripts/generate_dataset.py --convert-tools my_tools.json --out my_tools.openapi.json
```

The converter is bidirectional-safe — round-tripping `openai → openapi → openai` is lossless for type/required/description fields.

### Traces (passthrough)

No "recipe" — the API extracts user/assistant/tool turns from App Insights `dependencies` + `customEvents` for the named agent over the time window. Output requires `transform_traces.py` to be Azure-FT-trainable (see `workflows/traces-to-dataset.md`).

## Error Reference

| Error returned by job | Cause | Fix |
|-----------------------|-------|-----|
| `ContentSafetyViolation` on source | Source contains restricted content | Pre-screen with `content_safety_check.py` on the source, redact, re-upload |
| `RateLimitExceeded` on teacher | Teacher TPM exhausted by parallel passes | Lower `--max-samples`, request quota bump, or chunk smaller |
| `InvalidSchema` (openapi) | Tool defs aren't OpenAPI 3.0 | Run `--convert-tools` first |
| `EmptyOutput` despite `SUCCEEDED` | Source had no extractable text (scanned PDF) | OCR or convert to markdown before uploading |
| `AgentNotFound` (traces) | Agent name/version misspelled or no traces in window | Verify in Foundry Playground; widen `--hours` |

## Quotas

| Resource | Default | How to bump |
|----------|---------|-------------|
| Concurrent datagen jobs / project | 5 | File quota request |
| Teacher TPM (gpt-4.1) | 500 K | PATCH on deployment via REST or portal |
| Max source file size | 100 MB | See `references/large-file-uploads.md` |

## See Also

- `workflows/synthetic-datagen.md` — file / openapi recipes end-to-end
- `workflows/traces-to-dataset.md` — traces source end-to-end
- `references/dataset-formats.md` — output JSONL schemas per scenario
