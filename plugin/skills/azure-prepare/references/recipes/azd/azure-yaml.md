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

### Static Web App

For static sites WITH build steps (React, Vue, Angular):

```yaml
services:
  web:
    project: ./src/web
    language: js
    host: staticwebapp
    dist: dist
```

For pure static HTML sites (NO build step):

```yaml
services:
  web:
    project: ./src/web
    host: staticwebapp
    # Omit 'language' to skip build detection
    # Omit 'dist' or set to '/' for in-place deployment
```

**Important:** For pure static sites, omit the `language` field to prevent azd from attempting to run package manager commands (like `npm install`). The Bicep template should include `skipAppBuild: true` in buildProperties.

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
