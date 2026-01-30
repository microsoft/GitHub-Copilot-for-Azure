# Validation Commands Reference

## Azure Developer CLI (azd)

```bash
azd provision --preview                    # Preview changes
azd provision --preview -e dev             # Specific environment
azd provision --preview --no-prompt        # CI/CD mode
azd auth login --check-status              # Check auth
azd env list                               # List environments
```

## Azure CLI What-If

### Resource Group Scope
```bash
az deployment group what-if -g RG -f main.bicep
az deployment group what-if -g RG -f main.bicep --parameters main.bicepparam
az deployment group what-if -g RG -f main.bicep --validation-level ProviderNoRbac  # Fallback
```

### Subscription Scope
```bash
az deployment sub what-if --location eastus -f main.bicep
```

### Management Group / Tenant Scope
```bash
az deployment mg what-if --location eastus -m MG_ID -f main.bicep
az deployment tenant what-if --location eastus -f main.bicep
```

**Validation Levels:** `Provider` (full), `ProviderNoRbac` (read-only), `Template` (syntax only)

## Bicep CLI

```bash
bicep build main.bicep --stdout > /dev/null   # Validate syntax (bash)
bicep build main.bicep --stdout | Out-Null    # Validate syntax (PowerShell)
bicep --version
```

**Error format:** `<file>(<line>,<column>) : <severity> <code>: <message>`

## Determining Scope

Check `targetScope` in Bicep file:

| targetScope | Command |
|-------------|---------|
| `resourceGroup` (default) | `az deployment group what-if -g RG` |
| `subscription` | `az deployment sub what-if --location LOC` |
| `managementGroup` | `az deployment mg what-if --location LOC -m MG` |
| `tenant` | `az deployment tenant what-if --location LOC` |

## Parameter Files

```bash
--parameters main.bicepparam          # Bicep params
--parameters @parameters.json         # JSON params
--parameters location=westus          # Inline override
```

## Version Check

```bash
az --version && azd version && bicep --version
```
