---
name: azure-iac-generator
description: "Generate deployment-ready Bicep templates from existing Azure environments or Draw.io architecture diagrams. Reverse-engineer live infrastructure into Infrastructure as Code. WHEN: generate bicep, azure to bicep, generate bicep from azure, bicep from diagram, diagram to bicep, create bicep templates from resources, export infrastructure as code, generate infrastructure code, reverse engineer azure, generate iac from azure. DO NOT USE FOR: creating new applications for Azure (use azure-prepare), deploying existing Bicep (use azure-validate then azure-deploy), comparing Bicep against live Azure (use azure-infrastructure-sync)."
license: MIT
metadata:
  author: Microsoft
  version: "1.0.1"
---

# Azure IaC Generator

Reverse-engineer live Azure resources or Draw.io diagrams into deployment-ready, modular Bicep. The goal is an **environment-identical** redeployment for supported configurations. When Azure uses an end-of-life runtime, preserve the extracted value in comments and default to the current supported upgrade path.

## Prerequisites

- Authenticated Azure CLI session (`az login`)
- Azure MCP and Bicep MCP servers available
- For diagram source: a `.drawio` file in the workspace

## When to Use This Skill

- Generate Bicep from existing Azure resources or resource groups
- Reverse-engineer live infrastructure into Infrastructure as Code
- Convert Draw.io architecture diagrams to Bicep templates
- Export Azure infrastructure as code

## Quick Reference

| Property | Value |
|---|---|
| **MCP tools** | Azure MCP (`group_resource_list`, `appservice`, `compute`, `storage`, `keyvault`), Bicep MCP (`get_bicep_best_practices`, `get_az_resource_type_schema`) |
| **CLI fallback** | `az resource show --ids <id>`, `az webapp show`, `az webapp config appsettings list` |
| **Output** | Project folder with `main.bicep`, `.bicepparam`, `modules/`, `dependencies/`, `README.md` |

## Design Notes

Named `azure-iac-generator` rather than `azure-bicep-generator` to accommodate future IaC tooling such as Terraform. Bicep is the only supported target today; Terraform support is reserved for a future iteration.

## Routing — MUST follow the matched workflow

```
User request
├── Live Azure ("resource group", "subscription", "reverse engineer")
│   └─► FOLLOW [azure-to-bicep-workflow.md](references/azure-to-bicep-workflow.md) — ALL steps are HARD GATES
│
└── Draw.io diagram ("from diagram", ".drawio")
    └─► FOLLOW [diagram-to-bicep-workflow.md](references/diagram-to-bicep-workflow.md)
```

## Mandatory References — MUST read before generating any Bicep

- [bicep-best-practices.md](references/bicep-best-practices.md) — Generation rules
- [azure-resource-configs.md](references/azure-resource-configs.md) — Per-type property extraction
- [azure-deployment-verification.md](references/azure-deployment-verification.md) — Pre-deployment checks
- [version-currency.md](references/version-currency.md) — API + runtime version rules
- [bicep-parsing.md](references/procedures/bicep-parsing.md) — Parse existing Bicep and `.bicepparam` files when merging with generated output

## Output Structure — MUST create this folder layout

```
<scope-name>/
├── README.md                  # Original request, resource summary, verification, deploy commands
├── main.bicep                 # Orchestrator — module refs only, no inline resources
├── main.bicepparam            # All param values with comments (alternatives, EOL dates)
├── modules/                   # One file per resource category (only if resources exist)
│   ├── networking.bicep       # VNets, subnets, NSGs, private endpoints
│   ├── compute.bicep          # VMs, App Services, Functions, Container Apps
│   ├── data.bicep             # SQL, Cosmos DB, Storage, Redis
│   ├── identity.bicep         # Managed identities, role assignments
│   └── monitoring.bicep       # App Insights, Log Analytics
└── dependencies/              # Out-of-scope external dependencies (if any)
    └── README.md              # What each dependency needs and who owns it
```

> ⚠️ **NEVER generate a single flat `main.bicep` with all resources inline.** Resources MUST be in `modules/`.

## Error Handling

| Error | Remediation |
|---|---|
| Not authenticated | Run `az login` — see [azure-authentication.md](references/procedures/azure-authentication.md) |
| Resource type unsupported | Placeholder with `// TODO:` and resource ID |
| Secrets detected | `@secure()` param + `readEnvironmentVariable()` in `.bicepparam` |
| API version missing | Latest stable from Bicep MCP or Microsoft docs |
