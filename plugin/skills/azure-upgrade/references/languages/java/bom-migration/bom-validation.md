# BOM Migration — Validation Checklist

After BOM migration, verify:

- [ ] Project compiles successfully.
- [ ] No legacy `com.microsoft.azure.*` dependencies remain anywhere (pom.xml, build.gradle, TOML, settings.gradle).
- [ ] BOM-managed Azure libraries have **no** explicit version (no `<version>` tag, no version string, no `version.ref`, no `.versionRef()`).
- [ ] The BOM version is correct — check against https://repo1.maven.org/maven2/com/azure/azure-sdk-bom/

## Additional checks for TOML version catalog projects

- [ ] No orphaned entries in `[versions]` (every version key must be referenced by at least one library or plugin).
- [ ] `[bundles]` aliases match current `[libraries]` aliases (no stale references).
- [ ] `build.gradle` uses `libs.<alias>` references — no raw `"group:artifact:version"` strings for Azure libraries.

## Additional checks for programmatic settings.gradle catalog projects

- [ ] No orphaned `version(...)` calls (every version must be referenced by at least one `library` or `plugin` entry).
- [ ] `bundle(...)` aliases match current `library(...)` aliases (no stale references).
- [ ] `build.gradle` uses `libs.<alias>` references — no raw `"group:artifact:version"` strings for Azure libraries.
