# Azure AI Search interface selection

Select interfaces by **operation class**, not by preference or familiarity.
Preserve one workflow and equivalent postconditions across surfaces.

## Interfaces

| Interface | Use in Search and Foundry IQ workflows |
|---|---|
| REST data plane | Full indexing, documents, indexers, skillsets, queries, and knowledge-base configuration when an SDK does not expose the required contract |
| REST control plane | Provisioning, scaling, networking, identity, and service configuration |
| Azure SDKs | Preferred typed REST clients for .NET, Java, JavaScript/TypeScript, and Python; use the data-plane and resource-management libraries for their respective operations |
| Azure MCP Server | Six read-only Azure AI Search tools for service discovery, index inspection/query, and knowledge-base retrieval |
| Native knowledge-base MCP | Direct agent retrieval from `/knowledgeBases/{knowledge-base-name}/mcp` |
| Azure CLI / PowerShell | Control-plane creation and configuration; do not use as the normal document-query interface |
| ARM / Bicep / Terraform | Repeatable infrastructure and service configuration |
| Azure portal | Supported interactive management, but never required by the local-files hero workflow |
| Microsoft Foundry / Foundry IQ | Reusable permission-aware knowledge bases and agentic retrieval experiences backed by Azure AI Search |

## Operation classes

Choose the primary interface for the operation being performed. Use a fallback
only for the stated reason, and never use a prohibited interface.

| Operation class | Primary | Fallback | Never |
|---|---|---|---|
| Provision or scale a service | IaC, or control-plane SDK | Control-plane REST for a preview capability | Data-plane SDK |
| Network, private endpoint, encryption | IaC | Control-plane REST | Portal-only change that is not reproducible |
| Role assignment | IaC or CLI | ARM REST | Any key-based alternative |
| Discover existing resources | Azure MCP read-only tools | CLI or control-plane REST | Mutating interfaces |
| Define index, source, or knowledge base | Data-plane SDK | Data-plane REST for a contract the SDK lacks | CLI |
| Ingest and verify freshness | Data-plane SDK with indexer status | Data-plane REST | Azure MCP |
| Application query | Data-plane SDK from a trusted backend | Data-plane REST | Admin credentials in a client |
| Agent retrieval | Native knowledge-base MCP endpoint | Knowledge-base retrieve REST | Azure MCP Server as an application dependency |
| Diagnosis | Read-only control-plane and data-plane inspection | CLI and portal for correlation | Enabling keys or public access to reproduce |

## Selection rules

- Do not build or require a Foundry IQ-specific MCP proxy over supported developer
  interfaces. Skills provide workflow orchestration; existing MCP, SDK, REST, and
  IaC surfaces perform the operations.
- Prefer an available typed SDK for deterministic setup; use REST for complete or
  newly introduced data-plane operations not yet covered by that SDK.
- Use Azure MCP Server only for its advertised read-only discovery and query
  tools. Do not attempt indexing, permission changes, or network mutation through
  it.
- Use the native knowledge-base MCP endpoint for agent retrieval. For SSE, send
  `Accept: text/event-stream`.
- Use CLI, PowerShell, or IaC for control-plane automation, not normal document
  querying.
- Separate control-plane and data-plane authorization, audiences, and failure
  diagnosis. Never retrieve or expose service keys.

Add a thin MCP adapter only when an agent host cannot call the required supported
interface directly and the adapter provides a stable, reusable tool contract. It
must remain stateless, preserve caller identity and service errors, expose
idempotent operations at workflow-relevant granularity, and add no credential
broker, hidden defaults, or parallel resource model. Do not use an adapter merely
to wrap every REST operation one-for-one.

## Authoritative references

- [Azure AI Search overview](https://learn.microsoft.com/azure/search/search-what-is-azure-search)
- [API and SDK matrix](https://learn.microsoft.com/azure/search/search-api-versions)
- [REST reference](https://learn.microsoft.com/rest/api/searchservice/)
- [Azure AI Search MCP tools](https://learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-ai-search)
- [Agentic retrieval overview](https://learn.microsoft.com/azure/search/agentic-retrieval-overview)
