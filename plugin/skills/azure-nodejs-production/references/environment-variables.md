# Environment Variables

## Setting via Azure CLI

```bash
az containerapp update \
  --name APP \
  --resource-group RG \
  --set-env-vars \
    NODE_ENV=production \
    SESSION_SECRET=your-secret-here \
    PORT=3000
```

## Important Distinction: azd env set vs Application Variables

**`azd env set`** sets variables for the **azd provisioning process**, NOT application runtime environment variables. These are used by azd and Bicep during deployment (e.g., `AZURE_LOCATION`, `AZURE_SUBSCRIPTION_ID`).

**Application environment variables** (like `NODE_ENV`, `SESSION_SECRET`) must be configured in one of these ways:

### 1. In Bicep Templates
```bicep
env: [
  { name: 'NODE_ENV', value: 'production' }
  { name: 'SESSION_SECRET', secretRef: 'session-secret' }
]
```

### 2. Via Azure CLI
```bash
az containerapp update --set-env-vars NODE_ENV=production
```

### 3. In azure.yaml
```yaml
services:
  api:
    host: containerapp
    env:
      NODE_ENV: production
      PORT: "3000"
```

## azd Provisioning Parameters

These are for azd/Bicep configuration, NOT application runtime:
```bash
azd env set AZURE_LOCATION eastus
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
```
