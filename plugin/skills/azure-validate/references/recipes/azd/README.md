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

Use Azure MCP tools to list subscriptions:
```
mcp_azure_mcp_subscription_list
```

Use Azure MCP tools to list resource groups (check for conflicts):
```
mcp_azure_mcp_group_list
  subscription: <subscription-id>
```

Prompt user to confirm subscription and location before continuing.

Refer to the region availability reference to select a region supported by all services in this template:
- [Region availability](../../../azure-prepare/references/region-availability.md)

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

## References

- [Error handling](mdc:errors.md)

## Next

All checks pass → **azure-deploy**
