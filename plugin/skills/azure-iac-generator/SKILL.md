---
name: azure-iac-generator
description: "Generate deployment-ready Bicep templates from existing Azure environments or Draw.io architecture diagrams. Reverse-engineer live infrastructure into Infrastructure as Code. WHEN: generate bicep, azure to bicep, generate bicep from azure, bicep from diagram, diagram to bicep, create bicep templates from resources, export infrastructure as code, generate infrastructure code, reverse engineer azure, generate iac from azure. DO NOT USE FOR: creating new applications for Azure (use azure-prepare), deploying existing Bicep (use azure-validate then azure-deploy), comparing Bicep against live Azure (use azure-infrastructure-sync)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.0"
---

# Azure IaC Generator

Generate deployment-ready Bicep templates from an existing Azure environment or a Draw.io architecture diagram. Produces `main.bicep`, `.bicepparam`, and modular `modules/` following Azure best practices.

## Prerequisites

| Prerequisite | Required? | Purpose |
|---|---|---|
| Azure CLI (`az`) + active session | **Required** | Azure resource discovery (Azure source) |
| Draw.io VS Code extension | Optional | Preview diagram input (Diagram source) |

## When to Use This Skill

- Generate Bicep from an existing Azure resource group or subscription
- Convert a Draw.io architecture diagram to Bicep templates
- Reverse-engineer deployed infrastructure into Infrastructure as Code
- Export Azure resources as deployment-ready Bicep

## Routing

```
User request
├── Source is live Azure ("from my azure", "from resource group", "reverse engineer")
│   └─► Azure-to-Bicep path → [azure-to-bicep-workflow.md]
│
└── Source is a Draw.io diagram ("from diagram", "diagram to bicep", ".drawio file")
    └─► Diagram-to-Bicep path → [diagram-to-bicep-workflow.md]
```

## Workflow References

- **From live Azure resources**: [azure-to-bicep-workflow.md](references/azure-to-bicep-workflow.md) — Discovers resources, extracts deep properties, strips read-only ARM fields, detects secrets, generates modular Bicep with dependencies.
- **From Draw.io diagrams**: [diagram-to-bicep-workflow.md](references/diagram-to-bicep-workflow.md) — Parses diagram XML into a resource model, enriches with configuration from resource configs, generates Bicep with deployment verification.

Both workflows reference:
- [bicep-best-practices.md](references/bicep-best-practices.md) — Mandatory Bicep generation rules
- [azure-deployment-verification.md](references/azure-deployment-verification.md) — Pre-deployment verification checks
- [azure-resource-model.md](references/azure-resource-model.md) — Canonical resource model schema
- [version-currency.md](references/version-currency.md) — Version currency rules for API versions and runtimes

## Output Structure

```
<project>/
├── main.bicep              # Orchestrator with module references
├── main.bicepparam         # All parameter values with comments
├── modules/
│   ├── networking.bicep    # VNets, subnets, NSGs, private endpoints
│   ├── compute.bicep       # VMs, App Services, Functions
│   ├── data.bicep          # SQL, Cosmos DB, Storage
│   ├── identity.bicep      # Managed identities, role assignments
│   └── monitoring.bicep    # App Insights, Log Analytics
└── dependencies/           # Out-of-scope external dependencies (if any)
```

## Error Handling

| Error | Cause | Remediation |
|---|---|---|
| Not authenticated | No Azure session | Run `az login` — see [azure-authentication.md](references/procedures/azure-authentication.md) |
| Resource type not supported | Exotic or preview resource | Generate a placeholder with `// TODO:` comment and resource ID |
| Secrets detected | Connection strings or keys in properties | Use `@secure()` param with `readEnvironmentVariable()` in `.bicepparam` |
| Diagram has no Azure resources | Non-Azure or empty diagram | Verify diagram uses Azure stencils from the azure2 library |
| API version not found | Resource type missing from Bicep MCP | Use latest stable version from Microsoft docs |
