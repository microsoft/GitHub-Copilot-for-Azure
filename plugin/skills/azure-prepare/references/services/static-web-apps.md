# Azure Static Web Apps

Hosting patterns and best practices for Azure Static Web Apps.

## When to Use

- Single Page Applications (React, Vue, Angular)
- Static sites (HTML/CSS/JS)
- JAMstack applications
- Sites with serverless API backends
- Documentation sites

## Required Supporting Resources

| Resource | Purpose |
|----------|---------|
| None required | Static Web Apps is fully managed |
| Application Insights | Monitoring (optional) |

## Project Structure Detection

Detect layout first, then apply correct configuration:

| Layout | Detection | `project` | `language` | `dist` |
|--------|-----------|-----------|------------|--------|
| Static already in `public/` | `index.html` in `public/` | `.` | (omit) | `public` |
| Static in root (needs copy) | `index.html` in root, no `public/` | `.` | `js` | `public` |
| Framework in root | `package.json` with framework | `.` | `js` | framework output |
| Static in subfolder | `index.html` in subfolder | `./src/web` | (omit) | `.` |
| Framework in subfolder | `package.json` in subfolder | `./src/web` | `js` | framework output |

> **Key rules:**
> - `dist` is **relative to `project`** path
> - Omit `language` only when static files are already in the correct output folder (e.g., `public/`)
> - **SWA CLI limitation**: When `project: .`, cannot use `dist: .` - files must be in a separate folder
> - For static files in root: add `package.json` with build script to copy files to `public/`, use `language: js`
> - `language: html` and `language: static` are **NOT valid** - will fail

## azure.yaml Configuration

### Static files in root (requires build script)

> ⚠️ SWA CLI cannot deploy from root to root. Add a package.json build script to copy files.

```json
{
  "scripts": {
    "build": "node -e \"const fs=require('fs'),path=require('path');const webExts=/\\.(html|css|js|png|jpe?g|gif|svg|ico|json|xml|txt|webmanifest|map|woff2?|ttf|eot)$/i;const skipDirs=['public','node_modules','.git','.azure','infra'];function copy(s,d){fs.mkdirSync(d,{recursive:true});for(const e of fs.readdirSync(s,{withFileTypes:true})){if(skipDirs.includes(e.name)||e.name.startsWith('.env'))continue;const sp=path.join(s,e.name),dp=path.join(d,e.name);if(e.isDirectory())copy(sp,dp);else if(webExts.test(e.name))fs.copyFileSync(sp,dp);}}copy('.','public');\""
  }
}
```

> Note: This script copies only web assets (html, css, js, images, fonts, etc.) and excludes `infra/`, config files, and `.env*` files.

```yaml
services:
  web:
    project: .
    language: js           # triggers npm run build
    host: staticwebapp
    dist: public
```

### Framework app (with build)

```yaml
services:
  web:
    project: .              # or ./src/web for subfolder
    language: js            # triggers npm install && npm run build
    host: staticwebapp
    dist: dist              # framework output folder
```

## Framework Build Configuration

| Framework | `dist` value |
|-----------|--------------|
| React (CRA) | `build` |
| Vue / Vite | `dist` |
| Angular | `dist/<project-name>` |
| Next.js (static) | `out` |
| Gatsby / Hugo | `public` |

```yaml
# React
services:
  web: { project: ., language: js, host: staticwebapp, dist: build }

# Vue / Vite
services:
  web: { project: ., language: js, host: staticwebapp, dist: dist }

# Angular (replace my-app with your project name)
services:
  web: { project: ., language: js, host: staticwebapp, dist: dist/my-app }

# Next.js (static export)
services:
  web: { project: ., language: js, host: staticwebapp, dist: out }
```

## Bicep Resource Pattern

```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })  // Required for azd
  sku: { name: 'Free', tier: 'Free' }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: { skipGithubActionWorkflowGeneration: true }
  }
}
```

## SKU Selection

| SKU | Features |
|-----|----------|
| Free | 2 custom domains, 0.5GB storage, shared bandwidth |
| Standard | 5 custom domains, 2GB storage, SLA, auth customization |

## Region Availability

> ⚠️ **LIMITED AVAILABILITY** — See [region-availability.md](../region-availability.md) for the authoritative list.

SWA is only available in 5 regions. Attempting to provision in unsupported regions (including `eastus`) will fail.

## Route Configuration

Create `staticwebapp.config.json`:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/*.{png,jpg,gif}"]
  },
  "responseOverrides": {
    "404": { "rewrite": "/404.html" }
  }
}
```

## Advanced Configuration

See [swa-advanced.md](swa-advanced.md) for API integration, GitHub-linked deployments, custom domains, authentication, and environment variables.
