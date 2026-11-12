# Re-host an Existing Agent from other platforms

## Step 1: Collect information

Resolve two independent choices before initialization or edits:

1. **Model** -- keep the existing model or use a Foundry model.
2. **Agent framework** -- keep the existing framework or migrate it.

Infer these choices from the user's request and current code. Ask only for information that remains unclear; skip questions when the intent is explicit or evident, such as an existing Foundry model integration. Do not switch or deploy a model, or migrate the framework, without user intent.

A hosting request preserves existing model and tool providers by default. A Foundry project endpoint can be required for hosting, state or telemetry; its presence, a GPT deployment name or missing vendor credentials does not select a replacement inference provider. Disclose missing original-provider credentials instead of adding an automatic switch or fallback. If a provider change is requested, verify the selected SDK's protocol and authentication contract; an Anthropic-specific client cannot invoke a GPT deployment merely by changing its model name. Keep optional alternatives behind explicit provider selection that preserves the original default.

Inspect the original entry points, dependency files, environment examples, tools, state and documented user workflow before scaffolding. Keep graph exports, business prompts, tools and clients unless a boundary adaptation is necessary. For LangChain, LangGraph or Deep Agents, read [LangChain and LangGraph hosting](langchain-langgraph-hosting.md), including server-supplied persistence, before choosing an adapter. Missing Azure login, external credentials or networking blocks the operations that need them, not source inspection or authorized edits. Do not initiate login or claim checks that were not executed.

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

Treat local startup and the cloud entry point as separate launch contracts. Put `startupCommand` at `services.<service>.startupCommand`, not inside `codeConfiguration`. A cloud `codeConfiguration.entryPoint` must execute a server; a module that only exports `app` or a graph can import and immediately exit. Prefer one executable host file for both paths when appropriate, and verify native readiness using the actual configured local command. Compilation and manifest validation are not startup tests.

For Python `dependencyResolution: remote_build`, provide a deployable `requirements.txt` entry even when the existing application uses `pyproject.toml` or `uv.lock`. Reuse the existing dependency metadata, such as `-e .` for an installable project with complete runtime dependencies; do not introduce a second incompatible dependency list. Include the selected hosting/state extras and dependencies imported by delegated tools. Reconcile locks only when resolution actually succeeds, and preserve the original development workflow.

When execution is available, install the declared deployment requirements in a clean environment and import the complete graph. Record the interpreter, installed SDK path and resolved versions; an undeclared package or source overlay on `PYTHONPATH` is not deployability evidence. Keep TLS verification enabled and distinguish an environmental installation failure from a source defect. After deployment, exercise a representative real request under the runtime identity and inspect actual tool/file results. Unit mocks and an active version alone do not prove hosted behavior.

Once the agent is configured as a Foundry hosted agent, make the requested changes, return to [create-hosted](../create-hosted.md), and continue with Step 5.

## Step 3: Set azd env

```bash
azd env set AZURE_SUBSCRIPTION_ID "<id>"
azd env set AZURE_LOCATION "<region>"
azd env set AZURE_AI_MODEL_DEPLOYMENT_NAME "<model name>"
```

## Foundry Model Reference

Read [Foundry Model Reference](./foundry-model.md) and follow the steps in it when you want to query model related data.

## Verify and hand off

Derive checks from the application's existing behavior, not a replacement demo. Where saved artifacts must survive later turns, verify creation, separate read-only full readback, revision preserving the original content, and restoration in a different hosted session with the same conversation and authenticated caller. Keep process-crash recovery, cross-user isolation and business-output quality separate unless requested. Follow the [framework hosting reference](langchain-langgraph-hosting.md#deployment-or-durable-state-only-when-requested) for these boundaries; do not add task-specific validators or synthetic report seeds.

Preserve working framework tracing/logging without adding duplicate instrumentation when the installed integration already provides it. Report changed files, preserved behavior, executed commands and remaining prerequisites. Keep deployment, application success, state continuity and production readiness distinct; do not label an unexecuted check passed or an original application defect a migration regression.
