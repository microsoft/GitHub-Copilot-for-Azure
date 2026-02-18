# .NET Aspire Projects with AZD

**⛔ MANDATORY: For .NET Aspire projects, NEVER manually create azure.yaml. Use `azd init --from-code` instead.**

## Detection

| Indicator | How to Detect |
|-----------|---------------|
| `*.AppHost.csproj` | `find . -name "*.AppHost.csproj"` |
| `Aspire.Hosting` package | `grep -r "Aspire\.Hosting" . --include="*.csproj"` |
| `Aspire.AppHost.Sdk` | `grep -r "Aspire\.AppHost\.Sdk" . --include="*.csproj"` |

## Workflow

### ⛔ DO NOT (Wrong Approach)

```yaml
# ❌ WRONG - Missing services section
name: aspire-app
metadata:
  template: azd-init
# Results in: "Could not find infra\main.bicep" error
```

### ✅ DO (Correct Approach)

```bash
# Generate environment name
ENV_NAME="$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr ' _' '-')-dev"

# Use azd init with auto-detection
azd init --from-code -e "$ENV_NAME"
```

**Generated azure.yaml:**
```yaml
name: aspire-app
metadata:
  template: azd-init
services:
  app:
    language: dotnet
    project: ./MyApp.AppHost/MyApp.AppHost.csproj
    host: containerapp
```

## Command Flags

| Flag | Required | Purpose |
|------|----------|---------|
| `--from-code` | ✅ | Auto-detect AppHost, no prompts |
| `-e <name>` | ✅ | Environment name (non-interactive) |
| `--no-prompt` | Optional | Skip all confirmations |

**Why `--from-code` is critical:**
- Without: Prompts "How do you want to initialize?" (needs TTY)
- With: Auto-detects AppHost, no interaction needed
- Essential for agents and CI/CD

## Docker Context

When AppHost uses `AddDockerfile`:

```csharp
builder.AddDockerfile("ginapp", "./ginapp");
```

Generated azure.yaml includes context:
```yaml
services:
  ginapp:
    docker:
      path: ./ginapp/Dockerfile
      context: ./ginapp
```

## Troubleshooting

### Error: "Could not find infra\main.bicep"

**Cause:** Manual azure.yaml without services section

**Fix:**
1. Delete manual azure.yaml
2. Run `azd init --from-code -e <env-name>`
3. Verify services section exists

### Error: "no default response for prompt"

**Cause:** Missing `--from-code` flag

**Fix:** Always use `--from-code` for Aspire:
```bash
azd init --from-code -e "$ENV_NAME"
```

### AppHost Not Detected

**Solutions:**
1. Verify: `find . -name "*.AppHost.csproj"`
2. Build: `dotnet build`
3. Check package references in .csproj
4. Run from solution root

## Infrastructure Auto-Generation

| Traditional | Aspire |
|------------|--------|
| Manual infra/main.bicep | Auto-gen from AppHost |
| Define in IaC | Define in C# code |
| Update IaC per service | Add to AppHost |

**How it works:**
1. AppHost defines services in C#
2. `azd provision` analyzes AppHost
3. Generates Bicep automatically
4. Deploys to Azure Container Apps

## Next Steps

1. Verify azure.yaml has services section
2. Review generated infra/ (don't modify)
3. Set subscription: `azd env set AZURE_SUBSCRIPTION_ID <id>`
4. Proceed to **azure-validate**
5. Deploy with **azure-deploy** (`azd up`)

## References

- [.NET Aspire Docs](https://learn.microsoft.com/dotnet/aspire/)
- [azd + Aspire](https://learn.microsoft.com/dotnet/aspire/deployment/azure/aca-deployment-azd-in-depth)
- [Samples](https://github.com/dotnet/aspire-samples)
- [Main Guide](../../aspire.md)
