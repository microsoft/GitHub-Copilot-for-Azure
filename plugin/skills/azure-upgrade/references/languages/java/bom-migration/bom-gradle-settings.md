# BOM Migration — Gradle Programmatic Version Catalog (`settings.gradle`)

Some projects define version catalogs programmatically in `settings.gradle` / `settings.gradle.kts` instead of using a TOML file. OpenRewrite does not support this either ([openrewrite/rewrite#4852](https://github.com/openrewrite/rewrite/issues/4852)). Handle manually.

## Step 0 — Detect programmatic catalog usage

Look for a `dependencyResolutionManagement` block in `settings.gradle` or `settings.gradle.kts`:

```groovy
// settings.gradle (Groovy DSL)
dependencyResolutionManagement {
    versionCatalogs {
        libs {
            version('azureSdk', '1.41.4')
            version('azureStorage', '8.6.6')
            library('azure', 'com.microsoft.azure', 'azure').versionRef('azureSdk')
            library('azure-storage', 'com.microsoft.azure', 'azure-storage').versionRef('azureStorage')
        }
    }
}
```

```kotlin
// settings.gradle.kts (Kotlin DSL)
dependencyResolutionManagement {
    versionCatalogs {
        create("libs") {
            version("azureSdk", "1.41.4")
            version("azureStorage", "8.6.6")
            library("azure", "com.microsoft.azure", "azure").versionRef("azureSdk")
            library("azure-storage", "com.microsoft.azure", "azure-storage").versionRef("azureStorage")
        }
    }
}
```

The `library()` call can also use the two-arg `module` form:
```groovy
library('azure', 'com.microsoft.azure:azure').versionRef('azureSdk')
library('azure-inline', 'com.microsoft.azure:azure').version('1.41.4')
```

If the project has this pattern and contains Azure dependency entries, use this section. The same `libs.<alias>` accessor syntax is used in `build.gradle` as with TOML catalogs.

## Step 1 — Add or upgrade the BOM

Add a version and library entry for the BOM inside the `versionCatalogs` block:

```groovy
// Groovy DSL
dependencyResolutionManagement {
    versionCatalogs {
        libs {
            version('azureSdkBom', '{bom_version}')
            library('azure-sdk-bom', 'com.azure', 'azure-sdk-bom').versionRef('azureSdkBom')
        }
    }
}
```

```kotlin
// Kotlin DSL
dependencyResolutionManagement {
    versionCatalogs {
        create("libs") {
            version("azureSdkBom", "{bom_version}")
            library("azure-sdk-bom", "com.azure", "azure-sdk-bom").versionRef("azureSdkBom")
        }
    }
}
```

If a BOM entry already exists, update the version string.

In `build.gradle`, add the platform dependency (if not already present):
```groovy
dependencies {
    implementation enforcedPlatform(libs.azure.sdk.bom)
}
```

## Step 2 — Remove explicit versions from BOM-managed Azure libraries

For each modern Azure library (`com.azure.*`) managed by the BOM, change its catalog entry to remove the version. Use the `withoutVersion()` call:

Before:
```groovy
library('azure-identity', 'com.azure', 'azure-identity').versionRef('azureIdentity')
```

After:
```groovy
library('azure-identity', 'com.azure', 'azure-identity').withoutVersion()
```

For the two-arg module form:
```groovy
// Before
library('azure-identity', 'com.azure:azure-identity').versionRef('azureIdentity')
// After
library('azure-identity', 'com.azure:azure-identity').withoutVersion()
```

Then remove any orphaned `version(...)` calls that are no longer referenced.

## Step 3 — Replace legacy Azure library entries with modern equivalents

For each legacy `com.microsoft.azure.*` library call:
1. Replace the group and artifact with the modern `com.azure.*` equivalent.
2. Change `.versionRef(...)` or `.version(...)` to `.withoutVersion()` if the new artifact is managed by the BOM.
3. Remove orphaned `version(...)` calls.
4. If you rename the alias (first argument), update **all** references in `build.gradle` / `build.gradle.kts` and any `bundle(...)` calls.

Before:
```groovy
version('azureSdk', '1.41.4')
version('azureStorage', '8.6.6')
library('azure', 'com.microsoft.azure', 'azure').versionRef('azureSdk')
library('azure-storage', 'com.microsoft.azure', 'azure-storage').versionRef('azureStorage')
```

After:
```groovy
library('azure-resourcemanager', 'com.azure.resourcemanager', 'azure-resourcemanager').withoutVersion()
library('azure-storage-blob', 'com.azure', 'azure-storage-blob').withoutVersion()
```

Then update `build.gradle`:
```groovy
// Before
implementation libs.azure
implementation libs.azure.storage

// After
implementation libs.azure.resourcemanager
implementation libs.azure.storage.blob
```

## Step 4 — Handle bundles

If `bundle(...)` calls reference any renamed or removed aliases, update them:
```groovy
// Before
bundle('azureLibs', ['azure', 'azure-storage'])
// After
bundle('azureLibs', ['azure-resourcemanager', 'azure-storage-blob', 'azure-identity'])
```

## Expected settings.gradle after migration

```groovy
dependencyResolutionManagement {
    versionCatalogs {
        libs {
            version('azureSdkBom', '{bom_version}')
            library('azure-sdk-bom', 'com.azure', 'azure-sdk-bom').versionRef('azureSdkBom')
            library('azure-identity', 'com.azure', 'azure-identity').withoutVersion()
            library('azure-resourcemanager', 'com.azure.resourcemanager', 'azure-resourcemanager').withoutVersion()
        }
    }
}
```
