# Java Legacy Azure SDK — Client Initialization Fixture

Minimal Maven project used by the `azure-upgrade` integration test to verify
the client-initialization slice of Flow B (legacy `com.microsoft.azure` →
modern `com.azure`).

The pom intentionally pulls in:

- `com.microsoft.azure:azure` (legacy umbrella SDK)
- `com.microsoft.azure:azure-mgmt-resources`
- `com.microsoft.azure:azure-mgmt-compute`

Sources cover the secure-by-default authentication rewrite documented under
`plugin/skills/azure-upgrade/references/languages/java/package-specific/com.microsoft.azure.management.md`:

- `com/example/legacy/App.java` — `com.microsoft.azure.management.*` plus
  `Azure.configure().authenticate(File)` driven by `AZURE_AUTH_LOCATION`,
  exercising the rewrite to `DefaultAzureCredential`.

This is a **test fixture**, not a real application. Do not add real
credentials, subscription IDs, or tenant IDs.
