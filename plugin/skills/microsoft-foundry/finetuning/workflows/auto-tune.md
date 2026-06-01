# Auto-Tune Workflow

End-to-end **autopilot loop**: data → baseline → candidate plan → train → evaluate → diagnose → iterate. The agent owns the loop and pauses only on review gates.

Use this when the user says "auto fine-tune", "find the best HPs", "I just have a task description — figure out the rest", or "iterate until you beat baseline".

## When NOT to Use

- Single training run with a known config → `workflows/quickstart.md`
- Already iterating manually with a leaderboard → `workflows/iterative-training.md`
- Just need data, no training → `workflows/synthetic-datagen.md`

## The Loop (8 Phases)

```
1. ANALYZE     → derive task spec, choose datagen backend
2. GENERATE    → produce training data (local OR Foundry Data Gen API)
3. PREPARE     → validate JSONL, split train/val/test
4. BASELINE    → evaluate base model on test set (azure-ai-evaluation)
5. CANDIDATES  → plan 1–4 HP combos
6. EXECUTE     → submit jobs, wait, deploy each candidate
7. EVALUATE    → score each FT vs baseline with the SAME evaluator
8. REVIEW      → SHIP / ITERATE / STOP — on ITERATE, run diagnose_iteration.py
```

Stop conditions: lift ≥ 5% (SHIP), 3 consecutive regressions (STOP), budget exhausted (STOP), `diagnose_iteration` returns `task_genuinely_hard` (STOP — recommend RAG).

## Phase 1 — Analyze

Capture the task in a `task_spec.json`:

```json
{
  "task_name": "support-triage",
  "description": "Classify tickets into billing | technical | account | refund",
  "base_model": "gpt-4.1-mini",
  "teacher_model": "gpt-4.1",
  "rubric": "Return ONLY the category. Exact-match scoring.",
  "datagen_backend": "foundry-file",
  "max_iterations": 3,
  "max_budget_usd": 50
}
```

Use `ask_user` for missing values. Pick `datagen_backend`:

| Have | Backend |
|------|--------|
| Documents/PDFs/URLs | `foundry-file` |
| OpenAI tool schema | `foundry-openapi` (auto-converts to OpenAPI 3.0) |
| Production traces of an agent | `foundry-traces` |
| Only a description | `local` (combinatorial prompts → teacher) |

## Phase 2 — Generate

| Backend | Command |
|---------|---------|
| `local` | `python scripts/generate_distillation_data.py --teacher gpt-4.1 --topics ...` |
| `foundry-*` | `python scripts/generate_dataset.py --source <file\|traces\|openapi> --recipe <SimpleQnA\|QnA\|Conversation> --scenario sft` |

**Hooks (in order, all optional):**

- `transform_traces.py` — required when `source=traces` (fixes 5 Foundry export bugs)
- `chunk_and_generate.py` — when `source=file` and you need > ~150 rows (SimpleQnA saturates ~100–150 per source — see `references/data-generation-api.md`)
- `content_safety_check.py` — when prior submissions failed Azure FT's safety check
- `score_dataset.py --min-score 7` — drop low-quality rows

## Phase 3 — Prepare

```bash
python scripts/validate/validate_sft.py generated.jsonl
python scripts/convert_dataset.py --split 0.8,0.1,0.1 --in generated.jsonl --out-dir prepared/
```

Refuse to proceed if `test.jsonl < 20` rows; ask user to lower split or generate more.

## Phase 4 — Baseline

Use `azure-ai-evaluation` (see `references/evaluation.md`):

```python
from azure.ai.evaluation import evaluate, AzureOpenAIScoreModelGrader

grader = AzureOpenAIScoreModelGrader(
    model_config=judge_config,
    name="task_quality",
    prompt=task_spec["rubric_grader_prompt"],
    output_type="numeric",
    pass_threshold=task_spec.get("pass_threshold", 3),
)

baseline = evaluate(
    data="prepared/test.jsonl",
    target=lambda row: call_model(task_spec["base_model"], row),
    evaluators={"task_quality": grader},
    output_path="baseline.json",
)
```

Record `baseline["metrics"]["task_quality.pass_rate"]` and mean score.

## Phase 5 — Candidates

Default first iteration: see the **starting values** in `references/hyperparameters.md` (typically `lr_multiplier=1.0, epochs=2`, default batch size). Suffix the FT model name like `{task}-iter1`.

After ITERATE, generate a `candidate_plan.json` with 2–4 variations of the dimension flagged by `diagnose_iteration.py`. Examples by root cause (see `references/iteration-diagnosis.md` and `references/hyperparameters.md` for the full sweep ranges):

| Root cause | Sweep dimension |
|------------|-----------------|
| `wrong_hps_overfit` | lower LR, fewer epochs |
| `wrong_hps_underfit` | higher LR, more epochs |
| `model_mismatch` | swap base model |
| `data_quality` | re-generate or quality-filter, hold HPs constant |

## Phase 6 — Execute

For each candidate, in sequence (avoid quota contention):

```bash
python scripts/submit_training.py --type sft --model {model} \
    --training-file prepared/train.jsonl --validation-file prepared/val.jsonl \
    --epochs {epochs} --lr {lr} --suffix {task}-iter{i}-{j}
python scripts/monitor_training.py --job-id {id}
python scripts/deploy_model.py --model-id {ft_model} --name {task}-iter{i}-{j} --capacity 50
```

Cancel any job that stays `running` > 30 min with no event updates (silent-hang issue; see `references/platform-gotchas.md`).

## Phase 7 — Evaluate

**Use the SAME `evaluate()` call from Phase 4** with `target` swapped to each FT deployment. Compare metrics. For tool-using SFT, **also** add the structural tool-call grader from `references/tool-call-evaluation.md` — the default LLM judge skips rows whose reference is a `tool_calls` array.

```python
from azure.ai.evaluation import evaluate
# Import or define tool_call_grader per references/tool-call-evaluation.md

ft_result = evaluate(
    data="prepared/test.jsonl",
    target=lambda row: call_model(ft_deployment, row),
    evaluators={
        "task_quality": grader,                # from Phase 4
        "tool_call_match": tool_call_grader,   # only if rows have tool_calls
    },
    output_path=f"evals/iter{i}_{candidate}.json",
)
```

## Phase 8 — Review

Compute lift for each candidate vs baseline. Decision rule:

| Outcome | Action |
|---------|--------|
| Any candidate lift ≥ 5% | **SHIP** — print deploy command, set `keep_deployment=true`, delete others |
| Best lift < 5%, iter < max | **ITERATE** — run `diagnose_iteration.py`, plan new candidates per Phase 5 table |
| Lift < 5% AND `diagnose_iteration` returns `task_genuinely_hard` | **STOP — recommend RAG** |
| iter == max OR budget exhausted | **STOP — present leaderboard** |

```bash
python scripts/diagnose_iteration.py \
    --task-spec task_spec.json \
    --baseline baseline.json \
    --candidates evals/ \
    --train prepared/train.jsonl --test prepared/test.jsonl \
    --output diagnosis_iter{i}.json
```

See `references/iteration-diagnosis.md` for the seven root-cause buckets and how each maps to a Phase 5 sweep.

## Failsafes

- Always delete intermediate FT deployments after Phase 7 (cost). Keep only the winner.
- Never reuse `test.jsonl` for training in subsequent iterations.
- If `diagnose_iteration` says the eval is broken (`eval_problem`), fix evaluators before changing HPs.
- Budget: track each `submit_training` + `deploy` cost; stop when projected next-iter cost > remaining budget.
