# Azure/aks-mcp Server Reference

Use this reference when the user wants the AKS troubleshooting skill to rely on the public [Azure/aks-mcp](https://github.com/Azure/aks-mcp) server or when the current client is missing AKS-aware MCP tools.

## Quick Reference

| Property | Value |
|----------|-------|
| Source repo | `Azure/aks-mcp` |
| Best for | AKS-aware Azure operations, kubectl mediation, detectors, fleet, networking, compute, and observability |
| Default transport | `stdio` |
| Access levels | `readonly` (default), `readwrite`, `admin` |
| Tool styles | Unified `call_az` / `call_kubectl`, or legacy specialized tools when `USE_LEGACY_TOOLS=true` |

## When to Use

- The client does not already expose AKS-aware MCP tools
- The user wants a dedicated AKS MCP server wired into their client
- Troubleshooting needs kubectl mediation, detector tools, or Inspektor Gadget
- The user needs cluster, node pool, network, compute, or fleet context from one AKS-focused server

## Installation Paths

| Path | When to prefer | Notes |
|------|----------------|-------|
| VS Code AKS extension | Recommended for local development | Run **AKS: Setup AKS MCP Server** after installing the Azure Kubernetes Service extension |
| Manual binary | Custom clients or local debugging | Build or download `aks-mcp`, then configure it as an MCP stdio server |
| In-cluster / remote MCP | Shared team environments | Use the Helm chart or workload identity deployment guidance from the `Azure/aks-mcp` repo |

## Authentication Order

Azure/aks-mcp uses Azure CLI authentication with this precedence:

1. Service principal via `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
2. Workload identity via `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE`
3. User-assigned managed identity via `AZURE_CLIENT_ID`
4. System-assigned managed identity via `AZURE_MANAGED_IDENTITY=system`
5. Existing `az login` session

If `AZURE_SUBSCRIPTION_ID` is set, the server selects that subscription after login.

## Configuration Knobs

| Setting | Purpose | Recommended default |
|---------|---------|---------------------|
| `--access-level` | Controls whether the server can run read-only, read-write, or admin operations | Start with `readonly`; raise only when debug pods or mutations are required |
| `--allow-namespaces` | Restricts kubectl access to specific namespaces | Scope to the smallest set needed for the issue |
| `--enabled-components` | Limits enabled areas such as `kubectl`, `monitor`, `network`, `compute`, `detectors`, `fleet`, `advisor`, `inspektorgadget` | Enable only the components required for the scenario |
| `USE_LEGACY_TOOLS=true` | Switches from unified tools to specialized legacy tools | Leave unset unless the client expects legacy tool names |

> ⚠️ **Warning:** Some troubleshooting flows need `readwrite` or `admin` access to launch debug pods. Ask for confirmation before recommending elevated access.

## Client Mapping Notes

- In some clients, Azure/aks-mcp exposes unified tools such as `call_az` and `call_kubectl`.
- In this repo's AKS-oriented integrations, similar capabilities can surface as mapped tools such as `mcp_azure_mcp_aks`, `mcp_aks_mcp_az_aks_operations`, kubectl helpers, detector tools, or Inspektor Gadget operations.
- If the user already has working AKS MCP tools in the client, use those mapped names rather than insisting on a raw `call_az` / `call_kubectl` interface.

## Minimal Configuration Shape

```json
{
  "servers": {
    "aks-mcp": {
      "type": "stdio",
      "command": "<aks-mcp-command>",
      "args": [
        "--transport",
        "stdio",
        "--access-level",
        "readonly"
      ]
    }
  }
}
```

For WSL-aware client setup, follow the Windows host versus Remote-WSL guidance in the `Azure/aks-mcp` README.
