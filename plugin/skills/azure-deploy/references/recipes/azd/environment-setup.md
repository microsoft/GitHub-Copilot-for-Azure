# Environment Setup

Ensure AZD environment exists and is configured before deployment.

## Check for Existing Environment

```bash
azd env list
```

If no environments exist, or user wants a new one → create environment.

## Create Environment

Prompt user for environment name:

```bash
azd env new <environment-name>
```

Common names: `dev`, `staging`, `prod`, `test`

## Check User Defaults

Check if user has default subscription/location configured:

```bash
azd config get defaults
```

If defaults are set, this returns:
```json
{
  "defaults": {
    "location": "eastus",
    "subscription": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

**If defaults exist**: Confirm with user before using, or skip to verification.

**If no defaults**: Proceed to select subscription and location.

## Select Azure Subscription

Use the Azure MCP tool to list available subscriptions:

```
mcp_azure_mcp_subscription_list()
```

This returns subscriptions with: `subscriptionId`, `displayName`, `state`, `tenantId`, `isDefault`.

Set the subscription:

```bash
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
```

## Select Azure Location

Common locations:

| Location | Region |
|----------|--------|
| `eastus` | East US |
| `eastus2` | East US 2 |
| `westus2` | West US 2 |
| `westus3` | West US 3 |
| `centralus` | Central US |
| `westeurope` | West Europe |
| `northeurope` | North Europe |
| `uksouth` | UK South |
| `southeastasia` | Southeast Asia |
| `australiaeast` | Australia East |

Set the location:

```bash
azd env set AZURE_LOCATION <location>
```

## Verify Configuration

```bash
azd env get-values
```

Expected output:
```
AZURE_ENV_NAME="dev"
AZURE_LOCATION="eastus"
AZURE_SUBSCRIPTION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_subscription_list` | List available Azure subscriptions |
| `mcp_azure_mcp_group_list` | List resource groups in a subscription |

## Required Values

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_ENV_NAME` | ✅ | Environment name (set automatically) |
| `AZURE_LOCATION` | ✅ | Azure region for deployment |
| `AZURE_SUBSCRIPTION_ID` | ✅ | Target Azure subscription |

All three must be set before proceeding to deployment.
