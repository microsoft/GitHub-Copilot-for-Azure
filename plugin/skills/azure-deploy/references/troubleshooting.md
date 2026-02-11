# Troubleshooting

This reference covers common errors encountered during Azure deployment with `azd` and how to resolve them.

## Language Not Supported

**Symptom:** Error message like `ERROR: error executing step command 'package --all': initializing service 'web', getting framework service: language 'html' is not supported by built-in framework services`

**Cause:** Using unsupported language value in `azure.yaml`. Neither `html` nor `static` are valid language types for azd.

**Solution:**

For pure HTML/CSS static sites, omit the `language` field:

```yaml
services:
  web:
    project: ./src/web   # or . for root
    host: staticwebapp
    dist: .              # relative to project path (only works when project != root)
```

Valid language values: `python`, `js`, `ts`, `java`, `dotnet`, `go` (or omit for staticwebapp without build)

## SWA Project Path Issues

**Symptom:** Deployment fails, gets stuck in "Uploading", or shows default Azure page

**Cause:** Incorrect `project` or `dist` configuration.

**Solution:** Match configuration to your project layout:

| Layout | `project` | `dist` |
|--------|-----------|--------|
| Static files in root | `.` | `public` (put files in public/ folder) |
| Framework in root | `.` | `dist`/`build`/`out` |
| Static in subfolder | `./src/web` | `.` |
| Framework in subfolder | `./src/web` | `dist`/`build`/`out` |

> **SWA CLI Limitation:** When `project: .`, you **cannot** use `dist: .`. Put static files in a `public/` folder instead.

## SWA Dist Not Found

**Symptom:** Error like `dist folder not found` or empty deployment

**Cause:** The `dist` path doesn't exist or build didn't run.

**Solution:**
1. For framework apps: ensure `language: js` is set to trigger build
2. Verify `dist` value matches your framework's output folder
3. For pure static in root: put files in `public/` folder and use `dist: public`
4. For pure static in subfolder: use `dist: .`

## Service Resource Not Found

**Symptom:** Error message like `ERROR: getting target resource: resource not found: unable to find a resource tagged with 'azd-service-name: web'`

**Cause:** The Azure resource is missing the `azd-service-name` tag that azd uses to link services defined in `azure.yaml` to deployed infrastructure.

**Solution:**

Add the tag to your bicep resource definition:

```bicep
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })  // Must match service name in azure.yaml
  // ... rest of config
}
```

After updating, run `azd provision` to apply the tag, then `azd deploy`.

## Location Not Available for Resource Type

**Symptom:** Error message like `LocationNotAvailableForResourceType: The provided location 'westus3' is not available for resource type 'Microsoft.Web/staticSites'`

**Cause:** Azure Static Web Apps is not available in all regions.

**Solution:**

Change to a supported region:

```bash
azd env set AZURE_LOCATION westus2
```

Available regions for Static Web Apps: `westus2`, `centralus`, `eastus2`, `westeurope`, `eastasia`

## Missing Infrastructure Parameters

**Symptom:** Error message like `ERROR: prompting for value: no default response for prompt 'Enter a value for the '<param>' infrastructure parameter:'`

**Cause:** A Bicep parameter exists in your template but no corresponding environment variable is set.

**Example:** The `infra/main.bicep` has a parameter like:
```bicep
@description('SKU for the storage account.')
param storageAccountSku string
```

**Solution:**

1. Check `infra/main.parameters.json` for an existing mapping to this parameter.

2. **If a mapping exists** (e.g., `"value": "${STORAGE_SKU}"`), ask the user for the desired value and set the environment variable:
```bash
azd env set STORAGE_SKU <user-provided-value>
```

3. **If no mapping exists**, add one to `infra/main.parameters.json`:
```json
{
  "parameters": {
    "storageAccountSku": {
      "value": "${STORAGE_SKU}"
    }
  }
}
```

Then ask the user for the desired value and set the environment variable:
```bash
azd env set STORAGE_SKU <user-provided-value>
```

During `azd provision`, azd will substitute `${STORAGE_SKU}` with the value from the environment and will pass it to Bicep.

**Reference:** [Use environment variables in infrastructure files](https://learn.microsoft.com/azure/developer/azure-developer-cli/manage-environment-variables?tabs=bash#use-environment-variables-in-infrastructure-files)

## Node.js Functions Not Registered After Deployment

**Symptom:** Infrastructure deploys successfully, Function App shows "Running" status, but `az functionapp function list` returns empty array and API endpoints return 404 Not Found.

**Cause:** Node.js v4 programming model requires explicit entry point configuration in `package.json`. Without the `main` field, the Azure Functions runtime cannot locate function registrations, even though deployment succeeds.

**Solution:**

1. **Add entry point to package.json:**

Edit your `package.json` to include a `main` field pointing to your function registration file:

```json
{
  "name": "my-functions",
  "main": "src/index.js",
  "dependencies": {
    "@azure/functions": "^4.0.0"
  }
}
```

For TypeScript projects, point to the compiled JavaScript output:

```json
{
  "main": "dist/index.js"
}
```

2. **Verify host.json exists:**

Create `host.json` at the project root if missing:

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

3. **Check function registration code:**

Ensure your entry file uses the v4 registration pattern with the `app` object:

```javascript
const { app } = require('@azure/functions');

app.http('myFunction', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        return { status: 200, body: 'Success' };
    }
});
```

4. **Redeploy:**

```bash
azd deploy
```

5. **Verify functions registered:**

```bash
az functionapp function list \
  --name <function-app-name> \
  --resource-group <resource-group-name> \
  --query "[].name" -o table
```

**Additional checks:**

- Ensure `@azure/functions` is in `dependencies`, not `devDependencies`
- Verify the path in `main` matches your actual file structure
- Check deployment logs for any packaging errors: `azd deploy --debug`
- For TypeScript, ensure build runs before deployment and outputs to the path specified in `main`
