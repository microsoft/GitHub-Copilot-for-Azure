# Re-host an Existing Agent from other platforms

## Step 1: Collect information

Resolve two independent choices before initialization or edits:

1. **Model** -- keep the existing model or use a Foundry model.
2. **Agent framework** -- keep the existing framework or migrate it.

Infer these choices from the user's request and current code. Ask only for information that remains unclear; skip questions when the intent is explicit or evident, such as an existing Foundry model integration. Do not switch or deploy a model, or migrate the framework, without user intent.

Re-hosting alone does not request a model migration. Preserve the existing model provider, API family, and construction path by default. The agent's hosting protocol and its model-provider protocol are independent choices; adapting one does not require changing the other. Change model integration only for an explicit requirement or a demonstrated compatibility gap, and explain why it is necessary.

### Preserve the runtime contract

Inspect the application's documented launch path, framework runtime defaults, and representative workflow, not only its source code. Identify capabilities supplied by the original runtime outside the application, such as state and session management, identity propagation, and resource lifecycle management. Include framework- and tool-managed application state, not only conversation messages. Determine which capabilities the existing behavior relies on and how long they must remain effective.

Treat inherited runtime capabilities as part of the existing contract; their absence from the migration request is not permission to drop them.

Before choosing a scaffold, map each existing public operation to its input, caller configuration, output/effect, and usable target access path. Include supporting workflows used before or between requests. A retained source export or development-server configuration is not a delivered access path: either expose the operation through a supported target interface or deliver and document the companion service that callers actually use. Do not silently reduce the application to its conversational operation.

Keep application configuration distinct from platform authentication context. Preserve existing per-request parameters and their validation; do not silently substitute an authenticated identity, environment-wide default or shared fallback for an application-defined partition/configuration value. Resolve any required mapping explicitly at the hosting boundary, without inventing a new business or authorization policy.

Choose the least invasive supported hosting path that preserves those capabilities. An unchanged graph or successful startup does not establish behavioral equivalence. A small boundary or lifecycle adaptation is part of re-hosting when the target runtime does not provide an equivalent capability; it is not permission to redesign business logic, replace an established backend, or add requirements the application did not have.

For framework-specific runtime behavior, consult the applicable hosting reference before selecting the hosting path. For LangChain or LangGraph, use [LangChain and LangGraph hosting](langchain-langgraph-hosting.md).

Separate source preparation from cloud execution. Missing login or deployment choices block the operations that need them, not authorized source adaptation. Prepare the supported hosted entry point, deployment configuration, dependencies, and operating instructions without inventing resource bindings; identify the remaining prerequisites and do not claim deployment or unavailable behavioral checks succeeded.

## Step 2: Initialize and adapt

To scaffold a Foundry agent project with existing agent codes, run:

```bash
azd ai agent init --no-prompt \
  --src ./src/my-agent \
  --agent-name my-agent \
  --deploy-mode code \
  --runtime python_3_13 \
  --entry-point <entry-point>
```

Use `--deploy-mode code` by default. `--runtime` and `--entry-point` are required with `--deploy-mode code --no-prompt`. Use the existing executable entry point, or a new adapter file only when one is intentionally added. Runtimes: `python_3_13`, `python_3_14`, `dotnet_10`. `--deploy-mode container` builds from `Dockerfile`. For an existing Foundry project, add `--project-id "<resourceId>"`.

After scaffolding, you must use `azd ai agent sample list --language <language> --output json` and follow the [azd Sample Selection Guidance](../create-hosted.md#azd-sample-selection-guidance) to find the closest relevant samples for adapter, protocol, and deployment guidance. Treat samples as boundary patterns, not replacement applications. Browse the relevant samples as code references.

For reference, here are some awesome samples for re-hosting scenarios:
1. Re-host agents built with the OpenAI Agents SDK: https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/responses/openai-agents-sdk
2. Re-host agents built with the Claude Agent SDK: https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents/bring-your-own/invocations/claude-agent-sdk

If users use a Foundry model, you must wire the Foundry model to the agent.

Set `startupCommand` in `azure.yaml`.

Treat the deployable artifact as the runtime boundary. Keep the inputs consumed by the selected remote builder as well as runtime source, configuration and resources. Dependency manifests and lockfiles are build inputs, not disposable caches; exclude one only when a validated replacement dependency-resolution path is packaged. Inspect the archive after applying ignore rules, and verify installation from that archive in a clean environment.

For Python code deployment, do not assume that `pyproject.toml` alone selects the same installer as local `uv sync`. Oryx distinguishes requirements-based, uv and Poetry builds from the files present in the package; a uv project must retain its matching `pyproject.toml` and `uv.lock`, or intentionally provide another supported dependency manifest. See the [Oryx Python build implementation](https://github.com/microsoft/Oryx/blob/main/src/BuildScriptGenerator/Python/PythonBashBuildSnippet.sh.tpl). A successful local editable install does not validate remote build detection.

### Verify the migrated behavior

For each runtime capability the migration must preserve, trace its configuration or construction through to the component used by the target entry point. Check who owns it, how the consumer receives it, and whether its lifetime covers that use. A declared dependency or separately constructed resource does not establish that the running application uses it.

Launch the actual configured startup command in normal serving mode with its effective runtime configuration. Check entry selection, import resolution and sustained readiness before invoking the preserved operations through their target interfaces. An import, `--help`, manifest parse or unit test is not a startup test. Also compare effective model/tool defaults and credential requirements with the original application; a newly available hosting configuration must not silently change those independent choices.

Exercise each preserved public operation through its delivered access path, including the original configuration inputs and observable effects. Then exercise the existing workflow that connects those operations; an independently callable function or a successful empty-data conversation is insufficient. When behavior depends on continuity, include follow-up operations across the relevant request or session boundary. Select checks from the application's runtime contract rather than imposing the same state, storage, or recovery mechanism on every application.

Keep three verification gates distinct: install the packaged application, start its declared host, and successfully exercise its public workflow through that host. Readiness and rejection of malformed input do not exercise delegation to the application. Resolve and invoke the actual exported runnable used by each boundary path; compilation, an import or a similarly named symbol is not evidence that delegation works.

When model, tool or external-service credentials are unavailable, still complete a local successful-request check with controlled substitutes for those external dependencies. Keep the delivered adapter, graph construction, routing, configuration propagation and application execution real; do not stub the delegate or return expected results from the adapter. Observe the actual downstream effect, not only an HTTP success or an acknowledgement: an accepted request with an empty or dropped input can produce a plausible success message without performing the operation. Use a disposable harness outside production code and remove test substitutions before delivery. This is boundary verification, not proof of cloud integration or real provider behavior. Report any remaining unavailable checks and prerequisites explicitly rather than calling an unexercised path complete.

Once the agent is configured as a Foundry hosted agent, make the requested changes, return to [create-hosted](../create-hosted.md), and continue with Step 5.

## Step 3: Set azd env

```bash
azd env set AZURE_SUBSCRIPTION_ID "<id>"
azd env set AZURE_LOCATION "<region>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model name>"
```

## Foundry Model Reference

Read [Foundry Model Reference](./foundry-model.md) and follow the steps in it when you want to query model related data.
