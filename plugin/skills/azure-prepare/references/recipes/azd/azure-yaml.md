# azure.yaml Generation

Create `azure.yaml` in project root for AZD.

## Structure

```yaml
name: <project-name>
metadata:
  template: azd-init

services:
  <service-name>:
    project: <path-to-source>
    language: <python|js|ts|java|dotnet|go>
    host: <containerapp|appservice|function|staticwebapp|aks>
```

## Host Types

| Host | Azure Service | Use For |
|------|---------------|---------|
| `containerapp` | Container Apps | APIs, microservices, workers |
| `appservice` | App Service | Traditional web apps |
| `function` | Azure Functions | Serverless functions |
| `staticwebapp` | Static Web Apps | SPAs, static sites |
| `aks` | AKS | Kubernetes workloads |

## Examples

### Container App

```yaml
services:
  api:
    project: ./src/api
    language: python
    host: containerapp
    docker:
      path: ./src/api/Dockerfile
```

### Azure Functions

```yaml
services:
  functions:
    project: ./src/functions
    language: js
    host: function
```

### Azure Functions - TypeScript

TypeScript Functions support **two deployment approaches**:

#### Remote Build (Recommended)
```yaml
services:
  functions:
    project: ./src/functions
    language: ts  # Use 'ts' for remote build
    host: function
```

**How it works:**
1. Uploads TypeScript source (`.ts` files) and `tsconfig.json`
2. Azure's Oryx build system compiles TypeScript remotely
3. No local build step needed

**Required `.funcignore`:**
```gitignore
node_modules/     # MUST exclude to avoid permission errors
*.js.map
.git*
.vscode
local.settings.json
test
```

**Common error if misconfigured:**
```
Error: sh: 1: tsc: Permission denied
```

**Fix:** Ensure `.funcignore` excludes `node_modules/` and does NOT exclude `*.ts` or `tsconfig.json`.

#### Local Build (Alternative)
```yaml
services:
  functions:
    project: ./src/functions
    language: js  # Use 'js' for local build
    host: function
    hooks:
      prepackage:
        shell: sh
        run: npm run build
```

**How it works:**
1. `npm run build` compiles TypeScript locally before packaging
2. Uploads compiled JavaScript files only
3. Faster deployment, but requires local Node.js setup

**Required `.funcignore`:**
```gitignore
*.ts              # Exclude source files
tsconfig.json     # Exclude config
node_modules/
.git*
.vscode
local.settings.json
test
```

### Static Web App

```yaml
services:
  web:
    project: ./src/web
    language: js
    host: staticwebapp
    dist: dist
```

### App Service

```yaml
services:
  api:
    project: ./src/api
    language: dotnet
    host: appservice
```

## Hooks (Optional)

```yaml
hooks:
  preprovision:
    shell: sh
    run: ./scripts/setup.sh
  postprovision:
    shell: sh
    run: ./scripts/seed-data.sh
```

## Valid Values

| Field | Options |
|-------|---------|
| `language` | python, js, ts, java, dotnet, go |
| `host` | containerapp, appservice, function, staticwebapp, aks |

## Output

- `./azure.yaml`
