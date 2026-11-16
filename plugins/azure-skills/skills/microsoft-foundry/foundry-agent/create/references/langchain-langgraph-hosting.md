# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

For an end-to-end walkthrough of hosting an existing LangGraph, LangChain, or Deep Agents application on Foundry, see [Host LangGraph applications on Microsoft Foundry](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/d12-914d46a5/libs/azure-ai/docs/hosting/host-langgraph-on-foundry.md).

## Design Intent

Preserve the agent's existing framework behavior and minimize migration-specific code. Choose the least invasive hosting path that satisfies the requested behavior.

Treat migration as additive. Do not delete or replace user-authored code, and do not remove existing dependencies. Add only the hosting configuration, files, and dependencies required to run the existing agent on Foundry.

Preserve the application's state semantics, including capabilities supplied by its original runtime. Follow the walkthrough's persistence guidance when the target needs an explicit state owner; preserve an established backend and avoid adding state requirements the application did not have.

## Hosting Decision

| Need | Hosting path |
|------|--------------|
| The selected protocol's default mapping preserves the application's required interface | **Configuration-only** |
| Required input, configuration, operations or runtime capabilities are not covered by that mapping | **Host server integration** or another verified supported entry point |

Before initializing or editing a migration, fetch and read the linked walkthrough and its applicable local-hosting, deployment-packaging and persistence chapters. This reference routes the workflow; samples do not replace the walkthrough. If the documentation cannot be read, report that limitation instead of treating sample startup as migration verification. Then choose the least invasive supported path for the actual application's requirements; existing agent code alone is not a reason to add host integration.

**Required migration verification:** Complete the walkthrough's gates for every delivered entry point and the workflow connecting the preserved operations, and record the actual requests and observed results. Generic sample checks, imports and server readiness do not replace these application-boundary checks; report blocked gates separately.

## Sample Selection

Use the parent workflow's azd sample selection guidance. For configuration-only hosting, select the sample matching the required protocol:

| Protocol | Sample |
|----------|--------|
| Responses | [Configuration-driven agent (Responses, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [Configuration-driven agent (Invocations, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.
