# Azure Authentication Check

> **Canonical copy:** This shared reference is duplicated across Azure infrastructure skills. Keep parallel copies synchronized when updating shared guidance.

Canonical procedure for verifying Azure session before any Azure operations. Referenced by all skills that interact with Azure.

---

## Procedure

1. **Verify session**: Run `az account show` or `Get-AzContext` in the terminal, OR attempt a lightweight Azure MCP call (e.g., `mcp_azure_mcp_subscription_list`)

2. **If authenticated**:
   - Display the active subscription name and ID
   - Proceed to the next step

3. **If NOT authenticated**:
   - Present this message:

   ```
   ## Azure Authentication Required

   You need an active Azure session.

   **Option A — Azure CLI:**
   az login

   **Option B — Azure PowerShell:**
   Connect-AzAccount

   After authenticating, run this skill again.
   ```

   - **HARD GATE** — Stop execution. Do not proceed without authentication.
