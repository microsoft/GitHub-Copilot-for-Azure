# Codebase Scan

Analyze workspace to identify components, technologies, and dependencies.

## Detection Patterns

### Languages & Frameworks

| File | Indicates |
|------|-----------|
| `package.json` | Node.js |
| `requirements.txt`, `pyproject.toml` | Python |
| `*.csproj`, `*.sln` | .NET |
| `pom.xml`, `build.gradle` | Java |
| `go.mod` | Go |

### ⛔ Specialized SDK Detection — Check FIRST

Before classifying components, grep dependency files for SDKs that require a specialized skill:

| Dependency in code | Invoke instead |
|--------------------|----------------|
| `@github/copilot-sdk` · `github-copilot-sdk` · `copilot-sdk-go` · `GitHub.CopilotSdk` | **azure-hosted-copilot-sdk** |

> ⚠️ If ANY match is found, **STOP and invoke that skill**. Do NOT continue with azure-prepare — the skill has tested templates and patterns.

### Component Types

| Pattern | Component Type |
|---------|----------------|
| React/Vue/Angular in package.json | SPA Frontend |
| Only .html/.css/.js files, no package.json | Pure Static Site |
| Express/Fastify/Koa | API Service |
| Flask/FastAPI/Django | API Service |
| Next.js/Nuxt | SSR Web App |
| Celery/Bull/Agenda | Background Worker |
| azure-functions SDK | Azure Function |
| .AppHost.csproj or Aspire.Hosting package | .NET Aspire App |

**Pure Static Site Detection:**
- No package.json, requirements.txt, or build configuration
- Contains only HTML, CSS, JavaScript, and asset files
- No framework dependencies (React, Vue, Angular, etc.)
- ⚠️ For pure static sites, do NOT add `language` field to azure.yaml to avoid triggering build steps

### Existing Tooling

| Found | Tooling |
|-------|---------|
| `azure.yaml` | AZD configured |
| `infra/*.bicep` | Bicep IaC |
| `infra/*.tf` | Terraform IaC |
| `Dockerfile` | Containerized |
| `.github/workflows/` | GitHub Actions CI/CD |
| `azure-pipelines.yml` | Azure DevOps CI/CD |

### .NET Aspire Detection

Always check **.NET Aspire projects** by running the presence script ([detect-aspire.sh](scripts/detect-aspire.sh) / [detect-aspire.ps1](scripts/detect-aspire.ps1)), which reports just `isAspire` and `appHostPath` so you can branch quickly. Once Aspire is confirmed, [aspire.md](aspire.md) gathers the deeper facts (`ExcludeFromManifest`, Azure Functions signals) via `gather-aspire-info`:

**bash:**
```bash
./scripts/detect-aspire.sh [workspace-root]
```

**PowerShell:**
```powershell
./scripts/detect-aspire.ps1 -WorkspaceRoot <workspace-root>
```

A project is Aspire when the script returns `isAspire=true` (a `*.AppHost.csproj` or an `Aspire.Hosting` / `Aspire.Hosting.AppHost` / `Aspire.AppHost.Sdk` package reference was found). See [aspire.md](aspire.md) Step 1 for the full field list gathered by `gather-aspire-info`.

**When Aspire is detected:**
- Use `azd init --from-code -e <environment-name>` instead of manual azure.yaml creation
- The `--from-code` flag automatically detects the AppHost and generates appropriate configuration
- The `-e` flag is **required** for non-interactive environments (agents, CI/CD)
- ⚠️ **CRITICAL:** Run `gather-aspire-info` (per [aspire.md](aspire.md) Step 1). If it reports `hasFunctions=true` and `secretStorageConfigured=false`, you **MUST** add `.WithEnvironment("AzureWebJobsSecretStorageType", "Files")` to the Functions builder chain BEFORE deployment. Without this, Functions will fail at startup with `Secret initialization from Blob storage failed`. See [aspire.md](aspire.md) Step 4b for the complete fix procedure.
- See [aspire.md](aspire.md) for detailed Aspire-specific guidance

## Output

Document findings:

```markdown
## Components

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| api | API Service | Node.js/Express | src/api |
| web | SPA | React | src/web |
| worker | Background | Python | src/worker |

## Dependencies

| Component | Depends On | Type |
|-----------|-----------|------|
| api | PostgreSQL | Database |
| web | api | HTTP |
| worker | Service Bus | Queue |

## Existing Infrastructure

| Item | Status |
|------|--------|
| azure.yaml | Not found |
| infra/ | Not found |
| Dockerfiles | Found: src/api/Dockerfile |
```
