# =============================================================================
# guidance.sh — Per-step LM instruction text (step_guidance).
# Sourced by prepare.sh; shares globals (STATE, RepoPath, StateFile, FILES, STEP_IDS).
# Not a standalone script.
# =============================================================================

# Prints the LM instruction text (guidance) for the given step id.
step_guidance() {
    case "$1" in
    specialized-check) cat <<'EOG'
MANDATORY before any planning: decide whether a specialized skill should handle this
request FIRST. Check the user's PROMPT TEXT, not just existing code — critical for
greenfield projects with no codebase. Codebase markers already scanned by the script
are in `auto.codebaseMarkers`.

Routing table — check TOP TO BOTTOM, first match wins:
1. (HIGHEST) Python + Azure App Service AND NOT any of: Terraform, Bicep, IaC, VNet,
   private endpoint, Key Vault, Cosmos, Postgres, MySQL, SQL, Front Door,
   multi-environment, Lambda, migrate from AWS/GCP, Fargate, Cloud Run, ECS, EKS, GKE
   (e.g. "deploy Python to App Service", "Flask on App Service")
     -> invoke **python-appservice-deploy** (code-only deploy; do NOT resume here).
   If ANY of those IaC/infra/migration keywords are present, SKIP this row.
2. Lambda / AWS Lambda / migrate from AWS or GCP / Lambda to Functions / Fargate /
   Cloud Run / ECS / EKS / GKE  (wins even if Azure Functions also mentioned)
     -> invoke **azure-cloud-migrate** (does assessment + code conversion, then
        re-run this script for infrastructure).
3. copilot SDK / copilot app / @github/copilot-sdk / CopilotClient / sendAndWait /
   copilot-sdk-service
     -> invoke **azure-hosted-copilot-sdk**, then resume by re-running this script.
4. Azure Functions / function app / serverless / timer|HTTP|queue trigger / func new
     -> STAY here; prefer Azure Functions templates at architecture/generate.
5. (LOWEST) workflow / orchestration / multi-step / pipeline / fan-out-fan-in / saga /
   long-running process / durable / order processing
     -> STAY here; select the **durable** recipe. You MUST load the durable + DTS
        references (scripts/references/services/functions/durable.md, scripts/references/services/durable-task-scheduler/
        README.md, scripts/references/services/durable-task-scheduler/bicep.md) at architecture/generate.

Re-entry guard: if this run is a RESUME from a specialized skill that already executed
(e.g. azure-hosted-copilot-sdk handing back, or python-appservice-deploy needing full
infra like VNet/Key Vault/DB), set matched=false with notes="resumed from <skill>" so
the workflow proceeds — do NOT re-route.

Set `input.specializedRouting` to an object:
  { "matched": true|false, "skill": "<skill-name or null>", "notes": "<why>" }
If matched (and not a resume), invoke that skill first, then re-run this script.
EOG
        ;;
    analyze) cat <<'EOG'
Choose exactly one workspace mode. The script proposed one in `auto.proposedMode` from
file signals (`auto.workspaceEmpty`, `auto.existingInfra`). Confirm or correct it.

Modes:
- NEW       — empty workspace, or the user wants to create a new app from scratch.
- MODIFY    — existing Azure app (has azure.yaml/infra); user adds features/components.
- MODERNIZE — existing non-Azure app being moved to Azure (add Azure support first).

Decision tree:
- Create a new application                      -> NEW
- Add/change features to an existing app
    - has azure.yaml or infra (see auto.existingInfra) -> MODIFY
    - no Azure config                                  -> MODERNIZE
- Migrate/modernize for Azure
    - cross-cloud (AWS/GCP/Lambda) -> stop; this should have routed to azure-cloud-migrate
    - on-prem or generic           -> MODERNIZE

Detection signals (already gathered in `auto`):
  azureYaml=AZD project (MODIFY likely) · bicep/terraform=existing IaC ·
  dockerfile=containerized · workspaceEmpty=NEW or MODERNIZE.
Note: having azure.yaml does NOT mean skip to validate — the user may want to extend it.

Set `input.mode` to "NEW", "MODIFY", or "MODERNIZE".
Also set `input.goal` to a one-line statement of what the user wants.
EOG
        ;;
    requirements) cat <<'EOG'
Use `ask_user` to gather deployment requirements, then record them. Confirm each
of: classification, scale, budget, and compliance/data-residency needs.

Classification (drives reliability + monitoring footprint):
  - POC          → minimal infra, cost-optimized
  - Development   → balanced, team-focused internal tooling
  - Production    → full reliability, monitoring, customer-facing

Scale (drives SKUs + redundancy):
  - Small  (<1K users)     → single region, basic SKUs
  - Medium (1K-100K users) → auto-scaling, multi-zone
  - Large  (100K+ users)   → multi-region, premium SKUs

Budget (drives SKU tier):
  - Cost-Optimized → minimize spend, lower SKUs
  - Balanced        → value for money, standard SKUs
  - Performance     → maximum capability, premium SKUs

Compliance (drives region + security controls): data residency (region
constraints), industry regulations (security controls), internal policies
(approval workflows).

Set `input.requirements` to an object:
  { "classification": "POC|Development|Production",
    "scale": "Small|Medium|Large",
    "budget": "Cost-Optimized|Balanced|Performance",
    "compliance": "free text, or 'None' " }

Note: Azure Policy enforcement constraints are gathered separately in the
azure-context step once a subscription is confirmed.
EOG
        ;;
    scan) cat <<'EOG'
The script already auto-detected (see `auto.*`):
  - `auto.detectedLanguages`  — nodejs/dotnet/python/java/go/rust
  - `auto.detectedFrameworks` — react/next/express/flask/django/fastapi/etc.
  - `auto.existingInfra`      — azureYaml/bicep/terraform/dockerfile/githubActions/azurePipelines
  - `auto.componentSignals`   — aspire / azureFunctions / pureStaticSite
  - `auto.codebaseMarkers`    — copilotSdk (specialized-skill trigger)

Review the code and classify each component. Map signals to component types:
  - React/Vue/Angular in package.json        → SPA Frontend
  - Only .html/.css/.js, no package.json       → Pure Static Site
  - Express/Fastify/Koa, Flask/FastAPI/Django → API Service
  - Next.js/Nuxt                               → SSR Web App
  - Celery/Bull/Agenda                         → Background Worker
  - azure-functions SDK                        → Azure Function
  - *.AppHost.csproj / Aspire.Hosting          → .NET Aspire App

Caveats:
  - Pure Static Site (`auto.componentSignals.pureStaticSite` true): do NOT add a
    `language` field to azure.yaml — it triggers unwanted build steps.
  - .NET Aspire (`auto.componentSignals.aspire` true): prefer
    `azd init --from-code -e <env>` over manual azure.yaml. If the AppHost calls
    `AddAzureFunctionsProject`, you MUST add
    `.WithEnvironment("AzureWebJobsSecretStorageType", "Files")` before deploy.
    See `scripts/references/aspire.md` for the full procedure.

Set `input.components` to an array of objects:
  [ { "name": "...", "type": "Frontend|API|Worker|Function|Aspire|Static|...",
      "technology": "...", "path": "...", "dependsOn": ["PostgreSQL", "api", ...] } ]
EOG
        ;;
    recipe) cat <<'EOG'
Choose the IaC recipe. The script computed a suggestion in `auto.suggestedRecipe`
from existing tooling (`auto.existingInfra`, including `azureYamlProvider`) and
`auto.componentSignals.aspire`. Confirm or override it.

Special case — .NET Aspire (`auto.componentSignals.aspire` true):
  Always use AZD with auto-generated config (`azd init --from-code`). Do NOT
  manually select a recipe or hand-author artifacts. See `scripts/references/aspire.md`.

Default is AZD unless requirements indicate otherwise. azd supports both Bicep and
Terraform as IaC providers; when Terraform is wanted for an Azure deployment,
prefer AZD (Terraform) for the best DX.

Decision criteria:
  - AZD (Bicep)     → new/multi-service apps, simplest deploy (`azd up`)
  - AZD (Terraform) → DEFAULT when Terraform is wanted + azd simplicity
  - AZCLI           → existing az scripts, imperative control, custom pipelines, AKS
  - Bicep           → IaC-first, no CLI wrapper, direct ARM deployment
  - Terraform       → multi-cloud (non-Azure-first) or TF workflows incompatible with azd

Auto-detection mapping (already applied to `auto.suggestedRecipe`):
  azure.yaml provider=terraform → AZD (Terraform); azure.yaml else → AZD (Bicep);
  *.tf no azure.yaml → AZD (Terraform); *.bicep no azure.yaml → Bicep/AZCLI;
  nothing → AZD (Bicep).

Set `input.recipe` to one of: "AZD (Bicep)" | "AZD (Terraform)" | "AZCLI" | "Bicep" | "Terraform".
Set `input.recipeRationale` to a short reason. Then load the matching recipe
README above for the generate step.
EOG
        ;;
    architecture) cat <<'EOG'
Select a hosting stack, map each component to an Azure service + SKU, and record
rationale. Load per-service detail under `scripts/references/services/<service>/README.md`
as needed.

Stack selection:
  - Containers  → Docker experience, complex deps, microservices
                  (Container Apps, AKS, ACR)
  - Serverless  → event-driven, variable traffic, cost optimization
                  (Functions, Logic Apps, Event Grid)
  - App Service → traditional web apps, PaaS preference
                  (App Service, Static Web Apps)
  Lean Serverless for event-driven/minimal-ops; Containers for complex deps or
  long-running; App Service for traditional PaaS web apps.

Container hosting — Container Apps vs AKS:
  - Container Apps → microservices without K8s, KEDA/Dapr built-in, scale-to-zero,
                     teams without K8s expertise.
  - AKS           → need K8s API/kubectl, custom operators/CRDs, service mesh
                     (Istio), GPU/ML, complex/multi-tenant networking.
  ⮕ If AKS is chosen, invoke the **azure-kubernetes** skill for SKU (Automatic vs
     Standard), networking, identity, scaling, and security configuration.

Hosting service mapping (component type → primary [→ alternatives]):
  - SPA Frontend       → Static Web Apps [Blob + CDN]
  - SSR Web App        → Container Apps [App Service, AKS]
  - REST/GraphQL API   → Container Apps [App Service, Functions, AKS]
  - Background Worker  → Container Apps [Functions, AKS]
  - Scheduled Task     → Functions (Timer) [Container Apps Jobs, AKS CronJob]
  - Event Processor    → Functions [Container Apps, AKS + KEDA]
  - Microservices(K8s) → AKS [Container Apps]
  - GPU/ML Workloads   → AKS [Azure ML]

Data: Relational→Azure SQL [PostgreSQL/MySQL]; Document→Cosmos DB [MongoDB];
  Cache→Redis; Files→Blob Storage; Search→AI Search.
Integration: Queue→Service Bus; Pub/Sub→Event Grid; Streaming→Event Hubs.

Workflow & orchestration:
  - Multi-step workflow → Durable Functions + Durable Task Scheduler (DTS).
    ⚠️ DTS is the REQUIRED managed backend — do NOT use Azure Storage or MSSQL
    backends. See `scripts/references/services/functions/durable.md`.
  - Low-code / visual workflow → Logic Apps.

Supporting services — ALWAYS include: Log Analytics (logging), Application
Insights (monitoring/APM), Key Vault (secrets), Managed Identity (svc-to-svc auth).

Set `input.stack` to "Containers" | "Serverless" | "App Service" (or a hybrid label).
Set `input.architecture` to an array of objects:
  [ { "component": "...", "azureService": "...", "sku": "...", "rationale": "..." } ]
Include the supporting services as their own entries.
EOG
        ;;
    azure-context) cat <<'EOG'
Detect, confirm, and apply the Azure subscription and target region. The script
already collected:
  - `auto.azContext`  — `az account show` (subscriptionName/Id, tenantId)
  - `auto.azdContext` — azd defaults + current env (AZURE_SUBSCRIPTION_ID/LOCATION)

1. Existing AZD env (when `auto.existingInfra.azureYaml` is true): if
   `auto.azdContext.env` already has subscription/location, `ask_user` to confirm
   reuse; if accepted, skip re-detection.
2. Defaults: offer `auto.azdContext.defaults` then `auto.azContext` as the
   RECOMMENDED values (`auto.suggestedSubscription` holds the best guess).
3. Confirm subscription via `ask_user` showing the ACTUAL name AND id
   (e.g. "Use current: <name> (<id>)"). Never offer a vague "use default" choice.
   If the user wants a different one, list via `az account list -o table`.
4. Confirm region via `ask_user`. Present ONLY regions that support ALL selected
   services — a region missing a service will fail deployment. Most services
   (Container Apps, Functions, App Service, SQL, Cosmos, Key Vault, Storage, Service
   Bus, Event Grid, App Insights/Log Analytics) are broadly available. LIMITED ones
   need a region check: Static Web Apps (~5 regions), Azure AI Foundry (very limited,
   by model), AKS and Azure Database for PostgreSQL (limited in some regions) — use
   the Azure quota MCP tool (`quota_region_availability_list`) and the service-specific
   region-availability references to verify. See `scripts/references/region-availability.md`.
   Honor any data-residency constraint in `input.requirements.compliance`.
5. Provisioning limits for the chosen region are validated in the next (quota)
   step via the azure-quotas skill; if capacity is insufficient, return here and
   pick another region.
6. Apply to the azd environment — REQUIRED for AZD/Aspire recipes, immediately
   after `azd init`/`azd env new` (do NOT defer to deploy; az and azd keep
   separate config contexts):
     azd env new <env> --no-prompt      # or: azd init --from-code -e <env> --no-prompt
     azd env set AZURE_SUBSCRIPTION_ID <id>
     azd env set AZURE_LOCATION <location>
     azd env get-values                 # verify
   Record the environment name in `input.azdEnvName` ("n/a" for non-azd recipes).

Set `input.subscription` to the confirmed subscription name or id.
Set `input.location` to the confirmed Azure region (e.g., "eastus2").

After the subscription is confirmed, query Azure Policy assignments to discover
enforcement constraints BEFORE finalizing architecture (skipping this causes
deployment failures when policy denies resource creation):
  mcp_azure_mcp_policy(command: "policy_assignment_list", subscription: "<subscriptionId>")

Record discovered constraints so they feed architecture + generation. Watch for:
  - Blocked resource types / SKUs  → exclude from architecture
  - Required tags                  → add to all Bicep/Terraform resources
  - Allowed regions                → restrict location choices
  - Network restrictions (no public endpoints) → adjust networking/access
  - Storage policies (deny shared key) → use policy-compliant auth
  - Naming conventions             → apply to resource naming

Set `input.policyConstraints` to an array of short strings (empty array if none).
EOG
        ;;
    quota) cat <<'EOG'
Build the provisioning-limit checklist for all resources to be deployed, then
validate capacity in the confirmed subscription + region.

Invoke the **azure-quotas** skill to fetch real quota/usage via the Azure quota
CLI. Process ONE resource type at a time: `az quota list` first; if the provider
returns BadRequest (e.g. Microsoft.DocumentDB), fall back to Azure Resource Graph
+ official limits docs. Compute Available = Limit − Current Usage. If insufficient,
request an increase or return to the azure-context step for another region.

NO "_TBD_" entries may remain. Render the completed Section 6 table(s) as markdown.
See `scripts/references/resources-limits-quotas.md` for the full limits catalog,
CLI reference, service patterns, and a worked example.

Set `input.quotaChecklistMarkdown` to that markdown block.
EOG
        ;;
    approval) cat <<'EOG'
Present `.azure/deployment-plan.md` (the script just generated/updated it) to the user
and ask for explicit approval. Do NOT proceed without it.
Set `input.userApproved` to true once the user approves (false/keep null to revise).
If the user requests changes, update the relevant `input.*` fields and re-run so the
plan regenerates before asking again.
EOG
        ;;
    research) cat <<'EOG'
For each Azure service in `input.architecture`, gather best practices BEFORE
generating artifacts, then record findings.

Process:
  1. List all services from the architecture plan.
  2. Load each service's `scripts/references/services/<service>/README.md` first, then
     specific files (bicep.md / terraform.md / scaling.md / auth.md / sdk.md / etc.)
     only as needed (progressive loading).
  3. Check resource naming rules (valid chars, length, uniqueness scope) per
     learn.microsoft.com resource-name-rules.
  4. Load the selected recipe's guide + its IaC rules / MCP best practices / schema
     tools (see the recipe README chosen earlier).
  5. Verify every service is available in the target region
     (`scripts/references/region-availability.md`).
  6. Provisioning limits/quota were validated in the quota step — re-check if the
     architecture changed.
  7. For containerized apps, load runtime production settings (e.g.
     `scripts/references/runtimes/nodejs.md`).
  8. Invoke related skills for deeper guidance (see routing below).
  9. Document findings in `.azure/deployment-plan.md` under `## Research Summary`.

Service → reference / related skill (load README under scripts/references/services/<svc>/):
  - Container Apps / App Service → +azure-diagnostics, azure-observability, azure-nodejs-production
  - AKS → +azure-networking
  - Functions → (stay here; see composition mandate below)
  - Storage → +azure-storage
  - API Management → scripts/references/apim.md, +azure-aigateway (AI Gateway policies)
  - Durable Functions → scripts/references/services/functions/durable.md + scripts/references/services/durable-task-scheduler/
  - Key Vault → +azure-keyvault-expiration-audit;  Managed Identity → +entra-app-registration
  - Application Insights → +appinsights-instrumentation;  Log Analytics → +azure-observability, azure-kusto
  - Azure OpenAI → scripts/references/services/foundry/ + microsoft-foundry;  AI Search → +azure-ai

Skill routing for special scenarios:
  - GitHub Copilot SDK → invoke **azure-hosted-copilot-sdk** (scaffold+config), then resume.
  - Azure Functions → STAY here: load scripts/references/services/functions/templates/selection.md (decision
    tree) → follow scripts/references/services/functions/templates/recipes/composition.md (algorithm). Never
    synthesize IaC by hand.
  - PostgreSQL passwordless / security hardening → handle directly with service refs.
  - App Insights instrumentation → appinsights-instrumentation; AI apps → microsoft-foundry;
    cost-sensitive → azure-cost.

Set `input.researchDone` to true when finished.
EOG
        ;;
    generate) cat <<'EOG'
Generate infrastructure and configuration files for the selected recipe. Research
(prior step) MUST be complete and its findings applied.

⛔ FIRST — .NET Aspire (`auto.componentSignals.aspire` true): do NOT hand-create
azure.yaml or infra/ files. USE `azd init --from-code -e <env>` (it generates infra
from the AppHost; both `--from-code` AND `-e <name>` are REQUIRED for non-interactive
runs). Then IMMEDIATELY `azd env set AZURE_SUBSCRIPTION_ID <id>` and `AZURE_LOCATION`.
After init, VALIDATE the generated azure.yaml has a non-empty `services:` section — if
empty/missing, the AppHost has only local-only resources (`.ExcludeFromManifest()`):
record a blocker and STOP, do NOT hand-author artifacts to work around it. If
`azd init` fails with "unsupported resource type", that is also a hard stop — do NOT
patch the source. For Aspire + Azure Functions, add
`.WithEnvironment("AzureWebJobsSecretStorageType", "Files")` to the
`AddAzureFunctionsProject` chain before `azd up`. See `scripts/references/aspire.md` and
`scripts/references/recipes/azd/aspire.md`. Manually authoring azure.yaml for Aspire is the most
common deployment failure.

Other special patterns: complex existing codebase → consider `azd init --from-code`;
existing azure.yaml (`auto.existingInfra.azureYaml`) → MODIFY the existing config.

⛔ Global rules (see `scripts/references/global-rules.md`): destructive actions
(delete/overwrite/purge/expensive provisioning/RBAC changes) ALWAYS require `ask_user`
first — never delete the user's project or workspace directory. `azd init -t <template>`
is for NEW projects only: run it ONLY in an empty/new directory. To re-init an existing
project, scaffold in a separate new dir and migrate changes in with confirmed edits;
`azd init` WITHOUT a template arg is fine in existing workspaces.

⛔ If the target compute is Azure Functions, load the composition algorithm BEFORE
generating any infrastructure:
  1. Load `scripts/references/services/functions/templates/selection.md` (base template + recipe).
  2. Load `scripts/references/services/functions/templates/recipes/composition.md` (the algorithm).
  3. Use the `functions_template_get` MCP tool to list/fetch templates and write
     functionFiles[] + projectFiles[] directly — NEVER hand-write Bicep/Terraform.
     Fallback to `azd init -t <template>` / `func init` / `func new` only when composing
     multiple recipes and the required templates are not found.
  The Functions bicep.md/terraform.md files are REFERENCE DOCS, not templates to copy —
  hand-writing from them yields missing RBAC and broken managed identity.
For other compute (Container Apps, App Service, Static Web Apps) load their
`scripts/references/services/<service>/README.md`. Load the selected recipe's README (above)
for detailed generation steps.

Before generating IaC, research best practices via MCP (per recipe):
  - Bicep recipes (AZD Bicep / AZCLI / Bicep): `mcp_bicep_get_bicep_best_practices`,
    `mcp_bicep_list_avm_metadata`, `mcp_bicep_get_az_resource_type_schema`.
  - Terraform recipes (AZD Terraform / Terraform): `mcp_azure_mcp_azureterraformbestpractices`.
  - General: `mcp_azure_mcp_get_azure_bestpractices`.
  AVM module selection order is MANDATORY: prefer AVM Pattern modules → AVM Resource
  modules → AVM Utility modules (same order for Bicep and Terraform); only fall back to
  non-AVM when no AVM module exists. See the recipe README + iac-rules.md for detail.

Generation order: (1) azure.yaml (AZD only) → (2) app code scaffolding (entry points,
health endpoints) → (3) Dockerfiles (if containerized) → (4) IaC in ./infra/ →
(5) CI/CD (if requested). Typical layout: .azure/, infra/{main.bicep|main.tf,modules/},
src/<component>/Dockerfile, azure.yaml.

⚠️ Create the full directory tree (`mkdir -p`) BEFORE writing files — the `create`
tool does NOT make parent directories. The script already scaffolded the `infra/` tree
and a standard parameters stub for the selected recipe — see `auto.scaffold` for the
files it created (do NOT recreate them; fill in `infra/main.bicep`/`main.tf` + modules).

Security requirements (MANDATORY):
  - No hardcoded secrets; Key Vault for sensitive values; Managed Identity for auth;
    HTTPS only, TLS 1.2+.
  - SQL Server Bicep MUST use Entra-only auth — omit administratorLogin /
    administratorLoginPassword entirely (incl. conditional branches); these names must
    not appear in any .bicep. See `scripts/references/services/sql-database/bicep.md`.
  - SQL + Managed Identity → MUST generate scripts/grant-sql-access.sh + .ps1 and a
    `postprovision` hook in azure.yaml (ARM role assignments only grant control-plane).
  - App Service Bicep → every Microsoft.Web/sites MUST carry
    tags: union(tags, { 'azd-service-name': serviceName }) or `azd deploy` can't find it.
  - Containerized apps → apply runtime production settings (e.g. `scripts/references/runtimes/nodejs.md`).

After generation: record the generated file list in `.azure/deployment-plan.md`.
Set `input.generateDone` to true when artifacts are written.
EOG
        ;;
    security) cat <<'EOG'
Harden the generated artifacts following Zero Trust: never trust/always verify,
least privilege, defense in depth, encryption everywhere.

Identity & access:
  - Managed identities everywhere — no credentials in code.
  - Least-privilege RBAC (e.g. "Key Vault Secrets User", "Storage Blob Data Reader")
    scoped to the resource, not subscription. Assigning roles needs
    Microsoft.Authorization/roleAssignments/write (User Access Administrator).
  - Microsoft Entra ID for auth; MFA for users.
  - SQL Server → Entra-only auth: NEVER emit administratorLogin /
    administratorLoginPassword anywhere in Bicep (incl. conditional branches).

Network: private endpoints for PaaS in production; NSGs on subnets (default deny);
  disable public endpoints where possible; DDoS protection; Azure Firewall for egress.

Data protection: encryption at rest (default) + TLS 1.2+ in transit; secrets in
  Key Vault with soft-delete + purge protection + RBAC authorization; customer-managed
  keys for sensitive data.

Monitoring: enable Microsoft Defender for Cloud on production workloads; diagnostic +
  audit logging to Log Analytics; security alerts.

SDK auth: use the language Azure Identity package; `DefaultAzureCredential` for LOCAL
  dev only — in production use `ManagedIdentityCredential` (Rust: `DeveloperToolsCredential`).
  See `scripts/references/auth-best-practices.md`.

See `scripts/references/security.md` for the full checklists, MCP/CLI commands, RBAC
tables, and SDK package matrix.

Set `input.securityDone` to true when hardening is complete.
EOG
        ;;
    functional-verify) cat <<'EOG'
Verify the app works — both UI and backend — BEFORE marking the plan Ready for
Validation. This catches broken functionality before it reaches Azure.

Use `ask_user` to offer testing:
  "Before we deploy, would you like to verify the app works as expected? We can test
   both the UI and backend to catch issues before they reach Azure."
If the user declines, set the keys below and move on.

Backend checks: app starts without errors; core API endpoints respond (curl health/
list/create); data/CRUD operations work against storage/db; auth flows work (tokens,
managed-identity fallback, login/logout); errors return meaningful responses.

UI checks (if any): page loads in a browser; interactive elements (buttons, forms,
file inputs, nav) work; data renders from the backend; the core user journey completes
end-to-end (e.g. upload → view → delete).

Run locally where possible, by detected runtime:
  - Node.js: `npm install && npm start` (set PORT=3000 if unconfigured)
  - Python:  `pip install -r requirements.txt && python app.py` (use a venv)
  - .NET:    `dotnet run` (check launchSettings.json for the port)
  - Java:    `mvn spring-boot:run` or `gradle bootRun`
API-only/no UI → test endpoints with curl. Static site → open in a browser.
WARNING: apps using Azure services (Blob, Cosmos, etc.) need `az login` with adequate
RBAC, or local emulators (e.g. Azurite). If issues are found, fix and re-test.

Record the outcome in `.azure/deployment-plan.md`:
  ## Functional Verification
  - Status: Verified / Skipped
  - Backend: Tested / Not applicable
  - UI: Tested / Not applicable
  - Notes: <any issues found and resolved>

Set `input.functionalVerifyDone` to true when verification passes, is skipped, or N/A.
EOG
        ;;
    esac
}

