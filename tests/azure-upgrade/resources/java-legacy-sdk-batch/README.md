# Java Legacy Azure SDK — Batch Fixture

Minimal Maven project used by the `azure-upgrade` integration test to verify
the Batch slice of Flow B (legacy `com.microsoft.azure` → modern `com.azure`).

The pom intentionally pulls in:

- `com.microsoft.azure:azure` (legacy umbrella SDK)
- `com.microsoft.azure:azure-mgmt-batch`

Sources cover the Batch management rewrite documented under
`plugin/skills/azure-upgrade/references/languages/java/package-specific/com.microsoft.azure.management.md`:

- `com/fabrikam/azure/batch/BatchManagementHelper.java` —
  `com.microsoft.azure.management.batch.*` (BatchAccount, BatchAccountKeys,
  AccountKeyType) used through the legacy `Azure` fluent client. Includes the
  legacy `.defineNewApplicationPackage(...)` chain that must be rewritten to
  the top-level `.applicationPackages().define(...)` call. Source taken
  verbatim from
  <https://github.com/RoseFieldInc/batch-keyvault-java-management/blob/master/src/main/java/com/fabrikam/azure/batch/BatchManagementHelper.java>.

This is a **test fixture**, not a real application. Do not add real
credentials, subscription IDs, or tenant IDs.
