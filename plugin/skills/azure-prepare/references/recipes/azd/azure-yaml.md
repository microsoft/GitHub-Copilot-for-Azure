# Generate azure.yaml

Create `azure.yaml` in project root.

## Basic Structure

```yaml
name: <project-name>
metadata:
  template: <template-name>@0.0.1-beta

services:
  <service-name>:
    project: <path-to-source>
    language: <python|js|ts|java|dotnet|go>
    host: <containerapp|appservice|function|staticwebapp>
```

## Service Configuration by Host Type

### Container Apps

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

### Static Web Apps

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
