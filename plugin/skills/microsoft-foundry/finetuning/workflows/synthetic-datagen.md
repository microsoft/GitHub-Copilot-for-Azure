# Synthetic Data Generation (Foundry API)

Use the **Foundry Data Generation API** to produce training datasets from documents, OpenAPI specs, or agent traces — no manual prompt engineering, no LLM-judge filter loop. The API runs as a managed job on Foundry compute and returns ready-to-train SFT or DPO JSONL.

Use this when:
- You have **source material** (docs, OpenAPI, traces) and want a dataset matching a Foundry **recipe** (SimpleQnA, QnA, Conversation)
- You want managed generation with provenance + Content Safety prescreen built in

For **fully synthetic generation from a task description only** (no source material), use `scripts/generate_distillation_data.py` instead — see `workflows/dataset-creation.md`.

## Capability Matrix

| Source     | Recipe         | Scenario  | Typical output                             |
|------------|----------------|-----------|--------------------------------------------|
| `file`     | `SimpleQnA`    | `sft`     | Short factual Q&A from doc chunks          |
| `file`     | `QnA`          | `sft`     | Multi-hop Q&A grounded in doc context      |
| `file`     | `Conversation` | `sft`/`dpo` | Multi-turn dialogues seeded by doc topics |
| `openapi`  | `ToolUse`      | `sft`     | Single-turn tool-calling examples          |
| `traces`   | n/a (passthrough) | `sft`  | Distillation pairs from agent traces       |

Full surface area + error table: `references/data-generation-api.md`.

## End-to-End: File → SFT (SimpleQnA)

```bash
python scripts/generate_dataset.py \
    --source file --source-id file-abc123 \
    --recipe SimpleQnA --scenario sft \
    --teacher gpt-4.1 --max-samples 200 \
    --name product-faq \
    --output product_faq.jsonl
```

The script: uploads/registers the file if a local path is given, submits the datagen job, polls every 10s, downloads the SFT JSONL when status is `SUCCEEDED`.

## End-to-End: Tools → SFT (ToolUse)

```bash
# Convert OpenAI tool schema to OpenAPI 3.0 if needed
python scripts/generate_dataset.py --convert-tools my_tools.json --out my_tools.openapi.json

python scripts/generate_dataset.py \
    --source openapi --source-file my_tools.openapi.json \
    --recipe ToolUse --scenario sft \
    --teacher gpt-4.1 --max-samples 300 \
    --name agent-tools \
    --output tool_calls.jsonl
```

Train with `submit_training.py` — the resulting JSONL is already in the OpenAI tool-call format Azure FT expects.

## Working Around `SimpleQnA` Per-Source Saturation

A single `SimpleQnA` job on one source caps at **~100–150 unique pairs** regardless of `max_samples`. To produce more, split the source into chunks and submit parallel jobs:

```bash
python scripts/chunk_and_generate.py \
    --input large_doc.md --chunk-size 50000 \
    --teacher gpt-4.1 --recipe SimpleQnA --scenario sft \
    --max-samples-per-chunk 150 --concurrency 2 \
    --output full_dataset.jsonl
```

The script deduplicates the concatenated output by question text. Throughput is bounded by teacher TPM — keep `--concurrency` ≤ TPM / 150_000.

## Quality Hooks (Optional)

Run these between `generate_dataset.py` and `submit_training.py`:

```bash
# LLM-judge per-row scoring (drops noise)
python scripts/score_dataset.py --input out.jsonl --output filtered.jsonl --min-score 7

# Content Safety prescreen (Azure FT will reject submissions at severity ≥ 2)
python scripts/content_safety_check.py --input filtered.jsonl --output safe.jsonl
```

`content_safety_check.py` uses the `azure-ai-evaluation` `ContentSafetyEvaluator` and writes the dropped rows to `safe.dropped.jsonl` for inspection.

## When Generation Returns Few or Zero Rows

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Job `SUCCEEDED` but file empty | Source had no extractable text (e.g., scanned PDF) | OCR the source first, or use `--source-format markdown` after conversion |
| Returns << `max_samples` from a long doc | SimpleQnA saturation (see above) | Use `chunk_and_generate.py` |
| Job `FAILED` with safety violation | Source contains restricted content | Pre-screen the source with Content Safety before submitting |
| Job `FAILED` with rate limit | Teacher TPM exhausted | Lower `--concurrency` or request quota increase |

## See Also

- `references/data-generation-api.md` — full API surface, error codes, recipe semantics
- `workflows/traces-to-dataset.md` — for `source=traces`
- `references/large-file-uploads.md` — for source files > 100 MB
- `workflows/auto-tune.md` — runs this workflow as Phase 2 of the autopilot loop
