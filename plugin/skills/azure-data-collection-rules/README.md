# DCR Authoring Skill

A portable Copilot agent skill for authoring, validating, and deploying Azure Monitor Data Collection Rules (DCRs).

## Installation

Copy the entire `dcr-authoring/` folder to one of the supported skill locations:

| Location | Scope |
|----------|-------|
| `{workspace}/.github/skills/dcr-authoring/` | Project (shared with team via git) |
| `{workspace}/.agents/skills/dcr-authoring/` | Project (alternative) |
| `~/.agents/skills/dcr-authoring/` | Personal (all workspaces) |
| `~/.copilot/skills/dcr-authoring/` | Personal (all workspaces) |

## Prerequisites

- **VS Code** with GitHub Copilot Chat extension
- **Azure PowerShell** (`Az.Accounts` module) installed and authenticated via `Connect-AzAccount`
- **Permissions**: Contributor or Monitoring Contributor role on the target resource group
- For multi-stage transformations: API version `2025-05-11` support (enabled during preview)

## Usage

### Slash command
Type `/dcr-authoring` in Copilot Chat and describe your scenario.

### Auto-invocation
The skill triggers automatically when you ask about DCR authoring, data collection rules, KQL transforms, custom tables, or multi-stage transformations.

### Example prompts
- "Create a DCR that collects syslog auth events and filters by severity"
- "Add a JSON parsing transform to extract user and action fields from custom text logs"
- "Help me design a multi-stage DCR with client-side aggregation and ingestion-time KQL"
- "Create a custom Log Analytics table for my aggregated performance data"
- "Create a direct ingestion DCR so my app can send custom logs via the Log Ingestion API"
- "Generate a PowerShell script to send JSON data to Azure Monitor"

## Contents

```
dcr-authoring/
├── SKILL.md                # Entry point and procedure overview
├── README.md               # This file
├── references/
│   ├── procedure.md            # Full step-by-step authoring workflow
│   ├── dcr-kinds.md            # Kind selection guide and transformation capabilities
│   ├── dcr-schema.md           # DCR JSON structure and REST API
│   ├── stream-declarations.md  # Custom stream schema reference
│   ├── processors.md           # All processor types with syntax
│   ├── processor-heuristics.md # Auto-select processors from user intent
│   ├── destination-routing.md  # Stream-to-table routing rules and supported table list
│   ├── kql-transforms.md       # KQL patterns for ingestion-time transforms
│   ├── la-tables.md            # Custom table creation and management
│   ├── direct-ingestion.md     # Log Ingestion API (direct DCRs, endpoints, auth)
│   ├── decision-guide.md       # Scenario-to-approach routing table
│   └── limits.md               # DCR structure limits, column constraints, API quotas
├── scripts/
│   ├── get-dcr.ps1             # Retrieve existing DCR
│   ├── put-dcr.ps1             # Create/update DCR
│   ├── validate-dcr.ps1        # Validate DCR JSON before deployment (includes limits checks)
│   ├── get-table-schema.ps1    # Get LA table columns
│   ├── create-custom-table.ps1 # Create/update custom table
│   └── send-logs.ps1           # Send data via Log Ingestion API
└── examples/
    ├── syslog-filter-drop.json             # Syslog client-side filter + column drop
    ├── custom-json-log.json                # JSON log parsing with ingestion KQL
    ├── perf-counter-aggregation.json       # Performance counter aggregation
    ├── windows-events-split.json           # Windows events split to multiple tables
    └── direct-ingestion-custom-table.json  # Direct ingestion via Log Ingestion API
```

## Customization

To add organization-specific patterns:
- Add example DCR JSONs to `examples/`
- Add KQL patterns to `references/kql-transforms.md`
- The skill references files via relative paths, so all additions are self-contained

## No External Dependencies

This skill is fully self-contained. It does not reference any external workspace files, configuration, or proprietary knowledge bases. All reference material, scripts, and examples are included in the skill folder.
