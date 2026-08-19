# Enterprise Security Baseline

<!-- fixture-id: enterprise-planner-security-v1 -->

Apply these controls to every new workload:

- Primary region: `eastus2`.
- Tag all resources with `data-classification=confidential` and `cost-center=CC-4100`.
- Data services must disable public network access and use private endpoints.
- Storage must set `allowSharedKeyAccess=false`, require TLS 1.2, and use managed identity with RBAC.
- Key Vault must use RBAC, soft delete, purge protection, and no public network access.
- Secrets and access keys must never appear in source or outputs.
- Send audit and resource logs to Log Analytics with 90-day retention.