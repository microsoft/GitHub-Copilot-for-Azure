# AZD Validation

Validation steps for Azure Developer CLI projects.

## Prerequisites

- `azure.yaml` exists in project root
- `./infra/` contains Bicep files

## Validation Steps

### 1. AZD Installation

Verify AZD is installed:

```bash
azd version
```

**If not installed:**
```
mcp_azure_mcp_extension_cli_install(cli-type: "azd")
```

### 2. Schema Validation

Validate azure.yaml against official schema:

```
mcp_azure_mcp_azd(command: "validate_azure_yaml", parameters: { path: "./azure.yaml" })
```

### 3. Environment Check

Check if environment exists:

```bash
azd env list
```

**If environment exists**, get current values:
```bash
azd env get-values
```

**If no environment**, create one:
```bash
azd env new <environment-name>
```

### 4. Authentication Check

```bash
azd auth login --check-status
```

**If not logged in:**
```bash
azd auth login
```

### 5. Subscription/Location Check

Check environment values:
```bash
azd env get-values
```

**If AZURE_SUBSCRIPTION_ID or AZURE_LOCATION not set:**
- Use `mcp_azure_mcp_subscription_list` to list subscriptions
- Prompt user to confirm subscription and location before continuing

**Popular locations:** `eastus`, `eastus2`, `westus2`, `westus3`, `centralus`, `westeurope`, `northeurope`, `uksouth`, `australiaeast`, `southeastasia`

```bash
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
azd env set AZURE_LOCATION <location>
```

### 6. Provision Preview

Validate IaC is ready:

```bash
azd provision --preview --no-prompt
```

### 7. Package Validation

Confirm all services build/package successfully:

```bash
azd package --no-prompt
```

### 8. Azure Policy Validation

Retrieve and validate Azure policies for the subscription:

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
