# SWA Deployment Tests

Manual deployment tests for validating Static Web App configurations across different project structures.

## Test Projects

| # | Pattern | `project` | `language` | `dist` | Notes |
|---|---------|-----------|------------|--------|-------|
| 01 | Static files in root | `.` | `js` | `public` | Uses package.json build script to copy files |
| 02 | Framework app in root | `.` | `js` | `dist` | npm build creates dist/ |
| 03 | Static files in subfolder | `./src/web` | (omit) | `.` | No build needed |
| 04 | Framework app in subfolder | `./src/web` | `js` | `dist` | npm build creates dist/ |

## Key Finding

**SWA CLI Limitation:** When `project: .`, you **cannot** use `dist: .`. The SWA CLI errors with "Current directory cannot be identical to or contained within artifact folders."

**Solution for static files in root:** Add a `package.json` with a build script to copy files:

```json
{
  "scripts": {
    "build": "node scripts/copy-to-public.js"
  }
}
```

Then use `language: js` in azure.yaml to trigger `npm run build`.

## Running Tests

### Prerequisites

```bash
azd version
azd auth login --check-status
az account show
```

### Deploy All Tests

**Node.js (cross-platform):**
```bash
node test-swa-patterns.js --subscription "<your-subscription-id>"
node test-swa-patterns.js --subscription "<your-subscription-id>" --location westus2
node test-swa-patterns.js --subscription "<your-subscription-id>" --skip-deploy  # report only
```

**PowerShell:**
```powershell
.\test-swa-patterns.ps1 -SubscriptionId "<your-subscription-id>"
.\test-swa-patterns.ps1 -SubscriptionId "<your-subscription-id>" -Location westus2
.\test-swa-patterns.ps1 -SubscriptionId "<your-subscription-id>" -SkipDeploy  # report only
```

### Clean Up

**Node.js (cross-platform):**
```bash
node cleanup-swa-tests.js
```

**PowerShell:**
```powershell
.\cleanup-swa-tests.ps1
```

## Expected Results

Each deployment should:
1. ✅ Pass `azd provision` without errors
2. ✅ Pass `azd deploy` without errors
3. ✅ Show the test page at the deployed URL
4. ✅ Display the correct pattern description

## Troubleshooting

| Error | Fix |
|-------|-----|
| `language 'html' is not supported` | Omit `language` field |
| `LocationNotAvailableForResourceType` | Use `westus2` |
| `azd-service-name not found` | Check bicep has matching tag |
| `dist folder not found` | Verify `dist` is relative to `project` |
