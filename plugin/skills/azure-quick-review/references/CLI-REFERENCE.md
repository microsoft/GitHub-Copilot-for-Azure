# azqr CLI Reference

Complete command reference for Azure Quick Review CLI.

## Installation

### Windows

```powershell
# Using winget (recommended)
winget install azqr

# Using PowerShell script
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/azure/azqr/main/scripts/install.ps1'))
```

### macOS

```bash
# Using Homebrew
brew install azqr
```

### Linux / Azure Cloud Shell

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/azure/azqr/main/scripts/install.sh)"
```

## Authentication

azqr uses Azure SDK's `DefaultAzureCredential` which tries these methods in order:

1. Environment variables (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`)
2. Workload Identity
3. Managed Identity
4. Azure CLI

### Environment Variable Configuration

```bash
# For development - use Azure CLI credentials
export AZURE_TOKEN_CREDENTIALS=dev

# For production - use environment/workload/managed identity
export AZURE_TOKEN_CREDENTIALS=prod
```

### Cloud Configuration

```bash
# Azure Government
export AZURE_CLOUD=AzureUSGovernment

# Azure China
export AZURE_CLOUD=AzureChinaCloud
```

## Commands

### scan

Main scanning command for Azure resources.

```
azqr scan [flags]
azqr scan [service] [flags]
```

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--subscription-id` | `-s` | Azure Subscription ID (repeatable) |
| `--resource-group` | `-g` | Resource Group name (use with -s) |
| `--management-group-id` | | Management Group ID (repeatable) |
| `--output-name` | `-o` | Output filename (without extension) |
| `--filters` | `-e` | YAML filter file path |
| `--json` | | Generate JSON output |
| `--csv` | | Generate CSV output |
| `--xlsx` | | Generate Excel output (default) |
| `--mask` | `-m` | Mask subscription IDs (default: true) |
| `--costs` | `-c` | Include cost analysis (default: true) |
| `--advisor` | `-a` | Include Azure Advisor (default: true) |
| `--defender` | `-d` | Include Defender status (default: true) |
| `--policy` | `-p` | Include Azure Policy compliance |
| `--debug` | | Enable debug logging |

**Service-specific scans:**

| Abbreviation | Service |
|--------------|---------|
| `aa` | Automation Account |
| `adf` | Data Factory |
| `afd` | Front Door |
| `afw` | Azure Firewall |
| `agw` | Application Gateway |
| `aif` | AI Foundry / Cognitive Services |
| `aks` | Kubernetes Service |
| `amg` | Managed Grafana |
| `apim` | API Management |
| `appcs` | App Configuration |
| `appi` | Application Insights |
| `arc` | Arc-enabled machines |
| `asp` | App Service |
| `ca` | Container Apps |
| `cosmos` | Cosmos DB |
| `cr` | Container Registry |
| `kv` | Key Vault |
| `lb` | Load Balancer |
| `mysql` | Database for MySQL |
| `psql` | Database for PostgreSQL |
| `redis` | Cache for Redis |
| `sb` | Service Bus |
| `sql` | SQL Database |
| `st` | Storage Accounts |
| `vm` | Virtual Machines |
| `vmss` | VM Scale Sets |
| `vnet` | Virtual Networks |

**Examples:**

```powershell
# Full subscription scan
azqr scan -s 00000000-0000-0000-0000-000000000000

# Resource group scan
azqr scan -s 00000000-0000-0000-0000-000000000000 -g my-resource-group

# Multiple subscriptions
azqr scan -s sub1 -s sub2 -s sub3

# Management group scan
azqr scan --management-group-id my-mg-id

# Storage accounts only
azqr scan st -s 00000000-0000-0000-0000-000000000000

# JSON output without cost analysis
azqr scan -s sub-id --json -c=false -o my-report

# With filter file
azqr scan -s sub-id --filters ./filters.yaml
```

### show

Launch interactive web dashboard for scan results.

```
azqr show [flags]
```

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--file` | `-f` | Report file path (.xlsx or .json) |
| `--open` | | Auto-open browser |

**Examples:**

```powershell
# Open Excel report
azqr show -f compliance-scan.xlsx --open

# Open JSON report
azqr show -f compliance-scan.json --open
```

### compare

Compare two scan reports to identify changes.

```
azqr compare [flags]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--file1` | First report file (baseline) |
| `--file2` | Second report file (current) |
| `--output` | Output file for comparison results |

**Examples:**

```powershell
# Compare two Excel reports
azqr compare --file1 baseline.xlsx --file2 current.xlsx

# Save comparison to file
azqr compare --file1 baseline.xlsx --file2 current.xlsx --output diff.txt
```

### rules

Print all recommendations.

```
azqr rules [flags]
```

**Flags:**

| Flag | Short | Description |
|------|-------|-------------|
| `--json` | `-j` | Output as JSON |

**Examples:**

```powershell
# Print as markdown table
azqr rules

# Print as JSON
azqr rules --json
```

### types

Print all supported Azure resource types.

```
azqr types
```

### plugins

Manage azqr plugins.

```
azqr plugins [command]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `list` | List available plugins |

**Plugin-specific commands:**

```powershell
# OpenAI throttling analysis (standalone)
azqr openai-throttling

# Carbon emissions (standalone)
azqr carbon-emissions

# Zone mapping (standalone)
azqr zone-mapping

# Or include in scan
azqr scan -s sub-id --plugin openai-throttling --plugin carbon-emissions
```

## Filter File Format

Create a YAML file to include/exclude specific resources:

```yaml
azqr:
  include:
    subscriptions:
      - 00000000-0000-0000-0000-000000000000
    resourceGroups:
      - /subscriptions/sub-id/resourceGroups/rg-name
    resourceTypes:
      - vm  # Virtual Machines only
      - st  # Storage only
  exclude:
    subscriptions:
      - 11111111-1111-1111-1111-111111111111
    resourceGroups:
      - /subscriptions/sub-id/resourceGroups/dev-rg
    services:
      - /subscriptions/sub-id/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/devstore
    recommendations:
      - st-003  # Exclude versioning recommendation
      - vm-003  # Exclude zone redundancy for VMs
```

## Troubleshooting

### Debug Mode

```powershell
# Enable debug logging
$env:AZURE_SDK_GO_LOGGING = "all"
azqr scan -s sub-id --debug
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `AccountCostDisabled` | Use `-c=false` to skip cost analysis |
| `AuthenticationFailed` | Run `az login` to authenticate |
| `AuthorizationFailed` | Ensure Reader role on subscription |
| `Command not found` | Reinstall azqr |
| `Rate limiting` | Reduce scope or add delays |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error occurred |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AZURE_TOKEN_CREDENTIALS` | `dev` for CLI/azd, `prod` for managed identity |
| `AZURE_SUBSCRIPTION_ID` | Default subscription if not specified |
| `AZURE_CLOUD` | Cloud environment (AzurePublicCloud, AzureUSGovernment, AzureChinaCloud) |
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_CLIENT_SECRET` | Service principal secret |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SDK_GO_LOGGING` | Set to `all` for verbose SDK logging |

## Additional Resources

- [azqr GitHub Repository](https://github.com/Azure/azqr)
- [azqr Documentation](https://azure.github.io/azqr/docs/)
- [Recommendations Reference](https://azure.github.io/azqr/docs/recommendations/)
