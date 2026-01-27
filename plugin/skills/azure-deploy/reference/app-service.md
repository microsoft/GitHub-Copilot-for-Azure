# App Service Deployment Guide

Comprehensive guide for deploying applications to Azure App Service.

---

## Overview

Azure App Service is a fully managed platform for building, deploying, and scaling web apps. Use App Service for:

- Full-stack web applications (Node.js, Python, .NET, Java, PHP, Ruby)
- REST APIs and backend services
- Server-side rendered (SSR) frameworks (Next.js, Nuxt, etc.)
- Containerized applications

---

## Quick Start

```bash
# 1. Create resource group
az group create --name myapp-rg --location eastus

# 2. Create App Service plan
az appservice plan create \
  --name myapp-plan \
  --resource-group myapp-rg \
  --sku B1 \
  --is-linux

# 3. Create web app
az webapp create \
  --name myapp \
  --resource-group myapp-rg \
  --plan myapp-plan \
  --runtime "NODE:22-lts"

# 4. Deploy code
az webapp deploy \
  --name myapp \
  --resource-group myapp-rg \
  --src-path ./app.zip \
  --type zip
```

---

## App Service Plans

### SKU Recommendations

| Environment | SKU | vCPU | Memory | Features |
|-------------|-----|------|--------|----------|
| Dev/Test | **B1** | 1 | 1.75 GB | Custom domains, SSL |
| Production (small) | **P1v3** | 2 | 8 GB | Auto-scale, staging slots, backups |
| Production (medium) | **P2v3** | 4 | 16 GB | More resources |
| Production (large) | **P3v3** | 8 | 32 GB | Maximum resources |

### Create Plan

```bash
# Linux plan (recommended for most workloads)
az appservice plan create \
  --name <plan-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku B1 \
  --is-linux

# Windows plan (for .NET Framework or Windows-specific needs)
az appservice plan create \
  --name <plan-name> \
  --resource-group <resource-group> \
  --location <location> \
  --sku B1
```

---

## Runtime Configuration

### Available Runtimes (Linux)

**Node.js (use LTS versions):**
```bash
--runtime "NODE:22-lts"   # LTS - Recommended (EOL: April 2027)
--runtime "NODE:20-lts"   # LTS (EOL: April 2026)
```

**Python:**
```bash
--runtime "PYTHON:3.10"
--runtime "PYTHON:3.11"
--runtime "PYTHON:3.12"
```

**.NET:**
```bash
--runtime "DOTNETCORE:7.0"
--runtime "DOTNETCORE:8.0"
```

**Java:**
```bash
--runtime "JAVA:11-java11"
--runtime "JAVA:17-java17"
--runtime "JAVA:21-java21"
```

**PHP:**
```bash
--runtime "PHP:8.2"
--runtime "PHP:8.3"
```

### List Available Runtimes

```bash
az webapp list-runtimes --os linux
az webapp list-runtimes --os windows
```

---

## Deployment Methods

### 1. Zip Deploy (Recommended)

```bash
# Create zip of your application
zip -r app.zip . -x "node_modules/*" -x ".git/*"

# Deploy
az webapp deploy \
  --name <app-name> \
  --resource-group <resource-group> \
  --src-path app.zip \
  --type zip
```

### 2. Deploy from Git Repository

```bash
# Configure deployment source
az webapp deployment source config \
  --name <app-name> \
  --resource-group <resource-group> \
  --repo-url <git-repo-url> \
  --branch main \
  --manual-integration
```

### 3. Deploy from Local Git

```bash
# Enable local git deployment
az webapp deployment source config-local-git \
  --name <app-name> \
  --resource-group <resource-group>

# Get deployment URL
az webapp deployment list-publishing-credentials \
  --name <app-name> \
  --resource-group <resource-group> \
  --query scmUri -o tsv

# Push to deploy
git remote add azure <deployment-url>
git push azure main
```

### 4. Deploy from Container

```bash
# Create web app with container
az webapp create \
  --name <app-name> \
  --resource-group <resource-group> \
  --plan <plan-name> \
  --container-image-name <image:tag>

# Update container image
az webapp config container set \
  --name <app-name> \
  --resource-group <resource-group> \
  --container-image-name <new-image:tag>
```

---

## Application Settings

### Set Environment Variables

```bash
# Set single setting
az webapp config appsettings set \
  --name <app-name> \
  --resource-group <resource-group> \
  --settings KEY=value

# Set multiple settings
az webapp config appsettings set \
  --name <app-name> \
  --resource-group <resource-group> \
  --settings \
    DATABASE_URL="<connection-string>" \
    API_KEY="<key>" \
    NODE_ENV="production"
```

### Connection Strings

```bash
az webapp config connection-string set \
  --name <app-name> \
  --resource-group <resource-group> \
  --connection-string-type SQLAzure \
  --settings \
    DefaultConnection="<connection-string>"
```

### View Settings

```bash
az webapp config appsettings list \
  --name <app-name> \
  --resource-group <resource-group> \
  --output table
```

---

## Startup Configuration

### Custom Startup Command

```bash
az webapp config set \
  --name <app-name> \
  --resource-group <resource-group> \
  --startup-file "<command>"
```

**Examples by runtime:**

```bash
# Node.js
--startup-file "node server.js"
--startup-file "npm start"

# Python
--startup-file "gunicorn --bind=0.0.0.0 app:app"
--startup-file "uvicorn main:app --host 0.0.0.0 --port 8000"

# .NET
--startup-file "dotnet MyApp.dll"
```

---

## Scaling

### Manual Scaling

```bash
# Scale up (change SKU)
az appservice plan update \
  --name <plan-name> \
  --resource-group <resource-group> \
  --sku P1v3

# Scale out (add instances)
az appservice plan update \
  --name <plan-name> \
  --resource-group <resource-group> \
  --number-of-workers 3
```

### Auto-Scaling (Premium SKUs)

```bash
# Enable autoscale
az monitor autoscale create \
  --resource-group <resource-group> \
  --resource <plan-name> \
  --resource-type Microsoft.Web/serverFarms \
  --name <autoscale-name> \
  --min-count 1 \
  --max-count 10 \
  --count 1

# Add CPU-based rule
az monitor autoscale rule create \
  --resource-group <resource-group> \
  --autoscale-name <autoscale-name> \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 1
```

---

## Deployment Slots (Staging)

Requires Standard or Premium SKU.

```bash
# Create staging slot
az webapp deployment slot create \
  --name <app-name> \
  --resource-group <resource-group> \
  --slot staging

# Deploy to staging
az webapp deploy \
  --name <app-name> \
  --resource-group <resource-group> \
  --slot staging \
  --src-path app.zip \
  --type zip

# Swap staging to production
az webapp deployment slot swap \
  --name <app-name> \
  --resource-group <resource-group> \
  --slot staging \
  --target-slot production
```

---

## Custom Domains & SSL

### Add Custom Domain

```bash
# Add domain
az webapp config hostname add \
  --webapp-name <app-name> \
  --resource-group <resource-group> \
  --hostname www.example.com

# Create managed certificate
az webapp config ssl create \
  --name <app-name> \
  --resource-group <resource-group> \
  --hostname www.example.com

# Bind certificate
az webapp config ssl bind \
  --name <app-name> \
  --resource-group <resource-group> \
  --certificate-thumbprint <thumbprint> \
  --ssl-type SNI
```

---

## Logging & Diagnostics

### Enable Logging

```bash
# Enable application logging
az webapp log config \
  --name <app-name> \
  --resource-group <resource-group> \
  --application-logging filesystem \
  --level verbose

# Enable web server logging
az webapp log config \
  --name <app-name> \
  --resource-group <resource-group> \
  --web-server-logging filesystem
```

### View Logs

```bash
# Stream live logs
az webapp log tail \
  --name <app-name> \
  --resource-group <resource-group>

# Download logs
az webapp log download \
  --name <app-name> \
  --resource-group <resource-group> \
  --log-file logs.zip
```

---

## Common Configurations by Framework

### Node.js / Express

```bash
az webapp create \
  --name myapp \
  --resource-group myapp-rg \
  --plan myapp-plan \
  --runtime "NODE:22-lts"

az webapp config appsettings set \
  --name myapp \
  --resource-group myapp-rg \
  --settings \
    NODE_ENV=production \
    PORT=8080
```

### Python / Flask

```bash
az webapp create \
  --name myapp \
  --resource-group myapp-rg \
  --plan myapp-plan \
  --runtime "PYTHON:3.11"

az webapp config set \
  --name myapp \
  --resource-group myapp-rg \
  --startup-file "gunicorn --bind=0.0.0.0 app:app"
```

### Python / FastAPI

```bash
az webapp create \
  --name myapp \
  --resource-group myapp-rg \
  --plan myapp-plan \
  --runtime "PYTHON:3.11"

az webapp config set \
  --name myapp \
  --resource-group myapp-rg \
  --startup-file "uvicorn main:app --host 0.0.0.0 --port 8000"
```

### .NET Core

```bash
az webapp create \
  --name myapp \
  --resource-group myapp-rg \
  --plan myapp-plan \
  --runtime "DOTNETCORE:8.0"

# .NET apps auto-detect entry point
```

### Next.js (SSR)

```bash
az webapp create \
  --name myapp \
  --resource-group myapp-rg \
  --plan myapp-plan \
  --runtime "NODE:22-lts"

az webapp config appsettings set \
  --name myapp \
  --resource-group myapp-rg \
  --settings \
    NODE_ENV=production

az webapp config set \
  --name myapp \
  --resource-group myapp-rg \
  --startup-file "npm start"
```

---

## Cleanup

```bash
# Delete web app
az webapp delete \
  --name <app-name> \
  --resource-group <resource-group>

# Delete entire resource group (removes all resources)
az group delete --name <resource-group> --yes
```
