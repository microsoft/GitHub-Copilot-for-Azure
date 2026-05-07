# Intent Gathering — Steps 2 & 4

## Pass 1 — Quick Probe (Step 2)

Set `currentPhase: "prereq"`.

**Probe budget:** The quick probe is intentionally shallow. Count total files in the workspace (excluding `node_modules`, `.git`, `dist`, `build`, `vendor`, `.venv`, `__pycache__`). The probe may read at most **`max(5, ceil(totalFileCount × 0.05))`** files, with a hard cap of **1–2 files per top-level folder** (pick the project manifest + at most one config file like `docker-compose.yml` or `Dockerfile`). This prevents the probe from becoming a full scan while ensuring it sees enough to ask smart questions.

> ⛔ **Workspace-detection gate — MANDATORY FIRST ACTION.** Before asking ANY questions or explaining what BYA does, scan the workspace for project files (`package.json`, `requirements.txt`, `*.csproj`, `Dockerfile`, `go.mod`, `Cargo.toml`). If project files exist: run the quick probe immediately (read top-level fields — dependencies, scripts, name), present detected facts as confirmations ("I see a Node.js/Express API with MongoDB — is that right?"), include preliminary Azure service recommendations (e.g., "App Service F1" or "Static Web Apps Free"), then ask ONLY what the probe didn't answer. When the user's prompt clearly indicates deployment intent (e.g., "deploy my app"), skip informational responses — start scanning the workspace immediately, present findings, then offer to proceed. Do NOT explain what BYA is, pitch capabilities, or describe the workflow before scanning — start with results. If NO project files exist (empty workspace): ask all 4 context items.

**Write probe artifact:** After the quick probe, write results to `context.json.quickProbe` per [`QuickProbeResult`](session-schemas.ts) schema (loaded at Step 1). Populate `preliminaryServices` with the 1–2 Azure services you suggested to the user. Populate `unansweredQuestions` with ALL items the probe could not determine (e.g., "auth provider", "expected user count", "database needs").

Present `context.json.azure` as part of the confirmation: "☁️  **Azure target**: {subscriptionName} ({subscriptionId})". If the user wants a different subscription, write to `context.json.overrides[]`.

The 4 context items: (1) what the app does, (2) stack/language, (3) data model/storage needs, (4) auth approach. Probe-detected items count as covered — do not re-ask. User corrections go to `context.json.overrides[]`. Stop when covered or user says "just go." Optional: scale, budget, integrations. Write to `context.json.intent` and `context.json.repo`. Even while asking clarifying questions, mention 1–2 likely Azure services as a starting point based on what you already know (e.g., "I'm thinking App Service + Azure Database for PostgreSQL — but that depends on your answers below"). Give the user signal immediately, not just questions. For new users or when asked to walk through, present the BYA workflow as numbered steps (Step 1: Scan your code, Step 2: Plan architecture, Step 3: Review costs, Step 4: Deploy).

> **Container Apps deploy path preview.** When recommending Container Apps, mention: "I'll build your container images via ACR and deploy them to Container Apps." If BuildKit Dockerfiles detected, add: "I'll create ACR-compatible versions automatically."

> ⛔ **Do NOT offer CI/CD setup or monitoring options** — those sub-skills do not exist yet. Only offer capabilities the current pipeline can deliver (prereq → prepare → scaffold → deploy).

**Question targets:** Workspace with code + probe answers most items → ≤2 questions. Workspace with code, probe answers few items → ≤4 questions. Empty workspace → all 4 items + optional scale/budget. Never exceed 6 total. ⛔ Do NOT ask "production or development?" — ask concrete scale: "How many users?" or "What's the expected traffic?"

## After Prereq Returns (Step 3 → Step 4 Transition)

> ⛔ **Step 3 is MANDATORY — quick probe is NOT a prereq scan.** You MUST delegate to `azure-bya-prereq` and run the full 3-axis evaluation even if Step 2's quick probe already detected issues. The quick probe reads ≤5 files — it CANNOT assess build health, runtime compatibility, or deployment readiness. Do NOT skip Step 3 because you think you "already know enough." The pipeline is: Step 2 (probe) → Step 3 (prereq) → Step 4 (refine) → Step 5 (plan). No shortcuts.

> ⛔ **Non-Azure cloud SDK dependencies — inline handling.** If `prereq-output.json` contains `CLOUD_SDK_DEPENDENCY` findings (non-Azure cloud SDK dependencies like `google-cloud-*`, `aws-sdk`, `boto3`, `firebase`): these are **NOT pipeline blockers**. The prereq scan maps each dependency to its Azure equivalent in `prereq-output.json.cloudSdkSwaps[]`. Present the findings to the user: **"⚠️ Cloud SDK dependencies detected — these will be converted to Azure equivalents during scaffold: [list swaps]."** Include the swap plan in the architecture plan (Step 5) and execute the SDK conversions during scaffold (Step 7). The scaffold phase MUST: (1) replace non-Azure SDK imports with Azure SDK equivalents, (2) update connection/client initialization code, (3) add required Azure SDK packages to dependency manifests, (4) update environment variable references for Azure service connection strings.

## Pass 2 — Scan-Informed Refinement (Step 4)

Compare `prereq-output.json` against `context.json.quickProbe` and `context.json.intent`. The scan reveals things the probe could not: `components[]`, `detectedInfra[]`, build health, and fast-track eligibility (prereq gate + prepare alt analysis only — see [pipeline-rules.md § fastTrackEligible](pipeline-rules.md)).

> ⛔ **azd template routing gate — MANDATORY CHECK.** Before refining intent, check `context.json.detectedInfra[]`. If `azure-yaml` AND (`bicep` or `terraform`) are both present, the repo is an existing azd template with its own IaC. **You MUST read [`azd-template-routing.md`](azd-template-routing.md) using the `view` tool** and present the 3-option gate (Deploy with existing setup / Start fresh / Just scan). If the user chooses "Deploy with existing setup," invoke `{"skill": "azure-prepare"}` directly (same pattern as prereq in Step 3) and follow its workflow — do NOT continue to Step 5. BYA is a greenfield deployment skill; repos with complete Azure IaC belong to the prepare → validate → deploy pipeline. If the user chooses "Start fresh," write the `ignoreExistingInfra` override and continue the BYA pipeline.

- **Confirm or surface:** Present scan-discovered facts (components, infra, revised service picks) for confirmation. Compare `quickProbe.preliminaryServices` with `prereq-output.json.detectedStack` and `buildRequirements` — if the service recommendation changed, explain why (e.g., "Probe suggested App Service, but native modules detected → recommending Container Apps"). Do NOT re-ask questions the scan already answered — confirm instead. User corrections → `context.json.overrides[]`.
- **Resolve unanswered questions:** Read `quickProbe.unansweredQuestions`. Cross-check each against prereq scan results — remove items the scan resolved (e.g., scan found OAuth config → auth question answered). Ask the user ALL remaining unresolved items — these are genuine unknowns the agent cannot answer on its own.
- **Update intent:** Merge scan results into `context.json.intent`. Set `refinedFromScan: true` and populate `scanDiscoveredFacts[]`.

Target ≤2 confirmation questions for probe-detected facts (not open-ended). Scan-surfaced unknowns from `unansweredQuestions` are exempt from this budget — ask them all. If the scan answered everything, skip questions — present the summary and proceed. For empty workspaces, this step is a no-op.
