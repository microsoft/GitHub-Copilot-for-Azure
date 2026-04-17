# BOM Migration Guide

How to add or upgrade `azure-sdk-bom` and clean up redundant versions across all supported build configurations.

## Decision Tree

```
Is the project Maven?
├─ YES → Maven projects (bom-maven.md)
└─ NO (Gradle)
     ├─ Does gradle/libs.versions.toml exist with Azure entries?
     │    └─ YES → TOML catalog steps (bom-gradle-toml.md)
     ├─ Does settings.gradle define a programmatic versionCatalogs block with Azure entries?
     │    └─ YES → Programmatic catalog steps (bom-gradle-settings.md)
     └─ Neither (plain build.gradle dependencies)
          └─ Plain Gradle projects (bom-gradle.md)
```

> 💡 **Tip:** To check which artifacts are managed by the BOM, fetch
> `https://repo1.maven.org/maven2/com/azure/azure-sdk-bom/{bom_version}/azure-sdk-bom-{bom_version}.pom`
> and look for `<dependency>` entries.

## Build-System Guides

| Build system | Guide |
|---|---|
| Maven | [bom-maven.md](./bom-maven.md) |
| Gradle (no version catalog) | [bom-gradle.md](./bom-gradle.md) |
| Gradle + TOML version catalog | [bom-gradle-toml.md](./bom-gradle-toml.md) |
| Gradle + programmatic catalog | [bom-gradle-settings.md](./bom-gradle-settings.md) |

## Validation

See the [Validation Checklist](./bom-validation.md) — covers all build systems including TOML and programmatic `settings.gradle` catalogs.
