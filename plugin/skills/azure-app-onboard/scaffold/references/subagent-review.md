# Subagent Template — Security + Adversarial Review (Steps 6–9)

Review generated IaC for security compliance and correctness. Follow the workflow below — each step specifies which reference to read and what to check.

## Critical Rules

- ⛔ **Do NOT invoke ANY skills** — no `{"skill": "azure-validate"}`, `{"skill": "azure-deploy"}`, `{"skill": "azure-prepare"}`, or any other skill call. Use the procedures in THIS file only.
- ⛔ **Do NOT run `az deployment` commands** — review is read-only analysis of generated files.
- ⛔ **Do NOT modify IaC files** — report findings only. The caller fixes issues.

## Input (provided by caller)

| Field | Required |
|-------|----------|
| All generated IaC file contents (every `.bicep` or `.tf` file) | YES |
| `prepare-plan.json` — services (service types, SKUs), naming, deploymentVariables sections | YES |
| `scaffold-manifest.json.files[]` list | YES |
| `prereq-output.json.warnings[]` — all prereq warnings that require IaC fixes | YES |

## Output

Return JSON (≤1000 tokens):
```json
{
  "findings": [
    { "layer": "L1|L2|L3|L4", "file": "modules/app.bicep", "claim": "...", "rating": "VERIFIED|PLAUSIBLE|FLAGGED", "detail": "..." }
  ],
  "summary": "N/N VERIFIED, N PLAUSIBLE, N FLAGGED"
}
```

## Workflow

### Step 1 — Read security patterns + run L1 security baseline

Read [bicep-patterns-security.md](bicep-patterns-security.md) and [rbac-roles.md](rbac-roles.md).

**Do:** Check every generated IaC file against ALL security checks defined in the reference file. The file contains the complete check table with FLAGGED conditions, edge cases, and Bicep code patterns. Do NOT guess checks from memory — use the reference file as the checklist.

### Step 2 — Read checklist + run L2–L4 adversarial review

Read [self-review-checklist.md](self-review-checklist.md).

**Do:** First run the **cross-module reference trace** from the checklist's § Cross-Module Reference Validation: parse every `module` call in `main.bicep`, read each target module's `param`/`output` declarations and `secrets[]` entries, then verify every reference resolves (params passed match params declared, outputs referenced exist, every CA `secretRef` has a matching KV secret resource). Then run L2–L4:
- **L2 (Pattern Validation):** File structure matches `main.bicep` → `modules/*.bicep`, naming follows plan, Container Apps uses two-phase wiring, every `files[]` entry exists on disk, no `azure.yaml`, cross-module references all resolve
- **L3 (Hallucination Detection):** Resource names match `naming.resources[]` exactly, API versions are real (verify via `az bicep build`), SKU names match plan, no invented resource types
- **L4 (WAF Alignment):** Check per-pillar:
  - Reliability: zone redundancy (prod SKUs), health probes, GRS storage, min replicas ≥1
  - Security: managed identity, KV secrets, HTTPS+TLS 1.2, no public blob, no `administratorLogin`
  - Cost: SKU matches budget, scale-to-zero for dev/test CA, free grants applied
  - Ops: diagnostics → Log Analytics, App Insights, 5 AppOnboard tags, all values parameterized
  - Performance: autoscale (prod), CDN for SPA, connection pooling, cache tier

### Step 3 — Compile findings + return

**Do:** Merge L1–L4 results into the findings JSON. Apply rating per [self-review-checklist.md](self-review-checklist.md) § Rating System: VERIFIED (evidence confirms claim), PLAUSIBLE (no counter-evidence but unverified), FLAGGED (evidence contradicts or missing critical pattern). ⛔ FLAGGED at L1 (Security) or L3 (Hallucination) → caller must fix before deploy. Return to caller.
