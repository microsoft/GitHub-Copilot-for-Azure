# AI Projects — Java SDK Quick Reference

> Condensed from **azure-ai-projects-java**. Full patterns (connections,
> datasets, indexes, evaluations, deployments)
> in the **azure-ai-projects-java** plugin skill if installed.

## Install
```xml
<dependency>
    <groupId>com.azure</groupId>
    <artifactId>azure-ai-projects</artifactId>
    <version>1.0.0-beta.1</version>
</dependency>
```

## Quick Start
```java
import com.azure.ai.projects.AIProjectClientBuilder;
import com.azure.identity.DefaultAzureCredentialBuilder;
var builder = new AIProjectClientBuilder()
    .endpoint(System.getenv("PROJECT_ENDPOINT"))
    .credential(new DefaultAzureCredentialBuilder().build());
```

## Best Practices
- Use DefaultAzureCredential for production authentication
- Reuse client builder to create multiple sub-clients efficiently
- Handle pagination when listing resources with PagedIterable
- Use environment variables for connection names and configuration
- Check connection types before accessing credentials
