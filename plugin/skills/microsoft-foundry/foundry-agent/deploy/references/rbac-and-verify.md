# RBAC and Invocation Verification

Part of the [deploy skill](../deploy.md).

This reference covers the minimum hosted-agent RBAC checks and the required invocation verification flow after deployment.

## Step 7: Test the Agent

For a newly deployed hosted agent, before invocation testing, first check whether the per-agent identity and project-level agent identity already have the minimum RBAC required for invocation.

Required role assignment:
- `Azure AI User`

Required scope: the Cognitive Services account, not the project.

Check existing assignments before creating any new assignment. If the required role assignment is missing for either identity, assign it before invocation testing.

If the current user account does not have permission to create a missing role assignment, stop the deployment workflow here. Explain to the user that hosted-agent invocation requires `Azure AI User` on the per-agent identity and project-level agent identity at the Cognitive Services account scope, and the deployment cannot be treated as complete until someone with RBAC assignment permission grants the missing role.

After this RBAC check is complete, read and follow the [invoke skill](../../invoke/invoke.md) to send a test message and verify the agent responds correctly. DO NOT SKIP reading the invoke skill -- it contains important information about required hosted-agent session handling.

If invocation testing still fails after this RBAC check, immediately read and follow the [troubleshoot skill](../../troubleshoot/troubleshoot.md). Do not treat the deployment as fully successful until invocation succeeds.
