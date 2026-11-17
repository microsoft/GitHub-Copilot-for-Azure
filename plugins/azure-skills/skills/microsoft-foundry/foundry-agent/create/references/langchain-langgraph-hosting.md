# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

For an end-to-end walkthrough of hosting an existing LangGraph, LangChain, or Deep Agents application on Foundry, see [Host LangGraph applications on Microsoft Foundry](https://github.com/langchain-ai/langchain-azure/blob/main/libs/azure-ai/docs/hosting/host-langgraph-on-foundry.md).

## Design Intent

Preserve the agent's existing framework behavior and minimize migration-specific code. Choose the least invasive hosting path that satisfies the requested behavior.

Preserve business behavior and minimize edits. Make only the hosting-boundary, graph-construction, or lifecycle adaptations needed to run the application on Foundry, preserving business logic and existing dependencies.

Preserve the application's state semantics, including capabilities supplied by its original runtime. Follow the walkthrough's persistence guidance when the target needs an explicit state owner; preserve an established backend and avoid adding state requirements the application did not have.

## Hosting Decision

| Need | Hosting path |
|------|--------------|
| The selected protocol's default mapping preserves the application's required interface | **Configuration-only** |
| Required input, configuration, operations or runtime capabilities are not covered by that mapping | **Host server integration** or another verified supported entry point |

Follow the linked walkthrough and its applicable chapters to choose the least invasive supported hosting path for the application's requirements.

## Sample Selection

Use the parent workflow's azd sample selection guidance. For configuration-only hosting, select the sample matching the required protocol:

| Protocol | Sample |
|----------|--------|
| Responses | [Configuration-driven agent (Responses, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [Configuration-driven agent (Invocations, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.
