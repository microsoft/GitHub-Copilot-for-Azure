# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

For an end-to-end walkthrough of hosting an existing LangGraph, LangChain, or Deep Agents application on Foundry, see [Host LangGraph applications on Microsoft Foundry](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/dd6d89aeda772ab25671312c0bc0fbd55a5a4ddd/libs/azure-ai/docs/hosting/host-langgraph-on-foundry.md).

## Re-hosting Workflow

Preserve business behavior, the existing framework and dependencies. Keep the existing model provider, tools and credential inputs unless the user requests changes or the hosting contract requires an adaptation. Limit edits to necessary hosting-boundary, graph-construction and lifecycle adaptations.

Credential delivery is separate from application authentication. If a hosted environment can supply the existing credential variables securely, keep those inputs and avoid adding application-managed project connections solely to re-host. Document any required secret bindings without embedding secret values.

### 1. Record the source-to-target contract

Before editing, record the source and target public operations, input/configuration/result mappings, and any required state's owner and lifetime, including capabilities supplied by the original runtime. Name actual target entry points and state owners, not only protocol or session labels. Preserve established backends and caller responsibilities; do not introduce state requirements the application did not have.

Inspect the original startup command, documented follow-up workflow, and framework-managed tools before deciding the application is stateless. In particular, `langgraph dev` can checkpoint graphs that do not declare a checkpointer, and the default Deep Agents backend keeps virtual files and task progress in graph state. If the workflow reads or revises those files across requests, the new host must checkpoint that state. When reusing the default backend on Foundry without an existing durable saver, pass `FoundryCheckpointSaver` to the deployed graph's construction and verify that the launch configuration selects that graph. Keep a separate development export if Studio owns its checkpointer.

### 2. Choose the least invasive compatible path

Before choosing a hosting path or sample, read the walkthrough's [local-hosting chapter](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/dd6d89aeda772ab25671312c0bc0fbd55a5a4ddd/libs/azure-ai/docs/hosting/langgraph-to-foundry/02-run-locally.md) and, when deployment is in scope, [deployment preparation](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/dd6d89aeda772ab25671312c0bc0fbd55a5a4ddd/libs/azure-ai/docs/hosting/langgraph-to-foundry/03-prepare-deployment.md); read its [state-ownership guidance](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/dd6d89aeda772ab25671312c0bc0fbd55a5a4ddd/libs/azure-ai/docs/hosting/langgraph-to-foundry/05-persistence-and-recovery.md) if the original runtime supplies required state. If guidance cannot be read, report the limitation rather than substitute a sample.

| Need | Hosting path |
|------|--------------|
| The selected protocol's default mapping preserves the application's required interface, and any required state remains with the correct owner | **Configuration-only** |
| Required input, configuration, operations or runtime capabilities are not covered by that mapping | **Host server integration** or another verified supported entry point |

Choose the protocol from the required target caller and operations, not from the source framework's server APIs alone. When no target protocol is specified and Responses can preserve the required caller workflow, prefer Responses and reuse the existing graph and tools. Keep required state and artifact access in the mapping; do not recreate every development-server endpoint or add a custom RPC surface merely because the source server exposes one. If a required client operation or compatibility contract cannot be preserved this way, explain the gap and choose a supported boundary that meets it.

### 3. Check the delivered project against that contract

Before declaring the project deployable, check its actual entry points and uploaded runtime dependency inputs, including exclusions, against the recorded contract. A local environment or startup check alone does not establish a complete upload. Execute available checks and report blocked checks rather than claiming they passed.

Verify which uploaded dependency declaration the selected remote builder actually consumes. Follow the deployment preparation guidance for that builder, including files it expects and development manifests that could select a different build path. Do not infer that a local lockfile, editable install or virtual environment works remotely; verify the upload has a complete runtime declaration and a startup command that works with the installed runtime, not a path to a development environment.

Check the submitted agent service definition against the deployment preparation example linked above or a current generated definition for the chosen deployment mode. Verify the service kind, protocol entries and deployment configuration; parsing `azure.yaml` or starting the application alone does not validate the agent definition. When available, run `azd ai agent doctor --local-only` from the submitted project and inspect the per-service agent-definition result separately from environment setup. Fix definition failures and report skipped or unavailable checks without requiring cloud sign-in for this local check.

When including a local `azd ai agent run` path, verify the submitted startup command and interpreter selection, not just an equivalent command in a separate environment. For a Python launcher, use the prepared local runtime and keep any uv Python pin aligned with the selected hosted runtime.

For retained artifacts, verify a later request can read an artifact written by an earlier request without recreating it; use a different hosted session if the contract requires that lifetime. Startup, a successful first response, and an unchanged conversation ID are not evidence of state restoration. If external prerequisites block verification, keep the required state construction and report the blocked check.

## Sample Selection

Honor a named sample. For configuration-only migration, name the matching protocol sample below before editing and use the configuration in this guide without looking up the sample again. For scaffolding, use the parent workflow's azd sample selection guidance. Paths are relative to [`samples/python/hosted-agents`](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents).

| Protocol or need | Sample |
|----------|--------|
| Responses (configuration-only) | [`langgraph/responses/10-run`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations (configuration-only) | [`langgraph/invocations/03-run`](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |
| ReAct chat with `create_agent` | `langgraph/responses/01-langgraph-chat` |
| Toolbox; Toolbox with user OAuth | `langgraph/responses/02-langgraph-toolbox`; `langgraph/responses/03-langgraph-toolbox-user-identity` |
| Multi-agent, subgraphs, deep agents | `langgraph/responses/05-workflows`, `langgraph/responses/15-branching`, `langgraph/responses/11-deep-agents` |
| Human-in-the-loop | `langgraph/responses/07-human-in-the-loop` |
| Observability | `langgraph/responses/08-observability` |
| Custom Responses server or startup/shutdown lifecycle | `langgraph/responses/12-custom-host` (`ResponsesHostServer`), only when `langgraph.json` cannot express it |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.

## Zero-code migration

In the service's `project` directory, add or reuse `langgraph.json` and bind the existing graph or factory:

```json
{"dependencies": ["."], "graphs": {"agent": "./main.py:graph"}}
```

Add `langchain-azure-ai[hosting,opentelemetry]>=1.2.9` to the existing `pyproject.toml` or `requirements.txt`. Add a small deployment launcher, `foundry_host.py`, next to `langgraph.json` without changing the graph code:

```python
from langchain_azure_ai.agents.hosting.run import main

if __name__ == "__main__":
    main(["--protocol", "responses"])
```

Add or merge this service in `azure.yaml` (`project: .` for root-level code):

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
      entryPoint: foundry_host.py
    env:
      OTEL_AUTO_CONFIGURE_AZURE_MONITOR: "true"
```

Keep the module command in `startupCommand` for local runs. `azd` passes `codeConfiguration.entryPoint` as one argument to Python, so use the launcher path relative to the service's `project`, not module arguments. When scaffolding, pass `--entry-point foundry_host.py` even if the sample shows inline module arguments. Before running or deploying, verify the launcher exists and the graph binding resolves to the existing code.

For Invocations, use `invocations` in `protocols`, `startupCommand`, and the launcher's argument list. The entry-point filename stays the same.

## Model wiring and tracing

For a Foundry model, use the project's OpenAI-compatible base URL and a refreshable Entra token provider:

```python
import os
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from langchain_openai import ChatOpenAI

credential = DefaultAzureCredential()
endpoint = os.environ["FOUNDRY_PROJECT_ENDPOINT"]
with AIProjectClient(endpoint=endpoint, credential=credential) as project, project.get_openai_client() as client:
    base_url = str(client.base_url)

model = ChatOpenAI(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    base_url=base_url,
    api_key=get_bearer_token_provider(credential, "https://ai.azure.com/.default"),
    use_responses_api=True,
    output_version="responses/v1",
)
```

`use_responses_api=True` is mandatory: otherwise model spans lack `gen_ai.response.id` and Foundry Portal Traces renders empty. When monitoring is enabled, call `enable_auto_tracing()` from `langchain_azure_ai.callbacks.tracers` inside the graph factory and set `OTEL_AUTO_CONFIGURE_AZURE_MONITOR: "true"` in the service `env` as above. Verify correlated spans in the portal after a smoke invocation.

## Toolbox

Use `langchain_azure_ai.tools.AzureAIProjectToolbox` and follow the [LangChain / LangGraph Toolbox integration](use-toolbox-in-hosted-agent.md#langchain--langgraph-sdk) for schema adaptation and user OAuth consent.

## Pre-smoke-test RBAC

`ChatOpenAI` calls the project's OpenAI endpoint from inside the hosted container. Before remote smoke testing, check `Foundry User` for the **agent's managed identity**, not the deploy/invoke caller, at the project ARM scope ending in `Microsoft.CognitiveServices/accounts/<account>/projects/<project>`:

```bash
az role assignment list --assignee "<agent-principal-id>" --scope "<project-arm-id>" --role "Foundry User" --include-inherited --output table
```

If no `Foundry User` assignment is found, check whether another role grants the agent's managed identity model inference access. Only if that access is missing, have an authorized operator grant `Foundry User` at the project scope:

```bash
az role assignment create --assignee-object-id "<agent-principal-id>" --assignee-principal-type ServicePrincipal --scope "<project-arm-id>" --role "Foundry User"
```

Do not invoke until effective access is confirmed. For `401 PermissionDenied` from the model call, recheck the same identity and scope before retrying.