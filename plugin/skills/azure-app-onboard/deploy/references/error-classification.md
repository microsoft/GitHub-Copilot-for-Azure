# Error Classification

Three error categories for deploy-time failures. Each has a distinct fix path — never treat all errors the same.

## Multi-Error Triage

> ⛔ **When a deploy attempt produces 3+ errors, classify ALL errors before fixing ANY.** Group errors by root cause — e.g., 3 errors from missing KV secrets = 1 root cause (secret seeding not done). Fix root causes, not individual symptoms. This prevents cascading retry loops where fixing one symptom reveals the next. Present the grouped root causes to the user: "Deploy failed with {N} errors from {M} root causes: (1) {cause} → {fix}, (2) {cause} → {fix}."

## Categories

### `IAC_ERROR` — Route Back to Scaffold

IaC is wrong. Scaffold generated invalid code — scaffold must fix it.

| Example Error | Auto-Fix Strategy |
|---------------|-------------------|
| Invalid property name in Bicep | Scaffold removes/corrects property, re-runs `bicep build` |
| Wrong SKU for region | Scaffold substitutes from `prepare-plan.json.rejectedAlternatives[]` |
| Missing required field on resource | Scaffold adds field from resource schema |
| Policy violation (blocked resource/SKU) | Scaffold substitutes per policy constraint |
| API version not found | Scaffold looks up the latest stable API version using `az provider show -n Microsoft.Web --query "resourceTypes[?resourceType=='sites'].apiVersions[0]" -o tsv` (or equivalent for the resource type), then updates the Bicep file to that specific version (e.g., `2024-04-01`). Always include the concrete version string in the fix — never say just "update to latest". |
| `listKeys()` in Bicep output or module | ⛔ **Security risk:** `listKeys()` leaks API keys/connection strings to ARM deployment history (visible to anyone with Reader role on the RG). Scaffold MUST replace with Key Vault secret + managed identity reference. Never use `listKeys()`, `listConnectionStrings()`, or `listAccountSasParameters()` in deployment outputs. |

**Flow:** Deploy detects error → classifies as `IAC_ERROR` → passes error details to scaffold self-healing loop → scaffold fixes + re-validates → deploy retries.

### `INFRA_TRANSIENT` — Retry with Backoff

Azure platform hiccup. Will likely resolve on retry.

| Example Error | Retry Strategy |
|---------------|----------------|
| ARM 429 throttling | 30s → 60s → 120s (3 attempts max) |
| 409 resource conflict (being modified) | 30s → 60s → 120s |
| RBAC propagation delay (role not yet visible) | 30s → 60s → 120s |
| Intermittent network timeout | 30s → 60s → 120s |
| `ContainerAppOperationError: Operation expired` / Container Apps revision `Operation expired` (platform timeout) | **Do NOT blindly retry.** The platform timed out provisioning the revision. Likely causes: image pull failure, health probe timeout, port mismatch, resource exhaustion. Check root cause first: (1) `az containerapp logs show -n {name} -g {rg} --type system` for image pull or crash errors, (2) verify image exists in ACR (`az acr repository show --name {acr} --image {image}`), (3) verify `targetPort` matches app's listening port, (4) check health probe path exists. If port mismatch → `IAC_ERROR` (scaffold fix). If image pull failure/timeout → retry with backoff. If crash loop → `ENVIRONMENT_BLOCKING` (surface to user with logs). |

**Flow:** Deploy detects transient → waits backoff interval → retries same deployment. After 3 failures → escalate to user.

### `ENVIRONMENT_BLOCKING` — Surface to User

User's environment prevents deployment. No automated fix.

| Example Error | User Action |
|---------------|-------------|
| Insufficient permissions — subscription scope (403 on `az deployment sub create`) | **SCOPE_FALLBACK first** — do NOT halt immediately. See [`deploy-safety.md` § 403 Scope Fallback](deploy-safety.md) for full procedure. Restructure Bicep to RG-scope, `az group create` with all 5 AppOnboard tags, retry with `az deployment group create`. Only if retry ALSO fails with 403 → then ENVIRONMENT_BLOCKING. |
| Insufficient permissions — resource-group scope (403 on `az deployment group create`) | `az role assignment create --role Contributor --assignee {user} --scope {rg}` |
| Subscription quota exceeded | `az quota update` or choose alternate region |
| Region doesn't support resource type | Choose alternate region |
| **`LocationIsOfferRestricted` (Code: LocationIsOfferRestricted)** | **Subscription's offer type is restricted from provisioning this provider in the target region. Common with Postgres, MySQL, and other database services. ⛔ `what-if` and `az deployment group validate` do NOT catch this — both return `Succeeded`. The ONLY pre-deploy detection is the capabilities API check in [sku-quota-validation.md § Offer Restriction Check](../../prepare/references/sku-quota-validation.md). At deploy time: HALT, read `prepare-plan.json.quotaValidation.offerRestrictions[]` for regions where `blocked == false`, present region fallback options. If no regions were pre-checked, run the capabilities scan now (see [sku-matrix.md](../../prepare/references/sku-matrix.md)).** |
| State backend inaccessible | Configure storage account for Terraform state (Terraform path only) |
| Subscription disabled/suspended | Contact Azure support |
| **Managed identity sidecar OOM on low-tier App Service** | **Symptom: `503 Service Unavailable` with `Microsoft.Azure.WebSites.DataProtection` or `/msi/token` timeout errors on F1/B1 Linux after enabling managed identity. The identity sidecar adds memory overhead that may exceed available RAM on constrained SKUs. Remediation: (1) upgrade SKU, (2) remove managed identity and use connection strings, (3) switch to Container Apps. Classify as `ENVIRONMENT_BLOCKING`.** |
| **Conditional access token protection (AADSTS530084)** | **Terraform provider cannot authenticate. Switch IaC format to Bicep + `az deployment group create` (uses CLI tokens natively). OR use service principal auth: create an App Registration + secret in the Azure portal (or via `az ad sp create-for-rbac`), then set `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID` env vars with those values. Do NOT suggest `az login --scope graph.microsoft.com` — the error message is misleading.** |

**Flow:** Deploy detects blocker → halts → presents error + remediation command → waits for user action.

> ⛔ **AADSTS530084 / ALL Terraform auth failures:** This applies to ALL `azurerm` provider authentication failures — not just AADSTS530084. If the provider cannot authenticate for any reason (token protection, insufficient permissions, conditional access), classify as `ENVIRONMENT_BLOCKING`. **Never fall back to imperative CLI commands** (`az group create`, `az webapp create`, etc.) — offer to re-scaffold as Bicep and deploy via `az deployment group create`. See [pipeline-rules-runtime.md](../../references/pipeline-rules-runtime.md) § Known Platform Bugs for workarounds.

## Healing Trace

Each attempt logged to `deploy-result.json.healingAttempts[]`:

```jsonc
{
  "attempt": 1,
  "phase": "deployment",
  "errors": [{ "source": "az deployment", "detail": "SKU not available in region", "classification": "IAC_ERROR" }],
  "action": "routed-to-scaffold",
  "result": "fixed"
}
```

> ⛔ **Orphan RG tracking.** See [`deploy-safety.md`](deploy-safety.md) § Artifact Reconciliation for full orphan RG protocol.

> ⛔ **Repeat failure (same error 2+ times):** Read [iac-resources.md](../../references/iac-resources.md) § Deploy Troubleshooting and `fetch_webpage` the matching URL with the error message. Apply the documented fix instead of retrying blind.

After 3 failed cycles: write `partial: true` to `deploy-result.json`, surface remaining errors to user. Do NOT auto-rollback.

## Known Platform Bugs

See [`pipeline-rules-runtime.md`](../../references/pipeline-rules-runtime.md) § Known Platform Bugs for the full bug table and workarounds.

## Deploy Timing

See [`pipeline-rules-runtime.md`](../../references/pipeline-rules-runtime.md) § Deploy Timing.
