# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

## Design Intent

Preserve the agent's existing framework behavior and minimize migration-specific code. Choose the least invasive hosting path that satisfies the requested behavior.

Treat migration as additive. Do not delete or replace user-authored code, and do not remove existing dependencies. Add only the hosting configuration, files, and dependencies required to run the existing agent on Foundry.

Do not add, remove, or replace the agent's checkpointer unless the user explicitly requests a checkpointing change. Checkpointing belongs to the agent's application logic, not its hosting configuration.

## Hosting Decision

| Need | Hosting path |
|------|--------------|
| Standard LangChain or LangGraph agent hosting with no custom server behavior | **Configuration-only** |
| Custom request handling, protocol behavior, lifecycle control, or other hosting behavior that configuration cannot express | **Host server integration** |

Prefer configuration-only hosting unless the user explicitly requests custom hosting behavior or the existing agent demonstrably requires it. Do not add host server integration merely because the project already contains agent code.

## Sample Selection

For configuration-only hosting, select the sample matching the required protocol. Paths are relative to `samples/python/hosted-agents` in the [Foundry samples repo](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents).

| Protocol or need | Sample |
|----------|--------|
| Responses | [`langgraph/responses/10-run`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [`langgraph/invocations/03-run`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |
| ReAct chat with `create_agent` | `langgraph/responses/01-langgraph-chat` |
| Toolbox; Toolbox with user OAuth | `langgraph/responses/02-langgraph-toolbox`; `langgraph/responses/03-langgraph-toolbox-user-identity` |
| Multi-agent, subgraphs, deep agents | `langgraph/responses/05-workflows`, `langgraph/responses/15-branching`, `langgraph/responses/11-deep-agents` |
| Human-in-the-loop | `langgraph/responses/07-human-in-the-loop` |
| Observability | `langgraph/responses/08-observability` |
| Custom Responses server or startup/shutdown lifecycle | `langgraph/responses/12-custom-host` (`ResponsesHostServer`), only when `langgraph.json` cannot express it |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.

## Zero-code migration

For an existing agent moving to Foundry, read [Re-host an existing agent](re-host.md) before planning or applying the configuration below.

In the service's source directory (`azure.yaml` → `services.<agent>.project`), add or reuse `langgraph.json` and point to the existing graph or factory:

```json
{"dependencies": ["."], "graphs": {"agent": "./main.py:graph"}}
```

Add `langchain-azure-ai[hosting,opentelemetry]>=1.2.9` to the existing `pyproject.toml` or `requirements.txt`. Merge the following service into `azure.yaml` (`project: .` for root-level code):

```yaml
name: my-agent
services:
  my-agent:
    name: my-agent
    project: .
    host: azure.ai.agent
    kind: hosted
    language: python
    protocols:
      - protocol: responses
        version: 2.0.0
    startupCommand: python -m langchain_azure_ai.agents.hosting.run --protocol responses
    codeConfiguration:
      runtime: python_3_13
      entryPoint: "-m langchain_azure_ai.agents.hosting.run --protocol responses"
    env:
      OTEL_AUTO_CONFIGURE_AZURE_MONITOR: "true"
```

For Invocations, use `invocations` in the protocol and both commands. For a synced uv environment, `startupCommand` can prefix `python` with `uv run --no-sync`. Preserve existing project and model settings. For config-only preparation, leave unresolved project/model selection for deployment.

When scaffolding a sample, pass its module-style `codeConfiguration.entryPoint` as one `--entry-point` argument to `azd ai agent init`. Validate both hosting commands and the `langgraph.json` graph binding; do not replace the module entry point with a filename.

## Model wiring and tracing

When using a Foundry model, use the project's OpenAI-compatible base URL and a refreshable Entra token provider. Bind `FOUNDRY_PROJECT_ENDPOINT` and `AZURE_AI_MODEL_DEPLOYMENT_NAME` to the selected values:

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from langchain_openai import ChatOpenAI

credential = DefaultAzureCredential()
endpoint = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
with AIProjectClient(endpoint=endpoint, credential=credential) as project:
    with project.get_openai_client() as client:
        base_url = str(client.base_url)

model = ChatOpenAI(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    base_url=base_url,
    api_key=get_bearer_token_provider(credential, "https://ai.azure.com/.default"),
    use_responses_api=True,
    output_version="responses/v1",
)
```

`use_responses_api=True` is mandatory for Foundry trace correlation. Without it, model spans lack `gen_ai.response.id` and the Foundry portal's Traces view is empty for the invocation. When monitoring is enabled, call `enable_auto_tracing()` from `langchain_azure_ai.callbacks.tracers` inside the graph factory before building the graph, and set `OTEL_AUTO_CONFIGURE_AZURE_MONITOR="true"` in the agent service in `azure.yaml` as shown above. With Application Insights configured, confirm a smoke response has correlated spans in the portal.

## Toolbox

Use `langchain_azure_ai.tools.AzureAIProjectToolbox` and follow the [LangChain / LangGraph Toolbox integration](use-toolbox-in-hosted-agent.md#langchain--langgraph-sdk) for schema adaptation and user OAuth consent.

## Pre-smoke-test RBAC

`ChatOpenAI` calls the project's OpenAI endpoint from inside the container. Before the first remote smoke invocation, check the deployed agent's **managed identity principal ID**, separate from the deploy/invoke caller. Use the actual project ARM ID ending in `Microsoft.CognitiveServices/accounts/<account>/projects/<project>`:

```bash
az role assignment list --assignee "<agent-principal-id>" --scope "<project-arm-id>" --role "Foundry User" --include-inherited --output table
```

If the role is missing, have an authorized operator grant it to that identity at the project scope:

```bash
az role assignment create --assignee-object-id "<agent-principal-id>" --assignee-principal-type ServicePrincipal --scope "<project-arm-id>" --role "Foundry User"
```

Wait for propagation and recheck effective access before invoking. For `401 PermissionDenied` on the container's model call, verify the same identity and scope before retrying.