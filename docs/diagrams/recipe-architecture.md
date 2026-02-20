# Composable Recipes Architecture

Azure Functions recipe composition flow showing how base templates combine with integration recipes.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#0078D4', 'primaryTextColor': '#fff', 'primaryBorderColor': '#005A9E', 'lineColor': '#5C5C5C', 'secondaryColor': '#F3F3F3'}}}%%
flowchart TB
    subgraph Templates["AZD Base Templates"]
        T1[Python HTTP]
        T2[TypeScript HTTP]
        T3[.NET HTTP]
        T4[Java HTTP]
    end

    subgraph Recipes["Integration Recipes"]
        R1[Cosmos DB]
        R2[Event Hubs]
        R3[Service Bus]
        R4[SQL]
        R5[Blob + EventGrid]
        R6[Timer]
        R7[Durable]
        R8[MCP]
    end

    subgraph Output["Deployable Project"]
        O1[azure.yaml]
        O2[infra/main.bicep]
        O3[Source Code]
    end

    T1 & T2 & T3 & T4 --> |"azd init"| Base
    Base[Base Project] --> |"+ Recipe"| Combined
    R1 & R2 & R3 & R4 & R5 & R6 & R7 & R8 --> Combined
    Combined --> O1 & O2 & O3
    O1 & O2 & O3 --> |"azd up"| Deploy[Azure Resources]

    style Templates fill:#0078D4,color:#fff
    style Recipes fill:#50E6FF,color:#000
    style Output fill:#107C10,color:#fff
```

## Recipe Composition Flow

```mermaid
%%{init: {'theme': 'base'}}%%
sequenceDiagram
    participant User
    participant Skill as azure-prepare
    participant AZD
    participant Recipe
    participant Azure

    User->>Skill: Create function with Event Hubs
    Skill->>AZD: azd init -t functions-quickstart-python-http-azd
    AZD-->>Skill: Base project created
    Skill->>Recipe: Read eventhubs/README.md
    Recipe-->>Skill: IaC modules + source code
    Skill->>Skill: Copy bicep to infra/app/
    Skill->>Skill: Add module to main.bicep
    Skill->>Skill: Replace source code
    Skill->>AZD: azd provision
    AZD->>Azure: Deploy infrastructure
    Azure-->>AZD: Resources ready
    Skill->>AZD: azd deploy
    AZD->>Azure: Deploy code
    Azure-->>User: Function running ✅
```

## Storage Endpoint Flags

For recipes requiring additional storage access:

```mermaid
%%{init: {'theme': 'base'}}%%
flowchart LR
    subgraph Flags["main.bicep Flags"]
        B[enableBlob: true]
        Q[enableQueue: true]
        T[enableTable: true]
    end

    subgraph Auto["Auto-configured"]
        URI[Service URIs]
        RBAC[RBAC Roles]
    end

    subgraph Recipes["Recipes Requiring"]
        D[Durable: Queue + Table]
        M[MCP: Queue]
    end

    B --> URI
    Q --> URI
    T --> URI
    URI --> RBAC
    D --> Q & T
    M --> Q

    style Flags fill:#FFB900,color:#000
    style Auto fill:#107C10,color:#fff
```
