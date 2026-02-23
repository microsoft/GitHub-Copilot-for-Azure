---
name: azure-rbac
description: >-
  Helps users find the right Azure RBAC role for an identity with least privilege access, then generate CLI commands and Bicep code to assign it. Also provides guidance on permissions required to grant roles.
  USE FOR: "what role should I assign", "least privilege role", "RBAC role for", "role to read blobs", "role for managed identity", "custom role definition", "assign role to identity", "what role do I need to grant access", "permissions to assign roles", "User Access Administrator", "Microsoft.Authorization/roleAssignments/write".
  DO NOT USE FOR: creating or configuring managed identities, or general Azure security hardening; those are out of scope for this role-selection skill.
---
Use the 'azure__documentation' tool to find the minimal role definition that matches the desired permissions the user wants to assign to an identity. If no built-in role matches the desired permissions, use the 'azure__extension_cli_generate' tool to create a custom role definition with the desired permissions. Then use the 'azure__extension_cli_generate' tool to generate the CLI commands needed to assign that role to the identity. Finally, use the 'azure__bicepschema' and 'azure__get_azure_bestpractices' tools to provide a Bicep code snippet for adding the role assignment.
## Prerequisites for Granting Roles

To assign RBAC roles to identities, you need a role that includes the `Microsoft.Authorization/roleAssignments/write` permission. The most common roles with this permission are:

- **User Access Administrator** (least privilege - recommended for role assignment only)
- **Owner** (full access including role assignment)
- **Custom Role** with `Microsoft.Authorization/roleAssignments/write`

See [references/granting-roles.md](references/granting-roles.md) for detailed guidance on what permissions are needed to grant roles, especially for common scenarios like granting Storage access to Web Apps and Functions.

## Role Selection Workflow

Follow this workflow to help users find and assign the right Azure RBAC role:

1. **Find the minimal role definition**:
   - Use the `azure__documentation` tool to search for the minimal role that matches the desired permissions
   - If no built-in role matches, proceed to create a custom role

2. **Create custom role (if needed)**:
   - Use the `azure__extension_cli_generate` tool to create a custom role definition with the specific permissions required

3. **Generate assignment commands**:
   - Use the `azure__extension_cli_generate` tool to generate the Azure CLI commands needed to assign the role to the identity

4. **Provide Bicep code**:
   - Use the `azure__bicepschema` and `azure__get_azure_bestpractices` tools to generate a Bicep code snippet for the role assignment

When users ask about what permissions they need to grant roles, or encounter authorization errors when assigning roles, refer them to the prerequisites section above and the detailed reference document.
