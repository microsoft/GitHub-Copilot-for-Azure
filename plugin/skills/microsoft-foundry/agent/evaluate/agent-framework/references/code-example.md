# Evaluation Code Example

## Complete Example

```python
import os
import pytest
from pytest_agent_evals import (
    evals,
    EvaluatorResults,
    AzureOpenAIModelConfig,
    ChatAgentConfig,
    BuiltInEvaluatorConfig,
)
from dotenv import load_dotenv
from my_agent import create_my_agent  # Import the agent from user's source code

load_dotenv()
project_endpoint = os.getenv("FOUNDRY_PROJECT_ENDPOINT")
model_deployment = os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME")
# Azure OpenAI endpoint derived from the Foundry resource
# Format: https://<resource>.openai.azure.com/
azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")

# --- Agent Fixture ---
# The plugin calls this fixture to get the agent instance for testing.
@pytest.fixture
def my_agent():
    return create_my_agent(project_endpoint, model_deployment)

# --- Evaluation Suite ---
# Judge model uses Azure OpenAI endpoint format (not Foundry project endpoint).
@evals.dataset("my_agent_dataset.jsonl")
@evals.judge_model(AzureOpenAIModelConfig(deployment_name=model_deployment, endpoint=azure_openai_endpoint))
@evals.agent(ChatAgentConfig(my_agent))
class TestMyAgent:

    @evals.evaluator(BuiltInEvaluatorConfig("task_adherence"))
    def test_task_adherence(self, evaluator_results: EvaluatorResults):
        assert evaluator_results.task_adherence.result == "pass"

    @evals.evaluator(BuiltInEvaluatorConfig("relevance"))
    def test_relevance(self, evaluator_results: EvaluatorResults):
        assert evaluator_results.relevance.result == "pass"
```

## Key Concepts

1. **Agent Fixture**: A `@pytest.fixture` that returns an initialized `ChatAgent` or `WorkflowAgent` instance. Referenced via `ChatAgentConfig(agent_fixture)`.
2. **Dataset**: `@evals.dataset("file.jsonl")` — JSONL file with `query` (required) and `id` (optional) fields.
3. **Judge Model**: `@evals.judge_model(AzureOpenAIModelConfig(...))` — LLM used for AI-assisted (prompt-based) evaluation. The endpoint must be in Azure OpenAI format (`https://<resource>.openai.azure.com/`), not Foundry project endpoint format.
4. **Evaluators**: `@evals.evaluator(...)` on each test method — registers an evaluator that runs against the agent's response.
5. **Results**: Access via `evaluator_results.<name>.result` (returns `"pass"` or `"fail"`) and `evaluator_results.<name>.score`.

## Code Generation Guidelines

- **File naming**: `test_<agent_name>.py`
- **Class naming**: `Test<AgentName>` (must start with `Test`)
- **Test naming**: `test_<metric_name>` (must start with `test_`)
- **One evaluator per test method** — each `@evals.evaluator` maps to one test
- **Import the agent** from the user's source code and wrap in a `@pytest.fixture`. Always reuse the existing agent definition to keep a single source of truth — if the agent is updated, the evaluation automatically tests the updated version. If the agent cannot be directly imported (e.g., it's created inline in a `main()` function), perform a simple refactor: extract the agent creation into a standalone function or module-level variable in the user's source code, then import it in the test file
- **Judge model endpoint**: Must use Azure OpenAI endpoint format (`https://<resource>.openai.azure.com/`). The Foundry project endpoint (`https://<resource>.services.ai.azure.com/api/projects/<project>`) will NOT work for the judge model. Add `AZURE_OPENAI_ENDPOINT` to `.env`.
- **Judge model selection**: By default, reuse the agent's model deployment silently. Only if the model is unsupported (reasoning models, gpt-5 non-chat), use a separate env var (e.g., `JUDGE_MODEL_DEPLOYMENT_NAME`) and use `microsoft-foundry` skill's model catalog to select a supported model.
- Ensure `.env` contains `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL_DEPLOYMENT_NAME` (reuse from agent creation), and `AZURE_OPENAI_ENDPOINT` (for judge model)
