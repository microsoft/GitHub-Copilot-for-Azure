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

Also display: services + SKUs + region + resource names + monthly cost estimate + files to generate. **Check `context.json.overrides[]` for `iacFormat`** — if Terraform, display "Terraform templates (`infra/*.tf`)" in files list; if Bicep (default), display "Bicep templates (`infra/main.bicep`)". Do NOT hardcode "Bicep" — the prepare phase determines format based on `detectedInfraProvider`. Show resource names in the service table so the user sees exactly what will be created:

```
| Service | SKU | Resource Name | Monthly Cost |
|---------|-----|---------------|-------------|
| App Service Plan | B1 Linux | `plan-myapp-dev-a1d5` | $13.14 |
| App Service | (on plan) | `app-myapp-dev-a1d5` | (included) |
| Key Vault | Standard | `kv-myapp-dev-a1d5` | ~$0.03 |
```

Verify file list against target SKU — if F1/D1 (built-in runtime stack), Dockerfile MUST NOT appear in the files-to-generate list. Only generate Dockerfile for B1+, Container Apps, or Premium SKUs. ⛔ **Exclude `azure.yaml` from the files-to-generate list** — AppOnboard deploys via `az deployment sub create`, not azd. The existing ⛔ "Do NOT generate azure.yaml" rule applies to the gate display too, because showing it in the gate causes the user to expect an azd-based deploy.

> ⛔ **Container Apps code deploy preview (mandatory when plan includes Container Apps).** The gate MUST preview the full deploy path — not just IaC. Display after the service table:
> ```
> 📦 Code Deploy: After infrastructure, I'll build and deploy your container images:
>   • Build images via Azure Container Registry (az acr build) per component
>   • Update IaC with real image references (replace placeholder)
>   • Redeploy to swap placeholder images → your running code
> ```
> If `prereq-output.json.buildRequirements.hasBuildKitSyntax == true`, append: `"⚠️ Your Dockerfiles use BuildKit syntax — I'll create ACR-compatible versions (Dockerfile.azure) automatically before building."` This ensures the user knows the deploy includes code, not just infrastructure. Omitting this causes the user to expect manual "Next Steps" for image builds — which is a VIOLATION of the Container Apps code deploy rule in Step 8.

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

If "Run manually" is selected → point to [deployment-summary-template.md](deployment-summary-template.md) for manual execution steps.

If validation failed or any FLAGGED findings exist at L1 (Security) or L3 (Hallucination), block **Yes** until resolved.

Only after user approves: proceed to deploy sub-skill (Step 9) — the deploy sub-skill sets `currentPhase: "deploy"` at its Step 1.

> ⛔ **Before entering deploy:** scaffold references (bicep-patterns, self-review, waf-checklist) are no longer needed — let context compaction clear them. After ANY mid-session compaction during deploy, re-read `deploy/SKILL.md` Steps 4-8 before continuing. **You MUST read [`deploy/SKILL.md`](../deploy/SKILL.md) before executing any deployment, preflight check, or health verification.** Do not skip — the sub-skill contains preflight checks, error classification tables, and health-check patterns required for safe deployment. Follow its workflow. You MUST write `deploy-result.json` to the session folder.

> ⛔ **Deploy via `az deployment sub create` — see [pipeline-rules.md § azure.yaml prohibition](pipeline-rules.md) for full rules.** If you find an AppOnboard-generated `azure.yaml` in the workspace, DELETE it before deploying.

> ⛔ **Container Apps code deploy is NOT optional.** After IaC deploys placeholder images, you MUST complete the full code deploy: (1) `az acr build` per component, (2) update Bicep image params, (3) `az deployment sub create`, (4) health check. Presenting "Next Steps" with manual CLI commands for code deploy is a VIOLATION — the user expects end-to-end deployment. Post-deploy "Next Steps" contain ONLY skill-based suggestions (`azure-compliance`, `azure-resource-visualizer` — see [pipeline-rules.md](pipeline-rules.md)), not core deployment tasks. If `buildRequirements.hasBuildKitSyntax == true`, create `Dockerfile.azure` files BEFORE building.

> ⛔ **Phase exit:** `deploy-result.json` MUST be written before proceeding to Step 9. See deploy/SKILL.md for the full exit gate checklist.
