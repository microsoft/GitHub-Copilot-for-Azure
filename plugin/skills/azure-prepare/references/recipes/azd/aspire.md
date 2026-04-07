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

## ⛔ After `azd init`: Fix AddParameter Used with WithBuildArg Before Build/Deploy

> **MANDATORY** — After running `azd init --from-code`, but before `azd package`, `azd up`, or any Docker image build/deploy step, scan the AppHost source for `AddParameter` calls that are passed to `WithBuildArg`. This pattern triggers an azd bug (`parameter infra.parameters.<name> not found`) that causes Docker builds to fail even when the parameter has a default value.

### Scan for the pattern

**Bash:**
```bash
grep -RIn --include="*.cs" -E "AddParameter|WithBuildArg" <path/to/AppHost>
```

**PowerShell:**
```powershell
Get-ChildItem -Path "<path/to/AppHost>" -Recurse -Filter "*.cs" |
  Select-String -Pattern "AddParameter|WithBuildArg"
```

**Problematic pattern:**
```csharp
// ❌ azd cannot resolve AddParameter values during Docker builds
var goVersion = builder.AddParameter("goversion", "1.25.4", publishValueAsDefault: true);
builder.AddDockerfile("ginapp", "./ginapp")
    .WithBuildArg("GO_VERSION", goVersion);
```

### Fix: Replace AddParameter with a constant

For every `AddParameter(name, defaultValue, ...)` whose result is used **only** as a `WithBuildArg` argument, replace it with a `const string` (or `string`) constant:

```csharp
// ✅ Use a constant instead
const string goVersion = "1.25.4";
builder.AddDockerfile("ginapp", "./ginapp")
    .WithBuildArg("GO_VERSION", goVersion);
```

**Why:** azd generates a Bicep parameter for every `AddParameter()` call and tries to resolve that parameter during Docker builds. In azd ≤1.23.14, this resolution fails during the container image build phase. Using a constant avoids the parameter lookup entirely.

> ⚠️ **Do NOT skip this step for container-build projects.** If the AppHost passes an `AddParameter` result to `WithBuildArg`, apply this fix immediately before running `azd init` or `azd up`.

---

## ⛔ Post-Init: Verify and Fix Docker Context for AddDockerfile Services

> **MANDATORY** — After `azd init --from-code` completes, you **MUST** check the generated `azure.yaml` for correct `docker.context` on every `AddDockerfile()` service. `azd init` often omits or misconfigures the `docker.context` property, which causes build failures at deploy time.

### Step 1: Identify AddDockerfile services in the AppHost

Scan the AppHost source (e.g., `apphost.cs` or `Program.cs`) for `AddDockerfile` calls:

```csharp
// Pattern: builder.AddDockerfile("<name>", "<context-path>");
builder.AddDockerfile("ginapp", "./ginapp");
//                     ^^^^^^    ^^^^^^^^
//                     service   context path (relative to AppHost dir)
```

### Step 2: Check azure.yaml for each service

For **every** `AddDockerfile("<name>", "<path>")` call found in Step 1, verify the generated `azure.yaml` contains a matching service entry with `docker.context`:

```yaml
services:
  <name>:
    host: containerapp
    docker:
      path: <path>/Dockerfile
      context: <path>
```

### Step 3: Patch azure.yaml if docker.context is missing or wrong

If `azure.yaml` is missing the service, or has an incorrect/missing `docker.context`, use the `edit` tool to fix it.

**Example — service missing entirely:** If the AppHost has `builder.AddDockerfile("ginapp", "./ginapp")` but `azure.yaml` has no `ginapp` service, add it:

```yaml
services:
  ginapp:
    host: containerapp
    docker:
      path: ./ginapp/Dockerfile
      context: ./ginapp
```

**Example — docker.context missing:** If `azure.yaml` has the service but no `docker.context`, add the `docker` block with correct `path` and `context` values derived from the `AddDockerfile` call.

> ⚠️ **Do NOT skip this step.** The `azd init --from-code` output for Aspire `AddDockerfile` services is unreliable. Always verify and patch.

## Docker Context (AddDockerfile Services)

When an Aspire app uses `AddDockerfile()`, the second parameter specifies the Docker build context:

```csharp
builder.AddDockerfile("servicename", "./path/to/context")
//                                    ^^^^^^^^^^^^^^^^
//                                    This is the Docker build context
```

The build context determines:
- Where Docker looks for files during `COPY` commands
- The base directory for all Dockerfile operations
- What `azd init --from-code` sets as `docker.context` in azure.yaml

**Generated azure.yaml includes context:**
```yaml
services:
  ginapp:
    docker:
      path: ./ginapp/Dockerfile
      context: ./ginapp
```

### Aspire Manifest (for verification)

Generate the manifest to verify the exact build configuration:

```bash
dotnet run <apphost-project> -- --publisher manifest --output-path manifest.json
```

Manifest structure for Dockerfile-based services:
```json
{
  "resources": {
    "servicename": {
      "type": "container.v1",
      "build": {
        "context": "path/to/context",
        "dockerfile": "path/to/context/Dockerfile"
      }
    }
  }
}
```

### Common Docker Patterns

**Single Dockerfile service:**
```csharp
builder.AddDockerfile("api", "./src/api")
```
Generated azure.yaml:
```yaml
services:
  api:
    project: .
    host: containerapp
    image: api
    docker:
      path: src/api/Dockerfile
      context: src/api
```

**Multiple Dockerfile services:**
```csharp
builder.AddDockerfile("frontend", "./src/frontend");
builder.AddDockerfile("backend", "./src/backend");
```
Generated azure.yaml:
```yaml
services:
  frontend:
    project: .
    host: containerapp
    image: frontend
    docker:
      path: src/frontend/Dockerfile
      context: src/frontend
  backend:
    project: .
    host: containerapp
    image: backend
    docker:
      path: src/backend/Dockerfile
      context: src/backend
```

**Root context:**
```csharp
builder.AddDockerfile("app", ".")
```
Generated azure.yaml:
```yaml
services:
  app:
    project: .
    host: containerapp
    image: app
    docker:
      path: Dockerfile
      context: .
```

### azure.yaml Rules for Docker Services

| Rule | Explanation |
|------|-------------|
| **Omit `language`** | Docker handles the build; azd doesn't need language-specific behavior |
| **Use relative paths** | All paths in azure.yaml are relative to project root |
| **Extract from manifest** | When in doubt, generate the Aspire manifest and use `build.context` |
| **Match Dockerfile expectations** | The `context` must match what the Dockerfile's `COPY` commands expect |

### ❌ Common Docker Mistakes

**Missing context causes build failures:**
```yaml
services:
  ginapp:
    project: .
    host: containerapp
    docker:
      path: ginapp/Dockerfile
      # ❌ Missing context - COPY commands will fail
```

**Unnecessary language field:**
```yaml
services:
  ginapp:
    project: .
    language: go              # ❌ Not needed for Docker builds
    host: containerapp
    docker:
      path: ginapp/Dockerfile
      context: ginapp
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

### Error: "parameter infra.parameters.<name> not found"

**Cause:** The AppHost uses `AddParameter()` as a `WithBuildArg` argument, and azd ≤1.23.14 cannot resolve infrastructure parameters during Docker builds.

**Example error:**
```
ERROR: building service 'ginapp': parameter infra.parameters.goversion not found
```

**Fix:** In the AppHost source, replace the `AddParameter(...)` call with a constant:

```csharp
// ❌ Before (causes the error)
var goVersion = builder.AddParameter("goversion", "1.25.4", publishValueAsDefault: true);
builder.AddDockerfile("ginapp", "./ginapp")
    .WithBuildArg("GO_VERSION", goVersion);

// ✅ After (fix)
const string goVersion = "1.25.4";
builder.AddDockerfile("ginapp", "./ginapp")
    .WithBuildArg("GO_VERSION", goVersion);
```

### AppHost Not Detected

**Solutions:**
1. Verify: `find . -name "*.AppHost.csproj"`
2. Build: `dotnet build`
3. Check package references in .csproj
4. Run from solution root

### Error: "unsupported resource type" — Custom Aspire Resources

**Symptoms:** `azd init --from-code` fails with `unsupported resource type` for one or more resources in the AppHost (e.g., custom child resources, ClockHand, or other custom Aspire integration types).

**Cause:** The AppHost contains custom Aspire resource types designed for local development tooling only. These resources have no Azure equivalent and are not deployable.

**Resolution:**

1. ⛔ **Stop — do NOT fix this error by modifying source code.** Do not add `.ExcludeFromManifest()` to suppress the error.
2. ⛔ **Do NOT proceed with deployment.**
3. ✅ Inform the user: the application uses custom Aspire resource authoring patterns intended for local tooling, not cloud deployment.
4. ✅ Record a deployment blocker: "AppHost contains custom Aspire resource types (`unsupported resource type`) with no Azure deployment target."

> ⚠️ Adding `.ExcludeFromManifest()` to work around this error violates the application's design intent and may produce an incomplete or incorrect deployment.

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

## Validation Steps

1. **⛔ Fix `AddParameter` used with `WithBuildArg`** — see [Post-Init: Fix AddParameter Used with WithBuildArg](#-post-init-fix-addparameter-used-with-withbuildarg)
2. Verify azure.yaml has services section
3. **⛔ Verify `docker.context` for every `AddDockerfile()` service** — see [Post-Init: Verify and Fix Docker Context](#post-init-verify-and-fix-docker-context-for-adddockerfile-services)
4. Check Dockerfile COPY paths are relative to the specified context
5. Generate manifest to verify `build.context` matches azure.yaml
6. Run `azd package` to validate Docker build succeeds
7. Review generated infra/ (don't modify)

## Next Steps

1. Set subscription: `azd env set AZURE_SUBSCRIPTION_ID <id>`
2. Proceed to **azure-validate**
3. Deploy with **azure-deploy** (`azd up`)

## References

- [.NET Aspire Docs](https://learn.microsoft.com/dotnet/aspire/)
- [azd + Aspire](https://learn.microsoft.com/dotnet/aspire/deployment/azure/aca-deployment-azd-in-depth)
- [Samples](https://github.com/dotnet/aspire-samples)
- [Main Guide](../../aspire.md)
- [azure.yaml Schema](azure-yaml.md)
- [Docker Guide](docker.md)