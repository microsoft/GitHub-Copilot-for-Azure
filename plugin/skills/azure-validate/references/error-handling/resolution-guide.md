# Resolution Guide

Step-by-step resolution for complex validation failures.

## Authentication Issues

### Expired Token / Session

**Symptoms**:
- `AADSTS700082: The refresh token has expired`
- `InteractiveBrowserCredential authentication failed`

**Resolution Steps**:

1. Clear cached credentials
   ```bash
   az account clear
   az cache purge
   ```

2. Re-authenticate
   ```bash
   az login
   ```

3. Select correct subscription
   ```bash
   az account list --output table
   az account set --subscription <subscription-id>
   ```

4. Re-initialize AZD environment
   ```bash
   azd env refresh
   ```

### Service Principal Authentication

**Symptoms**:
- `AADSTS7000215: Invalid client secret`
- `AADSTS700016: Application not found`

**Resolution Steps**:

1. Verify service principal exists
   ```bash
   az ad sp show --id <app-id>
   ```

2. Create new secret if expired
   ```bash
   az ad sp credential reset --id <app-id>
   ```

3. Update environment variables
   ```bash
   export AZURE_CLIENT_ID=<app-id>
   export AZURE_CLIENT_SECRET=<new-secret>
   export AZURE_TENANT_ID=<tenant-id>
   ```

---

## Permission Issues

### Missing Contributor Role

**Symptoms**:
- `AuthorizationFailed: does not have authorization to perform action`

**Resolution Steps**:

1. Check current role assignments
   ```bash
   az role assignment list --assignee $(az ad signed-in-user show --query id -o tsv) --output table
   ```

2. Request role assignment (admin action)
   ```bash
   az role assignment create \
     --assignee <user-email-or-object-id> \
     --role Contributor \
     --scope /subscriptions/<subscription-id>
   ```

3. Wait for propagation (up to 5 minutes)

4. Verify assignment
   ```bash
   az role assignment list --assignee <user-email> --query "[?roleDefinitionName=='Contributor']"
   ```

### Resource Provider Not Registered

**Symptoms**:
- `The subscription is not registered to use namespace 'Microsoft.App'`

**Resolution Steps**:

1. List registration status
   ```bash
   az provider list --query "[?registrationState=='NotRegistered'].namespace" -o table
   ```

2. Register required providers
   ```bash
   az provider register --namespace Microsoft.App
   az provider register --namespace Microsoft.ContainerRegistry
   az provider register --namespace Microsoft.OperationalInsights
   ```

3. Wait for registration
   ```bash
   az provider show --namespace Microsoft.App --query "registrationState"
   ```

---

## Bicep/Infrastructure Issues

### Compilation Errors

**Symptoms**:
- `BCP035`, `BCP037`, `BCP018` errors

**Resolution Steps**:

1. Compile locally for detailed errors
   ```bash
   az bicep build --file ./infra/main.bicep
   ```

2. Check specific line number from error

3. Common fixes:
   - **BCP035**: Verify resource type matches API version
   - **BCP037**: Check property name spelling
   - **BCP018**: Fix syntax (missing brackets, quotes)

4. Validate Bicep version is current
   ```bash
   az bicep upgrade
   az bicep version
   ```

### Module Reference Errors

**Symptoms**:
- `Unable to find module`
- `Module path does not exist`

**Resolution Steps**:

1. Verify module file exists
   ```bash
   ls -la ./infra/modules/
   ```

2. Check path in main.bicep is correct
   ```bicep
   // Relative to main.bicep location
   module resources './modules/resources.bicep' = { ... }
   ```

3. Check for case sensitivity (Linux)

---

## Docker/Container Issues

### Docker Daemon Not Running

**Symptoms**:
- `Cannot connect to the Docker daemon`

**Resolution Steps**:

1. Start Docker Desktop (Windows/Mac)

2. Or start Docker service (Linux)
   ```bash
   sudo systemctl start docker
   ```

3. Verify Docker is running
   ```bash
   docker info
   ```

### Dockerfile Not Found

**Symptoms**:
- `failed to read dockerfile`

**Resolution Steps**:

1. Verify Dockerfile exists at expected path
   ```bash
   # Path is: {service.project}/{service.docker.path}
   ls -la ./src/api/Dockerfile
   ```

2. Update azure.yaml if path is wrong
   ```yaml
   services:
     api:
       project: ./src/api
       docker:
         path: ./Dockerfile  # Relative to project
   ```

### Build Context Issues

**Symptoms**:
- `COPY failed: file not found in build context`

**Resolution Steps**:

1. Understand build context
   - Default: service project directory
   - Can override with `docker.context`

2. Test Docker build manually
   ```bash
   cd ./src/api
   docker build -t test -f ./Dockerfile .
   ```

3. Adjust context if needed
   ```yaml
   docker:
     path: ./Dockerfile
     context: ../..  # Build from project root
   ```

---

## AZD Environment Issues

### Environment Not Initialized

**Symptoms**:
- `No environments found`
- `Environment not selected`

**Resolution Steps**:

1. Initialize new environment
   ```bash
   azd init
   ```

2. Or create specific environment
   ```bash
   azd env new dev
   ```

3. Set required values
   ```bash
   azd env set AZURE_LOCATION eastus
   ```

### Environment Variable Missing

**Symptoms**:
- `The template parameter 'X' was not provided`

**Resolution Steps**:

1. List current values
   ```bash
   azd env get-values
   ```

2. Set missing values
   ```bash
   azd env set <VARIABLE_NAME> <value>
   ```

3. Common required variables
   ```bash
   azd env set AZURE_LOCATION eastus
   azd env set AZURE_ENV_NAME dev
   ```

---

## Quota/Limit Issues

### Subscription Quota Exceeded

**Symptoms**:
- `QuotaExceeded`
- `Operation could not be completed as it results in exceeding approved quota`

**Resolution Steps**:

1. Check current usage
   ```bash
   az vm list-usage --location eastus --output table
   ```

2. Options:
   - **Request increase**: Azure Portal > Subscriptions > Usage + quotas
   - **Change region**: Try different Azure region
   - **Use smaller SKU**: Reduce resource size

### Resource Name Unavailable

**Symptoms**:
- `The name is already in use`
- `NameNotAvailable`

**Resolution Steps**:

1. Add unique suffix to names in Bicep
   ```bicep
   var uniqueHash = uniqueString(resourceGroup().id)
   var keyVaultName = '${prefix}-kv-${uniqueHash}'
   ```

2. Or change environment name
   ```bash
   azd env new dev2
   ```

3. Check name availability
   ```bash
   az keyvault check-name --name <proposed-name>
   ```
