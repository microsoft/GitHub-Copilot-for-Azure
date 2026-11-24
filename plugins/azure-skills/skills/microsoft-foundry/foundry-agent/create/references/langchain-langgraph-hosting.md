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

### 3. Check the delivered project against that contract

Before declaring the project deployable, check its actual entry points and uploaded runtime dependency inputs, including exclusions, against the recorded contract. A local environment or startup check alone does not establish a complete upload. Execute available checks and report blocked checks rather than claiming they passed.

Check the submitted agent service definition against the deployment preparation example linked above or a current generated definition for the chosen deployment mode. Verify the service kind, protocol entries and deployment configuration; parsing `azure.yaml` or starting the application alone does not validate the agent definition. When available, run `azd ai agent doctor --local-only` from the submitted project and inspect the per-service agent-definition result separately from environment setup. Fix definition failures and report skipped or unavailable checks without requiring cloud sign-in for this local check.

When including a local `azd ai agent run` path, verify the submitted startup command and interpreter selection, not just an equivalent command in a separate environment. For a Python launcher, use the prepared local runtime and keep any uv Python pin aligned with the selected hosted runtime.

For retained artifacts, verify a later request can read an artifact written by an earlier request without recreating it; use a different hosted session if the contract requires that lifetime. Startup, a successful first response, and an unchanged conversation ID are not evidence of state restoration. If external prerequisites block verification, keep the required state construction and report the blocked check.

## Sample Selection

Use the parent workflow's azd sample selection guidance. For configuration-only hosting, select the sample matching the required protocol:

| Protocol | Sample |
|----------|--------|
| Responses | [Configuration-driven agent (Responses, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [Configuration-driven agent (Invocations, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.
