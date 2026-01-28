---
name: azure-cli
description: Provides guidance on the Azure CLI tools (az, azd, func) with command reference and advanced patterns. Use this when asked about installing, configuring, or using az, azd, or func.
---

# Azure CLI Tools

## Installation

### Auto-Installation Flow

When a CLI tool is missing, follow this sequence:

#### 1. Detect Missing Tool

Check for these error patterns:
- `'az' is not recognized` or `az: command not found`
- `'azd' is not recognized` or `azd: command not found`
- `'func' is not recognized` or `func: command not found`
- `'docker' is not recognized` or `docker: command not found`

#### 2. Offer One-Click Install

**Use AskUserQuestion to offer installation:**

"I detected that [TOOL] is not installed. Would you like me to install it now?"
- Yes, install it
- No, I'll install it manually

#### 3. Run Installation Command

Use the Azure MCP tools to obtain platform-specific installation instructions appropriate for the user's system:

```
Tool: azure__extension_cli_install
Parameters:
  - cli-type: "az" | "azd" | "func"
```

**Example:**
```
Use azure__extension_cli_install with cli-type: "azd"
```

Then follow the instructions to perform the installation.

#### 4. Verify Installation

```bash
# After installation, verify:
az version
azd version
func --version
docker version
```

#### 5. Handle PATH Issues

If command still not found after install:

**Windows:**
- Restart terminal
- Or run: `refreshenv` (if using Chocolatey)
- Or start new PowerShell/CMD window

**macOS/Linux:**
- Run: `source ~/.bashrc` or `source ~/.zshrc`
- Or start new terminal session

### Tool Priority

For Azure deployments, install in this order:

| Priority | Tool | Required For |
|----------|------|--------------|
| 1 | `azd` | Application deployments (ALWAYS use this) |
| 2 | `az` | Resource queries, manual operations |
| 3 | `docker` | Container builds, local testing |
| 4 | `func` | Local Functions development |

### Quick Check Script

Run this to check all tools at once:

```bash
# Bash version
echo "=== Azure Tools Check ==="
echo -n "az: " && (az version --query '"azure-cli"' -o tsv 2>/dev/null || echo "NOT INSTALLED")
echo -n "azd: " && (azd version 2>/dev/null || echo "NOT INSTALLED")
echo -n "docker: " && (docker version --format '{{.Server.Version}}' 2>/dev/null || echo "NOT INSTALLED")
echo -n "func: " && (func --version 2>/dev/null || echo "NOT INSTALLED")
```

```powershell
# PowerShell version
Write-Host "=== Azure Tools Check ==="
Write-Host -NoNewline "az: "; try { az version --query '"azure-cli"' -o tsv 2>$null } catch { Write-Host "NOT INSTALLED" }
Write-Host -NoNewline "azd: "; try { azd version 2>$null } catch { Write-Host "NOT INSTALLED" }
Write-Host -NoNewline "docker: "; try { docker version --format '{{.Server.Version}}' 2>$null } catch { Write-Host "NOT INSTALLED" }
Write-Host -NoNewline "func: "; try { func --version 2>$null } catch { Write-Host "NOT INSTALLED" }
```

### Authentication After Installation

#### Azure CLI (az)

```bash
# Interactive (opens browser)
az login

# Device code (headless/remote) - use if browser login fails
az login --use-device-code

# Service principal (CI/CD)
az login --service-principal -u APP_ID -p SECRET --tenant TENANT_ID
```

#### Azure Developer CLI (azd)

```bash
# Uses Azure CLI credentials by default
# Or explicitly:
azd auth login

# Check authentication status
azd auth login --check-status
```

> ⚠️ **For automation/CI-CD**: Always use `--no-prompt` with azd commands to avoid interactive prompts blocking execution.

**Tip:** If device code auth times out repeatedly, run `az login` in a separate terminal window where you can interact with it directly.

### Common Installation Issues

| Issue | Solution |
|-------|----------|
| winget not found | Install App Installer from Microsoft Store |
| brew not found | Install Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Permission denied | Run as Administrator (Windows) or use sudo (Linux) |
| Old version installed | Run `az upgrade` or `brew upgrade azure-cli` |
| PATH not updated | Restart terminal or source shell config |

### Bulk Install (All Tools)

**Windows:**
```powershell
winget install Microsoft.AzureCLI Microsoft.Azd Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
```

**macOS:**
```bash
brew install azure-cli && brew install azd && brew install --cask docker
```

> 💡 **Note**: `brew install azd` works directly without needing `brew tap azure/azd` in recent Homebrew versions.

---

## Command Cheatsheet

### Authentication

```bash
# Interactive login
az login

# Device code flow (headless)
az login --use-device-code

# Service principal
az login --service-principal -u APP_ID -p PASSWORD --tenant TENANT_ID

# Check current account
az account show

# List subscriptions
az account list --output table

# Set subscription
az account set --subscription "Subscription Name"
```

### Resource Management

```bash
# List resource groups
az group list --output table

# Create resource group
az group create --name RG --location eastus

# List resources in group
az resource list -g RG --output table

# Delete resource group
az group delete --name RG --yes
```

### Storage

```bash
# List storage accounts
az storage account list --output table

# List containers
az storage container list --account-name ACCOUNT --output table

# List blobs
az storage blob list --account-name ACCOUNT --container-name CONTAINER --output table

# Upload blob
az storage blob upload --account-name ACCOUNT --container-name CONTAINER --name BLOB --file FILE

# Download blob
az storage blob download --account-name ACCOUNT --container-name CONTAINER --name BLOB --file FILE
```

### SQL Database

```bash
# List SQL servers
az sql server list --output table

# List databases
az sql db list --server SERVER -g RG --output table

# Create firewall rule
az sql server firewall-rule create --server SERVER -g RG --name RULE --start-ip-address IP --end-ip-address IP
```

### Key Vault

```bash
# List vaults
az keyvault list --output table

# List secrets
az keyvault secret list --vault-name VAULT --output table

# Get secret
az keyvault secret show --vault-name VAULT --name SECRET

# Set secret
az keyvault secret set --vault-name VAULT --name SECRET --value VALUE
```

### App Service

```bash
# List web apps
az webapp list --output table

# Get app details
az webapp show --name APP -g RG

# Deploy ZIP
az webapp deploy --name APP -g RG --src-path app.zip --type zip

# View logs
az webapp log tail --name APP -g RG
```

### Functions

```bash
# List function apps
az functionapp list --output table

# Get app settings
az functionapp config appsettings list --name APP -g RG

# Set app settings
az functionapp config appsettings set --name APP -g RG --settings KEY=VALUE
```

### Container Apps

```bash
# List container apps
az containerapp list --output table

# Deploy
az containerapp up --name APP -g RG --image IMAGE --ingress external --target-port 8080

# View logs
az containerapp logs show --name APP -g RG --follow
```

### AKS

```bash
# List clusters
az aks list --output table

# Get credentials
az aks get-credentials --name CLUSTER -g RG

# Scale node pool
az aks nodepool scale --cluster-name CLUSTER -g RG --name POOL --node-count 5
```

### Azure Developer CLI (azd)

```bash
# Initialize project
azd init --template TEMPLATE

# Provision and deploy
azd up

# For automation/agent scenarios - use --no-prompt
azd up --no-prompt
azd provision --no-prompt
azd deploy --no-prompt

# Preview changes before deployment
azd provision --preview

# Deploy code only
azd deploy --no-prompt

# Tear down resources
azd down

# View deployed resources
azd show
```

> ⚠️ **CRITICAL: `azd down` Data Loss Warning**
>
> `azd down` **permanently deletes ALL resources** in the environment, including:
> - **Databases** with all data (Cosmos DB, SQL, PostgreSQL, etc.)
> - **Storage accounts** with all blobs and files
> - **Key Vault** with all secrets (use `--purge` to bypass soft-delete)
>
> **Flags:**
> - `azd down` - Prompts for confirmation
> - `azd down --force` - Skips confirmation (still soft-deletes Key Vault)
> - `azd down --force --purge` - **Permanently deletes Key Vault** (no recovery possible)
>
> **Best practices:**
> - Always use `azd provision --preview` before `azd up` to understand what will be created
> - Use separate environments for dev/staging/production
> - Back up important data before running `azd down`

### Monitoring

```bash
# Query logs
az monitor log-analytics query --workspace WORKSPACE_ID --analytics-query "QUERY"

# List activity log
az monitor activity-log list -g RG --max-events 20
```

---

## Advanced Tips and Patterns

### Output Formatting

#### Table Output (Human Readable)

```bash
az resource list -g RG --output table
```

#### JSON Output (Scripting)

```bash
az resource list -g RG --output json
```

#### TSV Output (Parsing)

```bash
az resource list -g RG --output tsv
```

#### YAML Output

```bash
az resource list -g RG --output yaml
```

### JMESPath Queries

#### Select Specific Fields

```bash
az resource list --query "[].{Name:name, Type:type}" -o table
```

#### Filter Results

```bash
# Exact match
az resource list --query "[?type=='Microsoft.Web/sites']" -o table

# Contains
az resource list --query "[?contains(name, 'prod')]" -o table

# Multiple conditions
az resource list --query "[?type=='Microsoft.Web/sites' && contains(name, 'api')]" -o table
```

#### Get Single Value

```bash
az account show --query "id" -o tsv
```

#### First/Last Item

```bash
az resource list --query "[0].name" -o tsv
az resource list --query "[-1].name" -o tsv
```

### Environment Variables

#### Set Default Subscription

```bash
# Bash version
export AZURE_DEFAULTS_SUBSCRIPTION="subscription-id"
```

```powershell
# PowerShell version
$env:AZURE_DEFAULTS_SUBSCRIPTION = "subscription-id"
```

#### Set Default Location

```bash
# Bash version
export AZURE_DEFAULTS_LOCATION="eastus"
```

```powershell
# PowerShell version
$env:AZURE_DEFAULTS_LOCATION = "eastus"
```

#### Set Default Resource Group

```bash
# Bash version
export AZURE_DEFAULTS_GROUP="my-resource-group"
```

```powershell
# PowerShell version
$env:AZURE_DEFAULTS_GROUP = "my-resource-group"
```

### Scripting Patterns

#### Get Resource ID

```bash
# Bash version
RESOURCE_ID=$(az webapp show -n APP -g RG --query "id" -o tsv)
```

```powershell
# PowerShell version
$RESOURCE_ID = az webapp show -n APP -g RG --query "id" -o tsv
```

#### Loop Over Resources

```bash
# Bash version
for app in $(az webapp list -g RG --query "[].name" -o tsv); do
  echo "Processing $app"
  az webapp show -n "$app" -g RG
done
```

```powershell
# PowerShell version
$apps = az webapp list -g RG --query "[].name" -o tsv
foreach ($app in $apps) {
    Write-Host "Processing $app"
    az webapp show -n $app -g RG
}
```

#### Check If Resource Exists

```bash
# Bash version
if az webapp show -n APP -g RG &>/dev/null; then
  echo "App exists"
else
  echo "App does not exist"
fi
```

```powershell
# PowerShell version
$result = az webapp show -n APP -g RG 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "App exists"
} else {
    Write-Host "App does not exist"
}
```

#### Wait for Operation

```bash
# Bash version
az webapp create ... --no-wait
az webapp wait --name APP -g RG --created
```

```powershell
# PowerShell version
az webapp create ... --no-wait
az webapp wait --name APP -g RG --created
```

### Error Handling

#### Suppress Errors

```bash
# Bash version
az resource show --ids ID 2>/dev/null || echo "Not found"
```

```powershell
# PowerShell version
$result = az resource show --ids ID 2>$null
if (-not $result) { Write-Host "Not found" }
```

#### Check Exit Code

```bash
# Bash version
if az webapp show -n APP -g RG; then
  echo "Success"
else
  echo "Failed with code $?"
fi
```

```powershell
# PowerShell version
az webapp show -n APP -g RG
if ($LASTEXITCODE -eq 0) {
    Write-Host "Success"
} else {
    Write-Host "Failed with code $LASTEXITCODE"
}
```

### Configuration

#### View Config

```bash
az config get
```

#### Set Defaults

```bash
az config set defaults.group=myRG
az config set defaults.location=eastus
```

#### Disable Telemetry

```bash
az config set core.collect_telemetry=false
```

### Extensions

#### List Extensions

```bash
az extension list
```

#### Add Extension

```bash
az extension add --name extension-name
```

#### Update Extensions

```bash
az extension update --name extension-name
```

### Performance Tips

1. **Use `--no-wait`** for long operations
2. **Use `--query`** to reduce output size
3. **Use TSV output** for parsing
4. **Cache results** when querying multiple times
5. **Use resource IDs** instead of name lookups

### Common Issues

#### Command Not Found

```bash
# Update CLI
az upgrade

# Or reinstall
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

#### Authentication Expired

```bash
az login --use-device-code
```

#### Permission Denied

Check RBAC roles:
```bash
az role assignment list --assignee USER@domain.com
```
