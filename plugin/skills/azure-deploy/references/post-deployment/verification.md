# Deployment Verification

Verify that deployment completed successfully and resources are operational.

## TASK

Confirm all deployed resources are running and accessible.

## Verification Checklist

| Check | Status | Action |
|-------|--------|--------|
| Infrastructure created | | Check Azure Portal or CLI |
| Services deployed | | Verify container/code deployed |
| Endpoints accessible | | Test health endpoints |
| Logs flowing | | Check Application Insights |
| Secrets accessible | | Verify Key Vault access |

## Verification Commands

### AZD Status

```bash
# Show deployed resources
azd show
```

Expected output:
```
Showing deployed resources:

  Resource Group: rg-myapp-dev
  
  Services:
    api
      Endpoint: https://api-xxxx.azurecontainerapps.io
    web
      Endpoint: https://web-xxxx.azurestaticapps.net
```

### Resource Group Check

```bash
az resource list --resource-group rg-myapp-dev --output table
```

### Health Endpoint Tests

```bash
# Test API health
curl -s https://api-xxxx.azurecontainerapps.io/health | jq .

# Test web app
curl -s -o /dev/null -w "%{http_code}" https://web-xxxx.azurestaticapps.net
```

Expected: HTTP 200 response

## Service-Specific Verification

### Container Apps

```bash
# Check revision status
az containerapp revision list \
  --name <app-name> \
  --resource-group <rg-name> \
  --query "[].{name:name, active:properties.active, replicas:properties.replicas}" \
  --output table
```

### App Service

```bash
# Check app status
az webapp show \
  --name <app-name> \
  --resource-group <rg-name> \
  --query "{state:state, hostNames:hostNames}" \
  --output json
```

### Azure Functions

```bash
# List functions
az functionapp function list \
  --name <function-app-name> \
  --resource-group <rg-name> \
  --output table
```

### Static Web Apps

```bash
# Get deployment status
az staticwebapp show \
  --name <app-name> \
  --resource-group <rg-name> \
  --query "{defaultHostname:defaultHostname, sku:sku.name}"
```

## Monitoring Verification

### Open Azure Portal

```bash
azd monitor --overview
```

### View Real-time Logs

```bash
azd monitor --logs
```

### Check Application Insights

```bash
# Query recent traces
az monitor app-insights query \
  --app <app-insights-name> \
  --resource-group <rg-name> \
  --analytics-query "traces | take 10"
```

## Database Connectivity

### Test Connection (Example)

```bash
# PostgreSQL
psql -h <server>.postgres.database.azure.com -U <username> -d <database> -c "SELECT 1"

# Cosmos DB
az cosmosdb sql database show \
  --account-name <account> \
  --name <database> \
  --resource-group <rg-name>
```

## Common Issues

### Service Not Starting

```bash
# Check container logs
az containerapp logs show \
  --name <app-name> \
  --resource-group <rg-name> \
  --type console
```

### Health Check Failing

- Verify `/health` endpoint returns 200
- Check startup time vs. probe timing
- Review application logs for errors

### Endpoint Not Accessible

- Check ingress configuration
- Verify DNS propagation
- Test from Azure Cloud Shell (network issues)

## Verification Output

Document in Preparation Manifest:

```markdown
## Deployment Verification

| Service | Endpoint | Health Check | Status |
|---------|----------|--------------|--------|
| api | https://api-xxxx.azurecontainerapps.io | ✅ 200 OK | Healthy |
| web | https://web-xxxx.azurestaticapps.net | ✅ 200 OK | Healthy |

### Monitoring Confirmed

| Check | Status |
|-------|--------|
| Application Insights receiving data | ✅ |
| Log Analytics queries working | ✅ |
| Alerts configured | ⏳ Pending |
```
