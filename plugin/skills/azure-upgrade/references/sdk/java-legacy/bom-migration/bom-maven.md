# BOM Migration — Maven Projects

Run the `upgrade_bom.py` script located at `scripts/java-legacy/upgrade_bom.py` (relative to this skill). It auto-detects Maven and performs two steps:

1. **Set/upgrade the BOM** — adds `azure-sdk-bom` if missing, or upgrades the version if already present.
2. **Remove redundant explicit versions** — strips explicit `<version>` tags from individual Azure dependencies that are now managed by the BOM.

```bash
python3 <skill_dir>/scripts/java-legacy/upgrade_bom.py <project_dir> <bom_version>
```

Options:
- `--mvn <cmd>` — override the Maven command (default: auto-detects `mvnw` or `mvn`).

Under the hood (OpenRewrite recipes):
- **Add BOM**: `AddManagedDependency` ([docs](https://docs.openrewrite.org/recipes/maven/addmanageddependency))
- **Upgrade BOM**: `UpgradeDependencyVersion` ([docs](https://docs.openrewrite.org/recipes/maven/upgradedependencyversion))
- **Remove redundant versions**: `RemoveRedundantDependencyVersions` ([docs](https://docs.openrewrite.org/recipes/maven/removeredundantdependencyversions))

## Expected pom.xml after migration

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>com.azure</groupId>
            <artifactId>azure-sdk-bom</artifactId>
            <version>{bom_version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>com.azure</groupId>
        <artifactId>azure-identity</artifactId>
    </dependency>
    <dependency>
        <groupId>com.azure.resourcemanager</groupId>
        <artifactId>azure-resourcemanager</artifactId>
    </dependency>
</dependencies>
```
