---
name: azure-nodejs-production
description: Configure Express/Node.js applications for production deployment on Azure. Covers trust proxy settings, cookie configuration, health checks, port binding, and Dockerfile best practices for Container Apps and App Service.
---

# Express/Node.js Production Configuration for Azure

Configure Express/Node.js apps for Azure Container Apps and App Service with required production settings.

## When to Use

- Deploying Express apps to Azure Container Apps or App Service
- Fixing cookie/session issues in production
- Configuring health checks for Azure
- Setting up proper HTTPS handling behind Azure load balancers

## Required Settings

| Setting | Why Required |
|---------|--------------|
| `app.set('trust proxy', 1)` | Azure LB sits in front; needed for correct IP, HTTPS detection |
| `sameSite: 'lax'` cookie | Required for cookies through Azure proxy |
| `/health` endpoint | Azure probes for container health |
| Bind to `0.0.0.0` | Container networking requirement |
| `PORT` env var | Azure sets the port dynamically |

## Key Commands

```bash
# Configure health probe
az containerapp update --name APP --resource-group RG \
  --health-probe-path /health --health-probe-interval 30

# Set environment variables
az containerapp update --name APP --resource-group RG \
  --set-env-vars NODE_ENV=production SESSION_SECRET=secret
```

## References

- [production-config.md](references/production-config.md) - Complete Express configuration
- [dockerfile.md](references/dockerfile.md) - Dockerfile best practices
- [troubleshooting.md](references/troubleshooting.md) - Common issues and fixes
- [environment-variables.md](references/environment-variables.md) - Env var configuration (azd vs runtime)
