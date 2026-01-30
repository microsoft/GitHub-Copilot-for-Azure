# azure.yaml Generation

Create valid azure.yaml configuration file.

## TASK

Generate the azure.yaml file that maps application services to Azure hosting.

## File Location

```
project-root/
└── azure.yaml    # Root of the project
```

## Basic Structure

```yaml
name: my-app
metadata:
  template: azd-init

services:
  api:
    host: containerapp
    project: ./src/api
    docker:
      path: ./Dockerfile

  web:
    host: staticwebapp
    project: ./src/web
```

## Service Type Mappings

| Host Type | Azure Service | Use For |
|-----------|---------------|---------|
| `containerapp` | Container Apps | APIs, microservices, workers |
| `appservice` | App Service | Traditional web apps |
| `function` | Azure Functions | Serverless functions |
| `staticwebapp` | Static Web Apps | SPAs, static sites |
| `aks` | AKS | Kubernetes workloads |

## Service Configuration

### Container App

```yaml
services:
  api:
    host: containerapp
    project: ./src/api
    docker:
      path: ./Dockerfile
      context: .
```

### App Service

```yaml
services:
  web:
    host: appservice
    project: ./src/web
    language: node
```

### Azure Functions

```yaml
services:
  functions:
    host: function
    project: ./src/functions
    language: python
```

### Static Web App

```yaml
services:
  frontend:
    host: staticwebapp
    project: ./src/frontend
    dist: build      # Build output directory
```

### AKS

```yaml
services:
  microservice:
    host: aks
    project: ./src/microservice
    docker:
      path: ./Dockerfile
    k8s:
      deploymentPath: ./k8s
```

## Path Rules

### project

Points to the service source directory:

```yaml
project: ./src/api    # ✅ Relative to azure.yaml
project: src/api      # ✅ Also valid
project: /src/api     # ❌ No absolute paths
```

### docker.path

Relative to the service project directory:

```yaml
services:
  api:
    project: ./src/api
    docker:
      path: ./Dockerfile          # → src/api/Dockerfile
      path: ../shared/Dockerfile  # → src/shared/Dockerfile
```

### docker.context

Build context, relative to project:

```yaml
docker:
  path: ./Dockerfile
  context: ../..    # Build from project root
```

## Naming Rules

Service names must be:
- Alphanumeric with hyphens
- Start with a letter
- No underscores or special characters

```yaml
services:
  user-api: ...      # ✅ Valid
  userApi: ...       # ✅ Valid
  user_api: ...      # ❌ Invalid (underscore)
  1-api: ...         # ❌ Invalid (starts with number)
```

## Infrastructure Configuration

### Custom Bicep Path

```yaml
infra:
  path: ./infra
  module: main
```

### Resource Group Targeting

```yaml
resourceGroup: rg-${AZURE_ENV_NAME}
```

## Hooks

Pre/post deployment hooks:

```yaml
hooks:
  preprovision:
    shell: sh
    run: ./scripts/setup.sh
  postprovision:
    shell: sh
    run: ./scripts/post-provision.sh
  predeploy:
    shell: sh
    run: npm run build
  postdeploy:
    shell: sh
    run: ./scripts/verify.sh
```

## Complete Example

```yaml
name: contoso-app
metadata:
  template: azd-init

infra:
  path: ./infra
  module: main

services:
  api:
    host: containerapp
    project: ./src/api
    docker:
      path: ./Dockerfile

  web:
    host: staticwebapp
    project: ./src/web
    dist: build

  worker:
    host: containerapp
    project: ./src/worker
    docker:
      path: ./Dockerfile

hooks:
  postprovision:
    shell: sh
    run: ./scripts/seed-data.sh
```

## Validation

After generation, validate with:

```bash
azd config list      # Check configuration
azd package          # Verify packaging works
```

## Checklist Format

Document in Preparation Manifest:

```markdown
## azure.yaml Configuration

| Service | Host Type | Project Path | Status |
|---------|-----------|--------------|--------|
| api | containerapp | ./src/api | ✅ Configured |
| web | staticwebapp | ./src/web | ✅ Configured |
| worker | containerapp | ./src/worker | ✅ Configured |
```
