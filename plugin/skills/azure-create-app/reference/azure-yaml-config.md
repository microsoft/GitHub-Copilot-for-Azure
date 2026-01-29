# azure.yaml Configuration

The `azure.yaml` file defines your application's Azure deployment configuration.

## Host Property

The `host` property determines the Azure service:

| Value | Azure Service |
|-------|---------------|
| `containerapp` | Azure Container Apps |
| `appservice` | Azure App Service |
| `staticwebapp` | Azure Static Web Apps |
| `function` | Azure Functions |
| `aks` | Azure Kubernetes Service |

## Language Property

The `language` property specifies the application runtime.

**Valid values:** `js`, `ts`, `python`, `csharp`, `java`, `go`

**Rules by host type:**

| Host | Language Requirement |
|------|---------------------|
| `staticwebapp` | Do NOT specify for plain HTML sites |
| `containerapp` | Optional, used for build detection |
| `appservice` | Required for runtime selection |
| `function` | Required for runtime |

## Example Configurations

### Multi-Service Application

```yaml
name: my-application
services:
  web:
    project: ./src/web
    host: staticwebapp
    dist: ./dist
  api:
    project: ./src/api
    host: containerapp
    language: python
```

### Single Container App

```yaml
name: my-api
services:
  api:
    project: .
    host: containerapp
    language: ts
```

### Azure Functions

```yaml
name: my-functions
services:
  func:
    project: .
    host: function
    language: python
```

### Static Web App with API

```yaml
name: my-frontend
services:
  web:
    project: .
    host: staticwebapp
    dist: ./dist
```
