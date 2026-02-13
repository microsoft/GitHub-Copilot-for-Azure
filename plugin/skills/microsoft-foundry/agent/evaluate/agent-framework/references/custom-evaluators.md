# Custom Evaluators

For metrics not covered by built-in evaluators, define custom evaluators.

## Custom Prompt Evaluator (LLM Judge)

Use `CustomPromptEvaluatorConfig` to define an LLM-based evaluator with a Jinja2 prompt template.

```python
from pytest_agent_evals import CustomPromptEvaluatorConfig

friendliness_prompt = """
You are an AI assistant that evaluates the tone of a response.
Score the response on a scale of 1 to 5, where 1 is hostile/rude and 5 is very friendly.
Provide a brief reason for your score.

Input:
Query: {{query}}
Response: {{response}}

You must output your result in the following JSON format:
{
    "result": <integer from 1 to 5>,
    "reason": "<brief explanation>"
}
"""

@evals.evaluator(CustomPromptEvaluatorConfig(name="friendliness", prompt=friendliness_prompt, threshold=4))
def test_friendliness(self, evaluator_results: EvaluatorResults):
    assert evaluator_results.friendliness.result == "pass"
```

**Template variables**: `{{query}}`, `{{response}}`, `{{tool_calls}}`, `{{tool_definitions}}`, `{{context}}`, `{{ground_truth}}`, and any other dataset columns.

**Output format**: The prompt must instruct the LLM to output JSON with `"result"` (int, float, or bool) and `"reason"` (string).

**Threshold types**:
- `int` — ordinal scale (e.g., 1-5). Pass if score >= threshold.
- `float` — continuous scale (e.g., 0.0-1.0). Pass if score >= threshold.
- `bool` — boolean. Pass if returned boolean matches threshold.

## Custom Code Evaluator (Python Function)

Use `CustomCodeEvaluatorConfig` for deterministic or rule-based grading.

```python
from pytest_agent_evals import CustomCodeEvaluatorConfig

def length_check(sample, item):
    """Pass if response is shorter than 100 characters."""
    return 1.0 if len(sample["output_text"]) < 100 else 0.0

@evals.evaluator(CustomCodeEvaluatorConfig(name="length_check", grader=length_check, threshold=0.9))
def test_length_check(self, evaluator_results: EvaluatorResults):
    assert evaluator_results.length_check.result == "pass"
```

**Grader function signature**:
```python
def grade(sample: dict[str, Any], item: dict[str, Any]) -> float:
    # sample: {"output_text": str, "tool_calls": list, "tool_definitions": list}
    # item: dataset row (e.g., {"query": str, "context": str, ...})
    return score  # float, 0.0 to 1.0
```
