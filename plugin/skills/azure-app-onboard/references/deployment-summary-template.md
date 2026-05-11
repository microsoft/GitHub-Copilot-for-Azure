# Deployment Summary Template

Template for `deployment-summary.md` — the user-facing record of what AppOnboard planned, decided, and deployed. Written to `.copilot-azure/sessions/{uuid}/deployment-summary.md`.

## Lifecycle

| Phase | Action | Status value |
|-------|--------|-------------|
| Scaffold (after approval gate) | Create file with sections 1–5 | `Scaffolded` |
| Deploy (after deploy completes) | **Minimal update only** — change Status line + fill sections 6–8 | `Deployed` or `Failed` |
| Deploy (partial success) | Update with what succeeded | `Partial` |

> ⛔ **Deploy-phase update MUST be minimal.** Do NOT rewrite the entire file. Use `str_replace` or targeted edits to:
> 1. Change `**Status:** Scaffolded` → `**Status:** Deployed` (or `Failed`/`Partial`)
> 2. Fill the `## Deployment Links` section (3 lines: app URL, portal deployment, portal RG)
> 3. Fill the `## Health` table (1 row per endpoint)
> 4. Fill `**Updated:**` timestamp
>
> This keeps deploy-phase output small. Scaffold already wrote the bulk of the file.

## Template

Fill placeholders from session artifacts. Source mapping follows each section.

```markdown
# Deployment Summary

**App:** {appName} | **Session:** `{sessionId}`
**Status:** {Scaffolded | Deployed | Partial | Failed}
**Updated:** {timestamp}
🏢 **Subscription:** {subscriptionName} (`{subscriptionId}`)
📁 **Resource Group:** {rgName}
🌍 **Region:** {region}

---

## What's Being Deployed

| Service | SKU | Resource Name | Est. Cost/mo |
|---------|-----|---------------|-------------|
| {service} | {sku} | {resourceName} | ${cost} |

**Estimated total:** ~${total}/mo

---

## Architecture Decisions

| Decision | Chosen | Alternative | Why |
|----------|--------|-------------|-----|
| {category} | {chosen} | {rejected} | {reason} |

**Caveats:**
- {caveat}

---

## Generated Files

| File | Purpose |
|------|---------|
| {path} | {purpose} |

---

## Deployment Links

- 🌐 **App:** {endpoint}
- 🔗 **Portal (deployment):** {portalDeploymentLink}
- 🔗 **Portal (resource group):** {portalRgLink}

*(Populated after deploy)*

---

## Health

| Endpoint | Status | Checked |
|----------|--------|---------|
| {url} | {status} | {timestamp} |

*(Populated after deploy)*

---

## Cleanup

\`\`\`powershell
# Delete this deployment's resources
az group delete -n {rgName} --yes --no-wait

# Find all AppOnboard-created resources (safety net)
az group list --tag app-onboard-session-id={sessionId} --query "[].name" -o tsv | ForEach-Object { az group delete -n $_ --yes --no-wait }
\`\`\`

*(Populated after deploy)*
```

## Value Mapping

### Scaffold phase (What's Being Deployed, Architecture Decisions, Generated Files)

| Placeholder | Source |
|---|---|
| `{appName}` | `context.json.app.name` or repo directory name |
| `{sessionId}` | `context.json.sessionId` |
| `{subscriptionName}` | `context.json.azure.subscriptionName` |
| `{subscriptionId}` | `context.json.azure.subscriptionId` |
| `{timestamp}` | Current UTC ISO 8601 |
| §1 Service rows | `prepare-plan.json.services[]` → `name` (service), `sku`, `resourceName`, `monthlyUsd` from `costEstimate.breakdown[]` |
| `{total}` | `prepare-plan.json.costEstimate.monthlyUsd` |
| `{region}` | `context.json.azure.region` |
| `{rgName}` | `context.json.azure.resourceGroup` |
| §2 Decision rows | `prepare-plan.json.rejectedAlternatives[]` → decision category, chosen service, rejected service, reason |
| §2 Caveats | `prereq-output.json.warnings[]` that have severity ≥ WARN + `prepare-plan.json.postDeployRecommendations[]` |
| §3 File rows | `scaffold-manifest.json.files[]` → `path`, `type` |

### Deploy phase (Deployment Links, Health, Cleanup)

| Placeholder | Source |
|---|---|
| §4 Endpoint links | `deploy-result.json.endpoints[]` → first endpoint URL |
| `{portalDeploymentLink}` | URL-encoded portal deployment blade link (from deploy phase Step 5) |
| `{portalRgLink}` | `https://portal.azure.com/#@/resource/subscriptions/{subId}/resourceGroups/{rgName}/overview` |
| §6 Health rows | `deploy-result.json.endpoints[]` → `url`, `healthStatus`, check timestamp |
| §7 Cleanup | `deploy-result.json.resourceGroupName` + `context.json.sessionId` for tag-based cleanup |

## Rules

- **One file, two writes.** Scaffold creates it; deploy updates it. No other phase touches it.
- **User-readable.** No internal schema references, no JSON blobs, no "see session-schemas.ts". Plain markdown a developer can open and understand.
- **Not a source of truth.** Session artifacts (`prepare-plan.json`, `deploy-result.json`) remain canonical. This is a derived convenience file.
- **Decisions section is the key differentiator.** This is what the old bridge never had — WHY we chose what we chose. Pull from `rejectedAlternatives[]` and prereq warnings.
