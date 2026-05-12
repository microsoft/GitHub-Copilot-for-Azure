# IaC Generation Rules — Steps 5–8

Rules for generating infrastructure code, Dockerfiles, security verification, and telemetry wiring.

## Step 5 — Generate IaC

For each service in `services[]`:

> **Sub-agent delegation:** If using a sub-agent or background task for IaC generation, you MUST include these artifacts **verbatim** (not summarized) in the sub-agent prompt: (1) full `prepare-plan.json` content (services, naming, quotas, cost, deploymentVariables), (2) the 5-tag block from `bicep-patterns.md` (exact definition: `app-onboard-skill: 'true'`, NOT the skill name), (3) the `ScaffoldManifest` interface from `session-schemas-deploy.ts`, (4) all module patterns from the loaded compute-target file (`bicep-container-apps.md` or `bicep-app-service.md`), (5) **for Container Apps: the two-phase wiring rules** — Phase 1 MUST use `registries: []`, `secrets: []`, placeholder `targetPort: 80`, and the MCR placeholder image. Phase 2 adds ACR registries + KV secretRefs + real port after RBAC propagates. Sub-agents that include `registries` or KV `secretRef` in Phase 1 cause "Operation expired" failures. Sub-agents lacking these produce non-compliant artifacts (wrong tag values, broken resource references, missing RBAC). Self-review (Step 9) remains mandatory after sub-agent returns.

> **PostgreSQL wiring:** Include firewall rule + extension allow-list — see [`bicep-patterns-data.md`](bicep-patterns-data.md) (loaded at Step 4 if PostgreSQL in plan). **BuildKit Dockerfiles:** Generate `Dockerfile.azure` for ACR compatibility — see [code-deployment-container-apps.md § BuildKit](../../deploy/references/code-deployment-container-apps.md).

> **Env var completeness:** Read `.env.example` (or `.env.sample`, `config.example`) + config/settings files (Pydantic `Settings`, `@t3-oss/env-nextjs`, Django `settings.py`) for each component to enumerate required env vars before generating IaC. Every env var with a placeholder value (not `localhost`) should map to either: (1) a Bicep parameter, (2) a KV secret reference, or (3) a hardcoded value derived from other resources (e.g., database connection string from the DB module output). Flag unmapped vars in selfReview as ⚠️ WARN. Missing vars cause container crash loops at deploy time.

> ⛔ **F1/D1 SKU: do NOT generate a Dockerfile.** If `prepare-plan.json` specifies F1 or D1 (free/shared tier), use the platform's built-in runtime stack (e.g., `NODE|20-lts` for Node.js, `PYTHON|3.12` for Python). Dockerfiles are for B1+ or Container Apps only.

> ⛔ **Set `targetScope = 'subscription'` in `main.bicep`.** Subscription-scope Bicep creates the resource group in IaC with all 5 AppOnboard tags (including `created-at`). Do NOT use default resource-group scope — it requires imperative `az group create` which consistently misses tags. If the user lacks subscription-level permissions, the deploy phase handles fallback to RG-scope automatically.

> ⛔ **Native module deploy strategy.** If `prepare-plan.json.deployStrategy` exists, read [bicep-app-service.md § Native Module Deploy Strategy](bicep-app-service.md) and apply the startup command + app settings to the App Service Bicep. The `deployStrategy.startupCommand` goes into `appCommandLine`, and `deployStrategy.requiredAppSettings` goes into `appSettings[]`. When no `deployStrategy` exists, do NOT set `appCommandLine` — let Oryx use its default startup.

### Session Tags — Mandatory on ALL Resources

Include EXACTLY these 5 tags on every resource and module:

| Tag key | Value (Bicep) | Value (Terraform) |
|---------|---------------|-------------------|
| `app-onboard-skill` | `'true'` | `"true"` |
| `app-onboard-session-id` | `sessionId` (param) | `var.session_id` |
| `created-at` | `createdAt` (param — scaffold MUST populate with current ISO timestamp, e.g. `2026-05-07T12:00:00Z`. Deploy may override via CLI arg. NEVER leave empty.) | `timestamp()` |
| `environment` | `environmentName` (param — MUST equal `naming.resourcePrefix`, e.g. `myapp-dev-a1d5`) | `var.environment_name` |
| `deployed-by` | `deployedBy` (param — resolved ONCE at orchestrator Step 1 via `az ad signed-in-user show --query displayName -o tsv`. Stored in `context.json.azure.userDisplayName`. Fallback: `az account show --query user.name -o tsv`) | `var.deployed_by` |

**`app-onboard-skill: true`** is the unique AppOnboard identifier — use it for cleanup: `az group list --tag app-onboard-skill=true`.
**`app-onboard-session-id`** correlates to `.copilot-azure/sessions/{uuid}/` artifacts.

If extending existing IaC, MERGE AppOnboard session tags with existing tags using Bicep `union()` or Terraform `merge()` — do NOT overwrite the user's existing tags.

> ⛔ **Do NOT generate `azure.yaml`.** AppOnboard deploys via `az deployment sub create` (subscription-scope Bicep creates the RG in IaC). Do NOT use `azd`. Generating `azure.yaml` causes the agent to switch to azd conventions (wrong tag keys, `azd up` at deploy gate). Only preserve `azure.yaml` if the repo already has one (deploy-as-is). If the user lacks subscription-level permissions, the deploy phase automatically falls back to RG-scope.

### MCP Tool Calls

See the MCP Tools table in [scaffold SKILL.md](../SKILL.md) for full tool list. Key calls:
- `mcp_bicep_get_bicep_best_practices`, `mcp_bicep_get_az_resource_type_schema` per resource, `deploy_iac_rules_get` with `deployment-tool: "AzCli"`, `iac-type: "bicep"`, `resource-types` matching planned services
- `mcp_azure_mcp_get_azure_bestpractices` → `get_azure_bestpractices_get` with `resource: "general"`, `action: "code-generation"`. For Functions: `resource: "azurefunctions"`. Fallback: skip if unavailable.
- **Terraform path:** `mcp_azure_mcp_azureterraformbestpractices` + `deploy_iac_rules_get` with `iac-type: "terraform"` instead.

### Output

Output: `infra/main.bicep`, `main.parameters.json`, `modules/{service}.bicep` per service. Apply patterns from the IaC pattern file + compute-target file loaded at Step 4.

### Security Patterns — Apply During Generation

⛔ **BEFORE generating any IaC files**, apply ALL security patterns below during generation — do NOT defer to a later step. The full security reference ([`bicep-patterns-security.md`](bicep-patterns-security.md)) is loaded at Step 7 for verification.

Critical patterns for every App Service Bicep:
- For EVERY `Microsoft.Web/sites` resource, emit `basicPublishingCredentialsPolicies` child resources: `scm: { allow: true }` (deploy convenience — re-disabled after code upload) and `ftp: { allow: false }`. See [bicep-patterns-security.md](bicep-patterns-security.md) for the exact Bicep block.
- ⛔ Managed identity — EVERY compute resource (App Service, Container Apps, Functions) MUST have `identity: { type: 'SystemAssigned' }`. If missing, the scaffold is broken — add it before proceeding.
- Key Vault for secrets — no hardcoded connection strings
- Least-privilege RBAC role assignments

## Step 6 — Generate Dockerfiles

For `context.json.components[]` needing containerization without existing Dockerfiles.

### Cloud SDK Swaps (execute before Dockerfile generation)

If `prereq-output.json.cloudSdkSwaps[]` is non-empty, execute swaps per component BEFORE generating Dockerfiles (Dockerfiles may depend on the updated manifests):

1. **Replace imports** — swap `sourcePackage` → `azurePackage` in source files
2. **Update initialization** — replace cloud-specific clients (e.g., `DynamoDBClient` → `CosmosClient`) using `azureService`
3. **Update manifests** — remove `sourcePackage`, add `azurePackage` to `package.json`/`requirements.txt`
4. **Update env vars** — replace cloud-specific vars (e.g., `AWS_REGION` → `AZURE_COSMOS_ENDPOINT`), add to IaC `appSettings`/`env`

> ⛔ **After cloud SDK swaps** (per `prereq-output.json.cloudSdkSwaps[]`), if >3 files or >2 packages changed, present: **"I've replaced {N} cloud SDK dependencies with Azure equivalents. Want me to install dependencies, build, and run tests to verify? (Yes / Skip)"** If Yes: run `npm install` → `npm run build` → `npm test` (or stack equivalent), fix errors (max 2 attempts). If Skip: proceed — ACR/Oryx will catch issues at deploy time.

## Step 7 — Secure-by-Default Verification

⛔ **You MUST read [`bicep-patterns-security.md`](bicep-patterns-security.md)** (or `terraform-patterns.md` § Security Defaults for Terraform) and verify all security patterns were applied in Step 5. If the deployment includes App Service, Container Apps, or Functions (any compute with managed identity ↔ resource RBAC), ⛔ **you MUST read [rbac-roles.md](rbac-roles.md)** — it contains the common RBAC role GUIDs table. Do not guess GUIDs. Skip for SWA-only deployments (no RBAC role assignments needed). **Explicitly tell the user** about each pattern used:
- "Using **managed identity** instead of connection strings/keys"
- "Storing secrets in **Key Vault** — no hardcoded secrets in IaC"
- "Applying **least-privilege RBAC** using the common roles table in `rbac-roles.md`" — for every managed identity ↔ resource pair, look up the role GUID in the common roles table and emit a `Microsoft.Authorization/roleAssignments` resource. **If the role is NOT in the table, call `mcp_azure_mcp_documentation` with the target resource type to find the correct built-in role definition ID before generating the Bicep.** Never guess a GUID.
- "**SCM basic auth enabled for deploy, FTP disabled** (`scm.allow: true`, `ftp.allow: false`) via `basicPublishingCredentialsPolicies`. Deploy phase re-disables SCM via REST API after code upload." — if any App Service is missing these child resources, add them NOW before proceeding
- Private endpoints where applicable

## Step 8 — Wire Telemetry

If `prepare-plan.json.instrumentation.appInsightsEnabled` is `true`, wire the App Insights connection string to app settings via Key Vault reference. Add `APPLICATIONINSIGHTS_CONNECTION_STRING` as an app setting referencing the Key Vault secret created by the App Insights module. For Container Apps, use `secretRef` syntax; for App Service, use `@Microsoft.KeyVault()` syntax per [bicep-patterns.md § Key Vault Reference Syntax](bicep-patterns.md).
