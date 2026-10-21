# Windows Consumption Plan to Flex Consumption Plan Upgrade

> **Source**: Azure Functions Consumption Plan (Y1/Dynamic) on Windows
> **Target**: Azure Functions Flex Consumption Plan (FC1/FlexConsumption)
> **Platform**: Windows → Linux (Flex Consumption is Linux-based)
> **Docs**: [Windows migration guide](https://learn.microsoft.com/en-us/azure/azure-functions/migration/migrate-plan-consumption-to-flex?pivots=platform-windows)

> **This changes OS, not just plan.** Prepare Windows dependencies, in-process .NET, .NET Framework targets, and Windows-RID packages before migration. See [blockers](#known-limitations-and-migration-blockers).

## Before You Begin

Before discovery or Azure commands, summarize the ordered `### Phase` headings and [automation workflow units](automation.md), grouped by phase; do not invent a separate step list. Explain source-app safety below, then confirm the source app and Flex target plan before continuing.

**For a full plan only:** Read relevant linked procedures across phases without executing commands or creating artifacts. State each phase's concrete work, user decisions, blocking conditions, and verification in the answer; links alone are insufficient. Include storage authentication gates, Linux package checks, system/master-key exclusions, scale/concurrency setup and validation, Terraform adoption/plan review, and the required progress banner.

## Why Upgrade?

Flex offers always-ready instances, per-function scaling/concurrency, virtual networks/private endpoints, and ongoing feature investment.

## What to Expect

- Prepare code for Linux; create and test a parallel Flex app in the **same resource group**, with access to existing dependencies.
- Windows Azure Files/SMB content becomes immutable blob packages via **One Deploy**. Replace MSDeploy, FTP, and Kudu git deployment.
- Keep the source running until the user approves cutover.

### Source-App Safety

Keep the source **read-only during assessment and replication**. Immediately before any command changing its settings, triggers, state, deployment, bindings, or existence, use `ask_user` to describe the exact action and obtain explicit approval. Approval is action-specific, including cutover, rollback, and cleanup; never reuse it.

## Platform Notes

- Flex is the recommended serverless plan. State a Windows Consumption retirement date only if current Microsoft documentation publishes one.
- **`az functionapp flex-migration` does not support Windows**; use the raw CLI procedures in [automation.md](automation.md).
- Unremovable Windows dependencies require an alternative such as [Elastic Premium on Windows](https://learn.microsoft.com/en-us/azure/azure-functions/functions-premium-plan): higher cost, no OS migration.

## Prerequisites

- Azure CLI v2.77.0+
- `resource-graph` extension: `az extension add --name resource-graph`
- `jq`
- Resource-group Owner/Contributor and permissions for function apps, storage, App Insights, and managed-identity role assignments

## Compatibility Requirements

### Supported Language Stacks

| Stack | Requirement |
|-------|-------------|
| `dotnet-isolated` (.NET 8+) | No Windows-only dependencies or Windows RID |
| `dotnet-isolated` (`net4x`) | Unsupported; retarget to .NET 8+ |
| `dotnet` (in-process) | Unsupported; migrate to isolated worker |
| `node`, `java`, `python` | Supported |
| `powershell` | Replace Windows-only WMI/registry/COM modules |
| `go` (Preview), `custom` | Linux-compatible handler and native dependencies |

### Known Limitations and Migration Blockers

#### Flex Consumption Platform Limits (shared with Linux migration)

| Feature | Limit / action |
|---------|----------------|
| Deployment slots | Unsupported; consolidate or use separate apps |
| TLS/SSL certificates | Site-scoped preview; re-add used certificates, verify per-app limits, use Linux file paths |
| Polling Blob triggers | Convert `LogsAndContainerScan` → `EventGrid`; create event subscription |
| Disable settings for function names containing `-` | Unsupported on Linux; isolate dependencies, rename/repackage, use source-first deployment cutover, or explicitly accept active-trigger risk |
| Azure Government | Unavailable |
| MSDeploy / FTP / Kudu git | Replace with `az functionapp deploy` or `func azure functionapp publish` |
| PowerShell managed dependencies | Unsupported; package Linux-compatible modules in app-root `Modules`. `requirements.psd1` alone is insufficient; see [dependency management](https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-powershell#dependency-management). |

#### Windows-to-Linux Specific Blockers

| Issue | How to Detect | Action Required |
|-------|---------------|-----------------|
| In-process .NET | `FUNCTIONS_WORKER_RUNTIME=dotnet` | Change packages/startup to isolated worker |
| .NET Framework | `.csproj` targets `net4x` | Retarget .NET 8+; replace Framework-only APIs/packages |
| Windows packages (GDI+, COM, P/Invoke) | Heuristic assembly/package scan | Replace or use Windows Premium |
| Windows RID | `runtimes/win-x64/` without `linux-x64` | Republish framework-dependent or `-r linux-x64` |
| Paths/case | Code review | Use `Path.Combine()`; fix filename case |
| Windows PowerShell modules | `requirements.psd1`/imports | Replace or remove WMI/registry/COM dependencies |
| Windows certificate store | Code review | Load certificates from files |
| Runtime version | Site config | Use a [supported version](https://learn.microsoft.com/en-us/azure/azure-functions/supported-languages) |
| Unsupported region | Flex availability list | Wait or relocate |

## New App Name

Honor an explicit name ("as/named `<name>`"); otherwise propose **`<source>-flex`**. Before Step 4b, announce name, resource group, and region so the user can override without a blocking prompt.

Names must be globally unique, 2–60 alphanumeric/hyphen characters, start with a letter, and have no consecutive hyphens. If too long or unavailable, shorten (e.g. `<source>-fc`) and announce the fallback. See [App Creation](automation/app-creation.md).

## Storage Account Options

Bind storage at creation: **reuse source** (no new resource), **create new** (isolation), or **use a specified existing account**. Honor the request and follow the [App Creation storage decision](automation/app-creation.md#storage-account-binding-read-before-running-4a4b) before Steps 4a/4b. Configure target deployment storage; never copy Windows content-share settings.

## Upgrade Phases

Maintain `<UPGRADE_DIR>/upgrade-status.md` per [Migration Progress](progress-tracking.md), deriving the snapshot from current workflow/automation headings. Before/after each step, display `Phase <current> of <total> · <step> · <description> · <state>`; no percentages. Plan-only answers must promise this transition reporting and the assessment/status artifacts, not create them.

### Phase 1: Assessment

Run all [assessment checks](assessment.md) and manual discovery/compatibility Steps 1–2 in [automation.md](automation.md).

Recommend the [Step 2g dependency scan](automation/discovery-and-assessment.md#2g-source-code-windows-dependency-scan), using [dependency-scan.md](dependency-scan.md): prefer local/checked-out source; use the deployed package only if unavailable. Check Windows APIs/packages/RIDs, certificate stores, and Windows shell-outs. Record findings in report §11 and advisory readiness in §1; skipping transfers risk to the user.

### Phase 2: Pre-migration (Collect Everything)

Before target creation, inventory per [automation.md](automation.md):

1. App settings and site configuration (CORS, domains, HTTP, TLS, client certificates).
2. Used TLS/SSL certificates requiring site-scoped re-addition.
3. Managed identities, RBAC, built-in authentication, and inbound restrictions.
4. Deployment package, only if source is unavailable in version control.

### Phase 3: Create Flex Consumption App

Execute Steps 4a–4l in [automation.md](automation.md):

- **4a–4b** — Create storage only if selected; run authentication preflight and create the Flex app.
- **4b.opt** — Convert explicitly approved, permitted key-based storage to identity; never bypass the identity-first gate below.
- **4c** — Review setting names; ask to copy filtered settings or defer until target dependencies are configured.
- **4d–4f** — Apply HTTP/2, TLS, HTTPS-only, client certificates, SCM basic auth; migrate system identity/RBAC and user-assigned identities.
- **4f.auth** — Configure/validate every used authentication provider before deployment, or defer migration.
- **4g–4i** — Migrate CORS, custom domains, and access restrictions.
- **4j** — Choose [trigger safety](automation/trigger-safety-and-monitoring.md#4j-choose-the-pre-deployment-state-of-non-http-functions). Skip disablement only with proven isolation of settings/all trigger dependencies and no autonomous production effects. Classify literal names: `process-orders` **contains `-`** and cannot use Linux disable settings; use isolation, rename/repackage, source-first cutover, or approved active deployment.
- **4k** — Verify target App Insights; preserve AAD ingestion only if source used it.
- **4l** — Inventory key names; choose target-generated keys or opt in to preserving source host/HTTP-function keys.

### Identity-First Configuration (Functions)

Prefer Microsoft Entra ID + managed identities over connection strings.

- **Storage**: Always attempt managed identity + RBAC for **both runtime and deployment storage**, even if Shared Key is allowed. [4b](automation/app-creation.md#4b-create-the-flex-consumption-app) checks policy before creation and verifies each identity's effective roles/access before deployment. If identity-first provisioning is unverified, record a blocker and remediation/handoff; never silently use keys or present them as an equally good option. Where keys are prohibited, block key-based creation; [4b.opt](automation/app-creation.md#4bopt-identity-based-storage) cannot bypass this. Runtime identity alone is insufficient. Step 4c preserves target bindings, not source `AzureWebJobsStorage*`.
- **App Insights**: Preserve existing `Authorization=AAD`; otherwise conversion is optional post-migration hardening.
- For user-assigned identity, pass `managedIdentityClientId` explicitly.

### Phase 4: Verify and Configure the New App

Verify Step 4 results and finish missing configuration per [automation.md](automation.md):

1. Check selected setting mode, identities, and domains.
2. Re-add used TLS/SSL certificates through the site-scoped process; replace Windows certificate-store access.
3. Carry forward custom instance limits and review/configure HTTP per-instance and applicable trigger concurrency; explicitly record retained defaults.
4. Verify Application Insights monitoring.

### Phase 5: Deploy Code

**Code requires separate deployment. Block deployment until:**
- Step 4b storage authentication, required identities/RBAC, and effective access are verified.
- The user confirms all required target-specific settings deferred in 4c are configured; inspect names, never values.
- Every used built-in authentication provider deferred in 4f.auth is recreated and verified.

Use `ask_user` to choose **CI/CD update**, **local publish** (`func azure functionapp publish <NEW_APP_NAME>`), or **existing package**. Verify package/runtime/native dependencies are Linux-compatible; rebuild Windows-only artifacts before deploying. Execute [automation.md](automation.md) Step 5.

After function synchronization, run Step 5a: if preservation was selected, copy/verify source host and HTTP-function keys **before HTTP validation**. System/master keys stay target-generated.

- With 4j disablement approved and no risky hyphenated function approved for active deployment, only HTTP endpoints are live; cut over functions in Phase 6.
- With proven isolation, omit disable settings and validate only isolated dependencies.
- If disablement was declined, warn that non-HTTP processing/schedules may start immediately and obtain explicit approval **immediately before deployment**.

After deployment, remind the user to retain source for rollback, update key-dependent clients/workflows before directing them to target-generated keys, enable HTTPS-only/managed identity, and defer source deletion until validated production cutover.

### Phase 6: Post-Upgrade Validation

1. **Smoke test** — Query `defaultHostName` with `az functionapp show --query defaultHostName -o tsv`; request it (HTTP 2xx/4xx, not refused/503). For intentional `403 Ip Forbidden`, verify deployment/function synchronization through ARM and defer functional testing to an allowed client; never relax restrictions automatically.
2. Verify the app is running on Flex Consumption (`az functionapp show --query sku`)
3. Test HTTP trigger endpoints (e.g. `curl https://<DEFAULT_HOST>/api/<FUNCTION_NAME>`)
4. **Per-function validation/cutover** — Test isolated target resources without source changes, or follow [production cutover](automation/validation-and-cutover.md#per-function-cutover-event-driven-triggers): obtain function-specific approval explicitly including rollback on failure, disable/verify source, then enable target. Never enable a production-connected target while source-disable approval is pending.
5. Capture and compare performance benchmarks
6. Set up monitoring dashboards
7. Verify effective instance limits and HTTP/trigger concurrency; validate under representative load, compare errors/latency, then refine. Record unperformed load tests as deferred.
8. Update IaC (Bicep/Terraform) to reflect new plan

### Phase 7: Cleanup (Optional)

- Retain source for days/weeks as rollback; idle Consumption costs little.
- Offer deletion only for recorded `production cutover complete`, no deferred production-readiness work, and no source production processing. Validation-only success is insufficient.
- Immediately before deletion, obtain `ask_user` confirmation per [automation.md](automation.md) Step 7.

## Trigger Migration Risks

Apply these mitigations **before deployment/enablement**, alongside [4j safety decisions](automation/trigger-safety-and-monitoring.md#4j-choose-the-pre-deployment-state-of-non-http-functions) and Phase 6 cutover. Record immediate dual-processing/duplicate-schedule risk if disablement is declined.

| Trigger Type | Risk | Mitigation |
|-------------|------|------------|
| Azure Blob storage | High | Create separate container for event-based trigger in new app |
| Azure Cosmos DB | High | Create dedicated lease container for new app; set `StartFromBeginning: false` |
| Azure Event Grid | Medium | Recreate event subscriptions; ensure idempotent functions |
| Azure Event Hubs | Medium | Create new consumer group for new app |
| Azure Service Bus | High | Create new topic/queue; update senders; drain original before shutdown |
| Azure Storage Queue | High | Create new queue; update senders; drain original before shutdown |
| HTTP | Low | Update clients to target new app URL |
| Timer | Low | Offset schedules during cutover to avoid simultaneous execution |

## IaC Key Differences

| Property | Consumption | Flex Consumption |
|----------|-------------|------------------|
| SKU | `Y1` (Dynamic) | `FC1` (FlexConsumption) |
| Plan required | Optional (auto-created) | Required (must be explicit) |
| OS | Windows | Linux |
| Configuration | App settings | `functionAppConfig` section |
| Storage | `WEBSITE_CONTENTSHARE` setting | `deployment.storage` in `functionAppConfig` |

For Bicep/ARM/Terraform-managed apps:
1. Define a **new app and plan**, not an in-place conversion; model `functionAppConfig` and `deployment.storage` through equivalent provider fields.
2. Reconcile migrated resources to avoid recreation/overwrites; import into Terraform where appropriate.
3. Review `az deployment group what-if` or `terraform plan` before applying.
4. Retarget CI/CD. Avoid ongoing manual configuration alongside IaC.

Skip if the app is not IaC-managed.

## Deprecated Settings (Do NOT Migrate)

Step 4c filters these source settings in memory before PATCHing target ARM; never write secret values to disk.

### Azure Files content settings

Remove Windows SMB content settings; Flex uses blobs. Separately catalog any explicit mount metadata from `az webapp config storage-account list`, but do not migrate it: Windows Consumption doesn't support explicit mounts.

- `WEBSITE_CONTENTAZUREFILECONNECTIONSTRING`
- `WEBSITE_CONTENTSHARE`
- `WEBSITE_CONTENTOVERVNET`
- `WEBSITE_SKIP_CONTENTSHARE_VALIDATION`

### Deployment settings

Remove all run-from-package aliases; Flex uses `functionAppConfig.deployment.storage`:

- `WEBSITE_RUN_FROM_PACKAGE`
- `WEBSITE_RUN_FROM_ZIP`
- `WEBSITE_USE_ZIP`

### Runtime / scale settings

Configure through `functionAppConfig`, not app settings:

- `FUNCTIONS_EXTENSION_VERSION`
- `FUNCTIONS_WORKER_RUNTIME`
- `FUNCTIONS_WORKER_RUNTIME_VERSION`
- `FUNCTIONS_MAX_HTTP_CONCURRENCY`
- `FUNCTIONS_WORKER_PROCESS_COUNT`
- `FUNCTIONS_WORKER_DYNAMIC_CONCURRENCY_ENABLED`
- `WEBSITE_MAX_DYNAMIC_APPLICATION_SCALE_OUT`

### Other unsupported settings

- `WEBSITE_USE_PLACEHOLDER_DOTNETISOLATED`
- `WEBSITE_LOAD_CERTIFICATES` (use site-scoped certificates accessible to code)
- `AzureWebJobsDashboard` (legacy v1)
- `WEBSITE_MOUNT_ENABLED`
- `ENABLE_ORYX_BUILD`
- `SCM_DO_BUILD_DURING_DEPLOYMENT`
- `WEBSITE_DNS_SERVER`
- `WEBSITE_NODE_DEFAULT_VERSION`
- `WEBSITE_VNET_ROUTE_ALL`

### Application Insights

Discard source `APPLICATIONINSIGHTS_CONNECTION_STRING`; preserve the target value from 4b and verify without displaying it in 4k. Preserve `APPLICATIONINSIGHTS_AUTHENTICATION_STRING=Authorization=AAD` only if source used AAD ingestion.

### Storage

Drop every source `AzureWebJobsStorage*` setting, including connection strings and `__*` identity variants; preserve target bindings verified by 4b or [4b.opt](automation/app-creation.md#4bopt-identity-based-storage). Only permitted Shared Key creation may generate a fresh target connection string; never add one to identity-first targets.
