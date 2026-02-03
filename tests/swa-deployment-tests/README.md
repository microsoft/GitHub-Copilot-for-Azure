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

```powershell
$subId = "<your-subscription-id>"
$tests = @("01-static-root", "02-framework-root", "03-static-subfolder", "04-framework-subfolder")

foreach ($test in $tests) {
    Write-Host "`n=== Testing $test ===" -ForegroundColor Cyan
    Push-Location $test
    azd env new "swa-test-$($test.Split('-')[0])" --no-prompt
    azd env set AZURE_LOCATION westus2
    azd env set AZURE_SUBSCRIPTION_ID $subId
    azd up --no-prompt
    Pop-Location
}
```

### Clean Up

```powershell
foreach ($test in $tests) {
    Push-Location $test
    azd down --force --purge --no-prompt
    Pop-Location
}
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
