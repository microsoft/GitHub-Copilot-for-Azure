# Template 15a — Private Evaluation Setup & Diagnosis

Load this only when the user's scenario is the Bicep template **15a** (`15a-private-network-evaluation-only-setup`): private-network Foundry for **evaluations and data generation**, with Application Insights / Log Analytics behind Azure Monitor Private Link. For any other template, use the generic steps in [deploy.md](deploy.md) and [post-deployment-validation.md](post-deployment-validation.md).

**Base path:** https://github.com/microsoft-foundry/foundry-samples/tree/main/infrastructure/infrastructure-setup-bicep/15a-private-network-evaluation-only-setup/

The template ships two helper agent skills. Fetch the helper's `README.md` and `SKILL.md` before acting — they are authoritative for inputs, flags and behavior. Do not re-implement their logic.

| Helper | Use when | Changes Azure? |
|--------|----------|----------------|
| `foundry-private-setup/` | Deploy 15a, new or with bring-your-own (BYO) resources, including an existing account/project | Yes, after plan approval |
| `foundry-private-diagnostic/` | A 15a project is deployed but evaluations or agent runs fail | No — read-only |

## Setup (replaces Steps 3–5 for 15a)

Every component is either created or brought by the user (`mode: existing` in the JSON input). The helper:

1. Plans locally from one JSON input (`Setup.ps1 -Action Plan`) and prints a plan with a `planHash`.
2. Runs only with that hash (`-Action Run -ApprovePlan <planHash>`), with a what-if preview before every write.
3. Pauses before agent network injection, an account-wide change; continuing needs `-AcknowledgeAccountWideImpact`.
4. Resumes safely when the same command is rerun after a stop.

Rules for the agent:

- Show the plan and get explicit user approval **before** passing `-ApprovePlan`. Ask again before `-AcknowledgeAccountWideImpact`.
- Keep the helper folder unchanged; place input, plan and state **next to** it. A modified folder makes Run refuse the plan.
- Requirements: PowerShell 7.2+, Azure CLI with Bicep, and `roleAssignments/write` where the project identity is granted access (Contributor alone is not enough).
- Out of scope: it does not lock down public access, create keys/SAS, delete or repair resources, run evaluations, or migrate identities, CMK, models or multiple projects. Do not claim otherwise.

## Diagnose (extends Step 6 for 15a)

Run when evaluations fail, return empty results, or time out on a 15a project:

```powershell
./scripts/Diagnose.ps1 -ProjectResourceId /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<account>/projects/<project>
```

- Needs PowerShell 7.2+, `Az.Accounts` (or a VM managed identity), and Reader on the project, connected resources and network resources. Missing access shows as **Could not check**, not OK.
- Best run from a VM in the agent's VNet. From a laptop or Cloud PC, configuration checks still apply but connection tests are listed under **From this machine** and are not counted as problems.
- Output folder: `report.md` (problems, causes, next steps), `details.md`, `results.json`, `evidence.json`.
- Exit codes: `0` no problems, `1` problems, `2` blocking checks could not run, `3` input/script error.

### Interpreting results

- Lead with `report.md` problems ordered by severity; quote the stated owner and next step.
- Keep these layers separate — a pass in one does not prove another:
  - **Client reachability** — DNS and TCP from the machine running the tool (or the user's VM). NSG rules on a jump VM can block it even when the service path works.
  - **Service path** — Foundry → private endpoint → resource, using private DNS zone records and the Azure Monitor Private Link Scope (AMPLS) access modes.
  - **Authorization** — role assignments for the project managed identity on Storage, Application Insights and Log Analytics.
  - **Query execution** — whether Log Analytics actually accepts queries over the private path.
- A successful evaluation score does not prove the private Monitor query path; optional Insights validation can be skipped. Say which layer the evidence covers.
- If the report shows **Could not check**, ask for the missing Reader access rather than guessing.
- For support, share `evidence.json` (no keys or tokens). Use `-Mask` to replace resource names. Support re-runs it with `-EvidencePath`.

Apply fixes only after user approval; the diagnostic itself never changes Azure.
