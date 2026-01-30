# Static Web Apps

Deploy static frontends (React, Vue, Angular) with optional serverless APIs.

## Quick Reference

| Property | Value |
|----------|-------|
| Deployment tool | `azd` (Azure Developer CLI) |
| Local dev tool | SWA CLI (`npx swa`) |
| Best for | React, Vue, Angular, Next.js (SSG), Gatsby, Astro |

## Deploy with azd (Required)

```bash
azd up --no-prompt              # Deploy everything
azd provision --no-prompt       # Create SWA resource
azd deploy --no-prompt          # Deploy built content
azd down --force --purge        # Clean up
```

## Prerequisites

```bash
# Install azd
brew tap azure/azure-dev && brew install azd  # macOS
winget install Microsoft.Azd                   # Windows

# SWA CLI (use npx - no install needed)
npx swa --version
```

## SKU Options

| SKU | Price | Features |
|-----|-------|----------|
| Free | $0/month | 2 domains, 100GB bandwidth |
| Standard | ~$9/month | 5 domains, unlimited bandwidth, SLA |

## Configuration Files

**swa-cli.config.json** (project root):
```json
{
  "configurations": {
    "app": {
      "appLocation": ".", "apiLocation": "api", "outputLocation": "dist",
      "appBuildCommand": "npm run build", "appName": "myapp", "resourceGroup": "rg"
    }
  }
}
```

**staticwebapp.config.json** (build output):
```json
{
  "navigationFallback": { "rewrite": "/index.html", "exclude": ["/api/*", "*.{css,js,png}"] },
  "routes": [{ "route": "/api/*", "allowedRoles": ["authenticated"] }],
  "platform": { "apiRuntime": "node:22" }
}
```

## Local Development

```bash
npx swa start                              # Uses config
npx swa start ./dist                       # Serve folder
npx swa start http://localhost:3000        # Proxy to dev server
npx swa start ./dist --api-location ./api  # With API
```

## Deploy

> ⚠️ Run `swa deploy` from PARENT directory, not inside output folder.

```bash
npx swa deploy ./dist --deployment-token "$TOKEN" --env production
npx swa deploy --dry-run         # Preview
npx swa deploy --verbose silly   # Debug
```

**Get token:** `az staticwebapp secrets list --name <app> -g <rg> --query "properties.apiKey" -o tsv`

## Framework Build Output

| Framework | Output Directory |
|-----------|-----------------|
| Vite (React/Vue/Svelte) | `dist/` |
| Create React App | `build/` |
| Angular | `dist/<project>/browser` |
| Next.js (export) | `out/` |
| Gatsby | `public/` |

## API Integration

```bash
mkdir api && cd api && npm init -y && npm install @azure/functions
func init --worker-runtime node --model V4
func new --name message --template "HTTP trigger"
```

**api/src/functions/message.js:**
```javascript
const { app } = require('@azure/functions');
app.http('message', {
    methods: ['GET'], authLevel: 'anonymous',
    handler: async (request) => ({ jsonBody: { message: 'Hello!' } })
});
```

## Authentication

**Built-in providers:** GitHub, Microsoft Entra ID, Twitter

```json
{
  "routes": [{ "route": "/login", "redirect": "/.auth/login/github" }],
  "responseOverrides": { "401": { "redirect": "/.auth/login/aad" } }
}
```

**Get user info (frontend):**
```javascript
const { clientPrincipal } = await (await fetch('/.auth/me')).json();
```

## Custom Domains

```bash
az staticwebapp hostname set --name <app> -g <rg> --hostname www.example.com
```

- Subdomain: CNAME `www` → `<app>.azurestaticapps.net`
- SSL: Automatic, free (Let's Encrypt)

## Best Practices

- Use `npx swa` instead of global install
- Create `swa-cli.config.json` manually (not `swa init`)
- Use `navigationFallback` for SPAs
- Set `platform.apiRuntime` explicitly
- Test locally with `npx swa start` before deploying

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `swa` not found | Use `npx swa` |
| 404 on client routes | Add `navigationFallback` with `rewrite: "/index.html"` |
| API 404 | Check `api/` structure, set `platform.apiRuntime` |
| Build output not found | Verify `outputLocation` matches actual build output |
| Config not applied | Put `staticwebapp.config.json` in output directory |
