# Azure SDK Migration Guidelines

## Context

The application is identified using legacy Azure SDKs for Java (`com.microsoft.azure.*`). These libraries reached end of support in 2023. They are not recommended for use in production, should be migrated to the latest Azure SDKs with the latest security patches and new capabilities support.

Follow these steps:

* **Inventory legacy dependencies**: Use tools such as `mvn dependency:tree` or `gradlew dependencies` to find every `com.microsoft.azure.*` SDK and map each one to its modern counterpart under `com.azure.*`.

* **Adopt supported SDKs**: Replace the legacy dependencies with their modern equivalents in your `pom.xml` or `build.gradle`, following the migration guide to align feature parity and new SDK names.

* **Update application code**: Refactor your code to the builder-based APIs, updated authentication flows (Azure Identity), and modern async or reactive patterns required by the latest SDKs. Add concise comments explaining non-obvious changes.

* **Test thoroughly**: Run unit, integration, and end-to-end tests to validate that the modern SDKs behave as expected, focusing on authentication, retry, and serialization differences.

## Migration Guide

### Assumption

- Project is Maven or Gradle.
- Java code is on JDK 8 or above.

### Migrate dependencies

It is recommended to use azure-sdk-bom (version higher than 1.3.0).

Help with looking up the latest stable version on https://repo1.maven.org/maven2/com/azure/azure-sdk-bom/ and proceed with migration.

Example of pom.xml
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
Example of build.gradle
```groovy
dependencies {
    implementation enforcedPlatform('com.azure:azure-sdk-bom:{bom_version}')

    implementation 'com.azure:azure-identity'
    implementation 'com.azure.resourcemanager:azure-resourcemanager'
}
```

### Migrate Java Code

- Make a list of source code/maven/gradle files that contains legacy SDK packages. Migrate each of them.
- Determine legacy SDK artifacts according to previous files, find suitable migration guides in [Package-Specific Migration Guides](#package-specific-migration-guides) and follow the guides whenever possible. Record which migration guide URL you used for each legacy package (e.g., in your plan or commit messages), so you can validate against them later.
- **Do not change the Java `package ...;` declaration at the top of each source file, and do not rename or move the source file's directory path to match a new SDK package structure.** Keep every `.java` file in its original directory; only update `import` statements and type usages inside the file body. For example, if a file lives in `src/main/java/com/microsoft/azure/eventprocessorhosts/Consumer.java` with `package com.microsoft.azure.eventprocessorhosts;`, it must stay in that exact directory and keep that exact package declaration — even though the modern SDK uses `com.azure.messaging.eventhubs`.
- Do not upgrade JDK version, if it is already JDK 8 or above.
- If there is test in the project, Java code there also need to be updated.

## Package-Specific Source Code Guidelines (Add them to plan guidelines when generating plan)

Use these package-specific references:

- [com.microsoft.azure.management.**](./package-specific/com.microsoft.azure.management.md)
- [com.microsoft.azure.eventprocessorhost](./package-specific/com.microsoft.azure.eventprocessorhost.md)

## Validation

**Make sure**
- Migrated project pass compilation.
- All tests pass. Don't silently skip tests.
- No legacy SDK dependencies/references exist.
- If azure-sdk-bom is used, ensure **NO** explicit version dependencies for Azure libraries that are in azure-sdk-bom.
  E.g. Instead of `implementation 'com.azure.resourcemanager:azure-resourcemanager:2.60.0'`, we should use `implementation 'com.azure.resourcemanager:azure-resourcemanager'`.
  For Azure libraries in azure-sdk-bom, check https://repo1.maven.org/maven2/com/azure/azure-sdk-bom/{bom_version}/azure-sdk-bom-{bom_version}.pom (bom_version be version used during migration)
- For each migration guide you recorded during migration:
  1. Fetch and read the full content of the guide URL.
  2. Identify the migrated source files that correspond to that guide's package.
  3. Verify the migrated code follows the guide's recommended API replacements, class mappings, authentication patterns, and async/sync conventions.
  4. Fix any deviations — do not just report them.

## Package-Specific Migration Guides

- [Migrate to `com.azure.resourcemanager.**` from `com.microsoft.azure.management.**`](https://aka.ms/java-track2-migration-guide)
- [Migrate to com.azure:azure-messaging-servicebus from com.microsoft.azure:azure-servicebus](https://aka.ms/azsdk/java/migrate/sb)
- [Migrate to azure-messaging-eventhubs from azure-eventhubs and azure-eventhubs-eph](https://aka.ms/azsdk/java/migrate/eh)
- [Migrate to `azure-messaging-eventgrid` from `microsoft-azure-eventgrid`](https://aka.ms/azsdk/java/migrate/eg)
- [Storage Blob Service SDK Migration Guide from 8.x to 12.x](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/storage/azure-storage-blob/migrationGuides/V8_V12.md)
- [Storage Blob Service SDK Migration Guide from 10.x/11.x to 12.x](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/storage/azure-storage-blob/migrationGuides/V10_V12.md)
- [Storage Queue Service SDK Migration Guide from 8.x to 12.x](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/storage/azure-storage-queue/migrationGuides/V8_V12.md)
- [Storage File Share Service SDK Migration Guide from 8.x to 12.x](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/storage/azure-storage-file-share/migrationGuides/V8_V12.md)
- [Migrate to azure-security-keyvault-secrets from azure-keyvault](https://aka.ms/azsdk/java/migrate/kv-secrets)
- [Migrate to azure-security-keyvault-keys from azure-keyvault](https://aka.ms/azsdk/java/migrate/kv-keys)
- [Migrate to azure-security-keyvault-certificates from azure-keyvault](https://aka.ms/azsdk/java/migrate/kv-cert)
- [Migrate to `Azure-Compute-Batch` from `Microsoft-Azure-Batch`](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/batch/azure-compute-batch/MigrationGuide.md)
- [Migrate to `azure-ai-documentintelligence` from `azure-ai-formrecognizer`](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/documentintelligence/azure-ai-documentintelligence/MIGRATION_GUIDE.md)
- [Migrate to `azure-ai-formrecognizer 4.0.0-beta.1 - above` from `azure-ai-formrecognizer 3.1.x - lower`](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/formrecognizer/azure-ai-formrecognizer/migration-guide.md)
- [Migration Guide from Azure OpenAI Java SDK to OpenAI Java SDK](https://raw.githubusercontent.com/Azure/azure-sdk-for-java/main/sdk/openai/azure-ai-openai-stainless/MIGRATION.md)
- [Migrate to azure-monitor-query from azure-loganalytics and azure-applicationinsights-query](https://aka.ms/azsdk/java/migrate/monitorquery)
