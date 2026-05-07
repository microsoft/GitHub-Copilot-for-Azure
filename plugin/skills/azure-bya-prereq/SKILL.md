---
name: azure-bya-prereq
description: "Assess whether source code is ready to deploy to Azure — the check BEFORE infrastructure work. Evaluates build health, app completeness, dependencies and local services, stack compatibility, and deployment feasibility. Answers questions about what your app needs before it can be deployed — frameworks, dependencies, and configuration. Checks whether dependencies are compatible and identifies deployment blockers and unsupported frameworks. WHEN: \"evaluate my repo\", \"is my app ready to deploy\", \"what does my app need to deploy\", \"what do I need before deploying\", \"does my app need\", \"can I ship this to Azure\", \"scan my repo for issues\", \"is this app deployable\", \"check if my app is ready for Azure\", \"do I need a Dockerfile\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure BYA Prereq — Repository Evaluation

Evaluate a user's repository for build health, app completeness, and Azure deployment feasibility — before infrastructure planning. Produces per-component verdicts (PASS/WARN/FAIL) consumed by downstream phases.

> **Orchestrator relationship:** Called by `azure-bya` at Step 3, or used standalone for code readiness checks. When called by the orchestrator, return control to `azure-bya` after writing artifacts — do NOT invoke downstream phases directly.

Phase 1 of 4 in BYA pipeline. Session: `.copilot-azure/sessions/{session-id}/`. Reads `context.json`. Writes `components[]`, `repo{}`, `detectedInfra[]`. Produces `prereq-output.json`. Schema: `session-schemas.ts` — `BYAContext`, `PrereqOutput`. Direct entry supported.

## When NOT to Use

| Signal | Redirect |
|--------|----------|
| Validate infrastructure (Bicep/TF/azure.yaml) | **azure-validate** |
| Generate IaC | **azure-prepare** |
| End-to-end idea-to-production | **azure-bya** |
| Run `azd up` or deploy | **azure-deploy** |

## Rules

> ⛔ **ABSOLUTE PROHIBITION — `npm install` and `npm test` are NEVER allowed.**
> Under NO circumstances may you run `npm install`, `npm test`, `npx jest`, `pip install`, `pytest`, `dotnet restore`, `dotnet test`, `go mod download`, `cargo build`, or ANY package-manager install, build, or test command during the prereq phase. The prereq phase is read-only evaluation + static-only verification.

1. **Read-only by default** — Do not modify user code unless asked.
2. ⛔ **Build/install commands and test suites are FORBIDDEN** — no exceptions, no `ask_user` override.
3. ⛔ **Code modifications require `ask_user`** — Dockerfile generation, config changes, scaffolding.
4. ⛔ **Destructive actions require `ask_user`** — deleting files, overwriting config, provisioning resources, modifying RBAC.
5. **Non-blocking** — Warnings don't stop the workflow; only hard failures block.
6. **Scope** — Evaluation + starter code scaffolding. IaC is the **prepare** phase's job.
7. **Direct entry** — Don't repeat orchestrator's intent questions.
8. **Max 3 questions** before showing results.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp_azure_mcp_get_azure_bestpractices` | Validate detected stack patterns against Azure best practices |
| `mcp_azure_mcp_extension_cli_install` | Check/install required CLI tools (az, azd, func) |

## Workflow

### Step 1: Session Check

**If called by orchestrator (`azure-bya`):** Session already exists — read `context.json` and proceed to Step 2.

**If entered directly:** Follow session creation from [azure-bya SKILL.md](../azure-bya/references/session-protocol.md). Set `currentPhase: "prereq"`, `completedPhases: []`.

### Step 2: Scan Workspace

Scan for project files. Use `context.json.quickProbe` if available. Detect components, `repo{}`, `detectedInfra[]`, `detectedServices[]`. Classify Terraform providers. Check CLI availability.

> If no project files, no Dockerfile, AND no index.html → ⛔ Read [zero-code-path.md](references/zero-code-path.md).

### Step 3: Per-Component Evaluation

| Sub-step | Action | Reference |
|----------|--------|-----------|
| 3.1 | **Build check** | ⛔ Read [build-check.md](references/build-check.md) |
| 3.2 | **Completeness check** | ⛔ Read [completeness-check.md](references/completeness-check.md) |
| 3.3 | **Deployability check** | ⛔ Read [deployability-check.md](references/deployability-check.md) |

Populate `buildRequirements` per component after the 3-axis evaluation.

### Step 4: Write Artifacts + Readiness Gate

⛔ Read [readiness-gate.md](references/readiness-gate.md) — contains artifact write rules, severity tiers, critical gate, batch-then-approve flow, and fast-track condition.

### Step 5: Present Findings

Per [readiness-gate.md § Present Findings](references/readiness-gate.md) — show verdicts grouped by severity before proceeding.

### Steps 6-8: Remediation + Final State + Route

⛔ Read [remediation-protocol.md](references/remediation-protocol.md) — contains remediation loop, static verification, re-eval mandate, post-remediation updates, final state write, and routing.

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
| Prereq output | `prereq-output.json` | prepare phase (via `azure-bya`) |
| Readiness report | `.copilot-azure/sessions/{uuid}/readiness-report.md` | User (offline reference) |
