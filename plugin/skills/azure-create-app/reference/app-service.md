# Azure App Service

## Quick Reference

| Property | Value |
|----------|-------|
| Deployment tool | `azd` (Azure Developer CLI) |
| Best for | Web apps, REST APIs, managed hosting |
| Templates | `todo-csharp-sql`, `todo-nodejs-mongo` |

## Deploy with azd (Required)

```bash
azd up --no-prompt                  # Deploy everything
azd provision --no-prompt           # Create resources only
azd deploy --no-prompt              # Deploy code only
azd down --force --purge            # Clean up (WARNING: deletes all)
```

> ⚠️ `azd down` permanently deletes ALL resources including databases.

## Prerequisites

```bash
# Install azd
brew tap azure/azure-dev && brew install azd  # macOS
winget install Microsoft.Azd                   # Windows

# Auth
azd auth login && azd env new <env-name>
```

**Run `/azure:preflight` before deploying.**

## Plan Tiers

| Tier | Features | Use Case |
|------|----------|----------|
| Free (F1) | 60 min/day | Dev/test |
| Basic (B1-B3) | Dedicated VMs | Small production |
| Standard (S1-S3) | Auto-scale, slots | Production |
| Premium (P1v3-P3v3) | Enhanced perf, VNet | High-scale |

## Runtimes

**Linux:** `NODE:20-lts`, `PYTHON:3.12`, `DOTNETCORE:8.0`, `JAVA:21-java21`
**Windows:** `v4.8`, `ASPNET:V6.0`

## Deployment Methods

```bash
# ZIP Deploy (recommended)
zip -r app.zip . -x "*.git*" "node_modules/*"
az webapp deploy --name myapp -g RG --src-path app.zip --type zip

# Git Deploy
az webapp deployment source config-local-git --name myapp -g RG
git remote add azure $(az webapp deployment list-publishing-credentials --name myapp -g RG --query scmUri -o tsv)
git push azure main

# GitHub Actions
az webapp deployment github-actions add --name myapp -g RG --repo owner/repo --branch main
```

## Deployment Slots

```bash
az webapp deployment slot create --name myapp -g RG --slot staging
az webapp deploy --name myapp -g RG --slot staging --src-path app.zip
az webapp deployment slot swap --name myapp -g RG --slot staging --target-slot production
```

## Configuration

```bash
az webapp config appsettings set --name myapp -g RG --settings NODE_ENV=production
az webapp config set --name myapp -g RG --always-on true --min-tls-version 1.2
az webapp config connection-string set --name myapp -g RG --connection-string-type SQLAzure --settings MyDb="Server=tcp:..."
```

## Scaling

```bash
az appservice plan update --name myplan -g RG --sku S1              # Scale up
az appservice plan update --name myplan -g RG --number-of-workers 3 # Scale out
az monitor autoscale create --name autoscale -g RG --resource {plan-id} --min-count 1 --max-count 10
```

## Monitoring

```bash
az webapp log tail --name myapp -g RG                    # Stream logs
az webapp log config --name myapp -g RG --application-logging azureblobstorage
az monitor app-insights component create --app myapp-insights -g RG --location eastus
```

## Best Practices

- Use deployment slots for zero-downtime deployments
- Store secrets in Key Vault with managed identity
- Enable always-on for production (Standard tier+)
- Configure health checks
- Enable Application Insights
- Set minimum TLS version to 1.2

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 503 error | Check logs: `az webapp log tail --name myapp -g RG` |
| Slow cold starts | Enable always-on or use Premium tier |
| App won't start | Verify runtime version and startup command |
| Connection errors | Check firewall rules and connection strings |
