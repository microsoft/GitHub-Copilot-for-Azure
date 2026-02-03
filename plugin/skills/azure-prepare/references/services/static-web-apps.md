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
| Static in root | `index.html` in `public/` | `.` | (omit) | `public` |
| Framework in root | `package.json` in root | `.` | `js` | framework output |
| Static in subfolder | `index.html` in subfolder | `./src/web` | (omit) | `.` |
| Framework in subfolder | `package.json` in subfolder | `./src/web` | `js` | framework output |

> **Key rules:**
> - `dist` is **relative to `project`** path
> - Omit `language` for pure static (no build step)
> - **For static files in root**: put files in `public/` folder (SWA CLI requires distinct dist folder)
> - `language: html` and `language: static` are **NOT valid** - will fail

## azure.yaml Configuration

### Static files in root (no build)

```yaml
services:
  web:
    project: .
    host: staticwebapp
    dist: public            # SWA CLI requires distinct output folder
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

> ⚠️ **LIMITED AVAILABILITY** — SWA is NOT available in many common regions. See [region-availability.md](../region-availability.md) for full matrix.

**Available regions:** `westus2`, `westus3`, `centralus`, `westeurope`, `eastasia`, `australiaeast`

**NOT available (will FAIL):**
- ❌ `eastus` — NOT SUPPORTED
- ❌ `eastus2` — NOT SUPPORTED  
- ❌ `northeurope` — NOT SUPPORTED

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
