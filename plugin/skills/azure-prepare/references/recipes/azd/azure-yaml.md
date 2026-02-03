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

### Static Web App (with framework build)

For React, Vue, Angular, Next.js, etc. that require `npm run build`:

```yaml
services:
  web:
    project: ./src/web     # folder containing package.json
    language: js           # triggers: npm install && npm run build
    host: staticwebapp
    dist: dist             # build output folder (e.g., dist, build, out)
```

### Static Web App (pure HTML/CSS - no build)

For pure HTML sites without a build step:

```yaml
# Static files in subfolder (recommended)
services:
  web:
    project: ./src/web     # folder containing index.html
    host: staticwebapp
    dist: .                # works when project != root

# Static files in root - put in public/ folder
services:
  web:
    project: .
    host: staticwebapp
    dist: public           # SWA CLI requires distinct output folder when project: .
```

### SWA Project Structure Detection

| Layout | Configuration |
|--------|---------------|
| Static in root | `project: .`, `dist: public` (put files in `public/` folder) |
| Framework in root | `project: .`, `language: js`, `dist: <output>` |
| Static in subfolder | `project: ./path`, `dist: .` |
| Framework in subfolder | `project: ./path`, `language: js`, `dist: <output>` |

> **Key rules:**
> - `dist` is **relative to `project`** path
> - **SWA CLI limitation**: When `project: .`, cannot use `dist: .` - use a distinct folder
> - Omit `language` for pure static sites (no build)
> - `language: html` and `language: static` are **NOT valid** - will fail

### SWA Bicep Requirement

Bicep must include the `azd-service-name` tag:
```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })}
```
}
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
| `language` | python, js, ts, java, dotnet, go (omit for staticwebapp without build) |
| `host` | containerapp, appservice, function, staticwebapp, aks |

## Output

- `./azure.yaml`
