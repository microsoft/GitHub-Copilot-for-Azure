# Template Parsing & Resource Extraction

Detect the IaC dialect, then enumerate resources with their type, name, properties, and source
line number so findings can cite exact locations.

## Detection

| Type | Signals |
|---|---|
| **ARM JSON** | `"$schema"` containing `deploymentTemplate`; top-level `"resources"` array; `"apiVersion"` fields |
| **Bicep** | `resource <name> '<type>@<apiVersion>' = { ... }` declarations; `param`/`var`/`module` keywords; no JSON braces at root |
| **Terraform** | `resource "azurerm_*" "<name>" { ... }` blocks; `provider "azurerm"`; HCL syntax |

If none match, report "Cannot detect ARM/Bicep/Terraform" and ask the user to confirm the type.

### Non-Azure IaC — hard stop (do NOT scan)

Before extracting resources, reject templates that are **not Azure IaC**. This skill only
supports Azure ARM JSON, Bicep, and Terraform (`azurerm`/`azapi`). If any of these signals are
present, **stop immediately, emit zero findings, and do not produce a best-effort scan** — the
MCSB/MITRE mappings and Microsoft Learn grounding do not apply to other clouds:

| Foreign IaC | Signals | Redirect to |
|---|---|---|
| **AWS CloudFormation** | `"AWSTemplateFormatVersion"`; resource `type` values starting `AWS::` | `cfn-lint`, `cfn_nag`, Checkov, AWS Config / Security Hub |
| **AWS Terraform** | `provider "aws"`; `resource "aws_*"` blocks | `tfsec`, Checkov, Terrascan |
| **GCP** | Deployment Manager `type: gcp-types/*`; `provider "google"`; `resource "google_*"` | `gcloud`, Checkov, Terrascan |
| **Kubernetes / Helm** | `apiVersion:` + `kind:` (Pod/Deployment/Service); Helm `Chart.yaml` | `kubesec`, `kube-score`, Checkov, Trivy |

> **AKS is in scope.** An Azure Kubernetes Service *cluster* declared in Azure IaC
> (`Microsoft.ContainerService/managedClusters` in ARM/Bicep, `azurerm_kubernetes_cluster` in
> Terraform) is Azure IaC — scan it normally. Only **raw Kubernetes/Helm manifests** (native
> `kind:`/`apiVersion:` YAML that provisions in-cluster workloads) are out of scope.

Response when a foreign template is detected (no findings block, no MCSB IDs, no Learn URLs):

```
This skill only scans Azure IaC (ARM, Bicep, Terraform/azurerm). The provided template is
AWS CloudFormation, which is out of scope. Use an AWS-native scanner instead (cfn-lint,
Checkov, or AWS Security Hub). I did not run any Azure security checks against it.
```

A mixed file that contains **both** Azure and foreign resources is still scanned for the Azure
resources only; call out that the non-Azure resources were skipped as out of scope.


## Resource Extraction

### ARM JSON
Walk the `resources[]` array (including `resources` nested under a parent). For each item read
`type`, `name`, `apiVersion`, and `properties`. Track the line number of each `type` for
`line_number`. Build `resource_id` as `<type>/<name>`.

```json
{
  "type": "Microsoft.Storage/storageAccounts",
  "name": "mysa",
  "apiVersion": "2023-01-01",
  "properties": { "supportsHttpsTrafficOnly": false }
}
```

### Bicep
Match each `resource` declaration of the form
`resource <symbolicName> '<type>@<apiVersion>' = { ... }`. The single-quoted string **before**
`=` holds the resource type and API version (`<type>@<apiVersion>`); the identifier after
`resource` is the symbolic name; the object **after** `=` is the resource body. Parse that
`{ ... }` body for properties (top-level and under `properties:`). Record the line number.
Prefer `bicepschema_get` to confirm valid property names, API versions, and secure defaults.

```bicep
resource sa 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mysa'
  properties: { supportsHttpsTrafficOnly: false }
}
```

### Terraform
Match each `resource "azurerm_<kind>" "<name>"` block. Map the `azurerm_*` kind to the
equivalent ARM type for control lookup (e.g. `azurerm_storage_account` →
`Microsoft.Storage/storageAccounts`). Parse HCL attributes inside the block.

```hcl
resource "azurerm_storage_account" "mysa" {
  enable_https_traffic_only = false
}
```

## Property Normalization

- Treat missing security properties as **insecure defaults** unless Azure's *current* default is
  secure — confirm the default via `bicepschema_get` / live Learn grounding before flagging (note
  when a secure default is relied upon).
- Resolve parameters/variables to literal values when statically determinable; if a
  security-relevant value is a parameter with no default and no param-file value, do **not**
  emit a finding — record it in the top-level `unscanned_resources` array (see output-schema.md).
- Normalize Terraform snake_case attribute names to the corresponding ARM camelCase property
  when applying control checks.
