---
name: azure-deploy
description: Deploy applications to Azure using Azure Developer CLI (azd). USE THIS SKILL when users want to deploy, publish, host, or run their application on Azure. Trigger phrases include "deploy to Azure", "host on Azure", "publish to Azure", "run on Azure", "deploy my app", "azd up", etc.
---

# Azure Deployment Skill

Deploy applications to Azure using Azure Developer CLI (azd).

---

## Execution Flow

### Step 1: Check for azure.yaml

Check if `azure.yaml` exists in the project root.

**If `azure.yaml` does NOT exist:**
- Inform user: "No azure.yaml found. Use the azure-create-app skill to prepare your application for Azure deployment."
- Stop execution

**If `azure.yaml` exists:**
- Proceed to Step 2

### Step 2: Check Environment

Run:
```bash
azd env list
```

**If no environment exists:**
- Ask the user: "What name would you like for your Azure environment? (e.g., dev, staging, prod)"
- Create the environment with the user-provided name:
```bash
azd env new <user-provided-name>
```

**If environment exists:**
- Proceed to Step 3

### Step 3: Check Subscription Configuration

First, check for global defaults:
```bash
azd config get defaults
```

This may return defaults like:
```json
{
  "subscription": "<subscription-id>",
  "location": "<location>"
}
```

Store these default values if present.

Next, check environment-specific values:
```bash
azd env get-values
```

Check if `AZURE_SUBSCRIPTION_ID` is set in the output.

**If `AZURE_SUBSCRIPTION_ID` is NOT set:**

1. Call the `azure__subscription_list` MCP tool to get available subscriptions:
```json
{
  "command": "subscription_list",
  "parameters": {}
}
```

2. Present the list of subscriptions to the user. If a default subscription was found in `azd config get defaults`, include it in the prompt:
   - With default: "Which Azure subscription would you like to use? (default from azd config: `<default-subscription-id>`)"
   - Without default: "Which Azure subscription would you like to use for this deployment?"

3. Set the subscription with the user-selected value (or use default if user accepts):
```bash
azd env set AZURE_SUBSCRIPTION_ID <selected-subscription-id>
```

**If `AZURE_SUBSCRIPTION_ID` is set:**
- Proceed to Step 4

### Step 4: Check Location Configuration

Check if `AZURE_LOCATION` is set in the `azd env get-values` output from Step 3.

**If `AZURE_LOCATION` is NOT set:**

1. Get the list of available Azure regions:
```bash
az account list-locations --query "[].{name:name, displayName:displayName}" --output table
```

2. Present the list of available regions to the user. If a default location was found in `azd config get defaults`, include it in the prompt:
   - With default: "Which Azure region would you like to deploy to? (default from azd config: `<default-location>`)"
   - Without default: "Which Azure region would you like to deploy to?"

3. Set the location with the user-selected value:
```bash
azd env set AZURE_LOCATION <selected-location>
```

**If `AZURE_LOCATION` is set:**
- Proceed to Step 5

### Step 5: Deploy

Execute:
```bash
azd up --no-prompt
```

The `--no-prompt` flag is required to prevent interactive prompts from blocking execution.

This command provisions all Azure resources defined in `infra/` and deploys the application code.

**Alternative:** To provision and deploy separately:
```bash
azd provision --no-prompt   # Create Azure resources
azd deploy --no-prompt      # Deploy application code
```

**To preview changes before deployment:**
```bash
azd provision --preview
```

### Step 6: Handle Errors

If `azd up` fails, call the `azure__azd` MCP tool:
```json
{
  "command": "error_troubleshooting",
  "parameters": {}
}
```

Common error resolutions:
- "Not authenticated" → Run `azd auth login`
- "Environment not found" → Run `azd env new <name>`
- "azure.yaml invalid" → Use azure-create-app skill to regenerate
- "Bicep compilation error" → Check module paths and parameters
- "Provision failed" → Check resource quotas and permissions
- "Package failed" → Verify Dockerfile and build configuration

---

## Troubleshooting

See [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) for detailed troubleshooting guidance.

---

## Environment Management

```bash
azd env new <name>              # Create environment
azd env select <name>           # Switch environment
azd env set AZURE_LOCATION eastus   # Set variable
azd env list                    # List environments
```

---

## Post-Deployment Commands

```bash
azd monitor --logs      # View logs
azd monitor --overview  # Open Azure Portal
```

**Cleanup (DESTRUCTIVE):**
```bash
azd down --force --purge
```

WARNING: `azd down` permanently deletes ALL resources including databases with data, storage accounts with files, and Key Vaults with secrets.
