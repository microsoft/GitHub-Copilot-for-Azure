# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

For an end-to-end walkthrough of hosting an existing LangGraph, LangChain, or Deep Agents application on Foundry, see [Host LangGraph applications on Microsoft Foundry](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/c435ca894cc1ed1a4599fa9f61ca1c2d9d3b35f6/libs/azure-ai/docs/hosting/host-langgraph-on-foundry.md).

## Re-hosting Workflow

Preserve business behavior, the existing framework and dependencies. Keep the existing model provider, tools and credential inputs unless the user requests changes or the hosting contract requires an adaptation. Limit edits to necessary hosting-boundary, graph-construction and lifecycle adaptations.

### 1. Record the source-to-target contract

Before editing, record the source and target public operations, input/configuration/result mappings, and any required state's owner and lifetime, including capabilities supplied by the original runtime. Name actual target entry points and state owners, not only protocol or session labels. Preserve established backends and caller responsibilities; do not introduce state requirements the application did not have.

### 2. Choose the least invasive compatible path

Before choosing a hosting path or sample, read the walkthrough's [local-hosting chapter](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/c435ca894cc1ed1a4599fa9f61ca1c2d9d3b35f6/libs/azure-ai/docs/hosting/langgraph-to-foundry/02-run-locally.md) and, when deployment is in scope, [deployment preparation](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/c435ca894cc1ed1a4599fa9f61ca1c2d9d3b35f6/libs/azure-ai/docs/hosting/langgraph-to-foundry/03-prepare-deployment.md); read its [state-ownership guidance](https://raw.githubusercontent.com/Jiahui-Gu/langchain-azure/c435ca894cc1ed1a4599fa9f61ca1c2d9d3b35f6/libs/azure-ai/docs/hosting/langgraph-to-foundry/05-persistence-and-recovery.md) if the original runtime supplies required state. If guidance cannot be read, report the limitation rather than substitute a sample.

| Need | Hosting path |
|------|--------------|
| The selected protocol's default mapping preserves the application's required interface, and any required state remains with the correct owner | **Configuration-only** |
| Required input, configuration, operations or runtime capabilities are not covered by that mapping | **Host server integration** or another verified supported entry point |

### 3. Check the delivered project against that contract

Before declaring the project deployable, check its actual entry points and uploaded runtime dependency inputs, including exclusions, against the recorded contract. A local environment or startup check alone does not establish a complete upload. Execute available checks and report blocked checks rather than claiming they passed.

## Sample Selection

Use the parent workflow's azd sample selection guidance. For configuration-only hosting, select the sample matching the required protocol:

| Protocol | Sample |
|----------|--------|
| Responses | [Configuration-driven agent (Responses, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [Configuration-driven agent (Invocations, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.
