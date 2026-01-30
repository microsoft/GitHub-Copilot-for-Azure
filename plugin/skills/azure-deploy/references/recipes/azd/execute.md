# Execute Deployment

Run the deployment command.

## Full Deployment

Provisions infrastructure AND deploys application code:

```bash
azd up --no-prompt
```

## Infrastructure Only

Create or update Azure resources without deploying code:

```bash
azd provision --no-prompt
```

## Application Only

Deploy code to existing infrastructure:

```bash
azd deploy --no-prompt
```

## Single Service

Deploy specific service only:

```bash
azd deploy api --no-prompt
azd deploy web --no-prompt
```

## Successful Output

```
Provisioning Azure resources (azd provision)

  (✓) Done: Resource group rg-myapp-dev
  (✓) Done: Container Apps Environment
  (✓) Done: Container App api

Deploying services (azd deploy)

  (✓) Done: Deploying service api
  - Endpoint: https://api-xxxx.azurecontainerapps.io

SUCCESS: Your application was deployed to Azure
```
