# Environment Validation

Validate AZD environment and Azure authentication.

## TASK

Verify that the deployment environment is properly configured and authenticated.

## Validation Checks

### 1. AZD Installation

```bash
azd version
```

**Error**: `azd: command not found`
**Resolution**: Install Azure Developer CLI
```bash
# Windows
winget install Microsoft.Azd

# macOS
brew install azure-dev

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash
```

### 2. AZD Environment

```bash
azd env list
```

**Expected**: At least one environment exists

**Error**: `No environments found`
**Resolution**: Initialize environment
```bash
azd init
# or
azd env new <environment-name>
```

### 3. Active Environment

```bash
azd env get-value AZURE_ENV_NAME
```

**Expected**: Returns the active environment name

**Error**: `No environment selected`
**Resolution**: Select environment
```bash
azd env select <environment-name>
```

### 4. Azure CLI Authentication

```bash
az account show
```

**Expected**: Returns account details with subscription info

**Error**: `Please run 'az login'`
**Resolution**: Authenticate
```bash
az login
# or for service principals
az login --service-principal -u <app-id> -p <password> --tenant <tenant-id>
```

### 5. Subscription Selection

```bash
az account show --query "id" -o tsv
```

**Verify**: Correct subscription is selected

**Resolution**: Change subscription
```bash
az account set --subscription <subscription-id>
```

### 6. Required Environment Variables

Check AZD environment has required values:

```bash
azd env get-value AZURE_LOCATION
azd env get-value AZURE_SUBSCRIPTION_ID
```

**Set if missing**:
```bash
azd env set AZURE_LOCATION eastus
azd env set AZURE_SUBSCRIPTION_ID <subscription-id>
```

### 7. Permissions Check

Verify user has required permissions:

```bash
# Check role assignments
az role assignment list --assignee $(az ad signed-in-user show --query id -o tsv) --query "[].roleDefinitionName" -o tsv
```

**Required roles** (at minimum):
- Contributor (for resource creation)
- User Access Administrator (if assigning RBAC)

## Environment Variables Reference

| Variable | Purpose | Required |
|----------|---------|----------|
| `AZURE_ENV_NAME` | Environment name | ✅ |
| `AZURE_LOCATION` | Deployment region | ✅ |
| `AZURE_SUBSCRIPTION_ID` | Target subscription | ✅ |
| `AZURE_PRINCIPAL_ID` | Current user/SP ID | Auto-set |
| `AZURE_TENANT_ID` | Entra ID tenant | Auto-set |

## Validation Output

Record in manifest:

```markdown
### Environment Validation Results

| Check | Status | Details |
|-------|--------|---------|
| AZD installed | ✅ Pass | v1.5.0 |
| AZD environment | ✅ Pass | dev environment active |
| Azure CLI auth | ✅ Pass | Logged in as user@example.com |
| Subscription | ✅ Pass | My Subscription (xxxx-xxxx) |
| Location set | ✅ Pass | eastus |
| Permissions | ✅ Pass | Contributor role assigned |
```

## Common Issues

### Token Expired

```
ERROR: AADSTS700082: The refresh token has expired
```

**Resolution**:
```bash
az login --scope https://management.azure.com/.default
```

### Wrong Subscription

```
ERROR: The subscription 'xxxx' could not be found
```

**Resolution**:
```bash
az account list --output table
az account set --subscription <correct-subscription-id>
azd env set AZURE_SUBSCRIPTION_ID <correct-subscription-id>
```

### Missing Permissions

```
ERROR: AuthorizationFailed
```

**Resolution**: Request Contributor role from subscription admin
```bash
# Admin runs:
az role assignment create --assignee <user-email> --role Contributor --scope /subscriptions/<subscription-id>
```
