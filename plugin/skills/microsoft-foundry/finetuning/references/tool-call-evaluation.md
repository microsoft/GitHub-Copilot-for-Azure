# Tool-Call Evaluation

Structural match scoring for **tool-using SFT and traces distillation**. The default LLM-judge in `evaluate_model.py` silently skips test rows whose reference is a tool call (no `assistant.content` to grade), inflating apparent lift for tool-using agents because only the text-only minority gets scored.

Drop this evaluator into any `azure.ai.evaluation.evaluate()` call when training data contains `tool_calls` and you need to measure whether the FT model picks the right tools with the right arguments.

## Score Bands

| Score | Meaning |
|-------|---------|
| 1.0   | Exact match: same tool names AND same arguments |
| 0.8   | Same tool names, different arguments |
| > 0.0 | Partial name overlap (proportional: `|expected ∩ got| / |expected|`) |
| 0.1   | Model emitted text instead of expected tool call(s) |
| 1.0   | No tool calls expected and none emitted (correct no-op) |

`pass_threshold=0.7` means name match is required but arg differences are allowed (use 1.0 if you need exact arg match).

## Evaluator

Compares emitted tool calls to expected tool calls as a **multiset** keyed by `(name, canonicalized-args)`. Tool-call order is not significant (parallel tool calls can return in any order), and JSON-arg differences in whitespace/key order are normalized so they don't produce false mismatches.

```python
from azure.ai.evaluation import AzureOpenAIPythonGrader

tool_call_grader = AzureOpenAIPythonGrader(
    name="tool_call_match",
    source="""
import json
from collections import Counter

def _canon_args(args):
    # Parse JSON-string args then re-serialize with sorted keys so logically
    # equivalent payloads compare equal regardless of whitespace/key order.
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            return args  # keep raw string if not valid JSON
    if isinstance(args, dict):
        return json.dumps(args, sort_keys=True, separators=(",", ":"))
    return json.dumps(args, sort_keys=True, separators=(",", ":"), default=str)

def _key_multiset(calls):
    return Counter(
        (c.get("function", {}).get("name", ""), _canon_args(c.get("function", {}).get("arguments", "")))
        for c in calls
    )

def _name_multiset(calls):
    return Counter(c.get("function", {}).get("name", "") for c in calls)

def grade(item, sample):
    expected = item.get("tool_calls", []) or []
    out = sample.get("tool_calls")
    if out is None:
        # Some target wrappers serialize tool_calls into output_text as JSON.
        try:
            out = json.loads(sample.get("output_text", "[]") or "[]")
        except json.JSONDecodeError:
            out = []
    if not expected and not out:
        return {"score": 1.0, "reason": "no tools expected or emitted"}
    if not out:
        return {"score": 0.1, "reason": "expected tool call, model emitted text"}
    exp_full = _key_multiset(expected)
    out_full = _key_multiset(out)
    if exp_full == out_full:
        return {"score": 1.0, "reason": "exact match (names + canonicalized args)"}
    exp_names = _name_multiset(expected)
    out_names = _name_multiset(out)
    if exp_names == out_names:
        return {"score": 0.8, "reason": "names match, args differ"}
    common = sum((exp_names & out_names).values())
    if common == 0:
        return {"score": 0.1, "reason": f"tool name miss: {dict(out_names)} vs {dict(exp_names)}"}
    return {"score": common / max(sum(exp_names.values()), 1),
            "reason": f"partial name overlap: {common}/{sum(exp_names.values())}"}
""",
    pass_threshold=0.7,
)
```

## Usage

```python
from azure.ai.evaluation import evaluate

result = evaluate(
    data="prepared/test.jsonl",
    target=lambda row: call_model(deployment_name, row),
    evaluators={"tool_call_match": tool_call_grader},
    output_path="evals/iter1.json",
)
```

## See Also

- `references/evaluation.md` — broader evaluation methodology and grader choice
- `workflows/auto-tune.md` Phase 7 — uses this evaluator
- `workflows/traces-to-dataset.md` Step 4 — uses this evaluator for distillation
