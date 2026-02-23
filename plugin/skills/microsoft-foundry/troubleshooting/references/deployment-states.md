# Deployment Provisioning States

This reference documents the provisioning state transitions for model deployments in Microsoft Foundry.

## State Overview

| State | Terminal | Description |
|-------|----------|-------------|
| **Succeeded** | Yes | Deployment completed successfully, ready for use |
| **Failed** | Yes | Deployment failed, requires user action |
| **Canceled** | Yes | Deployment was canceled by user or system |
| **Creating** | No | Initial provisioning in progress |
| **Updating** | No | Configuration change being applied |
| **Deleting** | No | Deployment being removed |
| **Moving** | No | Resource being moved to different subscription/RG |

## State Transition Diagram

```
                    ┌─────────────┐
                    │  Creating   │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ Succeeded │   │  Failed  │   │ Canceled │
     └─────┬─────┘   └──────────┘   └──────────┘
           │
           │ (configuration change)
           ▼
     ┌──────────┐
     │ Updating │
     └─────┬────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌──────────┐ ┌──────────┐
│ Succeeded │ │  Failed  │
└──────────┘ └──────────┘
```

## Expected Durations

| Transition | Typical Duration | Extended Duration |
|------------|------------------|-------------------|
| Creating → Succeeded | 2-10 minutes | Up to 30 minutes |
| Updating → Succeeded | 1-5 minutes | Up to 15 minutes |
| Deleting → (removed) | 1-5 minutes | Up to 10 minutes |

**When to be concerned:**
- `Creating` > 30 minutes
- `Updating` > 15 minutes
- `Deleting` > 15 minutes

## Failure Modes

### InsufficientQuota
- **Cause:** No available capacity in the region
- **Error:** `"code": "InsufficientQuota"`
- **Resolution:** Request quota increase or try different region

### ModelNotFound
- **Cause:** Model not available in deployment region
- **Error:** `"code": "ModelNotFound"`
- **Resolution:** Check model availability with `check-model-availability` skill

### InvalidSku
- **Cause:** Requested SKU not supported for model/region
- **Error:** `"code": "InvalidSku"`
- **Resolution:** Use supported SKU (Standard, GlobalStandard)

### ContentPolicy
- **Cause:** Content filtering policy violation during deployment
- **Error:** `"code": "ContentPolicyViolation"`
- **Resolution:** Review deployment configuration

### ResourceConflict
- **Cause:** Deployment name already exists
- **Error:** `"code": "ResourceConflict"`
- **Resolution:** Use different deployment name or delete existing

### SubscriptionNotRegistered
- **Cause:** Subscription not registered for Cognitive Services
- **Error:** `"code": "SubscriptionNotRegistered"`
- **Resolution:** Register provider: `az provider register --namespace Microsoft.CognitiveServices`

## Checking Provisioning State

### Via CLI
```bash
az cognitiveservices account deployment show \
  --name <resource-name> \
  --resource-group <resource-group> \
  --deployment-name <deployment-name> \
  --query "properties.provisioningState" -o tsv
```

### Via MCP
Use `foundry_resource_get` with `resource-group` and `resource-name` and filter by deployment name.

## Stuck Deployments

If a deployment is stuck in a non-terminal state:

1. **Check Azure Status** — https://status.azure.com
2. **Check activity log** for errors:
   ```bash
   az monitor activity-log list \
     --resource-group <resource-group> \
     --query "[?contains(resourceId, '<deployment-name>')].{Time:eventTimestamp, Status:status.value, Message:subStatus.value}" \
     --output table
   ```
3. **Wait and retry** — Some delays are due to regional capacity
4. **Delete and recreate** — If stuck > 1 hour with no progress

## Recovery Actions

| Current State | Action | Expected Outcome |
|---------------|--------|------------------|
| Stuck Creating | Wait 30 min, then cancel | Canceled |
| Failed | Fix error, redeploy | Creating → Succeeded |
| Canceled | Redeploy | Creating → Succeeded |
| Stuck Updating | Wait 15 min, then cancel | Return to previous config |
