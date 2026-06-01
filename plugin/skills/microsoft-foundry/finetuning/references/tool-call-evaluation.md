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

```python
from azure.ai.evaluation import AzureOpenAIPythonGrader

tool_call_grader = AzureOpenAIPythonGrader(
    name="tool_call_match",
    source="""
def grade(item, sample):
    import json
    expected = item.get("tool_calls", [])
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
    exp_names = {c["function"]["name"] for c in expected}
    out_names = {c["function"]["name"] for c in out}
    overlap = exp_names & out_names
    if not overlap:
        return {"score": 0.1, "reason": f"tool name miss: {out_names} vs {exp_names}"}
    if exp_names == out_names:
        exact = all(c.get("function", {}).get("arguments") == e.get("function", {}).get("arguments")
                    for c, e in zip(out, expected))
        return {"score": 1.0 if exact else 0.8, "reason": "args match" if exact else "names match, args differ"}
    return {"score": len(overlap) / len(exp_names),
            "reason": f"partial name overlap: {overlap}"}
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
