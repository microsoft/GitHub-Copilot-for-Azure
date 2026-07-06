---
name: azure-iac-security
description: "Static pre-deployment security scan of Azure IaC (ARM, Bicep, Terraform) against MCSB v3.0 and MITRE ATT&CK. WHEN: \"scan my IaC for security before deploy\", \"check my template against MCSB\"."
license: MIT
metadata:
  author: Microsoft
  version: "0.0.0-placeholder"
---

# Azure IaC Security

Static, pre-deployment security analysis of Azure Infrastructure as Code (ARM JSON, Bicep,
Terraform). Catches misconfigurations **in the template before deployment**, mapped to
Microsoft Cloud Security Benchmark (MCSB) v3.0 and MITRE ATT&CK.

## Quick Reference

| Property | Details |
|---|---|
| Best for | Scanning IaC template *files* for security issues before deploy |
| Inputs | ARM JSON, Bicep, or Terraform template files |
| Frameworks | MCSB v3.0 (NS, IM, PA, DP, LT pillars), MITRE ATT&CK; MITRE ATLAS + OWASP LLM Top 10 for AI workloads |
| Output | JSON findings: control, severity, vulnerable code, code fix, Learn URL |
| Grounding | **Live Microsoft Learn MCP is authoritative**; static tables are seed hints only |
| Not for | Auditing *deployed* resources (use `azure-compliance`) or deploy readiness (use `azure-validate`) |

## When to Use This Skill

Activate when the user wants to:
- Scan an ARM/Bicep/Terraform file for security vulnerabilities or misconfigurations
- Check IaC against MCSB v3.0 (network, identity, data protection, logging)
- Harden a template before deployment (shift-left security)
- Scan **AI/ML workloads** (Azure OpenAI, AI Services, ML workspaces, AI Search) for insecure
  configuration and map to MITRE ATLAS / OWASP LLM Top 10
- Generate MITRE ATT&CK attack paths from IaC findings
- Get code-level remediation for insecure resource properties

**Do NOT use for:** runtime/deployed-resource audits (→ `azure-compliance`) or
"will it deploy" preflight checks (→ `azure-validate`).

## Scope Guard (refuse out-of-scope requests)

This skill does **one** thing: static, pre-deployment **security analysis of Azure IaC**. When
invoked — even if invoked explicitly — it must first confirm the request is in scope. If it is
not, **refuse in one line stating this skill's purpose and do not perform the unrelated task**:

- **No Azure IaC to scan** (no template file/content provided, or only a general question) →
  ask for an ARM/Bicep/Terraform template; do not fabricate a scan.
- **Non-Azure IaC** (AWS CloudFormation, GCP, or **raw K8s/Helm manifests** — *not* an AKS
  cluster authored in ARM/Bicep/Terraform, which IS in scope) → out of scope, zero findings,
  redirect to the native scanner (see [template parsing](references/template-parsing.md)).
- **Unrelated task** (recipes, prose, general coding, chit-chat, anything not IaC security) →
  refuse and restate purpose. Do **not** answer the unrelated request. Example reply:
  `The azure-iac-security skill only performs static security scanning of Azure IaC (ARM, Bicep, Terraform). It can't help with that request.`

## MCP Tools

| Tool | Purpose |
|---|---|
| `microsoft_docs_search` | Ground control guidance in official MCSB / Azure security docs |
| `microsoft_docs_fetch` | Fetch a full Learn page for a control or resource property |
| `bicepschema_get` | Look up valid property names / API versions and secure defaults for a Bicep resource type |

**Grounding-first (authoritative).** Static reference tables in this skill are *seed hints* that
go stale fast — **Azure ships new features and new security properties for services daily**, MCSB
is revised, and new resource types (AI and otherwise) appear constantly. No hardcoded table can
keep up. The **live Microsoft Learn** docs, exposed through the already-registered `azure` MCP
server (`@azure/mcp`), are the source of truth. On **every scan**, for each resource type, use
`microsoft_docs_search` / `microsoft_docs_fetch` (and `bicepschema_get`) to:
1. **Reconcile** each seed check's control ID, name, Docs URL, and the resource's current secure
   default before emitting it; and
2. **Discover newly-shipped security-relevant properties/checks** for that resource type/API
   version that are *not* in the seed tables, and evaluate those too.
This keeps coverage current for every service without waiting for a table update. Every finding
cites a `learn.microsoft.com` URL. If MCP is unavailable, fall back to seed-table URLs and mark
the finding `grounding: offline` (note that new-feature discovery is skipped).

## Workflow

1. **Detect template type** — read the file(s). ARM JSON has `"$schema"` + `resources[]`;
   Bicep has `resource` declarations with `@` API versions; Terraform has `azurerm_` blocks.
   **Scope gate:** if the file is non-Azure IaC (AWS CloudFormation `AWSTemplateFormatVersion` /
   `AWS::*`, `provider "aws"`/`aws_*`, GCP, or raw K8s/Helm manifests — an **AKS cluster** in
   ARM/Bicep/Terraform is Azure IaC and IS in scope), **stop immediately with zero
   findings** — state it is out of scope and redirect to the relevant native scanner (e.g.
   `cfn-lint`, Checkov). Do not emit MCSB findings or a best-effort scan. See
   [template parsing](references/template-parsing.md).
2. **Extract resources** — enumerate each resource with its `type`, name, properties, and
   source line number. See [template parsing](references/template-parsing.md).
3. **Preprocess** — resolve `[parameters()]`/`[variables()]`/ARM functions, associate any
   `.parameters.json` / `.bicepparam` files, and scan once per environment. Detect secrets in
   parameter values. See [template preprocessing](references/template-preprocessing.md).
4. **Ground controls (MCP) — authoritative, every run.** For every detected resource type, call
   `microsoft_docs_search` to (a) confirm the current MCSB control ID/name/URL and the resource's
   secure defaults, and (b) **discover newly-shipped security-relevant properties/checks** for
   that resource type/API version that aren't in the seed tables. Seed tables are a starting
   point; live Learn overrides them and extends coverage. For resource types **not in the seed
   tables** (new/AI services), grounding is the *primary* source — do not skip.
5. **Evaluate each pillar** against the resolved properties (reconcile IDs/URLs via step 4):
   - [Network Security (NS)](references/mcsb-ns.md)
   - [Identity Management (IM)](references/mcsb-im.md)
   - [Privileged Access (PA)](references/mcsb-pa.md) — least-privilege RBAC
   - [Data Protection (DP)](references/mcsb-dp.md)
   - [Logging & Threat Detection (LT)](references/mcsb-lt.md)
   - [AI Workload Security](references/ai-workload-security.md) — Azure OpenAI / AI Services /
     ML workspaces / AI Search (MITRE ATLAS + OWASP LLM Top 10)
6. **Assemble findings** in the standard schema — required: `control_id`, `severity`,
   `description`, `line_number`, `vulnerable_code`, `code_fix`, `priority`, `azure_guidance`.
   See [output schema](references/output-schema.md).
7. **(Optional) Attack paths** — when asked, map findings to MITRE ATT&CK techniques (and
   MITRE ATLAS / OWASP LLM for AI workloads) and chain them into attack scenarios.
   See [attack paths](references/mitre-attack.md).
8. **Report** — group findings by severity (Critical → Low), provide the code fix inline for
   each, and cite the Learn URL. See [remediation patterns](references/remediation-patterns.md).

## Severity & Priority

| Severity | Priority | Guidance |
|---|---|---|
| Critical | P0 | Public exposure / no auth — fix before deploy |
| High | P1 | Weak crypto, missing encryption, broad RBAC |
| Medium | P2 | Missing logging, short retention |
| Low | P3 | Hardening / defense-in-depth gaps |

## Error Handling

| Error | Message | Remediation |
|---|---|---|
| No template found | "No IaC file provided" | Ask the user for a file path or template content |
| Non-Azure IaC | "Out of scope: this skill only scans Azure ARM/Bicep/Terraform" | Stop with zero findings; redirect to the cloud's native scanner (e.g. `cfn-lint`/Checkov for AWS) |
| Unknown template type | "Cannot detect ARM/Bicep/Terraform" | Confirm file type; check for a valid schema/provider |
| MCP unavailable | "Docs grounding offline" | Proceed using reference-table URLs; note grounding was offline |
| Unsupported resource | "No seed mapping for `<type>`" | Ground the type live via `microsoft_docs_search`; if still unmapped, report as unscanned and suggest manual review |

## Supported Resource Types

Storage accounts, SQL servers/databases, Key Vault, NSGs, virtual networks, App Service /
Function Apps, VMs and VMSS, Container Registry, AKS, Service Bus, Cosmos DB, Redis, and
**AI/ML workloads** (Azure OpenAI, Azure AI Services, Machine Learning workspaces, AI Search).
For any type without a seed mapping, the skill grounds the current guidance live via Microsoft
Learn rather than skipping it.
