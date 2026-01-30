# Deployment Sequence

Ordered deployment steps for shipping to Azure.

## TASK

Execute deployment to Azure after validation has passed.

## Deployment Order

```
1. Read Preparation Manifest
         ↓
2. Verify Prerequisites
         ↓
3. Select Deployment Technology
         ↓
4. Execute Deployment
         ↓
5. Verify Deployment
         ↓
6. Update Manifest
```

## Step Details

### Step 1: Read Preparation Manifest

Load `.azure/preparation-manifest.md` and extract:

| Section | Information Needed |
|---------|-------------------|
| Stack Selection | Container/Serverless/Logic Apps |
| Azure Service Mapping | Target services |
| Implementation Plan | Deployment technology |
| Validation Requirements | Ensure status is `Validated` |

**If manifest missing or not validated**:
- Direct user to run `azure-prepare` and `azure-validate` first
- Stop deployment

### Step 2: Verify Prerequisites

| Check | Command | Expected |
|-------|---------|----------|
| AZD authenticated | `azd auth login --check-status` | Logged in |
| Environment exists | `azd env list` | Environment selected |
| Subscription set | `azd env get-value AZURE_SUBSCRIPTION_ID` | Value returned |
| Location set | `azd env get-value AZURE_LOCATION` | Value returned |

### Step 3: Select Deployment Technology

Based on manifest Implementation Plan:

| Technology | When to Use | Primary Command |
|------------|-------------|-----------------|
| **AZD** | Default for azure.yaml projects | `azd up` |
| **Azure CLI** | Standalone Bicep deployment | `az deployment` |
| **Terraform** | Terraform-based infrastructure | `terraform apply` |
| **GitHub Actions** | CI/CD pipeline | Trigger workflow |

See technology-specific guides in [technologies/](technologies/).

### Step 4: Execute Deployment

#### AZD Deployment (Default)

```bash
# Full deployment (provision + deploy)
azd up --no-prompt

# Or separately
azd provision --no-prompt  # Infrastructure
azd deploy --no-prompt     # Application
```

#### Azure CLI Deployment

```bash
az deployment sub create \
  --location <location> \
  --template-file ./infra/main.bicep \
  --parameters ./infra/main.parameters.json
```

#### Terraform Deployment

```bash
terraform init
terraform apply -auto-approve
```

### Step 5: Verify Deployment

After deployment completes:

1. **Check resource status**
   ```bash
   azd show
   ```

2. **Test endpoints**
   ```bash
   curl https://<service-url>/health
   ```

3. **View logs**
   ```bash
   azd monitor --logs
   ```

See: [post-deployment/verification.md](post-deployment/verification.md)

### Step 6: Update Manifest

Record deployment outcome:

```markdown
## Deployment Status

| Environment | Status | Timestamp | Notes |
|-------------|--------|-----------|-------|
| dev | Deployed | 2026-01-29T14:30:00Z | Initial deployment |

### Deployed Resources

| Resource | Type | URL/Endpoint |
|----------|------|--------------|
| api | Container App | https://api-xxxx.azurecontainerapps.io |
| web | Static Web App | https://web-xxxx.azurestaticapps.net |
```

Set manifest status to `Deployed`.

## Error Handling

If deployment fails:

1. **Capture error message**
2. **Check common issues** (see azure-validate error handling)
3. **Document in manifest Issues section**
4. **Provide resolution steps**
5. **Re-run deployment after fix**

## Rollback

If deployment succeeds but application is broken:

```bash
# Redeploy previous version
azd deploy --from-package <previous-package>

# Or destroy and redeploy
azd down --force
azd up
```

⚠️ `azd down` is destructive—use with caution.
