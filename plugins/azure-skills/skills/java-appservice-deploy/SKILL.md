---
name: java-appservice-deploy
description: "Deploy Java (Spring Boot/Quarkus/Tomcat/JBoss EAP) code to Azure App Service Linux. WHEN: \"Spring Boot App Service\", \"Tomcat App Service\", \"JBoss App Service\", \"deploy Java to App Service\". DO NOT USE FOR: Container Apps, Functions, Azure Spring Apps, Windows, non-Java, Terraform/Bicep/IaC, full infra — use azure-prepare."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Java on Azure App Service — Code Deploy

Deploys Java (Spring Boot, Quarkus, Tomcat WAR, JBoss EAP WAR/EAR) code to Azure App Service Linux (P0v3, matching Java runtime). Builds locally with Maven/Gradle and deploys the artifact. Creates RG + Plan + Web App if missing. Hand off to `azure-prepare` for VNet, Key Vault, databases, IaC, containers, or Azure Spring Apps.

**MCP tools used**: `mcp_azure_mcp_subscription_list`, `mcp_azure_mcp_group_list`, `mcp_azure_mcp_appservice`, `mcp_azure_mcp_azd` (when `azure.yaml` is present).

## Workflow

**Prerequisite:** Verify the latest stable Azure CLI; update with approval and recheck if needed.

1. **Resolve context — smart defaults, minimal prompts.** Only the app name is interactive; RG (`<app>-rg`), Plan (`<app>-plan`), region (current `az` default or `eastus2`), subscription are derived. [create-app.md](references/create-app.md) §1.
2. **Detect build tool, packaging, Java version + server** (Java SE/Tomcat/JBoss EAP; selects artifact and runtime). [detect.md](references/detect.md).
3. **Choose path** — `azure.yaml` host: appservice → [deploy-azd.md](references/deploy-azd.md); else [deploy-azcli.md](references/deploy-azcli.md).
4. **Ensure RG → Plan (`P0v3 --is-linux`) → Web App (`--runtime "<runtime>"`)** exist. Discover the latest compatible runtime in [create-app.md](references/create-app.md) §4 (e.g., `JAVA:25-java25`, `TOMCAT:11.0-java25`, `JBOSSEAP:8.1.0.1-java21`); before creating a plan, run its quota and region gate (§1d). On transient ARM errors, follow [transient-retry.md](references/transient-retry.md).
5. **Set startup** — none (App Service starts the JAR/WAR/EAR and sets `PORT`). Startup script only when needed (e.g., JBoss EAP CLI). [startup-commands.md](references/startup-commands.md).
6. **Build locally** — Maven/Gradle wrapper; no remote build, so `SCM_DO_BUILD_DURING_DEPLOYMENT` is not set.
7. **Deploy** — `azd deploy` or `az webapp deploy --type jar|war|ear --track-status false --enriched-errors true`.
8. **STOP. Print the post-deploy message** ([post-deploy-message.md](references/post-deploy-message.md)) and end the turn.

### Hard rules

- **LINUX SCRIPTS** — normalize shipped startup scripts to LF, then verify no CR bytes remain. Stop on build failure; deploy only a freshly built artifact.
- **ONE ARTIFACT** — executable JAR (not `-plain`/`.original`), WAR or EAR.
- **SERVER MATCH** — match Java major and `jakarta`/`javax` server generation; never silently retarget.
- **PORT** — never hard-code a listen port; App Service sets `PORT`/`SERVER_PORT`.
- ⛔ **NO POST-DEPLOY VERIFICATION** — after deploy returns, do not run `az webapp log tail`, `curl`, `Invoke-WebRequest`, or any health probe. App Service needs 2–3 min to warm; a quiet log or early 5xx is not failure.
- ⛔ **SHELL SAFETY** — for `--runtime` always use the colon form (e.g., `"JAVA:25-java25"`). Never `"JAVA|25-java25"` (pipe is a shell operator).
- ⛔ **NEVER `az webapp up`** — deprecated. Use Step 7 commands.
- ✅ **URL FORMAT** — present endpoints as `https://...` URLs.

## Error Handling

See [errors.md](references/errors.md) for the full symptom → cause → fix matrix. Quick triage: missing plan/app → re-run Step 4; container ping timeout on port 80 → bind to `PORT`; `no main manifest attribute` → deployed the plain JAR (Step 6); 404 on every Tomcat/JBoss path → `javax`/`jakarta` mismatch (Step 2).
