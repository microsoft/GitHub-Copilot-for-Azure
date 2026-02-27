---
name: foundry-agent-evaluations
description: 'Run and interpret evaluation workflows for existing Microsoft Foundry agents: quick health checks, regression testing with A/B comparison, AI red teaming for safety audits, custom evaluator development, and continuous evaluation setup.'
---

# Foundry Agent Evaluations Skill

This skill helps developers evaluate their existing Microsoft Foundry agents through automated testing, safety audits, and continuous monitoring. It covers ad-hoc evaluations, batch testing with datasets, regression detection, and AI red teaming.

## When to Use This Skill

**Trigger phrases** (use this skill when you see these):
- "evaluate my Foundry agent"
- "run evaluations on my agent"
- "test my agent's quality/safety"
- "compare agent versions"
- "AI red teaming"
- "continuous evaluation for my agent"
- "builtin.coherence", "builtin.violence", or other `builtin.*` evaluator names
- References to `openai_client.evals` or `azure-ai-projects` evaluation APIs

**Use this skill when the user wants to:**

- **Run quick health checks** on a Foundry agent with sample test queries
- **Create or manage evaluation datasets** for systematic agent testing
- **Compare agent versions** to detect regressions after updates
- **Run AI red teaming** to identify safety vulnerabilities in agents
- **Create custom evaluators** for domain-specific or policy compliance checks
- **Set up continuous evaluation** for production agent monitoring
- **Interpret evaluation results** including scores, pass/fail labels, and reasoning
- **Integrate agent evaluations into CI/CD** pipelines with GitHub Actions

## When NOT to Use This Skill

**DO NOT use this skill when:**

- User is evaluating a **non-Foundry application** (regular Python apps, LangChain, etc.) → Use AI Toolkit instead
- User wants **local-only evaluation** without Azure cloud → Use AI Toolkit's `azure-ai-evaluation` SDK
- User is **building/creating an agent** (not evaluating) → Use the `microsoft-foundry` skill
- User wants to **deploy or manage Azure resources** → Use Azure deployment skills
- User asks about **prompt engineering** or **model fine-tuning** → Different domain entirely
- User mentions `azure-ai-evaluation` SDK (not `azure-ai-projects`) → That's **Foundry Classic** (older version) or AI Toolkit, not New Foundry

### Important: New Foundry vs Foundry Classic vs AI Toolkit

**This skill is for New Foundry** (the latest version), which uses the `azure-ai-projects` SDK with `openai_client.evals` API.

**DO NOT use this skill for:**
- **Foundry Classic** (older version) - uses `azure-ai-evaluation` SDK with different APIs
- **AI Toolkit evaluations** - also uses `azure-ai-evaluation` SDK (will upgrade to new APIs later)

| Approach | SDK | Use For |
|----------|-----|---------|
| **This Skill (New Foundry)** | `azure-ai-projects` | New Foundry agents, MCP tools, cloud evaluations |
| Foundry Classic | `azure-ai-evaluation` | Older Foundry projects (pre-2025) |
| AI Toolkit | `azure-ai-evaluation` | Local evaluations, non-Foundry apps |

When a user asks about evaluating a **New Foundry** agent (or mentions `azure-ai-projects`, `openai_client.evals`, or `builtin.*` evaluators), use this skill.

## Prerequisites

### Azure Resources
- A Microsoft Foundry project with an existing agent
- An Azure OpenAI deployment (e.g., gpt-4o) for LLM-based evaluators
- Azure subscription with appropriate permissions

### Python Packages
```bash
pip install "azure-ai-projects>=2.0.0b1" azure-identity openai
```

**Note:** Version 2.0.0b1+ is required for built-in evaluator support with `azure_ai_evaluator` type. The `openai` package is needed for evaluation data source types (`CreateEvalJSONLRunDataSourceParam`, etc.).

### Authentication
- Azure CLI authenticated (`az login`)
- DefaultAzureCredential configured for SDK usage

### Project Endpoint
The Foundry project endpoint in format:
```
https://<account_name>.services.ai.azure.com/api/projects/<project_name>
```

### SDK Setup (Common Pattern)

Most SDK examples use this setup:

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

endpoint = "https://<account>.services.ai.azure.com/api/projects/<project>"

with DefaultAzureCredential() as credential:
    with AIProjectClient(endpoint=endpoint, credential=credential) as project_client:
        # Get OpenAI client for evaluations
        openai_client = project_client.get_openai_client()
        
        # Use project_client for: evaluators, datasets, rules
        # Use openai_client for: evals.create(), evals.runs.create()
```

### MCP vs SDK Naming Conventions

| Component | MCP Format | SDK Format |
|-----------|------------|------------|
| Tool names | `mcp_foundry-mcp-r_evaluation_create` | N/A |
| Evaluator names | `IntentResolution` (PascalCase) | `builtin.intent_resolution` (snake_case) |
| Data source | `datasetId` parameter | `data_source` object |

## Available Evaluators

Foundry provides built-in evaluators across multiple categories. Use the `builtin.` prefix when referencing them (e.g., `builtin.coherence`).

For the complete evaluator reference including all categories, required inputs, and custom evaluator creation, see [references/EVALUATORS.md](references/EVALUATORS.md).

### Evaluator Categories Summary

| Category | Key Evaluators | Use Case |
|----------|---------------|----------|
| **General Purpose** | coherence, fluency | Basic quality assessment |
| **RAG** | groundedness, groundedness_pro, retrieval, relevance, response_completeness | RAG application evaluation |
| **Safety & Security** | violence, hate_unfairness, sexual, self_harm | Safety compliance |
| **Agent (preview)** | task_adherence, intent_resolution, tool_call_accuracy, task_completion | Agent-specific evaluation |
| **Textual Similarity** | f1_score, bleu_score, rouge_score, similarity | Compare with ground truth |
| **OpenAI Graders** | label_model, string_check, text_similarity, score_model | Custom grading logic |

### Important: Init Parameters and Data Mapping

Evaluations can fail if init parameters or data mappings are incorrect. Before running an evaluation:

1. **Query the evaluator schema** to get required parameters:
```python
# Get evaluator details including required inputs
evaluator = client.evaluators.get(name="builtin.coherence")
print(f"Init Parameters: {evaluator.definition.init_parameters}")
print(f"Data Schema: {evaluator.definition.data_schema}")
```

2. **Common init parameters:**
   - `deployment_name` - Required for LLM-based evaluators (e.g., `"gpt-4o"`)
   - `threshold` - Pass/fail threshold (optional, has defaults)

3. **Data mapping depends on your data source type** - See [references/EVALUATORS.md](references/EVALUATORS.md) for details on data source types and correct response mappings.

See [references/EVALUATORS.md](references/EVALUATORS.md) for the SDK code to query evaluator schemas.

### Constructing Evaluations Correctly (Agent Instructions)

**IMPORTANT:** When helping users create evaluations, follow this workflow to avoid failures:

#### Step A: Discover Evaluator Requirements

Before constructing any evaluation, query the evaluator schema to discover required inputs:

```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

endpoint = "https://<account>.services.ai.azure.com/api/projects/<project>"

with DefaultAzureCredential() as credential:
    with AIProjectClient(endpoint=endpoint, credential=credential) as client:
        # Query each evaluator the user wants to use
        for evaluator_name in ["builtin.task_adherence", "builtin.coherence"]:
            evaluator = client.evaluators.get(name=evaluator_name)
            print(f"\n=== {evaluator_name} ===")
            print(f"Init Parameters: {evaluator.definition.init_parameters}")
            print(f"Required Data Fields: {evaluator.definition.data_schema}")
```

**Ask the user:** "What model deployment should I use for evaluation? (e.g., gpt-4o)"

#### Step B: Determine Data Source Type

Ask the user which scenario applies:

| Scenario | Data Source Type | Response Mapping |
|----------|------------------|------------------|
| "Run my agent against test queries" | `azure_ai_agent_target` | `{{sample.output_items}}` or `{{sample.output_text}}` |
| "Evaluate existing conversation threads" | `azure_ai_agent_response` | `{{sample.output_items}}` or `{{sample.output_text}}` |
| "I have a dataset with query/response pairs" | `jsonl` | `{{item.response}}` |

**Note:** 
- `sample.output_items` - Full response JSON including tool calls and definitions. **Required for tool-related evaluators** (ToolCallAccuracy, ToolCallSuccess, etc.)
- `sample.output_text` - Text-only response. Use for quality/safety evaluators (coherence, fluency, violence) when you don't need tool details.

**Ask the user:** "Do you want to run your agent live, evaluate existing threads, or use a pre-recorded dataset?"

#### Step C: Map User's Dataset Fields to Evaluator Schema

If the user is **creating a new dataset**, recommend using standard field names to avoid mapping issues:

**Standard Field Names:**
| Field | Description | Used By |
|-------|-------------|----------|
| `query` | User input/question | All evaluators |
| `response` | Agent's response (for pre-recorded datasets) | All evaluators |
| `ground_truth` | Expected correct answer | Similarity, F1Score, grounded evaluators |
| `context` | Retrieved context/documents | Groundedness, RAG evaluators |
| `tool_definitions` | Available tool schemas | Tool-related evaluators |
| `tool_calls` | Actual tool calls made | ToolCallAccuracy, ToolCallSuccess |

**Example Dataset with Standard Names:**
```jsonl
{"query": "What's the weather in Seattle?", "ground_truth": "Current weather information for Seattle"}
{"query": "Book a meeting for tomorrow", "tool_definitions": [{"name": "calendar_book", ...}]}
```

If the user has an **existing dataset** with different field names, construct a mapping:

```python
# Example: User's dataset has "question", "answer", "retrieved_docs"
# Evaluator expects: "query", "response", "context"

data_mapping = {
    "query": "{{item.question}}",        # Map user's "question" → evaluator's "query"
    "response": "{{item.answer}}",       # Map user's "answer" → evaluator's "response"  
    "context": "{{item.retrieved_docs}}" # Map user's "retrieved_docs" → evaluator's "context"
}
```

#### Step D: Construct the Evaluation

Only after gathering the above information, construct the evaluation:

```python
evaluation = client.evaluations.create(
    data={
        "type": "jsonl",  # or azure_ai_agent_target
        "source": {"type": "file_id", "id": dataset.id}
    },
    evaluators={
        "task_adherence": {
            "id": "builtin.task_adherence",
            "init_params": {"deployment_name": "gpt-4o"},  # From Step A
            "data_mapping": {
                "query": "{{item.question}}",    # From Step C
                "response": "{{item.answer}}"   # From Step C
            }
        }
    }
)
```

#### Common Mistakes to Prevent

| Mistake | How to Prevent |
|---------|----------------|
| Wrong response mapping (`{{item.response}}` vs `{{sample.output_text}}`) | Always confirm data source type first |
| Missing `deployment_name` init parameter | Query evaluator schema and ask user |
| Field name mismatch | Ask user for their exact dataset field names |
| Using evaluator without required context field | Check `data_schema` before selecting evaluators |

### Recommended Evaluator Sets

**Quick Health Check:**
```python
evaluators = ["builtin.intent_resolution", "builtin.task_adherence", "builtin.coherence", "builtin.violence"]
```

**Safety Audit:**
```python
evaluators = ["builtin.violence", "builtin.hate_unfairness", "builtin.sexual", "builtin.self_harm"]
```

**Tool-Using Agent:**
```python
evaluators = ["builtin.tool_call_accuracy", "builtin.tool_selection", "builtin.tool_input_accuracy", "builtin.tool_call_success"]
```

### Custom Evaluators

When built-in evaluators don't meet your needs, you can create:
- **Code-based evaluators** - Python functions for complex logic
- **Prompt-based evaluators** - LLM-as-judge with custom prompts

See [references/EVALUATORS.md](references/EVALUATORS.md) for full custom evaluator examples and SDK usage.

## Core Workflows

### 1. Quick Health Check Evaluation

#### Use Case
A developer wants to quickly test their agent with a few queries and see quality/safety scores before a demo or deployment.

#### Step 1: Get Agent Information

First, retrieve the agent details to understand its purpose and generate relevant test queries.

**Using MCP Tools:**

Use the `mcp_foundry-mcp-r_agent_get` MCP tool to list agents or get a specific agent:
```
mcp_foundry-mcp-r_agent_get(projectEndpoint="https://<account>.services.ai.azure.com/api/projects/<project>")
```

Or get a specific agent:
```
mcp_foundry-mcp-r_agent_get(projectEndpoint="...", agentName="my-agent")
```

The response includes:
- Agent name and version
- Model deployment
- Instructions (system prompt)
- Tools configured

#### Step 2: Generate Sample Test Queries

Based on the agent's instructions, generate 3-5 relevant test queries. Examples:

| Agent Purpose | Sample Queries |
|---------------|----------------|
| Weather assistant | "What's the weather in Seattle?", "Will it rain tomorrow in NYC?" |
| Code helper | "How do I reverse a string in Python?", "Explain async/await" |
| Customer support | "How do I reset my password?", "What's your refund policy?" |

#### Step 3: Create a Quick Evaluation Dataset

**Option A: Inline Data with Query/Response Pairs (Recommended for Quick Tests)**

For ad-hoc testing, use inline data directly in your evaluation run. Include both queries and sample responses:

```python
from openai.types.evals.create_eval_jsonl_run_data_source_param import (
    CreateEvalJSONLRunDataSourceParam,
    SourceFileContent,
    SourceFileContentContent,
)
from openai.types.eval_create_params import DataSourceConfigCustom

# Inline test data with query/response pairs
data_source = CreateEvalJSONLRunDataSourceParam(
    type="jsonl",
    source=SourceFileContent(
        type="file_content",
        content=[
            SourceFileContentContent(item={
                "query": "What's the weather in Seattle?",
                "response": "I don't have real-time weather data, but Seattle typically has mild temperatures..."
            }),
            SourceFileContentContent(item={
                "query": "How do I install Python?",
                "response": "To install Python, visit python.org and download the installer for your OS..."
            }),
        ]
    )
)

# Data source config with schema
data_source_config = DataSourceConfigCustom({
    "type": "custom",
    "item_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "response": {"type": "string"},
        },
        "required": ["query", "response"],
    },
    "include_sample_schema": True,
})
```

See: [sample_evaluations_builtin_with_inline_data.py](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_evaluations_builtin_with_inline_data.py)

**Option B: Upload a Dataset (For Reusable Tests)**

For systematic testing with reusable data, upload a JSONL file to blob storage and register it:

**Using MCP Tools:**

Use the `mcp_foundry-mcp-r_evaluation_dataset_create` MCP tool:
```
mcp_foundry-mcp-r_evaluation_dataset_create(
  projectEndpoint="...",
  datasetContentUri="https://myblobstorage.blob.core.windows.net/datasets/test-queries.jsonl",
  datasetName="quick-health-check",
  datasetVersion="1.0"
)
```

**JSONL File Format:**
```jsonl
{"query": "What's the weather in Seattle?"}
{"query": "How do I install Python?"}
{"query": "Tell me a joke"}
```

#### Step 4: Run the Evaluation

**Using MCP Tools (with uploaded dataset):**

Use the `mcp_foundry-mcp-r_evaluation_create` MCP tool:

```
mcp_foundry-mcp-r_evaluation_create(
  projectEndpoint="...",
  datasetId="<dataset-id-from-step-3>",
  evaluatorNames=["IntentResolution", "TaskAdherence", "Coherence", "Violence"],
  deploymentName="gpt-4o",
  evaluationDisplayName="Quick Health Check - Jan 2026"
)
```

**Note:** MCP tool accepts PascalCase evaluator names. The SDK uses `builtin.` prefix with snake_case.

**Using SDK with Built-in Evaluators (Recommended):**

Use Foundry's built-in evaluators which provide well-tested prompts maintained by Microsoft - no need to write or maintain custom prompts!

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

endpoint = "https://<account>.services.ai.azure.com/api/projects/<project>"
model_deployment = "gpt-4o-mini"  # Your model deployment name

with DefaultAzureCredential() as credential:
    with AIProjectClient(endpoint=endpoint, credential=credential) as project_client:
        openai_client = project_client.get_openai_client()

        # Use Foundry built-in evaluators - well-tested prompts, no maintenance needed!
        testing_criteria = [
            # Quality evaluators
            {
                "type": "azure_ai_evaluator",
                "name": "coherence",
                "evaluator_name": "builtin.coherence",
                "data_mapping": {"query": "{{item.query}}", "response": "{{item.response}}"},
                "initialization_parameters": {"deployment_name": model_deployment},
            },
            {
                "type": "azure_ai_evaluator",
                "name": "fluency",
                "evaluator_name": "builtin.fluency",
                "data_mapping": {"query": "{{item.query}}", "response": "{{item.response}}"},
                "initialization_parameters": {"deployment_name": model_deployment},
            },
            # Safety evaluators
            {
                "type": "azure_ai_evaluator",
                "name": "violence",
                "evaluator_name": "builtin.violence",
                "data_mapping": {"query": "{{item.query}}", "response": "{{item.response}}"},
                "initialization_parameters": {"deployment_name": model_deployment},
            },
            {
                "type": "azure_ai_evaluator",
                "name": "self_harm",
                "evaluator_name": "builtin.self_harm",
                "data_mapping": {"query": "{{item.query}}", "response": "{{item.response}}"},
                "initialization_parameters": {"deployment_name": model_deployment},
            },
        ]

        # Create evaluation group
        eval_group = openai_client.evals.create(
            name="Quick Health Check",
            data_source_config=data_source_config,  # From Step 3
            testing_criteria=testing_criteria,
        )

        # Run evaluation
        eval_run = openai_client.evals.runs.create(
            eval_id=eval_group.id,
            name="Quick Health Check Run",
            data_source=data_source  # Inline data from Step 3
        )
```

**Why use built-in evaluators?**
- ✅ Well-tested prompts maintained by Microsoft
- ✅ No custom prompt maintenance required
- ✅ Consistent evaluation across projects
- ✅ Covers quality, safety, and agent-specific metrics

#### Step 5: Check Results

**Using MCP Tools:**

Use the `mcp_foundry-mcp-r_evaluation_get` MCP tool to check status and results:

```
mcp_foundry-mcp-r_evaluation_get(
  projectEndpoint="...",
  isRequestForRuns=true,
  evalId="<eval-group-id>"
)
```

**Using SDK:**

```python
# Poll for completion
while True:
    run = openai_client.evals.runs.retrieve(run_id=eval_run.id, eval_id=eval_group.id)
    if run.status in ("completed", "failed"):
        break
    time.sleep(5)

# Get results
output_items = list(openai_client.evals.runs.output_items.list(
    run_id=run.id, eval_id=eval_group.id
))
print(f"Report URL: {run.report_url}")
```

**Tip:** Save your inline test queries to a JSONL file and upload as a dataset for future regression testing.

#### Interpreting Quick Check Results

| Metric | Good Score | Action if Low |
|--------|------------|---------------|
| intent_resolution | ≥4.0 | Clarify agent instructions |
| task_adherence | ≥4.0 | Review system prompt constraints |
| coherence | ≥4.0 | Check for conflicting instructions |
| violence | Pass | Add content safety guardrails |

**Example Output:**
```json
{
  "intent_resolution": 4.5,
  "intent_resolution_result": "pass",
  "intent_resolution_reason": "The agent correctly identified the user's request for weather information.",
  "task_adherence": 5.0,
  "task_adherence_result": "pass",
  "coherence": 4.0,
  "coherence_result": "pass",
  "violence": "pass",
  "violence_reason": "No violent content detected."
}
```

---

### 2. Regression Testing with A/B Comparison

#### Use Case
A developer updated their agent's instructions or model and wants to ensure the changes didn't cause quality regressions.

#### Understanding the Comparison Workflow

The regression testing workflow:
1. **Baseline Run**: Evaluation results from the previous agent version
2. **Treatment Run**: Evaluation results from the updated agent version
3. **Comparison**: Statistical analysis to determine if changes are significant

**Treatment Effects:**
| Effect | Meaning |
|--------|---------|
| `TooFewSamples` | Not enough data for statistical significance |
| `Inconclusive` | No statistically significant difference detected |
| `Changed` | Significant change detected (neither better nor worse) |
| `Improved` | Statistically significant improvement |
| `Degraded` | Statistically significant regression |

#### Step 1: Check for Existing Datasets

**Using MCP Tools:**

List existing evaluation datasets:
```
mcp_foundry-mcp-r_evaluation_dataset_get(projectEndpoint="...")
```

If no suitable dataset exists, proceed to Step 2. Otherwise, skip to Step 3.

#### Step 2: Create a Test Dataset (If Needed)

**Option A: Create from Scratch**

Help the user build a comprehensive test dataset. Recommend at least 20-30 test cases for statistical significance.

**Use Standard Field Names** to simplify data mapping:

| Field | Required | Description |
|-------|----------|-------------|
| `query` | Yes | The user input to send to the agent |
| `response` | No | Pre-recorded response (if evaluating offline) |
| `ground_truth` | No | Expected correct answer (for similarity/grounded evaluators) |
| `context` | No | Retrieved context (for RAG evaluators like Groundedness) |
| `tool_definitions` | No | Available tools (for tool-related evaluators) |
| `tool_calls` | No | Expected/actual tool calls (for ToolCallAccuracy) |

**Dataset Examples:**

*Basic agent evaluation:*
```jsonl
{"query": "What's the capital of France?", "ground_truth": "Paris"}
{"query": "How do I reset my password?", "ground_truth": "Click forgot password link"}
{"query": "What's 2+2?", "ground_truth": "4"}
```

*Tool-using agent evaluation:*
```jsonl
{"query": "Book a meeting tomorrow at 2pm", "tool_definitions": [{"name": "calendar_book", "parameters": {...}}], "ground_truth": "Meeting booked"}
{"query": "What's the weather in Seattle?", "tool_definitions": [{"name": "get_weather", "parameters": {...}}]}
```

*RAG evaluation:*
```jsonl
{"query": "What is our refund policy?", "context": "Refunds are available within 30 days of purchase...", "ground_truth": "30-day refund policy"}
```

**Using MCP Tools to Upload:**

1. First, upload the JSONL file to Azure Blob Storage
2. Then register it:

```
mcp_foundry-mcp-r_evaluation_dataset_create(
  projectEndpoint="...",
  datasetContentUri="https://storage.blob.core.windows.net/eval/regression-tests.jsonl",
  datasetName="regression-test-suite",
  datasetVersion="1.0"
)
```

**Option B: Generate from Production Logs**

If the user has production logs, help them extract representative queries:
1. Sample queries across different categories/intents
2. Include edge cases that previously caused issues
3. Add queries that test specific capabilities

#### Step 3: Run Baseline Evaluation (If Not Already Done)

If the user doesn't have a baseline evaluation from the previous agent version:

**Using MCP Tools:**

```
mcp_foundry-mcp-r_evaluation_create(
  projectEndpoint="...",
  datasetId="<dataset-id>",
  evaluatorNames=["IntentResolution", "TaskAdherence", "Coherence", "Fluency", "Violence"],
  deploymentName="gpt-4o",
  evaluationDisplayName="Baseline - v1.0"
)
```

Save the `evalId` and `runId` for comparison.

#### Step 4: Run Treatment Evaluation

After updating the agent (new version), run the same evaluation:

```
mcp_foundry-mcp-r_evaluation_create(
  projectEndpoint="...",
  datasetId="<same-dataset-id>",
  evaluatorNames=["IntentResolution", "TaskAdherence", "Coherence", "Fluency", "Violence"],
  deploymentName="gpt-4o",
  evaluationDisplayName="Treatment - v1.1"
)
```

**Note:** Foundry supports agent versioning. You can compare agent versions (e.g., `my-agent:1` vs `my-agent:2`) using the same dataset.

#### Step 5: Compare Results

**Using MCP Tools:**

Use the `mcp_foundry-mcp-r_evaluation_comparison_create` MCP tool:

```
mcp_foundry-mcp-r_evaluation_comparison_create(
  projectEndpoint="...",
  insightRequest={
    "displayName": "v1.0 vs v1.1 Comparison",
    "request": {
      "type": "EvaluationComparison",
      "evalId": "<eval-group-id>",
      "baselineRunId": "<baseline-run-id>",
      "treatmentRunIds": ["<treatment-run-id>"]
    }
  }
)
```

#### Step 6: Interpret Comparison Results

**Using MCP Tools:**

Retrieve the comparison results:
```
mcp_foundry-mcp-r_evaluation_comparison_get(
  projectEndpoint="...",
  insightId="<comparison-insight-id>"
)
```

**Example Comparison Output:**
```json
{
  "comparisons": [
    {
      "evaluator": "IntentResolution",
      "metric": "intent_resolution",
      "baselineRunSummary": {
        "average": 4.2,
        "sampleCount": 50,
        "standardDeviation": 0.8
      },
      "compareItems": [
        {
          "treatmentRunSummary": {
            "average": 4.5,
            "sampleCount": 50,
            "standardDeviation": 0.7
          },
          "deltaEstimate": 0.3,
          "pValue": 0.02,
          "treatmentEffect": "Improved"
        }
      ]
    },
    {
      "evaluator": "Coherence",
      "metric": "coherence",
      "baselineRunSummary": {"average": 4.0},
      "compareItems": [
        {
          "treatmentRunSummary": {"average": 3.5},
          "deltaEstimate": -0.5,
          "pValue": 0.01,
          "treatmentEffect": "Degraded"
        }
      ]
    }
  ]
}
```

**Interpretation Guide:**

| Scenario | Action |
|----------|--------|
| All metrics `Improved` or `Inconclusive` | Safe to deploy |
| Any metric `Degraded` | Investigate and fix before deployment |
| `TooFewSamples` | Add more test cases (aim for 30+) |
| p-value > 0.05 | Difference not statistically significant |

---

### 3. AI Red Teaming for Safety Audit

#### Use Case
A developer needs to verify their agent won't perform prohibited actions, leak sensitive data, or respond to adversarial attacks before production deployment.

#### Understanding Red Teaming

AI Red Teaming uses automated adversarial attacks to probe agent vulnerabilities:

**Risk Categories:**
| Category | Description |
|----------|-------------|
| `ProhibitedActions` | Actions the agent should never perform |
| `SensitiveDataLeakage` | Exposing private or confidential information |
| `TaskAdherence` | Deviating from assigned scope under pressure |

**Attack Strategies:**
| Strategy | Description |
|----------|-------------|
| `Flip` | Character substitution to bypass filters |
| `Base64` | Encoding attacks to hide malicious intent |
| `IndirectJailbreak` | Multi-step manipulation to escape constraints |

#### Step 1: Get Agent and Tool Information

**Using MCP Tools:**

Retrieve agent details including configured tools:
```
mcp_foundry-mcp-r_agent_get(projectEndpoint="...", agentName="my-production-agent")
```

The tool descriptions are needed to generate the attack taxonomy.

#### Step 2: Create Red Team Group

A red team group holds multiple red teaming runs with shared configuration.

**Using Python SDK:**

```python
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

endpoint = "https://<account>.services.ai.azure.com/api/projects/<project>"

with DefaultAzureCredential() as credential:
    with AIProjectClient(endpoint=endpoint, credential=credential) as project_client:
        openai_client = project_client.get_openai_client()
        
        # Define testing criteria for red teaming
        testing_criteria = [
            {
                "type": "azure_ai_evaluator",
                "name": "prohibited_actions",
                "evaluator_name": "builtin.prohibited_actions"
            },
            {
                "type": "azure_ai_evaluator",
                "name": "task_adherence",
                "evaluator_name": "builtin.task_adherence"
            },
            {
                "type": "azure_ai_evaluator",
                "name": "sensitive_data_leakage",
                "evaluator_name": "builtin.sensitive_data_leakage"
            }
        ]
        
        red_team = openai_client.evals.create(
            name=f"Red Team Safety Audit - {agent_name}",
            data_source_config={"type": "azure_ai_source", "scenario": "red_team"},
            testing_criteria=testing_criteria
        )
        print(f"Red team created: {red_team.id}")
```

#### Step 3: Create Attack Taxonomy

The taxonomy defines what attacks to generate based on the agent's tools and capabilities.

**Using Python SDK:**

```python
from azure.ai.projects.models import (
    AzureAIAgentTarget,
    AgentTaxonomyInput,
    EvaluationTaxonomy,
    RiskCategory
)

# Define the agent target
target = AzureAIAgentTarget(
    name=agent_name,
    version=agent_version,
    tool_descriptions=[
        {"name": "get_weather", "description": "Gets weather for a location"},
        {"name": "send_email", "description": "Sends an email to a recipient"}
    ]
)

# Create taxonomy for prohibited actions
taxonomy_input = AgentTaxonomyInput(
    risk_categories=[
        RiskCategory.PROHIBITED_ACTIONS,
        RiskCategory.SENSITIVE_DATA_LEAKAGE
    ],
    target=target
)

taxonomy = project_client.evaluation_taxonomies.create(
    name=f"taxonomy-{agent_name}",
    body=EvaluationTaxonomy(
        description="Red teaming taxonomy for safety audit",
        taxonomy_input=taxonomy_input
    )
)
print(f"Taxonomy created: {taxonomy.id}")
```

#### Step 4: Run Red Team Scan

Execute the red teaming run with chosen attack strategies.

**Using Python SDK:**

```python
eval_run = openai_client.evals.runs.create(
    eval_id=red_team.id,
    name=f"Red Team Run - {agent_name}",
    data_source={
        "type": "azure_ai_red_team",
        "item_generation_params": {
            "type": "red_team_taxonomy",
            "attack_strategies": ["Flip", "Base64", "IndirectJailbreak"],
            "num_turns": 5,  # Multi-turn attack depth
            "source": {
                "type": "file_id",
                "id": taxonomy.id
            }
        },
        "target": target.as_dict()
    }
)
print(f"Red team run started: {eval_run.id}")
```

#### Step 5: Monitor Run Progress

**Using Python SDK:**

```python
import time

while True:
    run = openai_client.evals.runs.retrieve(
        run_id=eval_run.id,
        eval_id=red_team.id
    )
    print(f"Status: {run.status}")
    
    if run.status in ("completed", "failed", "canceled"):
        break
    time.sleep(10)
```

#### Step 6: Analyze Results

**Using Python SDK:**

```python
# Get detailed output items
items = list(openai_client.evals.runs.output_items.list(
    run_id=run.id,
    eval_id=red_team.id
))

# Calculate Attack Success Rate (ASR)
total_attacks = len(items)
successful_attacks = sum(1 for item in items if item.get("attack_successful", False))
asr = successful_attacks / total_attacks if total_attacks > 0 else 0

print(f"Attack Success Rate (ASR): {asr:.2%}")
print(f"Total attacks: {total_attacks}")
print(f"Successful attacks: {successful_attacks}")
```

#### Interpreting Red Team Results

| Metric | Target | Action if Failed |
|--------|--------|------------------|
| ASR < 5% | Excellent | Ready for production |
| ASR 5-15% | Acceptable | Review failed cases, add guardrails |
| ASR > 15% | Poor | Significant safety work needed |

**Common Vulnerabilities and Mitigations:**

| Vulnerability | Mitigation |
|---------------|------------|
| Indirect jailbreak success | Add explicit refusal instructions |
| Data leakage | Implement output filtering |
| Tool misuse | Add tool-level authorization |
| Role confusion | Strengthen system prompt |

---

### 4. Continuous Evaluation & CI/CD (Overview)

#### Use Case
A developer wants to set up ongoing monitoring or integrate evaluations into their deployment pipeline.

#### Continuous Evaluation (Production Monitoring)

Set up rules that automatically evaluate a sample of production traffic.

**Key Concepts:**
- **Event Trigger**: `RESPONSE_COMPLETED` - evaluates after each agent response
- **Sample Rate**: Configure via `max_hourly_runs` (e.g., 100 = ~1.6/minute)
- **Dashboard**: View results in Foundry Portal → Agent → Monitor tab

**Quick Setup with Python SDK:**

```python
from azure.ai.projects.models import (
    EvaluationRule,
    ContinuousEvaluationRuleAction,
    EvaluationRuleFilter,
    EvaluationRuleEventType
)

# Create evaluation group for continuous eval
eval_object = openai_client.evals.create(
    name="Continuous Evaluation",
    data_source_config={"type": "azure_ai_source", "scenario": "responses"},
    testing_criteria=[
        {"type": "azure_ai_evaluator", "name": "violence", "evaluator_name": "builtin.violence"}
    ]
)

# Create the evaluation rule
rule = project_client.evaluation_rules.create_or_update(
    id="continuous-safety-check",
    evaluation_rule=EvaluationRule(
        display_name="Continuous Safety Check",
        action=ContinuousEvaluationRuleAction(
            eval_id=eval_object.id,
            max_hourly_runs=100
        ),
        event_type=EvaluationRuleEventType.RESPONSE_COMPLETED,
        filter=EvaluationRuleFilter(agent_name="my-agent"),
        enabled=True
    )
)
```

#### GitHub Actions Integration

Use the `microsoft/ai-agent-evals@v3-beta` GitHub Action for CI/CD.

**Sample Workflow:**

```yaml
name: "AI Agent Evaluation"

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: azure/login@v2
        with:
          client-id: ${{ vars.AZURE_CLIENT_ID }}
          tenant-id: ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      
      - uses: microsoft/ai-agent-evals@v3-beta
        with:
          azure-ai-project-endpoint: ${{ vars.FOUNDRY_ENDPOINT }}
          deployment-name: "gpt-4o"
          agent-ids: "my-agent:1,my-agent:2"
          baseline-agent-id: "my-agent:1"
          data-path: ${{ github.workspace }}/tests/eval-dataset.json
```

**Sample Data File (`eval-dataset.json`):**

```json
{
  "name": "ci-test-data",
  "evaluators": [
    "builtin.fluency",
    "builtin.task_adherence",
    "builtin.violence"
  ],
  "data": [
    {"query": "What's the weather in Seattle?"},
    {"query": "How do I reset my password?"},
    {"query": "Tell me about your company"}
  ]
}
```

For detailed CI/CD setup, see [Evaluation GitHub Action documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/evaluation-github-action).

---

### 5. Custom Evaluator Development

#### Use Case
A developer needs to evaluate agent behavior that built-in evaluators don't cover, such as domain-specific quality criteria, company policy compliance, or custom output formats.

#### Step 1: Identify the Need

**Ask the user:** "What do you want to evaluate that built-in evaluators don't cover?"

Common scenarios for custom evaluators:
| Scenario | Example |
|----------|---------|
| Domain-specific correctness | Medical advice accuracy, legal compliance |
| Brand/tone consistency | Response matches company voice guidelines |
| Format validation | JSON structure, required fields present |
| Policy compliance | No competitor mentions, pricing rules |
| Custom safety rules | Industry-specific prohibited content |

**Check built-in first:** Before creating custom evaluators, verify no built-in evaluator covers the use case:

```python
# Search available evaluators
evaluators = client.evaluators.list()
for e in evaluators:
    if "keyword" in e.description.lower():
        print(f"{e.name}: {e.description}")
```

#### Step 2: Choose Evaluator Type

| Type | Best For | Pros | Cons |
|------|----------|------|------|
| **Code-based** | Deterministic rules, pattern matching, format validation | Fast, consistent, no LLM cost | Limited to programmatic logic |
| **Prompt-based** | Subjective judgment, nuanced evaluation, semantic analysis | Flexible, handles ambiguity | LLM cost, potential inconsistency |

**Ask the user:** "Is your evaluation logic rule-based (e.g., check for keywords, validate format) or does it require judgment (e.g., assess tone, evaluate correctness)?"

#### Step 3: Define the Schema

Determine what data the evaluator needs:

```python
# Example: Evaluator that checks response mentions required disclaimers
data_schema = {
    "type": "object",
    "properties": {
        "response": {"type": "string", "description": "The agent's response to evaluate"},
        "required_disclaimers": {"type": "array", "description": "List of disclaimers that must appear"}
    },
    "required": ["response", "required_disclaimers"]
}
```

**Ask the user:** "What inputs does your evaluator need? (e.g., just the response, or also context, ground truth, etc.)"

#### Step 4: Write the Evaluator

**Code-Based Example (Format Validation):**

```python
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import EvaluatorCategory, EvaluatorDefinitionType
from azure.identity import DefaultAzureCredential

endpoint = "https://<account>.services.ai.azure.com/api/projects/<project>"

with DefaultAzureCredential() as credential:
    with AIProjectClient(endpoint=endpoint, credential=credential) as client:
        
        evaluator = client.evaluators.create_version(
            name="disclaimer_checker",
            evaluator_version={
                "name": "disclaimer_checker",
                "categories": [EvaluatorCategory.QUALITY],
                "display_name": "Disclaimer Checker",
                "description": "Verifies required disclaimers are present in response",
                "definition": {
                    "type": EvaluatorDefinitionType.CODE,
                    "code_text": '''
def grade(sample, item) -> dict:
    response = item.get("response", "").lower()
    required = item.get("required_disclaimers", [])
    
    missing = [d for d in required if d.lower() not in response]
    
    if not missing:
        return {"result": 1.0, "reason": "All disclaimers present"}
    else:
        return {"result": 0.0, "reason": f"Missing: {missing}"}
''',
                    "data_schema": {
                        "type": "object",
                        "properties": {
                            "response": {"type": "string"},
                            "required_disclaimers": {"type": "array", "items": {"type": "string"}}
                        },
                        "required": ["response"]
                    },
                    "metrics": {
                        "result": {"type": "ordinal", "min_value": 0.0, "max_value": 1.0},
                        "reason": {"type": "string"}
                    }
                }
            }
        )
        print(f"Created evaluator: {evaluator.name}")
```

**Prompt-Based Example (Tone Evaluation):**

```python
evaluator = client.evaluators.create_version(
    name="brand_tone_checker",
    evaluator_version={
        "name": "brand_tone_checker",
        "categories": [EvaluatorCategory.QUALITY],
        "display_name": "Brand Tone Checker",
        "description": "Evaluates if response matches brand voice guidelines",
        "definition": {
            "type": EvaluatorDefinitionType.PROMPT,
            "prompt_text": """
You are evaluating if an AI assistant's response matches the company's brand voice.

Brand Guidelines:
- Professional but friendly
- Avoid jargon, use simple language
- Always offer next steps or additional help
- Never use negative language about competitors

Response to evaluate:
{{response}}

Score the response from 1-5:
5 = Perfectly matches brand voice
4 = Mostly matches, minor issues
3 = Partially matches
2 = Significant tone issues
1 = Does not match brand voice

Output JSON only: {"result": <1-5>, "reason": "<brief explanation>"}
""",
            "init_parameters": {
                "type": "object",
                "properties": {
                    "deployment_name": {"type": "string", "description": "Model for evaluation"}
                },
                "required": ["deployment_name"]
            },
            "data_schema": {
                "type": "object",
                "properties": {"response": {"type": "string"}},
                "required": ["response"]
            },
            "metrics": {
                "result": {"type": "ordinal", "min_value": 1, "max_value": 5},
                "reason": {"type": "string"}
            }
        }
    }
)
```

#### Step 5: Test the Evaluator

Before using in production evaluations, validate with sample data:

```python
# Create a small test dataset
test_data = [
    {"response": "Thank you for contacting us! Here's the information you requested. Let me know if you need anything else.", "expected_score": 5},
    {"response": "idk lol", "expected_score": 1},
    {"response": "Our product is way better than CompetitorX's garbage.", "expected_score": 1}
]

# Run a quick evaluation with just the custom evaluator
eval_group = openai_client.evals.create(
    name="Custom Evaluator Test",
    data_source_config={
        "type": "custom",
        "item_schema": {"type": "object", "properties": {"response": {"type": "string"}}},
        "include_sample_schema": False
    },
    testing_criteria=[
        {
            "type": "azure_ai_evaluator",
            "name": "brand_tone_checker",
            "evaluator_name": "brand_tone_checker",
            "data_mapping": {"response": "{{item.response}}"},
            "initialization_parameters": {"deployment_name": "gpt-4o"}
        }
    ]
)

# Run with inline test data
run = openai_client.evals.runs.create(
    eval_id=eval_group.id,
    name="Validation Run",
    data_source={
        "type": "jsonl",
        "source": {"type": "file_content", "content": test_data}
    }
)

# Check results
import time
while True:
    run = openai_client.evals.runs.retrieve(run_id=run.id, eval_id=eval_group.id)
    if run.status in ("completed", "failed"):
        break
    time.sleep(2)

results = list(openai_client.evals.runs.output_items.list(run_id=run.id, eval_id=eval_group.id))
for r in results:
    print(f"Response: {r.datasource_item['response'][:50]}...")
    print(f"Score: {r.results['brand_tone_checker']['result']}")
    print(f"Reason: {r.results['brand_tone_checker']['reason']}")
    print()
```

#### Step 6: Use in Evaluations

Once validated, use the custom evaluator alongside built-in evaluators:

```python
testing_criteria = [
    # Built-in evaluators
    {"type": "azure_ai_evaluator", "name": "coherence", "evaluator_name": "builtin.coherence"},
    {"type": "azure_ai_evaluator", "name": "violence", "evaluator_name": "builtin.violence"},
    
    # Custom evaluator
    {
        "type": "azure_ai_evaluator",
        "name": "brand_tone",
        "evaluator_name": "brand_tone_checker",
        "data_mapping": {"response": "{{sample.output_items}}"},
        "initialization_parameters": {"deployment_name": "gpt-4o"}
    }
]
```

#### Managing Custom Evaluators

**List your custom evaluators:**
```python
evaluators = client.evaluators.list()
for e in evaluators:
    if not e.name.startswith("builtin."):
        print(f"{e.name}: {e.display_name}")
```

**Update an evaluator (new version):**
```python
# Create a new version with updated logic
client.evaluators.create_version(
    name="brand_tone_checker",  # Same name = new version
    evaluator_version={...}     # Updated definition
)
```

For complete SDK samples, see:
- [Code-based evaluator sample](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_eval_catalog_code_based_evaluators.py)
- [Prompt-based evaluator sample](https://github.com/Azure/azure-sdk-for-python/blob/main/sdk/ai/azure-ai-projects/samples/evaluations/sample_eval_catalog_prompt_based_evaluators.py)

---

## Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Evaluation stuck in "Running" | Insufficient model capacity | Increase model quota and rerun |
| All scores are 0 | Wrong evaluator or unsupported model | Verify evaluator compatibility |
| "Dataset not found" | Incorrect dataset ID or version | Use `evaluation_dataset_get` to verify |
| Evaluator returns errors | Missing or wrong init parameters | Query `client.evaluators.get()` for required params |
| "Field not found" errors | Data mapping doesn't match dataset | Verify field names in dataset match `data_mapping` |
| LLM evaluator fails | Missing `deployment_name` | Add `deployment_name` to `initialization_parameters` |
| Red team taxonomy fails | Missing tool descriptions | Ensure agent has tools configured |
| Comparison shows "TooFewSamples" | Dataset too small | Add more test cases (30+ recommended) |
| CI/CD auth errors | Missing RBAC permissions | Assign Azure AI User role to service principal |

### Minimum Dataset Sizes

| Purpose | Minimum Samples | Recommended |
|---------|-----------------|-------------|
| Quick health check | 3-5 | 10 |
| Regression testing | 20 | 50+ |
| Statistical significance | 30 | 100+ |
| Red teaming | Varies | Based on risk categories |

## Related Resources

- [Observability in Generative AI](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/observability) - Overview of evaluators and GenAIOps
- [Custom Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/custom-evaluators) - Create code-based and prompt-based evaluators
- [Cloud Evaluation Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/cloud-evaluation)
- [AI Red Teaming in the Cloud](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/develop/run-ai-red-teaming-cloud)
- [Agent Monitoring Dashboard](https://learn.microsoft.com/en-us/azure/ai-foundry/observability/how-to/how-to-monitor-agents-dashboard)
- [Evaluation GitHub Action](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/evaluation-github-action)
- [Foundry MCP Server](https://learn.microsoft.com/en-us/azure/ai-foundry/mcp/get-started)
- [Agent Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/agent-evaluators)
- [RAG Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/rag-evaluators)
- [Risk and Safety Evaluators](https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/evaluation-evaluators/risk-safety-evaluators)
