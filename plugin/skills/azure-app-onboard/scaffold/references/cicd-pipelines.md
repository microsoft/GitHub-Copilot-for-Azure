# CI/CD Pipeline Patterns

GitHub Actions workflow patterns for deploying AppOnboard-generated IaC. Suggest as follow-up after scaffold completes — do NOT auto-generate workflow files.

> **Source:** [HashiCorp – Automate Terraform with GitHub Actions](https://developer.hashicorp.com/terraform/tutorials/automation/github-actions) · [Microsoft Learn – Deploy Bicep via GitHub Actions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-github-actions)

## Auth — OIDC (Both Paths)

Use **Workload Identity Federation** (OIDC) — no stored secrets. Identical for Terraform and Bicep:

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

> ⛔ Never use `AZURE_CREDENTIALS` (service principal JSON). OIDC is the secure default.

## Bicep Workflow

| Trigger | Steps |
|---------|-------|
| PR opened/updated | `azure/login` → `az bicep build` (lint) → `what-if` preview |
| Merge to `main` | `azure/login` → `Azure/bicep-deploy` with `operation: create` |

**Actions:** [`Azure/bicep-deploy`](https://github.com/Azure/bicep-deploy)

```yaml
- uses: Azure/bicep-deploy@v2
  with:
    type: subscription
    operation: create
    name: ${{ github.run_id }}
    location: ${{ vars.AZURE_LOCATION }}
    template: infra/main.bicep
    parameters: infra/main.parameters.json
```

## Terraform Workflow

| Trigger | Steps |
|---------|-------|
| PR opened/updated | `terraform init` → `fmt -check` → `validate` → `plan` → post plan as PR comment |
| Merge to `main` | `terraform init` → `apply -auto-approve` |

**Actions:** [`hashicorp/setup-terraform`](https://github.com/hashicorp/setup-terraform)

```yaml
- uses: hashicorp/setup-terraform@v3
- run: terraform init
  working-directory: infra
- run: terraform plan -no-color -out=tfplan
  working-directory: infra
```

## Side-by-Side

| | Bicep (default) | Terraform (alternative) |
|---|---|---|
| Setup action | `Azure/bicep-deploy` | `hashicorp/setup-terraform` |
| Preview | `az deployment sub what-if` | `terraform plan` |
| Apply | `Azure/bicep-deploy` (operation: create) | `terraform apply` |
| State | ARM manages state | Remote backend (Azure Storage) |
