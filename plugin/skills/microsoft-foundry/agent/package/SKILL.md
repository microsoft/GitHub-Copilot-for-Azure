---
name: package
description: |
  Package and containerize agent projects for deployment as Hosted Agents in Azure AI Foundry. Generates Dockerfiles, docker-compose files, scans for environment variables, and publishes images to Azure Container Registry (ACR).
  USE FOR: containerize agent, Dockerfile, Docker image, ACR, package agent, dockerize, container registry, build image, push image, docker-compose, environment variable scan.
  DO NOT USE FOR: deploying agents to Foundry (use deploy skill), invoking or testing agents (use invoke skill), Azure Functions (use azure-functions).
---

# Foundry Agent Package

Package agent projects into container images for deployment as Hosted Agents in Azure AI Foundry.

## Quick Reference

| Property | Value |
|----------|-------|
| Best for | Containerizing agent projects for Foundry hosted deployment |
| CLI tools | `docker`, `az acr` |
| Supported languages | .NET, Node.js, Python, Go, Java |
| Build methods | Cloud Build (ACR Tasks), Local Docker Build |

## When to Use This Skill

- Containerize an existing agent project with a Dockerfile
- Scan source code for environment variables needed at runtime
- Generate `docker-compose.yml` and `.env` files for local testing
- Build and push Docker images to Azure Container Registry (ACR)

## Supported Project Types

| Project Type | Detection Files |
|--------------|-----------------|
| .NET | `*.csproj`, `*.fsproj` |
| Node.js | `package.json` |
| Python | `requirements.txt`, `pyproject.toml`, `setup.py` |
| Go | `go.mod` |
| Java (Maven) | `pom.xml` |
| Java (Gradle) | `build.gradle` |

## Workflow

### Step 1: Get Project Path

Use the project path from the project context (see Common: Project Context Resolution). If not available, ask the user for the absolute path to their agent project directory. If the workspace already has a single project root open, offer it as the default choice.

### Step 2: Detect Project Type

Check for detection files listed in the Supported Project Types table above. Use glob/view tools to identify which project files exist.

### Step 3: Scan for Environment Variables

Delegate the environment variable scan to a sub-agent. Provide it the project path, detected project type, and the patterns table below. The sub-agent should search source files and return a structured list of variable names, classification (required/optional), and any default values found.

Search source files for environment variable access patterns based on the detected project type:

| Project Type | Patterns to Search |
|--------------|--------------------|
| .NET (`*.cs`) | `Environment.GetEnvironmentVariable("...")`, `configuration["..."]`, `configuration.GetValue<T>("...")` |
| Node.js (`*.js`, `*.ts`, `*.mjs`) | `process.env.VAR_NAME`, `process.env["..."]` |
| Python (`*.py`) | `os.environ["..."]`, `os.environ.get("...")`, `os.getenv("...")` |
| Go (`*.go`) | `os.Getenv("...")`, `os.LookupEnv("...")` |
| Java (`*.java`) | `System.getenv("...")`, `@Value("${...}")` |

**Classification rules:**
- If followed by a throw/error → Required, no default
- If followed by a fallback value (e.g., `|| "default"`, `?? "val"`, second argument) → Optional, extract default
- Otherwise → Assume required, ask user

### Step 4: Collect Environment Variable Values

Use the azd environment values from the project context (see Common: Project Context Resolution) to pre-fill discovered variables (exact match or common aliases like `AZURE_OPENAI_ENDPOINT` for `OPENAI_ENDPOINT`).

Present discovered variables to the user, grouped by required (no default) and optional (with defaults). Show azd-resolved values as pre-filled defaults. Only prompt the user for variables not resolved from azd or project defaults.

> ⚠️ **Warning:** For sensitive variables (API keys, connection strings), remind users to add `.env` to `.gitignore` and consider Azure Key Vault for production secrets.

### Step 5: Generate Dockerfile

Delegate Dockerfile creation to a sub-agent. Provide the project type, runtime version, port, and any special requirements. The sub-agent should create the Dockerfile in the project directory following these guidelines:

- Find the official base image for the language and runtime version
- Use multi-stage builds (build stage + runtime stage) for compiled languages
- Use Alpine or slim variants for smaller final images
- Expose the correct port (ask the user if not detectable from project config)
- Set the appropriate entrypoint for the project type
- Always target `linux/amd64` platform

> 💡 **Tip:** Reference [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples) for up-to-date containerized agent examples per language.

### Step 6: Generate docker-compose.yml and .env Files

Create supporting files for local development:

- **docker-compose.yml** — Service definition with build context, port mapping, `platform: linux/amd64`, and environment variable references
- **.env.template** — Documented template with placeholder values for all discovered variables
- **.env** — Actual values collected in Step 4 (add to `.gitignore`)

### Step 7: Build and Push to ACR

Collect ACR details. Use the ACR name from the project context (see Common: Project Context Resolution) if available. Ask the user only for values not already resolved: registry name, repository name, image tag (default: current timestamp).

Let the user choose the build method: `Cloud Build (ACR Tasks) (Recommended)` or `Local Docker Build`.

**Option A: Cloud Build (ACR Tasks)** — No local Docker required

Build and push in one step using `az acr build`. This uploads source code to ACR and builds in the cloud.

##### Bash
```bash
az acr build --registry <acr-name> --image <repository>:<tag> --platform linux/amd64 --file Dockerfile .
```

##### PowerShell
```powershell
az acr build --registry <acr-name> --image <repository>:<tag> --platform linux/amd64 --file Dockerfile .
```

**Option B: Local Docker Build**

Build locally, then push to ACR. Requires Docker running locally.

##### Bash
```bash
docker build --platform linux/amd64 -t <image>:<tag> -f Dockerfile .
az acr login --name <acr-name>
docker tag <image>:<tag> <acr-name>.azurecr.io/<repository>:<tag>
docker push <acr-name>.azurecr.io/<repository>:<tag>
```

##### PowerShell
```powershell
docker build --platform linux/amd64 -t <image>:<tag> -f Dockerfile .
az acr login --name <acr-name>
docker tag <image>:<tag> <acr-name>.azurecr.io/<repository>:<tag>
docker push <acr-name>.azurecr.io/<repository>:<tag>
```

> 💡 **Tip:** Prefer Cloud Build if Docker is not available locally. Check Docker availability with `docker info`.

## Platform Detection

Before running Docker commands, detect the environment:

- **Windows with WSL**: If `docker info` fails but `wsl -e docker info` succeeds, prefix all Docker commands with `wsl -e`
- **WSL path conversion**: Convert Windows paths (`C:\projects\app`) to WSL format (`/mnt/c/projects/app`)
- **Multi-architecture**: Always use `--platform linux/amd64` for Foundry compatibility

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Project type not detected | No known project files found | Ask user to specify project type manually |
| Docker not running | Docker Desktop not started or not installed | Start Docker Desktop, or use Cloud Build (ACR Tasks) instead |
| ACR login failed | Not authenticated to Azure | Run `az login` first, then `az acr login --name <acr-name>` |
| Build failed | Dockerfile errors or missing dependencies | Check Dockerfile syntax, verify base image availability |
| Push failed | Insufficient ACR permissions | Verify Contributor or AcrPush role on the registry |

## Additional Resources

- [Foundry Samples](https://github.com/azure-ai-foundry/foundry-samples) — Containerized agent examples
- [ACR Build Tasks](https://learn.microsoft.com/azure/container-registry/container-registry-tutorial-quick-task) — Cloud build documentation
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/) — Best practices
