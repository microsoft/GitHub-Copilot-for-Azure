# Package Validation

Validate that all services can be packaged for deployment.

## TASK

Run `azd package` to verify that all services build successfully and produce deployable artifacts.

## Command

```bash
azd package --no-prompt
```

## What It Validates

| Check | Description |
|-------|-------------|
| **Source code** | All project paths exist and contain buildable code |
| **Docker builds** | Dockerfiles build successfully (for container services) |
| **Dependencies** | All dependencies can be resolved |
| **Build scripts** | npm build, dotnet publish, etc. succeed |
| **Artifacts** | Output artifacts are generated |

## Per-Service Validation

### Container App / AKS

```bash
# Builds Docker image
docker build -t <service-name> -f <dockerfile-path> <context>
```

**Common errors**:
- Missing Dockerfile
- Build failures (missing dependencies, syntax errors)
- Base image pull failures

### App Service

```bash
# Runs language-specific build
npm run build        # Node.js
dotnet publish       # .NET
pip install -r requirements.txt  # Python
```

**Common errors**:
- Missing package.json / requirements.txt
- Build script failures
- Dependency conflicts

### Azure Functions

```bash
# Runs function-specific packaging
func pack
```

**Common errors**:
- Invalid function.json
- Missing host.json
- Binding errors

### Static Web App

```bash
# Runs frontend build
npm run build
```

**Common errors**:
- Build script missing or failing
- Output directory mismatch

## Common Errors and Resolutions

### Docker Build Failure

```
ERROR: failed to solve: failed to read dockerfile
```

**Resolution**:
1. Verify Dockerfile path in azure.yaml
2. Check Dockerfile syntax
3. Ensure docker.path is relative to project directory

### Missing Dependencies

```
ERROR: npm ERR! Could not resolve dependency
```

**Resolution**:
1. Delete node_modules and package-lock.json
2. Run `npm install`
3. Fix version conflicts in package.json

### Build Script Not Found

```
ERROR: npm ERR! Missing script: "build"
```

**Resolution**:
1. Add build script to package.json
2. Or remove if not needed (for runtime-only projects)

### Python Dependency Failure

```
ERROR: Could not find a version that satisfies the requirement
```

**Resolution**:
1. Check Python version compatibility
2. Update requirements.txt with compatible versions
3. Consider using version ranges

### .NET Build Failure

```
ERROR: NETSDK1045: The current .NET SDK does not support targeting
```

**Resolution**:
1. Install required .NET SDK version
2. Update global.json or project target framework

## Validation Output

Record in manifest:

```markdown
### Package Validation Results

| Service | Status | Build Time | Notes |
|---------|--------|------------|-------|
| api | ✅ Pass | 45s | Docker image built |
| web | ✅ Pass | 30s | Static build completed |
| worker | ✅ Pass | 38s | Docker image built |

### Package Artifacts

| Service | Artifact Type | Size |
|---------|---------------|------|
| api | Docker image | 245 MB |
| web | Static files | 12 MB |
| worker | Docker image | 198 MB |
```

## Troubleshooting

### Verbose Output

```bash
azd package --no-prompt --debug
```

### Service-Specific Package

```bash
azd package <service-name> --no-prompt
```

### Skip Specific Service

```bash
azd package --no-prompt --service api --service worker
# Omit 'web' service
```

## Pre-Package Checks

Before running `azd package`, verify:

1. **Docker daemon running** (for container services)
   ```bash
   docker info
   ```

2. **Dependencies installed**
   ```bash
   npm install      # Node.js
   pip install -r requirements.txt  # Python
   dotnet restore   # .NET
   ```

3. **Environment variables set** (if build requires them)
   ```bash
   azd env get-values
   ```
