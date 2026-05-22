# Containerize and Build Hosted Agents

Part of the [deploy skill](../deploy.md).

This reference covers project scanning, environment variable confirmation, Dockerfile generation, ACR setup, and image builds for hosted agents.

### Step 1: Detect and Scan Project

Get the project path from the selected agent root in the project context (see Common: Project Context Resolution). Detect the project type by checking for these files. Do **not** scan sibling agent folders.

| Project Type | Detection Files |
|--------------|-----------------|
| .NET | `*.csproj`, `*.fsproj` |
| Node.js | `package.json` |
| Python | `requirements.txt`, `pyproject.toml`, `setup.py` |
| Go | `go.mod` |
| Java (Maven) | `pom.xml` |
| Java (Gradle) | `build.gradle` |

Delegate an environment variable scan to a sub-agent. Provide the selected agent root path and project type. Search source files inside that folder only for these patterns:

| Project Type | Patterns to Search |
|--------------|--------------------|
| .NET (`*.cs`) | `Environment.GetEnvironmentVariable("...")`, `configuration["..."]`, `configuration.GetValue<T>("...")` |
| Node.js (`*.js`, `*.ts`, `*.mjs`) | `process.env.VAR_NAME`, `process.env["..."]` |
| Python (`*.py`) | `os.environ["..."]`, `os.environ.get("...")`, `os.getenv("...")` |
| Go (`*.go`) | `os.Getenv("...")`, `os.LookupEnv("...")` |
| Java (`*.java`) | `System.getenv("...")`, `@Value("${...}")` |

Classification: if followed by a throw/error -> required; if followed by a fallback value -> optional with default; otherwise -> assume required, ask user.

### Step 2: Collect and Confirm Environment Variables

> **Warning:** Environment variables are included in the agent payload and are difficult to change after deployment.

Use azd environment values from the project context to pre-fill discovered variables. Merge with any user-provided values. Present all variables to the user for confirmation with variable name, value, and source (`azd`, `project default`, or `user`). Mask sensitive values.

Loop until the user confirms or cancels:
- `yes` -> Proceed
- `VAR_NAME=new_value` -> Update the value, show updated table, ask again
- `cancel` -> Abort deployment

### Step 3: Generate Dockerfile and Build Image

Delegate Dockerfile creation to a sub-agent. Guidelines:
- Use official base image for the detected language and runtime version
- Use multi-stage builds for compiled languages
- Use Alpine or slim variants for smaller images
- Always target `linux/amd64` platform
- Expose the correct port (usually 8088)

> **Tip:** Reference [Hosted Agents Foundry Samples](https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents) for containerized agent examples.

Also generate `docker-compose.yml` and `.env` files for local development.

**IMPORTANT**: You MUST always generate image tag as current timestamp (e.g., `myagent:202401011230`) to ensure uniqueness and avoid conflicts with existing images in ACR. DO NOT use static tags like `latest` or `v1`.

Collect ACR details from project context.

- If an ACR already exists, use it, then verify that the Foundry project managed identity has pull permissions (for example, `Container Registry Repository Reader` or equivalent) on the target repository/registry. If the role assignment is missing, add it.
- If no ACR exists, create a new one with ABAC repository permissions mode, and assign `Container Registry Repository Reader` to the Foundry project managed identity. Foundry hosted agents use ABAC mode that requires repository-scoped roles, not the registry-level `AcrPull` role.

Let the user choose the build method:

**Cloud Build (ACR Tasks) (Recommended)** -- no local Docker required:
```bash
az acr build --registry <acr-name> --image <repository>:<tag> --platform linux/amd64 --source-acr-auth-id "[caller]" --file Dockerfile .
```

> **Mandatory:** The `--source-acr-auth-id "[caller]"` parameter is required. Do NOT omit it -- without this flag the build will fail due to missing authentication context.

**Local Docker Build:**
```bash
docker build --platform linux/amd64 -t <image>:<tag> -f Dockerfile .
az acr login --name <acr-name>
docker tag <image>:<tag> <acr-name>.azurecr.io/<repository>:<tag>
docker push <acr-name>.azurecr.io/<repository>:<tag>
```

> **Tip:** Prefer Cloud Build if Docker is not available locally. On Windows with WSL, prefix Docker commands with `wsl -e` if `docker info` fails but `wsl -e docker info` succeeds.
