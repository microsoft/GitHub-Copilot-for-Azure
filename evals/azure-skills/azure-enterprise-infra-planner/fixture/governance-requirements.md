# Subscription Governance Requirements

<!-- fixture-id: enterprise-planner-governance-v1 -->

- Generate subscription-scope infrastructure for a landing-zone extension.
- Restrict resource locations to `eastus2` and `westus3` using Azure Policy.
- Deny public IP creation unless an exemption is approved.
- Require the tags `owner`, `cost-center`, and `environment` on resource groups and resources.
- Assign built-in least-privilege RBAC roles to platform operators and auditors.
- Send policy and activity audit data to a central Log Analytics workspace.
- All policy and role assignment names must be deterministic across deployments.