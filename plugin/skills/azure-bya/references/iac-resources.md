# IaC Resources — Official Documentation & Tools

Look up when stuck after 3 tries, edge cases, or validating generated code against ground truth.

## Bicep

| Resource | URL | Use When |
|----------|-----|----------|
| Bicep Documentation | https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/ | Syntax, file structure, deployment scopes, install |
| Bicep Best Practices | https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/best-practices | Naming, parameters, resource definitions, modules |
| Azure Resource Reference | https://learn.microsoft.com/en-us/azure/templates/ | Resource properties, API versions, schema per type |
| Bicep GitHub Repo | https://github.com/Azure/bicep | Release notes, roadmap, issue tracking, CLI reference |
| Bicep Registry Modules | https://github.com/Azure/bicep-registry-modules | Microsoft-maintained reusable Bicep modules |

## Terraform

| Resource | URL | Use When |
|----------|-----|----------|
| HashiCorp Developer Docs | https://developer.hashicorp.com/terraform | HCL syntax, provider config, built-in functions |
| Terraform Registry — azurerm | https://registry.terraform.io/providers/hashicorp/azurerm/latest | Resource type properties, argument reference, import blocks |
| Terraform Registry — azapi | https://registry.terraform.io/providers/azure/azapi/latest | Bleeding-edge resources not yet in azurerm; maps to ARM REST APIs |
| HCL Language Reference | https://developer.hashicorp.com/terraform/language | Expressions, modules, state management, backends |
| Azure Resource Reference | https://learn.microsoft.com/en-us/azure/templates/ | Side-by-side Bicep + ARM + Terraform AzAPI schema per resource type |

**Key providers:** `hashicorp/azurerm` (standard), `azure/azapi` (ARM-direct for preview resources)

## Pre-Validated Module Libraries

| Resource | URL | Use When |
|----------|-----|----------|
| Azure Verified Modules (AVM) | https://aka.ms/AVM | Production-ready Bicep + Terraform modules; Microsoft-endorsed |
| AVM Bicep Index | https://azure.github.io/Azure-Verified-Modules/indexes/bicep/ | Browse available Bicep resource/pattern modules |
| AVM Terraform Index | https://azure.github.io/Azure-Verified-Modules/indexes/terraform/ | Browse available Terraform resource/pattern modules |

## Security & Architecture

| Resource | URL | Use When |
|----------|-----|----------|
| Azure Well-Architected Framework | https://learn.microsoft.com/en-us/azure/well-architected/ | WAF pillar alignment (Reliability, Security, Cost, Ops, Performance) |
| WAF Service Guides | https://learn.microsoft.com/en-us/azure/well-architected/service-guides/ | Per-service WAF checklists |
| Azure Security Baseline (MCSB) | https://learn.microsoft.com/en-us/security/benchmark/azure/overview | Security control domains, MCSB recommendations |

## Validation & Quality Tools

| Tool | Purpose | Format |
|------|---------|--------|
| `terraform validate` | Syntax + schema validation (catches unknown resources/attributes) | Terraform |
| `terraform plan` | Provider-level dry run (catches SKU, region, auth errors) | Terraform |
| `bicep build` | Syntax + schema validation (catches invalid API versions, types) | Bicep |
| `az deployment group create --what-if` | ARM-level dry run with change preview | Bicep |
| PSRule for Azure | Static analysis + policy compliance for Bicep | Bicep |
| TFLint | Catches deprecated syntax, naming violations | Terraform |
| Checkov | Security misconfiguration scanner | Both |

> **Source:** All URLs validated 2026-04-25. All are official (Microsoft Learn, HashiCorp Developer, GitHub/Azure).
