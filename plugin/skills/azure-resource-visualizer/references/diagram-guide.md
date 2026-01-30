# Mermaid Diagram Guide

## Example

```mermaid
graph TB
    subgraph "Resource Group"
        subgraph "Network"
            VNET[Virtual Network<br/>10.0.0.0/16]
            SUBNET[Subnet<br/>10.0.1.0/24]
        end
        subgraph "Compute"
            APP[App Service<br/>P1v2]
            FUNC[Function App<br/>.NET 8]
        end
        subgraph "Data"
            SQL[Azure SQL<br/>S1]
            STORAGE[Storage<br/>Standard LRS]
        end
    end
    APP -->|"HTTPS"| FUNC
    FUNC -->|"SQL"| SQL
    FUNC -->|"Blob"| STORAGE
    VNET --> SUBNET --> APP
```

## Requirements

| Requirement | Example |
|-------------|---------|
| Group by layer | Network, Compute, Data, Security |
| Include details | SKUs, tiers in labels with `<br/>` |
| Label connections | Describe data flow |
| Visual hierarchy | Subgraphs for grouping |

## Connection Types

- `-->` data flow/dependencies
- `-.->` optional connections
- `==>` critical paths

## Syntax

- `graph TB` (top-bottom) or `graph LR` (left-right)
- Subgraph: `subgraph "Name"`
- Node: `ID["Name<br/>Details"]`
- Connection: `SOURCE -->|"Label"| TARGET`
