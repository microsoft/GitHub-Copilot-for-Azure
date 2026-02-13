# AI Evaluation — Python SDK Quick Reference

> Condensed from **azure-ai-evaluation-py**. Full patterns (built-in evaluators,
> custom evaluators, batch evaluation, red teaming)
> in the **azure-ai-evaluation-py** plugin skill if installed.

## Install
pip install azure-ai-evaluation azure-identity

## Quick Start
```python
from azure.ai.evaluation import evaluate
result = evaluate(data="test_data.jsonl", evaluators={"relevance": RelevanceEvaluator(model_config)})
```

## Best Practices
- Use built-in evaluators (relevance, coherence, groundedness) before custom ones
- Evaluate with representative datasets — at least 50-100 samples
- Run evaluations in CI/CD pipeline for regression detection
- Use red teaming to test adversarial scenarios
- Track evaluation metrics over time for model quality monitoring
- Use structured JSONL format for evaluation datasets
