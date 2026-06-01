# Traces → Training Dataset

Distill a hosted Foundry agent into a smaller student model by harvesting its production traces, transforming them to the Azure FT JSONL format, and submitting an SFT job.

Use this when:
- You have a working hosted agent (any framework) with real traffic logged to Application Insights
- You want a cheaper / faster student model that imitates the agent's behavior
- The agent uses tool calls (this workflow preserves the full tool-call sequence)

## Prerequisites

- Hosted agent with > ~100 successful turns logged in App Insights (more is better)
- App Insights connection string in azd env (`APPLICATIONINSIGHTS_CONNECTION_STRING`)
- Target student model deployed (e.g., `gpt-4.1-nano`)

## Step 1 — Export Traces via Foundry Data Gen API

```bash
python scripts/generate_dataset.py \
    --source traces \
    --agent-name my-retail-agent --agent-version 5 \
    --hours 168 --max-samples 1000 \
    --scenario sft --name retail-distil \
    --output traces_raw.jsonl
```

`--hours 168` = last 7 days. The script submits a Foundry **traces datagen job**, polls until `SUCCEEDED`, and writes the raw OpenAI-shaped JSONL.

## Step 2 — Transform for Azure FT Preprocessing

The raw export is **not directly trainable** — Azure FT preprocessing rejects it with cryptic errors. Run the 5-step transform:

```bash
python scripts/transform_traces.py \
    --input traces_raw.jsonl \
    --output traces_train.jsonl \
    --system-prompt-file agent_system_prompt.md \
    --tools-file agent_tools.json
```

The transform applies (in order):

1. **Dedup overlapping snapshots** — traces export emits multiple snapshots per conversation as it grows; keep only the longest per `conversation_id`.
2. **Drop fragments** — rows that end mid-tool-call or with no assistant turn.
3. **Strip `content: "null"`** — string-typed nulls on tool-call asst rows that crash preprocessing.
4. **Merge consecutive assistant tool_calls** — when the agent emitted N tools then text, merge into one assistant message.
5. **Inject system + tools** — pull from `--system-prompt-file` and `--tools-file` so every row matches the deployed agent's schema.

Validate:

```bash
python scripts/validate/validate_sft.py traces_train.jsonl
```

## Step 3 — Split, Train, Deploy

Standard pipeline from here:

```bash
python scripts/convert_dataset.py --split 0.8,0.1,0.1 --in traces_train.jsonl --out-dir prepared/
python scripts/submit_training.py --type sft --model gpt-4.1-nano \
    --training-file prepared/train.jsonl --validation-file prepared/val.jsonl \
    --epochs 2 --lr 1.0 --suffix retail-distil-v1
python scripts/monitor_training.py --job-id <id>
python scripts/deploy_model.py --model-id <ft_id> --name retail-distil --capacity 50
```

## Step 4 — Evaluate the Student vs the Teacher Agent

Run the same `azure-ai-evaluation` suite against both deployments. Use the **structural tool-call grader from `references/tool-call-evaluation.md`** so tool-using rows are scored — the default LLM-judge skips them.

```python
from azure.ai.evaluation import evaluate
# Import or define tool_call_grader per references/tool-call-evaluation.md

teacher = evaluate(data="prepared/test.jsonl",
                   target=lambda r: call("my-retail-agent", r),
                   evaluators={"tool_match": tool_call_grader})
student = evaluate(data="prepared/test.jsonl",
                   target=lambda r: call("retail-distil", r),
                   evaluators={"tool_match": tool_call_grader})

lift = student["metrics"]["tool_match.score"] - teacher["metrics"]["tool_match.score"]
print(f"Lift: {lift:+.1%}  (positive = student matches teacher better than baseline)")
```

For distillation, the **goal is parity** (lift ≈ 0) at much lower cost/latency, not a positive lift.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `validate_sft.py` reports `content` issues on assistant tool-call rows | Raw traces export emits `content: "null"` (the string), which Azure FT preprocessing rejects. Step 3 of the transform replaces it with JSON `null`. | Re-run `transform_traces.py` on the raw export (the validator runs against the transform's output). |
| Most rows dropped during transform | Agent emits text-only turns (no tools) | This is expected — text-only rows are kept, fragments aren't |
| Job `FAILED: tool name mismatch` | Tools file out of sync with deployed agent | Re-export current tools from the agent project |
| Student tool-call accuracy << teacher | Training set too small (<200 useful rows) | Widen `--hours` or run agent with more probes; consider `score_dataset.py` to drop noise |

## See Also

- `workflows/synthetic-datagen.md` — same `generate_dataset.py`, different sources
- `references/data-generation-api.md` — traces source semantics, payload shape, known issues
- `references/dataset-formats.md` — JSONL schema for tool-call rows
- `workflows/auto-tune.md` — uses this as Phase 2a when `--datagen-backend foundry-traces`
