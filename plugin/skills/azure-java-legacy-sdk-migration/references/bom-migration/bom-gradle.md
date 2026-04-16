# BOM Migration — Gradle Projects (No Version Catalogs)

Run the same `upgrade_bom.py` script. It auto-detects Gradle and performs:

1. **Set/upgrade the BOM** — adds `enforcedPlatform('com.azure:azure-sdk-bom:...')` if missing, or upgrades the version.
2. **Remove redundant explicit versions** — strips inline version strings from Azure dependencies managed by the BOM.

```bash
python3 <skill_dir>/scripts/upgrade_bom.py <project_dir> <bom_version>
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
