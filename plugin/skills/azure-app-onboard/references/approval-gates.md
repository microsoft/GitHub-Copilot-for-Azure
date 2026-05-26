# Approval Gates — Steps 6 & 8

> **Gate summary:** AppOnboard has **2 approval gates**: (1) **Scaffold Gate** (orchestrator Step 6) — approve architecture plan before generating IaC, (2) **Deploy Gate** (orchestrator Step 8 / deploy/SKILL.md Step 4) — approve cost + resource summary before `az deployment`. Both are mandatory and SEPARATE — scaffold approval does NOT imply deploy approval.

## Scaffold Approval Gate (Step 6)

Display the architecture plan for user approval BEFORE generating any files:

> ⛔ **Resource group edit is MANDATORY in the gate display.** Show this exact block:
> ```
> 🏢 **Subscription:** {subscriptionName} (`{subscriptionId}`)
> 📦 **Resource Group:** {rg-name} ({region})
>    Want a different name or region? Say "Edit plan".
> ```
> ⛔ **Gate MUST show Subscription (name + ID), Resource Group, and Region** as standalone lines above the service table — see [pipeline-rules.md § Approval gates](pipeline-rules.md). Do NOT omit or bury in a table.

Also display: services + SKUs + region + resource names + monthly cost estimate + files to generate. **Check `context.json.overrides[]` for `iacFormat`** — if Terraform, display "Terraform templates (`infra/*.tf`)"; if Bicep (default), display "Bicep templates (`infra/main.bicep`)". Show resource names so the user sees what will be created.

Verify file list against target SKU — F1/D1: no Dockerfile (built-in runtime). ⛔ **Exclude `azure.yaml` from file list** (see pipeline-rules.md).

> ⛔ **Container Apps code deploy preview (when plan includes Container Apps).** After the service table, preview the deploy path: build via ACR, replace placeholder images, redeploy. If `buildRequirements.hasBuildKitSyntax == true`, note ACR-compatible versions will be created.

> ⛔ **Data-loss warnings at the gate.** If `prereq-output.json.warnings[]` contains any data-loss findings (SQLite on App Service, in-memory sessions, local file storage), surface them prominently with ⛔ formatting ABOVE the approval prompt. The user must see these before approving — do not bury them in a table or omit them.

> ⛔ Use EXACT text: **"✅ Ready to proceed with scaffolding? (Yes / Edit plan / Cancel)"** — do NOT paraphrase, reword, or add extra options.

> ⛔ **RESPONSE BOUNDARY — MANDATORY.** The approval gate MUST be the LAST content in your response. Do NOT generate any files, write any IaC, create any Dockerfiles, or execute any commands in the same response as the gate. Your next action MUST be reading the user's reply. If the user has not yet responded, WAIT — do not proceed.

Three options:
- **Yes** → proceed to Step 7 (scaffold only — NOT deploy)
- **Edit plan** → ask what to change → write to `context.json.overrides[]` → re-run Step 5 → show updated gate
- **Cancel** → preserve session artifacts for later resumption, stop

## Deploy Approval Gate (Step 8)

This is a SEPARATE gate from Step 6.

> ⛔ **Context refresh:** Before presenting this gate, re-read this SKILL.md Steps 8-9 if you have not read them in the last 5 turns. Scaffold reference loading (Steps 6-7) consumes significant context — deploy rules may have been evicted.

Display:
- Validation status from `scaffold-manifest.json.validationResult`
- Self-review summary (count of VERIFIED/PLAUSIBLE/FLAGGED findings)
- Resource group name + region
- Services + SKUs + estimated cost
- End with **"🚀 Ready to deploy? (Yes / Run manually / Edit plan / Cancel)"**

> ⛔ **After deploy approval:** Your NEXT action MUST be: read `deploy/SKILL.md`, then read `.copilot-azure/sessions/{id}/deploy-checklist.md`. Do NOT call the `azure-deploy` skill — AppOnboard uses its own embedded deploy sub-skill.

If "Run manually" is selected → point to [deploy-checklist-template.md § Deployment Summary](../deploy/references/deploy-checklist-template.md) for manual execution steps.

If validation failed or any FLAGGED findings exist at L1 (Security) or L3 (Hallucination), block **Yes** until resolved.

Only after user approves: proceed to deploy sub-skill (Step 9). `context.json` already has `currentPhase: "deploy"` from the post-scaffold checkpoint (main SKILL.md Step 7).

> ⛔ **Before entering deploy:** ⛔ Read [`deploy/SKILL.md`](../deploy/SKILL.md) before any deployment action. After mid-session compaction, re-read `deploy/SKILL.md` Steps 4-8. You MUST write `deploy-result.json`.

> ⛔ Deploy via `az deployment sub create` (see [pipeline-rules.md](pipeline-rules.md)). If AppOnboard-generated `azure.yaml` found, DELETE it.

> ⛔ **Container Apps code deploy is NOT optional.** After IaC placeholder deploys, complete: `az acr build` → update image params → redeploy → health check. Do NOT present manual CLI "Next Steps" for core deploy tasks. If `hasBuildKitSyntax`, create `Dockerfile.azure` first.

> ⛔ **Phase exit:** `deploy-result.json` MUST be written before proceeding to Step 9. See deploy/SKILL.md for the full exit gate checklist.
