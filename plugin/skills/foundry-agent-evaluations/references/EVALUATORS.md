# Foundry Evaluators Reference

This is a quick reference for the most commonly used evaluators. For the complete list, use the Evaluator Catalog API or browse the Foundry Portal.

## Discovering Available Evaluators

### Browse in Foundry Portal

The easiest way to explore all available evaluators:
1. Open [Foundry Portal](https://ai.azure.com)
2. Navigate to **Build** > **Evaluations** > **Evaluator catalog**
3. Browse by category, view required inputs, and see output metrics

### Query via SDK (Evaluator Catalog API)

Retrieve all evaluators available to your project programmatically:

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

endpoint = "https://<account>.services.ai.azure.com/api/projects/<project>"

with DefaultAzureCredential() as credential:
    with AIProjectClient(endpoint=endpoint, credential=credential) as client:
        
        # List all available evaluators (built-in and custom)
        evaluators = client.evaluators.list()
        
        for evaluator in evaluators:
            print(f"Name: {evaluator.name}")
            print(f"  Display Name: {evaluator.display_name}")
            print(f"  Categories: {evaluator.categories}")
            print(f"  Description: {evaluator.description}")
            print()

        # Get detailed info about a specific evaluator
        evaluator = client.evaluators.get(name="builtin.coherence")
        print(f"Data Schema: {evaluator.definition.data_schema}")
        print(f"Metrics: {evaluator.definition.metrics}")
```

For the full sample, see: [sample_eval_catalog.py](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_eval_catalog.py)

### Getting Required Init Parameters and Data Schema

**Important:** Evaluations fail if init parameters or data mappings are incorrect. Always query the evaluator schema before use:

```python
# Get the full evaluator definition
evaluator = client.evaluators.get(name="builtin.task_adherence")

# Required initialization parameters (e.g., deployment_name, threshold)
print("Init Parameters:")
print(evaluator.definition.init_parameters)

# Required data fields (e.g., query, response, context)
print("Data Schema:")  
print(evaluator.definition.data_schema)

# Output metrics
print("Metrics:")
print(evaluator.definition.metrics)
```

**Common Init Parameters:**
| Parameter | Required By | Description |
|-----------|-------------|-------------|
| `deployment_name` | All LLM-based evaluators | Model deployment for evaluation (e.g., `"gpt-4o"`) |
| `threshold` | Most evaluators | Pass/fail threshold (has sensible defaults) |

**Data Mapping Example:**
```python
# Your dataset has fields: query, response, retrieved_context
# The evaluator expects: query, response, context

"data_mapping": {
    "query": "{{item.query}}",
    "response": "{{item.response}}",
    "context": "{{item.retrieved_context}}"  # Map your field name to expected name
}
```

### Data Source Types and Response Mapping

**Critical:** The response mapping syntax depends on your data source type. Using the wrong mapping will cause evaluations to fail.

| Data Source Type | Description | Response Mapping |
|------------------|-------------|------------------|
| `azure_ai_agent_target` | Eval service calls your agent to generate responses | `{{sample.output_items}}` |
| `azure_ai_agent_response` | Eval service fetches responses from existing threads | `{{sample.output_items}}` |
| `jsonl` (user dataset) | You provide pre-recorded query/response pairs | `{{item.response}}` |

**`sample.output_items`** contains JSON with:
- Response text
- Tool calls made
- Tool definitions used

Use `{{sample.output_text}}` if you only need the plain text response.

**Agent Target Example** (eval service generates responses):
```python
data_source = {
    "type": "azure_ai_agent_target",
    "agents": [{"agent_id": "<agent-id>"}],
    "source": {"type": "file_id", "id": dataset.id}
}
"data_mapping": {
    "query": "{{item.query}}",
    "response": "{{sample.output_items}}"  # Full response with tool calls
}
```
See: [sample_agent_evaluation.py](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_agent_evaluation.py)

**Agent Response Example** (fetch existing responses):
```python
data_source = {
    "type": "azure_ai_agent_response",
    "agents": [{"agent_id": "<agent-id>"}],
    "response_ids": ["<thread-id-1>", "<thread-id-2>"]
}
"data_mapping": {
    "query": "{{item.query}}",
    "response": "{{sample.output_items}}"  # Full response with tool calls
}
```
See: [sample_agent_response_evaluation.py](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_agent_response_evaluation.py)

**User Dataset Example** (pre-recorded responses):
```python
data_source = {
    "type": "jsonl",
    "source": {"type": "file_id", "id": dataset.id}
}
"data_mapping": {
    "query": "{{item.query}}",
    "response": "{{item.response}}"  # Your dataset's response field
}
```

## Key Evaluators by Category

Use the `builtin.` prefix when referencing evaluators (e.g., `builtin.coherence`).

### Agent Evaluators (Most Important for Agent Evaluation)

| Evaluator | What It Measures |
|-----------|-----------------|
| `task_adherence` | Does the agent follow its system instructions? |
| `intent_resolution` | Does the agent correctly understand what the user wants? |
| `task_completion` | Did the agent complete the task end-to-end? |
| `tool_call_accuracy` | Are tool/function calls correct (selection + parameters)? |
| `tool_call_success` | Did tool calls execute without failures? |

### Quality Evaluators

| Evaluator | What It Measures |
|-----------|-----------------|
| `coherence` | Is the response logically consistent and well-structured? |
| `fluency` | Is the language natural and readable? |
| `relevance` | Is the response relevant to the query? |
| `groundedness` | Are claims supported by the provided context? |

### Safety Evaluators

| Evaluator | What It Measures |
|-----------|-----------------|
| `violence` | Does the response contain violent content? |
| `hate_unfairness` | Does the response contain biased or hateful content? |
| `sexual` | Does the response contain inappropriate sexual content? |
| `self_harm` | Does the response promote or describe self-harm? |


### Textual Similarity (for Ground Truth Comparison)

| Evaluator | What It Measures |
|-----------|-----------------|
| `f1_score` | Token overlap between response and ground truth |
| `similarity` | Semantic similarity to expected answer |

## Recommended Evaluator Sets

When using the SDK, include the `builtin.` prefix. MCP tools accept short names.

### Quick Health Check
```python
evaluators = ["builtin.intent_resolution", "builtin.task_adherence", "builtin.coherence", "builtin.violence"]
```

### Full Agent Assessment
```python
evaluators = ["builtin.intent_resolution", "builtin.task_adherence", "builtin.task_completion", 
              "builtin.tool_call_accuracy", "builtin.coherence", "builtin.fluency"]
```

### Safety Audit
```python
evaluators = ["builtin.violence", "builtin.hate_unfairness", "builtin.sexual", "builtin.self_harm"]
```

### RAG Application
```python
evaluators = ["builtin.groundedness", "builtin.relevance", "builtin.response_completeness", "builtin.retrieval"]
```

## Custom Evaluators

When built-in evaluators don't meet your needs, create custom evaluators:

| Type | Use Case |
|------|----------|
| **Code-based** | Python function for pattern matching, keyword detection, custom logic |
| **Prompt-based** | LLM-as-judge with your own evaluation prompt |

### Creating a Code-Based Evaluator

```python
from azure.ai.projects.models import EvaluatorCategory, EvaluatorDefinitionType

evaluator = client.evaluators.create_version(
    name="my_custom_evaluator",
    evaluator_version={
        "name": "my_custom_evaluator",
        "categories": [EvaluatorCategory.QUALITY],
        "display_name": "My Custom Evaluator",
        "definition": {
            "type": EvaluatorDefinitionType.CODE,
            "code_text": '''
def grade(sample, item) -> float:
    response = item.get("response", "").lower()
    # Your custom scoring logic
    if "thank you" in response:
        return 1.0
    return 0.5
''',
            "data_schema": {
                "type": "object",
                "properties": {"response": {"type": "string"}},
                "required": ["response"]
            },
            "metrics": {
                "result": {"type": "ordinal", "min_value": 0.0, "max_value": 1.0}
            }
        }
    }
)
```

### Creating a Prompt-Based Evaluator

```python
evaluator = client.evaluators.create_version(
    name="custom_groundedness",
    evaluator_version={
        "name": "custom_groundedness",
        "categories": [EvaluatorCategory.QUALITY],
        "definition": {
            "type": EvaluatorDefinitionType.PROMPT,
            "prompt_text": """
Score how well the response is grounded in the context (1-5):
5 = Fully grounded, 1 = Not grounded

Query: {{query}}
Context: {{context}}
Response: {{response}}

Output JSON: {"result": <1-5>, "reason": "<explanation>"}
""",
            "init_parameters": {
                "type": "object",
                "properties": {"deployment_name": {"type": "string"}},
                "required": ["deployment_name"]
            },
            "metrics": {
                "result": {"type": "ordinal", "min_value": 1, "max_value": 5}
            }
        }
    }
)
```

### Using Custom Evaluators

Reference by name in testing criteria:
```python
testing_criteria = [
    {
        "type": "azure_ai_evaluator",
        "name": "my_custom_evaluator",
        "evaluator_name": "my_custom_evaluator",
        "data_mapping": {"response": "{{item.response}}"},
        "initialization_parameters": {"deployment_name": "gpt-4o"}
    }
]
```

For complete examples, see:
- [Code-based evaluator sample](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_eval_catalog_code_based_evaluators.py)
- [Prompt-based evaluator sample](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_eval_catalog_prompt_based_evaluators.py)

## Related Documentation

- [Observability in Generative AI](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/observability)
- [Custom Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/custom-evaluators)
- [Agent Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/agent-evaluators)
- [Risk and Safety Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/risk-safety-evaluators)
