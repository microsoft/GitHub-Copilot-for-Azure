# LangChain and LangGraph Hosting

Use this guidance when creating, migrating, or re-hosting a LangChain or LangGraph agent on Foundry.

For an end-to-end walkthrough of hosting an existing LangGraph, LangChain, or Deep Agents application on Foundry, see [Host LangGraph applications on Microsoft Foundry](https://github.com/langchain-ai/langchain-azure/blob/main/libs/azure-ai/docs/hosting/host-langgraph-on-foundry.md).

## Design Intent

Preserve the agent's existing framework behavior and minimize migration-specific code. Choose the least invasive hosting path that satisfies the requested behavior.

Keep migration focused on the hosting boundary. Preserve user-authored business logic, established model and tool integrations, and existing dependencies. Small changes to graph construction or resource ownership are appropriate when required to connect the target runtime's capabilities; preserving behavior does not require keeping every construction statement unchanged. Do not replace the application with sample code.

Preserve the application's state semantics, not just its graph construction. LangGraph development/server runtimes can manage checkpointing outside the exported graph: `langgraph dev` supplies persistence itself and rejects application-configured checkpointers. A graph handed to a different host does not inherit that runtime service. Inspect the graph's state schema and framework/tool-managed state; when existing behavior relies on continuity, the target needs an explicit persistence owner. Responses message history is not a substitute for arbitrary graph state. Keep development and hosted construction separate where their ownership rules differ.

Keep an established checkpointer and backend unless the requested migration requires a justified adaptation. If the original runtime supplied a required capability that the target does not, configure the equivalent supported capability with the appropriate lifetime. Do not introduce persistence for a stateless application, replace an existing storage backend, or migrate historical checkpoints without user intent. For stateful workflows, read the walkthrough's [persistence and recovery guidance](https://github.com/langchain-ai/langchain-azure/blob/main/libs/azure-ai/docs/hosting/langgraph-to-foundry/05-persistence-and-recovery.md) before choosing the hosting path; enable only the capabilities the application requires.

## Hosting Decision

| Need | Hosting path |
|------|--------------|
| One message-shaped graph using the selected protocol's default input, output and configuration mapping | **Configuration-only**, after verifying that mapping |
| Non-message graph inputs/outputs, application-defined request configuration, or multiple public operations not covered by the default mapping | **Explicit boundary adaptation** through host integration or verified supported configuration |
| State or resource lifecycle previously supplied by the original runtime | **An explicit target owner**, with host integration where configuration cannot provide it |

The configuration-driven runner selects and loads a graph; it does not reproduce the LangGraph development/server API. The default Responses mapping supplies conversation messages. The default Invocations mapping accepts a message and builds message-shaped graph input. Neither automatically turns a JSON string into an arbitrary graph input or forwards caller-supplied `configurable` fields. Inspect the installed SDK's request parser, input/configuration builders and output parser before relying on a mapping. A different protocol name or a disabled compatibility check does not implement a missing conversion.

Before selecting a path, identify the target owner of each capability inherited from the original runtime. Prefer configuration-only hosting when configuration supplies those capabilities with the required lifetime. Otherwise use host server integration with the necessary construction or lifecycle adaptation, not merely because the project already contains agent code. Verify representative behavior as described in [re-host verification](re-host.md#verify-the-migrated-behavior).

For either path, verify the effective runtime configuration of the graph or factory selected by the deployment entry point, not just an independently constructed graph or development export. Required framework capabilities must apply to the graph that actually handles requests; validate configuration-driven integrations without introducing an unnecessary adapter.

A LangGraph project's public API includes both graph input schemas and `RunnableConfig.configurable` parameters. Account for every exposed graph and its callers before choosing the hosted entry and protocol. Selecting one graph does not expose the others, and a `messages` field does not make the entire API chat-shaped. If the selected host cannot carry the existing input/configuration or route the required operations, configuration-only hosting is not sufficient: use a boundary adapter or separately delivered supported entry points. Keep request parsing, operation routing, configuration propagation and output serialization at that boundary, and delegate business execution to the existing graphs. Validate the adapted input against the original schema; do not merely suppress host validation to start a graph whose inputs are still unmapped. Preserve the original validation and parameter semantics; platform user/session keys do not automatically replace application configuration.

## Sample Selection

Use the parent workflow's azd sample selection guidance. For configuration-only hosting, select the sample matching the required protocol:

| Protocol | Sample |
|----------|--------|
| Responses | [Configuration-driven agent (Responses, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/responses/10-run/azure.yaml) |
| Invocations | [Configuration-driven agent (Invocations, LangGraph, Python)](https://github.com/microsoft-foundry/foundry-samples/blob/main/samples/python/hosted-agents/langgraph/invocations/03-run/azure.yaml) |

Use a host server integration sample only when the hosting decision above requires that path.

Samples provide hosting patterns only. Use their manifests, adapters, protocol wiring, and deployment configuration as references; do not treat sample application structure or conventions as the desired final application.

A sample's model provider, model API, and model deployments are not implicit re-hosting requirements. Reuse the application's existing model integration unless the independently established model choice requires a change.

A Foundry project endpoint can be present for hosting or state access even when the application uses another model provider. Its presence must not activate a new model path or alter the existing provider/API defaults. Keep any explicitly requested model migration separate from the hosting adaptation.
