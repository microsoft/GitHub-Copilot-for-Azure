# .NET Aspire Projects

> ⛔ **CRITICAL - READ THIS FIRST**
>
> For .NET Aspire projects, **NEVER manually create azure.yaml or infra/ files.**
> Always use `azd init --from-code` which auto-detects the AppHost and generates everything correctly.
>
> **Failure to follow this causes:** "Could not find a part of the path 'infra\main.bicep'" error.

Guidance for preparing .NET Aspire applications for Azure deployment.

**📖 For detailed AZD workflow:** See [recipes/azd/aspire.md](recipes/azd/aspire.md)

## Detection

A .NET Aspire project is identified by:

| Indicator | Description |
|-----------|-------------|
| `*.AppHost.csproj` | AppHost orchestrator project file |
| `Aspire.Hosting` package | Core Aspire hosting package reference |
| `Aspire.Hosting.AppHost` | Alternative Aspire hosting package |

## Azure Preparation Workflow

### Step 1: Detection

When scanning the codebase (per [scan.md](scan.md)), detect Aspire by:

```bash
# Check for AppHost project
find . -name "*.AppHost.csproj"

# Or check for Aspire.Hosting package reference
grep -r "Aspire.Hosting" . --include="*.csproj"
```

### ⛔ Step 1a: Pre-Check for Custom/Non-Deployable Resources (MANDATORY)

Before `azd init --from-code`, scan AppHost source for local-only custom resources:

```bash
# Find the AppHost project and scan only its source directory
APPHOST_PROJECT=$(find . -name "*.AppHost.csproj" | head -1)
APPHOST_DIR=$(dirname "$APPHOST_PROJECT")
grep -r "ExcludeFromManifest" "$APPHOST_DIR" --include="*.cs" | head -20
```

This scan is informational. A positive match does **not** immediately block deployment; final `azure.yaml` output matters:

- If `azd init` **fails** with `unsupported resource type` → see Step 2 error guidance below.
- If `azd init` **succeeds** but `azure.yaml` has an empty or missing `services` section → see Step 4a below.

### Step 2: Initialize with azd

**CRITICAL: For Aspire projects, use `azd init --from-code -e <environment-name>` instead of creating azure.yaml manually.**

**⚠️ ALWAYS include the `-e <environment-name>` flag:** Without it, `azd init` will fail in non-interactive environments (agents, CI/CD) with the error: `no default response for prompt 'Enter a unique environment name:'`

```bash
# Non-interactive initialization for Aspire projects (REQUIRED for agents)
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init --from-code -e "$ENV_NAME"
```

**If `azd init --from-code` fails with `unsupported resource type`:** do not patch AppHost source or proceed. Record a blocker that custom Aspire resource types cannot be deployed to Azure. See [Aspire troubleshooting](aspire-troubleshooting.md).

### Step 3: Configure Subscription and Location

> **⛔ CRITICAL**: After `azd init --from-code` completes, you **MUST** immediately set the user-confirmed subscription and location.
>
> **DO NOT** skip this step or delay it until validation. The `azd init` command creates an environment but does NOT inherit the Azure CLI's subscription. If you skip this step, azd will use its own default subscription, which may differ from the user's confirmed choice.

**Set and verify the subscription/location immediately after initialization** with the AZD context helper. It detects existing/default context, sets `AZURE_SUBSCRIPTION_ID` before `AZURE_LOCATION`, verifies both values, and emits `key=value` lines plus a summary:

```bash
./scripts/set-azd-context.sh <subscription-id> <location> <environment-name>
```

```powershell
.\scripts\set-azd-context.ps1 -SubscriptionId <subscription-id> -Location <location> -EnvironmentName <environment-name>
```

Confirm that `AZURE_SUBSCRIPTION_ID` and `AZURE_LOCATION` match the user's confirmed choices from [Azure Context](azure-context.md).

### Step 4: What azd Generates

`azd init --from-code` creates:

| Artifact | Location | Description |
|----------|----------|-------------|
| `azure.yaml` | Project root | Service definitions from AppHost |
| `infra/` | Project root | Bicep templates for Azure resources |
| `.azure/` | Project root | Environment configuration |

### ⛔ Step 4a: Validate Generated Output

Verify generated `azure.yaml` contains a non-empty `services:` map:

```bash
# Check if azure.yaml has a non-empty services section
cat azure.yaml
```

If the `services` section is empty or missing, the AppHost has no deployable resources:

1. Do **not** proceed or manually create Bicep, Dockerfiles, or azure.yaml.
2. Record a blocker: "Application contains only custom/demo Aspire resources with no Azure-deployable services."
3. Inform the user that this app is local-only.

### ⛔ Step 4b: Fix Azure Functions Secret Storage (MANDATORY for Aspire + Functions)

For Aspire + Functions, ensure file-based secret storage before `azd up`:

```bash
APPHOST_DIR=$(dirname "$(find . -name '*.AppHost.csproj' | head -1)")
grep -n "AddAzureFunctionsProject" "$APPHOST_DIR"/*.cs
```

If `AddAzureFunctionsProject` is absent, skip. If present, check whether `AzureWebJobsSecretStorageType` already exists:

```bash
grep -n "AzureWebJobsSecretStorageType" "$APPHOST_DIR"/*.cs
```

If absent, add it immediately after `.WithHostStorage(...)`:

```csharp
var functions = builder.AddAzureFunctionsProject<Projects.MyFunctions>("functions")
    .WithHostStorage(storage)
    .WithEnvironment("AzureWebJobsSecretStorageType", "Files")
    .WithReference(queues);
```

See [aspire-functions-secrets reference](services/functions/aspire-containerapps.md) and [Aspire troubleshooting](aspire-troubleshooting.md) for details.

## Flags Reference

### azd init for Aspire

| Flag | Required | Description |
|------|----------|-------------|
| `--from-code` | ✅ Yes | Auto-detect AppHost, no interactive prompts |
| `-e <name>` | ✅ Yes | Environment name (required for non-interactive) |
| `--no-prompt` | Optional | Skip additional confirmations |

**Complete initialization sequence:**
```bash
# 1. Initialize the environment
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"
azd init --from-code -e "$ENV_NAME"

# 2. IMMEDIATELY detect, set subscription first, set location, and verify
./scripts/set-azd-context.sh <subscription-id> <location> "$ENV_NAME"
```

## Troubleshooting

See [Aspire troubleshooting](aspire-troubleshooting.md) for non-interactive `azd init`, missing AppHost, unsupported resource type, Azure Functions secret storage, and wrong-subscription fixes.

## References

- [.NET Aspire Documentation](https://learn.microsoft.com/en-us/dotnet/aspire/)
- [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/)
- [Aspire Samples Repository](https://github.com/dotnet/aspire-samples)
- [azd + Aspire Integration](https://learn.microsoft.com/en-us/dotnet/aspire/deployment/azure/aca-deployment-azd-in-depth)

## Next Steps

After `azd init --from-code`:
1. Review generated `azure.yaml` and `infra/` files (if present)
2. Set and verify AZURE_SUBSCRIPTION_ID and AZURE_LOCATION with [set-azd-context.sh](scripts/set-azd-context.sh) or [set-azd-context.ps1](scripts/set-azd-context.ps1)
3. Customize infrastructure as needed
4. Proceed to **azure-validate** skill
5. Deploy with **azure-deploy** skill

> ⚠️ **Important for Container Apps:** If using Aspire with Container Apps, azure-validate will check and help set up required environment variables after provisioning.
