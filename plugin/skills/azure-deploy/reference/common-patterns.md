# Common Azure Deployment Patterns

Shared commands and patterns used across all deployment guides. Reference this to avoid duplication.

---

## Resource Group Commands

```bash
# Create
az group create --name <rg> --location <location>

# Delete
az group delete --name <rg> --yes --no-wait

# List
az group list --output table
```

## Common Locations

| Region | Location Code |
|--------|---------------|
| East US | `eastus` |
| West US 2 | `westus2` |
| Central US | `centralus` |
| West Europe | `westeurope` |
| North Europe | `northeurope` |
| Southeast Asia | `southeastasia` |
| Australia East | `australiaeast` |

## App Settings Pattern

```bash
# Set (works for webapp, functionapp, staticwebapp)
az <service> config appsettings set \
  --name <app> \
  --resource-group <rg> \
  --settings KEY1=value1 KEY2=value2

# List
az <service> config appsettings list \
  --name <app> \
  --resource-group <rg> \
  --output table

# Delete
az <service> config appsettings delete \
  --name <app> \
  --resource-group <rg> \
  --setting-names KEY1 KEY2
```

## Logging Pattern

```bash
# Stream logs (works for webapp, functionapp)
az <service> log tail \
  --name <app> \
  --resource-group <rg>

# Download logs
az <service> log download \
  --name <app> \
  --resource-group <rg> \
  --log-file logs.zip
```

## Deployment Slots Pattern

```bash
# Create slot
az <service> deployment slot create \
  --name <app> \
  --resource-group <rg> \
  --slot staging

# Deploy to slot
az <service> deploy \
  --name <app> \
  --resource-group <rg> \
  --slot staging \
  --src-path app.zip

# Swap slots
az <service> deployment slot swap \
  --name <app> \
  --resource-group <rg> \
  --slot staging \
  --target-slot production
```

## Build Commands by Framework

| Framework | Build Command | Output Directory |
|-----------|--------------|------------------|
| React (CRA) | `npm run build` | `build/` |
| React (Vite) | `npm run build` | `dist/` |
| Vue (Vite) | `npm run build` | `dist/` |
| Angular | `npm run build` | `dist/<project>/` |
| Next.js (Static) | `npm run build` | `out/` |
| Next.js (SSR) | `npm run build` | `.next/` |
| Nuxt (Static) | `npm run generate` | `.output/public/` |
| Gatsby | `npm run build` | `public/` |
| Astro | `npm run build` | `dist/` |
| Svelte | `npm run build` | `build/` |
| Python | N/A | `.` |
| .NET | `dotnet publish -c Release` | `bin/Release/net*/publish/` |

## Zip Deployment Pattern

```bash
# Create zip excluding common files
zip -r app.zip . \
  -x "node_modules/*" \
  -x ".git/*" \
  -x ".env*" \
  -x "*.log" \
  -x ".venv/*" \
  -x "__pycache__/*" \
  -x "local.settings.json"

# Deploy zip
az <service> deploy \
  --name <app> \
  --resource-group <rg> \
  --src-path app.zip \
  --type zip
```

## Storage Account (Required for Functions)

```bash
# Create (name must be globally unique, 3-24 chars, lowercase alphanumeric)
az storage account create \
  --name <storage> \
  --resource-group <rg> \
  --location <location> \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name <storage> \
  --resource-group <rg> \
  --query connectionString -o tsv
```

## Custom Domain Pattern

```bash
# Add hostname
az <service> config hostname add \
  --webapp-name <app> \
  --resource-group <rg> \
  --hostname <domain>

# Create managed certificate
az <service> config ssl create \
  --name <app> \
  --resource-group <rg> \
  --hostname <domain>
```

## Environment Variables Template

```bash
# Common environment variables for production
NODE_ENV=production
WEBSITE_NODE_DEFAULT_VERSION=~20
FUNCTIONS_WORKER_RUNTIME=<node|python|dotnet|java>
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```
