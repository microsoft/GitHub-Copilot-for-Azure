# Azure Data Collection Rules Skill

A Copilot agent skill for authoring, validating, and deploying Azure Monitor Data Collection Rules (DCRs).

## Prerequisites

- **VS Code** with GitHub Copilot Chat extension
- **Azure CLI** (`az`) or **Azure PowerShell** (`Az.Accounts` module), authenticated
- **Permissions**: Contributor or Monitoring Contributor role on the target resource group
- For multi-stage transformations: API version `2025-05-11` support (enabled during preview)

## Usage

The skill triggers automatically when you ask about DCR authoring, data collection rules, KQL transforms, custom tables, or multi-stage transformations.

### Example prompts
- "Create a DCR that collects syslog auth events and filters by severity"
- "Add a JSON parsing transform to extract user and action fields from custom text logs"
- "Help me design a multi-stage DCR with client-side aggregation and ingestion-time KQL"
- "Create a custom Log Analytics table for my aggregated performance data"
- "Create a direct ingestion DCR so my app can send custom logs via the Log Ingestion API"
- "Generate a script to send JSON data to Azure Monitor"

## Contents

```
azure-data-collection-rules/
├── SKILL.md                    # Entry point, quick reference, procedure overview
├── version.json                # Version metadata for CI
├── README.md                   # This file
├── references/
│   ├── procedure.md                        # Full step-by-step authoring workflow
│   ├── dcr-kinds.md                        # Kind selection guide
│   ├── dcr-schema.md                       # DCR JSON structure and REST API
│   ├── stream-declarations.md              # Custom stream schema reference
│   ├── processors-headers.md               # Header processor types and output columns
│   ├── processors-operations.md            # Filter, map, parse, aggregate, enrich operations
│   ├── processor-heuristics-filters.md     # Native filter intent mapping
│   ├── processor-heuristics-transforms.md  # Transform intent mapping
│   ├── processor-heuristics-staging.md     # Stage placement and cost optimization
│   ├── destination-routing.md              # Stream-to-table routing rules
│   ├── supported-tables.json               # Standard tables accepting custom streams
│   ├── supported-tables.md                 # Supported tables documentation
│   ├── kql-transforms.md                   # KQL patterns for ingestion-time transforms
│   ├── la-tables.md                        # Custom table creation and management
│   ├── direct-ingestion.md                 # Log Ingestion API (direct DCRs, auth)
│   ├── decision-guide.md                   # Scenario-to-approach routing table
│   └── limits.md                           # DCR structure limits, column constraints
├── scripts/
│   ├── get-dcr.ps1 / get-dcr.sh            # Retrieve existing DCR
│   ├── put-dcr.ps1 / put-dcr.sh            # Create/update DCR
│   ├── validate-dcr.ps1 / validate-dcr.sh  # Validate DCR JSON before deployment
│   ├── get-table-schema.ps1 / .sh          # Get LA table columns
│   ├── create-custom-table.ps1 / .sh       # Create/update custom table
│   └── send-logs.ps1 / send-logs.sh        # Send data via Log Ingestion API
└── examples/
    ├── syslog-filter-drop.json             # Syslog client-side filter + column drop
    ├── custom-json-log.json                # JSON log parsing with ingestion KQL
    ├── perf-counter-aggregation.json       # Performance counter aggregation
    ├── windows-events-split.json           # Windows events split to multiple tables
    └── direct-ingestion-custom-table.json  # Direct ingestion via Log Ingestion API
```

## No External Dependencies

This skill is fully self-contained. All reference material, scripts, and examples are included in the skill folder.
