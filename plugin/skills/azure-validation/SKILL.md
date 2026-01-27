---
name: azure-validation
description: Pre-deployment validation for Azure resources including naming constraints, Bicep validation, subscription filtering, and quota checks. Ensures deployments succeed by catching naming errors, character limits, and configuration issues before they fail mid-deployment.
---

# Pre-Deployment Validation

> **VALIDATE BEFORE DEPLOYING** - Catch naming errors, quota limits, and Bicep issues BEFORE they fail mid-deployment.

## Azure Resource Naming Constraints

**CRITICAL: Many Azure resources have strict naming rules. Validate names BEFORE generating any code or running any commands.**

### Common Naming Limits

| Resource | Min | Max | Allowed Characters | Global Unique |
|----------|-----|-----|-------------------|---------------|
| **Storage Account** | 3 | **24** | lowercase letters, numbers only | Yes |
| **Container Registry** | 5 | 50 | alphanumerics only | Yes |
| **Key Vault** | 3 | **24** | alphanumerics, hyphens | Yes |
| **Container App** | 2 | 32 | lowercase letters, numbers, hyphens | No |
| **App Service** | 2 | 60 | alphanumerics, hyphens | Yes (for *.azurewebsites.net) |
| **Function App** | 2 | 60 | alphanumerics, hyphens | Yes |
| **Resource Group** | 1 | 90 | alphanumerics, hyphens, underscores, periods | No |
| **Cosmos DB Account** | 3 | 44 | lowercase letters, numbers, hyphens | Yes |

### The 24-Character Problem

**Storage Accounts and Key Vaults are limited to 24 characters.** This is the most common naming failure.

**Bad examples:**
- `mycompanyproductionstore` (25 chars) - FAILS
- `dev-my-application-storage` (26 chars) - FAILS
- `my-key-vault-production` (23 chars but has hyphens) - FAILS for storage

**Good examples:**
- `mycompprodstore` (15 chars) - OK
- `devmyappstor` (12 chars) - OK
- `prodkeyvault01` (14 chars) - OK

### Naming Validation Checklist

Before generating resource names:

1. **Count characters** - Storage/KeyVault must be <=24 chars
2. **Check allowed characters**:
   - Storage: lowercase + numbers ONLY (no hyphens!)
   - KeyVault: lowercase + numbers + hyphens
   - ACR: alphanumerics only (no hyphens!)
3. **Check global uniqueness** - Storage, ACR, KeyVault names must be globally unique
4. **Use abbreviations** for long names:
   - `prod` not `production`
   - `stor` not `storage`
   - `kv` not `keyvault`
   - `acr` not `containerregistry`

### Use MCP Tools for Validation

**Before creating Bicep/Terraform, get the schema to understand constraints:**

```
Use azure__bicepschema_get with resource-type: "Microsoft.Storage/storageAccounts"
```

This returns the full schema including naming constraints.

## Bicep Validation

**ALWAYS use the Azure MCP deployment tools to validate Bicep before deploying.**

### Get IaC Rules Before Writing Bicep

```
Use azure__deploy_iac_rules_get with:
  deployment-tool: "AZD"
  iac-type: "bicep"
  resource-types: "containerapp,storage"
```

This returns best practices and rules for writing correct Bicep.

### Get Schema for Specific Resources

```
Use azure__bicepschema_get with:
  resource-type: "Microsoft.App/containerApps"
```

This returns the complete Bicep schema so you know all required/optional properties.

### Generate a Deployment Plan

Before writing any infrastructure code, generate a plan:

```
Use azure__deploy_plan_get with:
  workspace-folder: "/path/to/project"
  project-name: "myapp"
  target-app-service: "ContainerApp"
  provisioning-tool: "AZD"
  azd-iac-options: "bicep"
```

This generates a complete deployment plan with recommended services.

## Subscription & Resource Filtering

**CRITICAL: Never dump entire subscription or resource lists into context - this can overflow (140K+ characters).**

### Filtering Subscriptions

```bash
# GOOD - Clean, limited output
az account list --query "[].{Name:name, ID:id}" -o table

# BAD - Can produce massive output
az account list   # Full JSON with all metadata
```

### Filtering Resources

```bash
# GOOD - Filter and limit
az resource list --resource-group RG --query "[].{Name:name, Type:type}" -o table

# GOOD - Filter by type
az containerapp list -g RG --query "[].{Name:name, FQDN:properties.configuration.ingress.fqdn}" -o table

# BAD - Everything
az resource list   # Can be 100K+ chars
```

### MCP Tool Best Practices

When using MCP tools that list resources:

1. **Always specify resource group** when possible
2. **Use query parameters** to filter results
3. **Paginate** if the tool supports it
4. **Summarize** results instead of showing raw output

### Common Filters

```bash
# Only show names and essential info
--query "[].{Name:name, Location:location, Status:properties.provisioningState}"

# Limit results
--query "[:10]"  # First 10 only

# Filter by condition
--query "[?properties.provisioningState=='Succeeded']"
```

## Pre-flight Command

Run `/azure:preflight` before any deployment to check:
- Tools installed (az, azd, docker)
- Authentication valid
- Quota availability
- Docker running

## Quick Validation Flow

1. **Name check** - Validate all resource names against limits above
2. **Get IaC rules** - `azure__deploy_iac_rules_get` for best practices
3. **Get schemas** - `azure__bicepschema_get` for specific resources
4. **Generate plan** - `azure__deploy_plan_get` for full deployment plan
5. **Run preflight** - `/azure:preflight` for tool/auth checks
6. **Deploy** - `azd up`
