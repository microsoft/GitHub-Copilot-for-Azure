# BOM Migration — Gradle Projects (No Version Catalogs)

> **Python availability**: The script below requires Python 3.8+. If `python3 --version` (or `python --version`) fails, skip the script section and follow [Manual Fallback (no Python)](#manual-fallback-no-python) instead.

## Automated (Python available)

Run the `upgrade_bom.py` script located at `references/languages/java/scripts/upgrade_bom.py` (relative to this skill). It auto-detects Gradle and performs:

1. **Set/upgrade the BOM** — adds `enforcedPlatform('com.azure:azure-sdk-bom:...')` if missing, or upgrades the version.
2. **Remove redundant explicit versions** — strips inline version strings from Azure dependencies managed by the BOM.

```bash
# Path is relative to the skill directory (plugin/skills/azure-upgrade/)
python3 ./references/languages/java/scripts/upgrade_bom.py <project_dir> <bom_version>
```

Options:
- `--gradle <cmd>` — override the Gradle command (default: auto-detects `gradlew` or `gradle`).

Under the hood (OpenRewrite recipes):
- **Add BOM**: `AddPlatformDependency` ([docs](https://docs.openrewrite.org/recipes/gradle/addplatformdependency))
- **Upgrade BOM**: `UpgradeDependencyVersion` ([docs](https://docs.openrewrite.org/recipes/gradle/upgradedependencyversion))
- **Remove redundant versions**: `RemoveRedundantDependencyVersions` ([docs](https://docs.openrewrite.org/recipes/gradle/removeredundantdependencyversions))

> ⚠️ **Warning:** The script does **not** support Gradle version catalogs — neither TOML files nor programmatic `settings.gradle` catalogs. If the project uses either, follow [TOML catalog steps](./bom-gradle-toml.md) or [programmatic catalog steps](./bom-gradle-settings.md) instead.

## Expected build.gradle after migration

```groovy
dependencies {
    implementation enforcedPlatform('com.azure:azure-sdk-bom:{bom_version}')

    implementation 'com.azure:azure-identity'
    implementation 'com.azure.resourcemanager:azure-resourcemanager'
}
```

## Manual Fallback (no Python)

When Python is unavailable, edit `build.gradle` (or `build.gradle.kts`) directly. Apply the same two steps as the script.

### Step 1 — Add or upgrade the BOM platform

Inside the `dependencies { }` block, add or update the `enforcedPlatform` line for `azure-sdk-bom`:

Groovy DSL:
```groovy
dependencies {
    implementation enforcedPlatform('com.azure:azure-sdk-bom:{bom_version}')
    // ...other dependencies...
}
```

Kotlin DSL:
```kotlin
dependencies {
    implementation(enforcedPlatform("com.azure:azure-sdk-bom:{bom_version}"))
    // ...other dependencies...
}
```

- **If the line exists**: update only the version to `{bom_version}`.
- **If the line is missing**: insert it at the top of the `dependencies` block.
- Use the same configuration (`implementation`, `api`, `compileOnly`, etc.) the project already uses for Azure deps. Repeat the platform line per configuration if needed.
- **Multi-project build**: add the platform line in every subproject that declares Azure dependencies, or apply it once via a shared `subprojects { }` / convention plugin.

### Step 2 — Remove redundant explicit versions

For every Azure dependency whose group starts with `com.azure` and is managed by the BOM (verify against `https://repo1.maven.org/maven2/com/azure/azure-sdk-bom/{bom_version}/azure-sdk-bom-{bom_version}.pom`), strip the version coordinate.

Groovy DSL — string notation:
```groovy
// Before
implementation 'com.azure:azure-identity:1.13.0'
// After
implementation 'com.azure:azure-identity'
```

Groovy DSL — map notation:
```groovy
// Before
implementation group: 'com.azure', name: 'azure-identity', version: '1.13.0'
// After
implementation group: 'com.azure', name: 'azure-identity'
```

Kotlin DSL:
```kotlin
// Before
implementation("com.azure:azure-identity:1.13.0")
// After
implementation("com.azure:azure-identity")
```

Do **not** strip versions from artifacts that are not managed by the BOM.

### Step 3 — Verify

Run `./gradlew dependencies --configuration runtimeClasspath` (or the relevant configuration) and confirm:
- The platform `com.azure:azure-sdk-bom:{bom_version}` appears.
- All BOM-managed Azure artifacts resolve to versions sourced from the BOM.

Then continue with the validation checklist in [bom-validation.md](./bom-validation.md).
