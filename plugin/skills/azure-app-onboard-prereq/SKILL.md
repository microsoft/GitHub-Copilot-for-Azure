---
name: azure-app-onboard-prereq
description: "Assess whether source code is ready to deploy to Azure — the check BEFORE infrastructure work. Evaluates build health, app completeness, dependencies and local services, stack compatibility, and deployment feasibility. Answers questions about what your app needs before it can be deployed — frameworks, dependencies, and configuration. Checks whether dependencies are compatible and identifies deployment blockers and unsupported frameworks. WHEN: \"evaluate my repo\", \"is my app ready to deploy\", \"what does my app need to deploy\", \"what do I need before deploying\", \"does my app need\", \"can I ship this to Azure\", \"scan my repo for issues\", \"is this app deployable\", \"check if my app is ready for Azure\", \"do I need a Dockerfile\", \"what's blocking my deployment\", \"are there any blockers\", \"are my dependencies compatible\", \"does Azure support my framework\", \"what needs to change before deploying\", \"check my app configuration\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure App Onboard Prereq — Repository Evaluation

Evaluate a user's repository for build health, app completeness, and Azure deployment feasibility — before infrastructure planning. Produces per-component verdicts (PASS/WARN/FAIL) consumed by downstream phases.

> **Orchestrator relationship:** Called by `azure-app-onboard` at Step 3, or used standalone for code readiness checks. When called by the orchestrator, return control to `azure-app-onboard` after writing artifacts — do NOT invoke downstream phases directly.

## When NOT to Use

| Signal | Redirect |
|--------|----------|
| Validate infrastructure (Bicep/TF/azure.yaml) | **azure-validate** |
| Generate IaC | **azure-prepare** |
| End-to-end idea-to-production | **azure-app-onboard** |
| Run `azd up` or deploy | **azure-deploy** |

## Rules

> ⛔ **ABSOLUTE PROHIBITION — `npm install` and `npm test` are NEVER allowed.**
> Under NO circumstances may you run `npm install`, `npm test`, `npx jest`, `pip install`, `pytest`, `dotnet build`, `dotnet restore`, `dotnet test`, `go mod download`, `cargo build`, or ANY package-manager install, build, or test command during the prereq phase. The prereq phase is read-only evaluation + static-only verification.

1. **Read-only by default** — Do not modify user code unless asked.
2. ⛔ **Build/install commands and test suites are FORBIDDEN** on existing code — no `ask_user` override. Limited exception: when agent created or modified >2 source files AND re-evaluation passed (M=0), the build-validation gate in [remediation-protocol.md § Step 6](references/remediation-protocol.md) allows install/build/test with explicit user approval via `ask_user`.
3. ⛔ **Every repo goes through the full pipeline (Steps 1–5). No exceptions.** Do not refuse, skip, or short-circuit based on what you recognize. The readiness gate in Step 4 is the ONLY mechanism that halts the pipeline.
4. ⛔ **Code modifications require `ask_user`** — Dockerfile generation, config changes, scaffolding.
5. ⛔ **Destructive actions require `ask_user`** — deleting files, overwriting config, provisioning resources, modifying RBAC.
6. **Non-blocking** — Warnings don't stop the workflow; only hard failures block.
7. **Scope** — Evaluation + starter code scaffolding. IaC is the **prepare** phase's job.
8. **Direct entry** — Don't repeat orchestrator's intent questions.
9. **Max 3 questions** before showing results.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_get_azure_bestpractices` | Validate detected stack patterns against Azure best practices |
| `mcp_azure_mcp_extension_cli_install` | Check/install required CLI tools (az, azd, func) |

## Workflow

### Step 1: Session Check

**If called by orchestrator (`azure-app-onboard`):** Session already exists — read `context.json` and proceed to Step 2.

**If entered directly:** Follow session creation from [session-protocol.md](references/session-protocol.md). Set `currentPhase: "prereq"`, `completedPhases: []`.

### Step 2: Scan Workspace

Scan for project files. Detect components, `repo{}`, `detectedInfra[]`, `detectedServices[]`. Classify Terraform providers. Check CLI availability. For stack or infrastructure detection conflicts, see [conflict-resolution.md](references/conflict-resolution.md).

> ⛔ **Probe data reuse.** If `context.json.quickProbe` exists with populated `manifests[]`: seed components from it, skip re-reading files already captured (`manifests[]`, `dockerfiles[]`, `composeServices[]`, `importSamples[]`). Carry forward `missingFiles[]` as automatic ❌ FAIL, `healthEndpoint: null` as ⚠️ WARN, and `earlyHaltSignal` as 🛑 HALT. Still scan files the probe didn't read (config files, source files beyond import samples, nested manifests the probe missed due to budget cap). The 3-axis evaluation (Steps 3.1–3.3) always runs — probe data accelerates it, doesn't replace it.

> If no project files, no Dockerfile, AND no index.html → ⛔ Read [zero-code-path.md](references/zero-code-path.md).

### Step 3: Per-Component Evaluation

| Sub-step | Action | Reference |
|----------|--------|-----------|
| 3.1 | **Build check** | ⛔ Read [build-check.md](references/build-check.md) |
| 3.2 | **Completeness check** | ⛔ Read [completeness-check.md](references/completeness-check.md) |
| 3.3 | **Deployability check** | ⛔ Read [deployability-check.md](references/deployability-check.md) |
| 3.3a | **Dependency compatibility** (conditional) | Already loaded via deployability-check.md. Apply cloud SDK swap rules from [dependency-compatibility.md](references/dependency-compatibility.md) ONLY IF grep found `aws-sdk\|@aws-sdk\|boto3\|google-cloud\|@google-cloud\|firebase` in manifests |
| 3.3b | **Component mapping** (conditional) | Read [component-mapping.md](references/component-mapping.md) ONLY IF >1 project manifest found (monorepo) |

Populate `buildRequirements` per component after the 3-axis evaluation.

### Step 4: Write Artifacts + Readiness Gate

⛔ Read [readiness-gate.md](references/readiness-gate.md) — contains artifact write rules, severity tiers, critical gate, batch-then-approve flow, and fast-track condition.

### Step 5: Present Findings

Per [readiness-gate.md § Present Findings](references/readiness-gate.md) — show verdicts grouped by severity before proceeding.

### Steps 6-8: Remediation + Final State + Route

Read [remediation-protocol.md](references/remediation-protocol.md) **ONLY IF any ❌ FAIL verdict exists** — contains remediation loop, static verification, re-eval mandate, post-remediation updates. If all verdicts are ✅ PASS or ⚠️ WARN, skip remediation and proceed to final state write + routing (update `context.json`: append `"prereq"` to `completedPhases`, set `currentPhase: null`).

## Verdicts

| Verdict | Meaning |
|---------|---------|
| ✅ PASS | No issues |
| ⚠️ WARN | Non-blocking — can proceed with caveats |
| ❌ FAIL | Blocking — must be resolved before continuing |

## Outputs

| Artifact | Location | Consumer |
|----------|----------|----------|
| Session context | `context.json` → `components[]`, `repo{}`, `detectedInfra[]`, `detectedServices[]` | All downstream phases |
| Prereq output | `prereq-output.json` | prepare phase (via `azure-app-onboard`) |
| Readiness report | `.copilot-azure/sessions/{uuid}/readiness-report.md` | User (offline reference) |
| Schemas | `session-schemas.ts` (`AppOnboardContext`), `prereq-schemas.ts` (`PrereqOutput`, `BuildRequirements`, `CloudSdkSwap`) | Artifact validation |
