# AZCLI Validation

Validation steps for Azure CLI deployments.

## Prerequisites

- `./infra/main.bicep` exists
- Docker available (if containerized)

## Validation Steps

### 1. Azure CLI Installation

Verify Azure CLI is installed:

```bash
az version
```

**If not installed:**
```
mcp_azure_mcp_extension_cli_install(cli-type: "az")
```

### 2. Authentication

```bash
az account show
```

**If not logged in:**
```bash
az login
```

**Set subscription:**
```bash
az account set --subscription <subscription-id>
```

### 3. Bicep Compilation

```bash
az bicep build --file ./infra/main.bicep
```

### 4. Template Validation

```bash
# Subscription scope
az deployment sub validate \
  --location <location> \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json

# Resource group scope
az deployment group validate \
  --resource-group <rg-name> \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

### 5. What-If Preview

```bash
# Subscription scope
az deployment sub what-if \
  --location <location> \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json

# Resource group scope
az deployment group what-if \
  --resource-group <rg-name> \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

### 6. Docker Build (if containerized)

```bash
docker build -t <image>:test ./src/<service>
```

### 7. Azure Policy Validation

Retrieve and validate Azure policies for the subscription:

**Get subscription ID:**
```bash
az account show --query id -o tsv
```

**Validate policies:**
```
mcp_azure_mcp_policy(command: "list", parameters: { subscription_id: "<subscription-id>" })
```

**Review policy compliance:**
- Check for any policy violations or non-compliant resources
- Ensure deployment will comply with organizational policies
- Address any policy conflicts before proceeding to deployment

## References

- [Error handling](mdc:errors.md)

## Next

All checks pass → **azure-deploy**
