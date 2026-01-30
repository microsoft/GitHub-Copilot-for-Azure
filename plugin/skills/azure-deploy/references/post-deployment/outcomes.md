# Deployment Outcomes

Record and track deployment outcomes in the Preparation Manifest.

## TASK

Document deployment results for audit, troubleshooting, and team awareness.

## Outcome Recording

After each deployment, update the Preparation Manifest with:

### Deployment Status Section

```markdown
## Deployment Status

| Environment | Status | Timestamp | Deployed By | Notes |
|-------------|--------|-----------|-------------|-------|
| dev | ✅ Deployed | 2026-01-29T14:30:00Z | user@example.com | Initial deployment |
| staging | ⏳ Pending | | | |
| prod | ⏳ Pending | | | |
```

### Status Values

| Status | Meaning |
|--------|---------|
| ⏳ Pending | Not yet deployed |
| 🔄 In Progress | Deployment running |
| ✅ Deployed | Successfully deployed |
| ❌ Failed | Deployment failed |
| ⚠️ Degraded | Partial success or issues |

### Deployed Resources Section

```markdown
### Deployed Resources

| Resource | Type | Name | URL/Endpoint |
|----------|------|------|--------------|
| API | Container App | myapp-api-xxxx | https://myapp-api-xxxx.azurecontainerapps.io |
| Web | Static Web App | myapp-web-xxxx | https://myapp-web-xxxx.azurestaticapps.net |
| Database | PostgreSQL | myapp-db-xxxx | myapp-db-xxxx.postgres.database.azure.com |
| Key Vault | Key Vault | myapp-kv-xxxx | https://myapp-kv-xxxx.vault.azure.net |
| Logs | Log Analytics | myapp-log-xxxx | Azure Portal |
| Monitoring | App Insights | myapp-appi-xxxx | Azure Portal |
```

### Configuration Values Section

```markdown
### Configuration Values

| Variable | Value | Source |
|----------|-------|--------|
| AZURE_ENV_NAME | dev | azd env |
| AZURE_LOCATION | eastus | azd env |
| AZURE_SUBSCRIPTION_ID | xxxx-xxxx-xxxx | azd env |
| AZURE_RESOURCE_GROUP | rg-myapp-dev | Deployment output |
```

## Failure Recording

When deployment fails:

```markdown
### Deployment Failure

**Environment**: dev  
**Timestamp**: 2026-01-29T14:30:00Z  
**Status**: ❌ Failed

**Error**:
```
Error: creating Container App: Original Error: Code="QuotaExceeded" 
Message="The subscription exceeded the maximum number of Container Apps"
```

**Root Cause**: Subscription quota limit reached

**Resolution**: 
1. Request quota increase via Azure Portal
2. Or deploy to different subscription
3. Or reduce number of container apps

**Resolution Status**: 🔄 In Progress
```

## Outcome Metrics

Track key metrics for each deployment:

```markdown
### Deployment Metrics

| Metric | Value |
|--------|-------|
| Provision Duration | 4m 32s |
| Deploy Duration | 2m 15s |
| Total Duration | 6m 47s |
| Resources Created | 8 |
| Resources Updated | 0 |
| Resources Deleted | 0 |
```

## Version Tracking

Track what was deployed:

```markdown
### Deployed Versions

| Service | Version/Commit | Image Tag |
|---------|----------------|-----------|
| api | abc1234 | myacr.azurecr.io/api:abc1234 |
| web | abc1234 | N/A (static) |
| worker | abc1234 | myacr.azurecr.io/worker:abc1234 |
```

## Rollback Information

Document rollback options:

```markdown
### Rollback Information

**Previous Successful Deployment**: 2026-01-28T10:00:00Z

**Rollback Command**:
```bash
# Redeploy previous version
git checkout <previous-commit>
azd deploy --no-prompt
```

**Or restore from backup**:
- Database backup: myapp-db-backup-20260128
- Storage backup: myapp-storage-backup-20260128
```

## Update Manifest Status

After successful deployment:

1. Change header status:
   ```markdown
   Status: Deployed
   ```

2. Update deployment status table with ✅

3. Fill in deployed resources with actual names/URLs

4. Record deployment timestamp

5. Add any post-deployment notes

## Notification

Consider notifying team on deployment:

```markdown
### Notifications Sent

| Channel | Sent | Recipients |
|---------|------|------------|
| Email | ✅ | team@example.com |
| Slack | ✅ | #deployments |
| Teams | ✅ | Deployment Team |
```
