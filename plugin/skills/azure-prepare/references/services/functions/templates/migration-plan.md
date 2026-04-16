# Design: Replace Hardcoded Azure Functions Content with MCP Tools

## Executive Summary

Replace static, hardcoded Azure Functions code samples and templates in `plugin/skills/azure-prepare/references/services/functions/` with dynamic calls to the **Azure MCP Functions toolset** (`functions_language_list`, `functions_project_get`, `functions_template_get`).

> **Key Insight**: MCP templates are **complete AZD samples** that include:
>
> - ✅ Full source code
> - ✅ Complete IaC (Bicep/Terraform)
> - ✅ RBAC role assignments
> - ✅ Managed identity configuration
> - ✅ VNet integration
> - ✅ azure.yaml for AZD
>
> **Skills just need to instruct agents to always choose AZD-enabled templates.**

## Problem Statement

### Current State

The skills contain **hardcoded content** that becomes stale:

| File | Hardcoded Content |
|------|-------------------|
| `templates/recipes/*/source/*.md` | Python/TS/C# trigger code snippets |
| `templates/http.md` | Template names (`functions-quickstart-*-azd`) |
| `templates/recipes/README.md` | Base template lookup table |
| `bicep.md` | Bicep resource patterns, API versions |
| `README.md` | Runtime stack versions |

### Issues

1. **Staleness** — Template names, API versions, and code patterns change
2. **Maintenance burden** — 6 languages × 10+ integrations = 60+ files to update
3. **Inconsistency** — MCP tools may diverge from skill content
4. **Duplication** — Same information maintained in two places
5. **Context bloat** — All static content loads into context even when not needed

### Why Dynamic Loading Matters

Static hardcoded content has a **context loading problem**:

| Approach | Context Impact |
|----------|---------------|
| **Static (Current)** | All 70+ files load into skill context upfront |
| **Dynamic (MCP)** | Only requested language/template loads on-demand |

**Benefits of dynamic context loading:**

- **Token efficiency** — Only load templates for the language user needs (Python user doesn't load C#/Java/TS samples)
- **Reduced skill size** — Skill contains instructions, not content
- **Selective fetching** — Get only HTTP template when user wants HTTP, not all 10+ trigger types
- **Scalable** — Adding new templates doesn't increase skill context size
- **Fresh content** — Every fetch gets current version from MCP

**Example: Context Savings**

```
User: "Create a Python HTTP function"

STATIC APPROACH (loads everything):
├── python/http.md ✅ needed
├── python/timer.md ❌ not needed
├── python/cosmos.md ❌ not needed
├── typescript/http.md ❌ not needed
├── csharp/http.md ❌ not needed
├── ... (60+ more files) ❌ not needed
└── Total: ~50K tokens loaded

DYNAMIC APPROACH (loads on-demand):
├── functions_template_get(language: "python") → list
├── functions_template_get(language: "python", template: "http-*-azd")
└── Total: ~2K tokens loaded (only what's needed)
```

---

## Proposed Solution

### Architecture: Dynamic MCP Tool Invocation

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SKILL INSTRUCTION                            │
│  (azure-prepare → functions → templates/)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CURRENT (Hardcoded):                                               │
│  ┌─────────────────┐                                                │
│  │ source/python.md│ → Contains static ```python code blocks       │
│  │ source/ts.md    │ → Contains static ```typescript code blocks   │
│  │ http.md         │ → Contains static template names              │
│  └─────────────────┘                                                │
│                                                                     │
│  PROPOSED (Dynamic):                                                │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐   │
│  │ SKILL.md        │───►│ "Call functions_template_get with:   │   │
│  │ (Instructions)  │    │  - language: <detected>              │   │
│  │                 │    │  - template: <integration>-trigger-* │   │
│  └─────────────────┘    └──────────────────────────────────────┘   │
│           │                           │                             │
│           ▼                           ▼                             │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐   │
│  │ MCP Tool Call   │───►│ Azure.Mcp.Tools.Functions            │   │
│  │ (at runtime)    │    │ Returns: Complete project files      │   │
│  └─────────────────┘    └──────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tools Available (Azure.Mcp.Server 2.0.0-beta.40+)

### 1. `functions_language_list`

**Purpose**: Discover supported languages with runtime versions

**Output includes**:

- Language names (python, typescript, javascript, java, csharp, powershell)
- Runtime versions (current GA/LTS)
- Prerequisites
- Init/run/build commands

**Replaces hardcoded**:

- `README.md` → Runtime Stacks table
- Version numbers throughout recipes

### 2. `functions_project_get`

**Purpose**: Get project scaffolding structure

**Parameters**: `{ language: "python" | "typescript" | ... }`

**Output includes**:

- Project structure (file list)
- Init instructions
- Setup commands

**Replaces hardcoded**:

- `templates/recipes/composition.md` → Project structure patterns
- Node.js entry point instructions

### 3. `functions_template_get`

**Purpose**: Generate complete function code from templates

**Parameters**:

```json
{
  "language": "python",
  "template": "cosmos-trigger-python-azd",  // Optional - omit to list
  "runtime-version": "3.11"                 // Optional
}
```

**Output includes (when template specified)**:

- `functionFiles[]` — Function-specific files:
  - `function_app.py` / `index.ts` (function source code)
  - Function configuration files
  - Function-level bindings

- `projectFiles[]` — Project-level files:
  - `azure.yaml` (AZD config)
  - `infra/*.bicep` or `infra/*.tf` (IaC)
  - `host.json`, `local.settings.json`
  - `.vscode/` settings
  - `requirements.txt` / `package.json` (dependencies)
  - README, gitignore, etc.

- Template metadata (displayName, description, resource type)

> **IMPORTANT**: Agents must write BOTH `functionFiles[]` AND `projectFiles[]` to create a complete working project.

**Available Templates (Python example)**:

| Template Name | Resource | Description |
|---------------|----------|-------------|
| `http-trigger-python-azd` | http | HTTP trigger quickstart |
| `timer-trigger-python-azd` | timer | Timer trigger |
| `cosmos-trigger-python-azd` | cosmos | Cosmos DB trigger |
| `eventhub-trigger-python-azd` | eventhub | Event Hub trigger |
| `blob-eventgrid-trigger-python-azd` | blob | Blob + Event Grid |
| `sql-trigger-python-azd` | sql | SQL trigger |
| `mcp-server-remote-python` | mcp | Remote MCP server |
| `mcp-sdk-hosting-python` | mcp | Self-hosted MCP SDK |
| `ai-agent-python` | http | Simple AI agent |
| `ai-chatgpt-python` | http | ChatGPT integration |
| `ai-langchain-python` | http | LangChain |

---

## Available Templates (Discovered Dynamically)

### Template Metadata from List Call

Each template in the list response includes:

| Field | Description | Use |
|-------|-------------|-----|
| `templateName` | Unique identifier | Pass to generate call |
| `displayName` | Human-readable name | Show to user |
| `resource` | Integration type | **Filter by this** |
| `infrastructure` | IaC type (bicep/terraform) | **Prefer "bicep"** |

### Resource Types for Filtering

| Resource Value | Matches User Intent |
|---------------|---------------------|
| `http` | HTTP API, REST endpoint, webhook |
| `cosmos` | Cosmos DB, document database |
| `timer` | Scheduled task, cron job |
| `eventhub` | Event streaming, Event Hubs |
| `blob` | Blob storage, file processing |
| `sql` | SQL database trigger |
| `mcp` | MCP server, AI tools |

### IaC Selection Priority

When multiple templates match the resource type:

```
IF user requests Terraform:
  1. PREFER: infrastructure == "terraform"
  2. FALLBACK: infrastructure == "bicep"
  3. FALLBACK: non-AZD template (if no AZD exists for this trigger/binding)

ELSE (default):
  1. PREFER: infrastructure == "bicep" (default)
  2. THEN: infrastructure == "terraform"
  3. FALLBACK: non-AZD template (if no AZD exists for this trigger/binding)
```

### Non-AZD Template Fallback

Not all triggers/bindings have AZD templates. When AZD template unavailable:

| Scenario | Action |
|----------|--------|
| Trigger has AZD template | ✅ Use AZD template (complete) |
| Trigger has NO AZD template | ⚠️ Use non-AZD for code + reference related AZD for IaC |
| Binding has AZD template | ✅ Extract binding from AZD template |
| Binding has NO AZD template | ⚠️ Use non-AZD for binding code + reference related AZD for IaC |

**When using non-AZD templates:**

```
1. USE non-AZD template FOR:
   ✅ Function source code (triggers, bindings)
   ✅ Package dependencies
   ✅ Connection config patterns

2. FIND related AZD template AS REFERENCE FOR:
   - IaC structure and patterns
   - RBAC role assignments
   - Managed identity config
   - azure.yaml format

3. GENERATE IaC using AZD reference:
   - Copy IaC structure from related AZD template
   - Adapt resource definitions for the specific trigger/binding
   - Include correct RBAC roles for the binding's resource
   - Maintain azure.yaml, managed identity patterns
```

**Example: Non-AZD Binding with AZD Reference**

```
User wants: ServiceBus trigger (no AZD template exists)
Related AZD: EventHub trigger (similar messaging pattern)

1. GET code from: servicebus-trigger-python (non-AZD)
   → function_app.py with @app.service_bus_queue_trigger(...)

2. GET IaC reference from: eventhub-trigger-python-azd
   → infra/ structure, RBAC patterns, managed identity

3. GENERATE IaC for ServiceBus:
   → Copy infra/ structure from EventHub AZD
   → Replace EventHub resource with ServiceBus resource
   → Replace EventHub RBAC roles with ServiceBus roles
   → Keep managed identity, azure.yaml patterns
```

### Finding Related AZD Templates for Reference

When a non-AZD template is needed, find a related AZD template based on resource similarity:

| Non-AZD Resource | Related AZD Reference | Why Similar |
|-----------------|----------------------|-------------|
| ServiceBus | EventHub AZD | Both messaging services |
| RabbitMQ | EventHub AZD | Message queue pattern |
| SignalR | HTTP AZD | Real-time + HTTP |
| Kafka | EventHub AZD | Event streaming |
| SendGrid | HTTP AZD | HTTP-based integration |
| Twilio | HTTP AZD | HTTP-based integration |
| Custom webhook | HTTP AZD | HTTP trigger pattern |
| IoT Hub | EventHub AZD | Event ingestion |

**Selection Algorithm for AZD Reference:**

```
1. SAME resource type with AZD → use directly
2. SIMILAR resource category → use as reference
   - Messaging: EventHub, ServiceBus, Queue → any messaging AZD
   - Storage: Blob, Table, File → Blob AZD
   - Database: Cosmos, SQL, Table → Cosmos AZD
   - HTTP-based: HTTP, Webhook, API → HTTP AZD
3. FALLBACK: Use HTTP AZD (simplest, most common)
```

| User Says | Select Infrastructure |
|-----------|----------------------|
| "use terraform", "terraform IaC", "with terraform" | `terraform` |
| "use bicep", "bicep IaC", nothing specified | `bicep` (default) |

> **Both Bicep and Terraform templates are AZD-enabled** with Flex Consumption, managed identity, RBAC, and VNet support.

---

## Recipe Composition: Templates as Ingredients

### Key Concept

MCP templates are **ingredients** that agents combine into a **recipe**:

- **Trigger template** (REQUIRED) — at least one, defines how function is invoked
- **Binding templates** (OPTIONAL) — zero or more, add input/output connections
- **Custom logic** — user-specific business logic added to the composed function

### Using Descriptions for Intelligent Template Selection

**CRITICAL**: Agents MUST use `description` field (not just `templateName`) when selecting templates.

Descriptions provide semantic context that template names cannot:

| Selection Criteria | Description Reveals |
|-------------------|---------------------|
| **Trigger type** | "HTTP trigger", "Timer trigger", "Cosmos DB trigger" |
| **Security features** | "managed identity", "virtual network", "OAuth via EasyAuth" |
| **Deployment pattern** | "Flex Consumption", "deployed to Azure Functions" |
| **Integration pattern** | "event-driven integration", "serverless AI" |
| **Special capabilities** | "supports GitHub Copilot models", "bring your own model" |

**Example: Selecting AI Template**

User: "Create a function that uses AI"

```
Template List (from MCP):
┌─────────────────────────────────────────────────────────────────────────────┐
│ templateName: ai-agent-python-azd                                           │
│ description: "Azure Functions AI agent built with the GitHub Copilot SDK.   │
│              Supports GitHub Copilot models or bring your own model via     │
│              Microsoft Foundry (BYOK)."                                     │
│ resource: ai                                                                │
│ infrastructure: bicep                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ templateName: http-trigger-python-azd                                       │
│ description: "Azure Functions HTTP trigger quickstart written in Python..." │
│ resource: http                                                              │
│ infrastructure: bicep                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Agent Decision:
- User said "AI" → scan descriptions for AI-related terms
- "ai-agent-python-azd" description mentions: "AI agent", "Copilot SDK", "BYOK"
- SELECT ai-agent-python-azd (description matches user intent)
```

**Example: Selecting Secure Template**

User: "Create an HTTP function with secure networking"

```
Agent scans descriptions for:
- "managed identity" ✓
- "virtual network" ✓
- "secure deployment" ✓

→ Select template whose description includes these security features
```

### Template Metadata Reference

| Template Pattern | Description Keywords | Use As |
|-----------------|---------------------|--------|
| `http-trigger-*` | "HTTP trigger" | Trigger |
| `timer-trigger-*` | "Timer trigger", "scheduled" | Trigger |
| `cosmos-trigger-*` | "Cosmos DB trigger", "event-driven" | Trigger |
| `eventhub-trigger-*` | "Event Hub trigger", "event streaming" | Trigger |
| `blob-*-trigger-*` | "Blob trigger", "EventGrid" | Trigger |
| `ai-agent-*` | "AI agent", "Copilot SDK", "Foundry" | Trigger (AI) |
| `mcp-server-*` | "MCP server", "remote tools" | Trigger (MCP) |
| `*-output-*` | "output binding" | Output Binding |
| `*-input-*` | "input binding" | Input Binding |

### Composition Algorithm

```
INPUT: language, user_requirements (may include multiple integrations)
OUTPUT: Composed project with trigger + bindings + custom logic

1. DISCOVER: Call functions_template_get(language) to list all templates
   → Each template has: templateName, description, resource, infrastructure
   → CACHE the full list with descriptions for selection decisions

2. PARSE USER REQUIREMENTS:
   - Identify PRIMARY TRIGGER (required): "HTTP endpoint", "timer", "Cosmos change"
   - Identify BINDINGS (optional): "write to blob", "send to queue", "read from cosmos"
   - Identify CUSTOM LOGIC: business rules, transformations, API calls

3. CHECK FOR SINGLE-TEMPLATE MATCH (optimization):
   - SCAN DESCRIPTIONS for a template that demonstrates BOTH trigger AND bindings
   - Example: "blob-trigger-blob-output-python-azd" may demonstrate trigger + output
   - Example: "cosmos-trigger-cosmos-output-python-azd" for Cosmos trigger + output
   - IF single template covers all requirements → use it alone (skip steps 4-5)

4. SELECT TRIGGER TEMPLATE (if no single match):
   - SCAN DESCRIPTIONS to find templates matching user's trigger requirement
   - Description reveals: trigger type, security features, deployment patterns
   - Example: "managed identity and virtual network" → secure deployment
   - Example: "event-driven integration" → reactive pattern
   - Prefer infrastructure matching user's IaC choice (bicep default)

5. SELECT BINDING TEMPLATES (if needed - zero or more):
   - ONLY fetch separate binding templates if trigger template doesn't include them
   - SCAN DESCRIPTIONS to find templates demonstrating required bindings
   - Description indicates: binding direction (input/output), integration patterns

6. FETCH TEMPLATES (minimize calls):
   - SINGLE MATCH: functions_template_get(language, template=combined_template)
   - MULTIPLE: Parallel calls for trigger + any missing binding templates
   - SKIP templates if their patterns are already in another fetched template

7. COMPOSE RECIPE:
   - SINGLE TEMPLATE: Use as-is, add user's custom logic
   - MULTIPLE TEMPLATES:
     - START with trigger template as base (has IaC, azure.yaml, project structure)
     - EXTRACT binding configurations from binding templates
     - MERGE bindings into trigger template's function code
     - ADD user's custom business logic
     - MERGE IaC resources (RBAC roles, connections) from all templates

8. WRITE composed project files

9. DEPLOY: azd up
```

### Single-Template Optimization

**IMPORTANT**: Avoid fetching multiple templates when one template already demonstrates everything needed.

```
BEFORE checking for separate binding templates, ask:
┌─────────────────────────────────────────────────────────────┐
│ Does any single template's DESCRIPTION mention BOTH the     │
│ trigger AND the binding(s) the user requested?              │
│                                                             │
│ YES → Fetch that one template only                          │
│ NO  → Fetch trigger template + separate binding templates   │
└─────────────────────────────────────────────────────────────┘
```

**Example: Blob Trigger + Blob Output**

User: "Create a function triggered by blob that writes to another blob"

```
Agent scans template descriptions:

Template A: blob-trigger-python-azd
  description: "Blob trigger...processes files when uploaded"
  → Has trigger, but no output binding mentioned

Template B: blob-trigger-blob-output-python-azd
  description: "Blob trigger with blob output binding...copies files between containers"
  → Has BOTH trigger AND output binding!

Decision: Fetch Template B only (1 call instead of 2)
```

**Example: Cosmos Trigger + Cosmos Input (same resource)**

User: "Cosmos trigger that reads related documents"

```
Check if any template demonstrates:
- Cosmos trigger ✓
- Cosmos input binding ✓

If cosmos-trigger-cosmos-input exists → fetch it alone
If not → fetch cosmos-trigger + cosmos-input separately
```

### Example: Multi-Binding Composition

**User Request:** "Create an HTTP function that reads from Cosmos DB and writes to Blob storage"

```
Agent Analysis:
- Trigger: HTTP (primary)
- Input Binding: Cosmos DB
- Output Binding: Blob storage
- Custom Logic: Transform data between read and write

Templates to Fetch:
1. http-trigger-python-azd (trigger - base project)
2. cosmos-input-python-azd (input binding pattern)
3. blob-output-python-azd (output binding pattern)

Composition:
┌─────────────────────────────────────────────────────────┐
│ http-trigger-python-azd (BASE)                          │
│ ├── function_app.py ← ADD cosmos input + blob output    │
│ ├── infra/main.bicep ← MERGE cosmos + blob resources    │
│ ├── infra/app/rbac.bicep ← MERGE all RBAC roles        │
│ └── azure.yaml (keep as-is)                            │
├─────────────────────────────────────────────────────────┤
│ + cosmos-input-python-azd (EXTRACT)                     │
│   └── binding config, cosmos connection, RBAC           │
├─────────────────────────────────────────────────────────┤
│ + blob-output-python-azd (EXTRACT)                      │
│   └── binding config, storage connection, RBAC          │
├─────────────────────────────────────────────────────────┤
│ + USER LOGIC                                            │
│   └── Data transformation between cosmos read & blob    │
└─────────────────────────────────────────────────────────┘
```

### Binding Extraction from Templates

When fetching a binding template, extract:

| Component | Location in Template | Merge Into |
|-----------|---------------------|------------|
| Binding decorator/attribute | Source code | Function definition |
| Connection string pattern | `local.settings.json` | Environment config |
| IaC resource definition | `infra/app/*.bicep` | Main Bicep |
| RBAC role assignment | `infra/app/rbac.bicep` | RBAC file |
| Package dependency | `requirements.txt`/`package.json` | Dependencies |

### Key Instruction for Skills

> **Recipe Composition Model:**
>
> 1. **ALWAYS discover templates first** — `functions_template_get(language)`
> 2. **Parse user requirements** — identify trigger (required) + bindings (optional)
> 3. **Fetch multiple templates** — one for trigger, one per binding
> 4. **Use descriptions** — template descriptions indicate trigger/binding type
> 5. **Compose recipe:**
>    - Trigger template = base project (IaC, azure.yaml)
>    - Extract binding patterns from binding templates
>    - Merge all RBAC roles and IaC resources
>    - Add user's custom business logic
> 6. **Never hardcode** — template names discovered dynamically

---

## Simple vs Composed Projects

| User Request | Composition Type |
|--------------|-----------------|
| "Create a timer function" | **Simple** — single template |
| "Create an HTTP API" | **Simple** — single template |
| "HTTP function that writes to Cosmos" | **Composed** — trigger + binding |
| "Timer that reads blob and sends to Event Hub" | **Composed** — trigger + 2 bindings |

### Simple Project (Single Template)

```
1. Discover → 2. Select trigger template → 3. Fetch → 4. Write → 5. Deploy
```

### Composed Project (Multiple Templates)

```
1. Discover → 2. Select trigger + bindings → 3. Fetch all → 4. Compose → 5. Write → 6. Deploy
```

---

```markdown
## Azure Functions — ALWAYS Use MCP Templates

### Step 1: Discover Available Templates (REQUIRED)
\`\`\`
functions_template_get(language: "<detected-language>")
\`\`\`
This returns a list of all available templates with metadata:
- `templateName` — unique identifier
- `displayName` — human-readable name  
- `resource` — integration type (http, cosmos, timer, eventhub, blob, sql, mcp)
- `infrastructure` — IaC type (bicep, terraform)

### Step 2: Select Template by IaC Preference (REQUIRED)
From the returned list:
1. **Filter by resource type** matching user's integration need
2. **Select by IaC preference:**
   - **Default (Bicep):** `infrastructure: "bicep"`
   - **If user requests Terraform:** `infrastructure: "terraform"`
3. These are complete, production-ready projects with:
   - ✅ RBAC roles pre-configured
   - ✅ Managed identity (UAMI) setup
   - ✅ VNet integration
   - ✅ Flex Consumption hosting

> ⛔ **DO NOT hardcode template names** — always discover via list call first.
> ✅ **Default to Bicep** (`infrastructure: "bicep"`)
> ✅ **Use Terraform if user requests it** (`infrastructure: "terraform"`)

### Step 3: Generate Complete Project
\`\`\`
functions_template_get(
  language: "<language>",
  template: "<selected-template-name-from-list>"
)
\`\`\`

### Step 4: Write All Files
Write every file from BOTH arrays to the project directory:
- `functionFiles[]` — Function source code and bindings
- `projectFiles[]` — IaC, azure.yaml, host.json, dependencies

**DO NOT modify the generated IaC** — it has correct RBAC and identity config.

### Step 5: Deploy
\`\`\`bash
azd env set AZURE_LOCATION <region>
azd up --no-prompt
\`\`\`

### Template Selection Algorithm

\`\`\`
INPUT: language, user_intent (e.g., "Cosmos DB trigger", "scheduled task")
OUTPUT: selected template name

1. LIST: templates = functions_template_get(language)
2. DETECT: resource_type = map_intent_to_resource(user_intent)
   - "cosmos", "cosmosdb", "document db" → resource: "cosmos"
   - "timer", "schedule", "cron" → resource: "timer"
   - "event hub", "streaming" → resource: "eventhub"
   - "blob", "file", "storage trigger" → resource: "blob"
   - "sql", "database trigger" → resource: "sql"
   - "mcp", "mcp server", "tools" → resource: "mcp"
   - "http", "api", "rest" → resource: "http"
3. FILTER: candidates = templates.filter(t => t.resource == resource_type)
4. SELECT IaC: 
     if user_wants_terraform:
       selected = candidates.find(t => t.infrastructure == "terraform")
     else:  // default = Bicep
       selected = candidates.find(t => t.infrastructure == "bicep")
     fallback = selected || candidates[0]
5. RETURN: selected.templateName
\`\`\`

> ⛔ **DO NOT** use hardcoded template name patterns.
> ⛔ **DO NOT** manually add RBAC roles — templates have them.
> ✅ **ALWAYS** discover templates via list call first.
> ✅ **ALWAYS** prefer AZD-enabled templates (bicep infrastructure).
```

---

## Files to DELETE (Completely Replaced by MCP)

```
plugin/skills/azure-prepare/references/services/functions/
├── templates/
│   ├── recipes/
│   │   ├── cosmosdb/source/          # DELETE (6 files)
│   │   ├── timer/source/             # DELETE (6 files)
│   │   ├── servicebus/source/        # DELETE (6 files)
│   │   ├── eventhubs/source/         # DELETE (6 files)
│   │   ├── sql/source/               # DELETE (6 files)
│   │   ├── blob-eventgrid/source/    # DELETE (6 files)
│   │   ├── mcp/source/               # DELETE (6 files)
│   │   ├── durable/source/           # DELETE (6 files)
│   │   ├── cosmosdb/bicep/           # DELETE - IaC in MCP
│   │   ├── eventhubs/bicep/          # DELETE - IaC in MCP
│   │   ├── eventhubs/terraform/      # DELETE - IaC in MCP
│   │   └── common/uami-bindings.md   # DELETE - UAMI in MCP templates
│   ├── http.md                       # DELETE - template names dynamic
│   ├── integrations.md               # DELETE - covered by MCP
│   └── mcp.md                        # DELETE - MCP templates exist
├── bicep.md                          # DELETE - IaC in MCP templates
├── terraform.md                      # DELETE - IaC in MCP templates
└── triggers.md                       # DELETE - trigger code in MCP

# Total: ~70+ hardcoded files → 0 hardcoded files
```

## Files to KEEP (Minimal Skill Logic)

```
plugin/skills/azure-prepare/references/services/functions/
├── README.md                         # UPDATE - MCP-first instructions
├── templates/
│   ├── README.md                     # UPDATE - point to MCP tools
│   ├── selection.md                  # SIMPLIFY - just template mapping
│   └── recipes/
│       ├── README.md                 # UPDATE - MCP architecture overview
│       └── composition.md            # SIMPLIFY - "call MCP + azd up"
├── durable.md                        # KEEP - DTS backend guidance (non-IaC)
└── aspire-containerapps.md           # KEEP - Aspire-specific guidance
```

---

## Updated Composition Algorithm (Recipe-Based)

Replace the current 200+ line `composition.md` with:

```markdown
# Azure Functions Composition (MCP Recipe Model)

## Core Concept: Templates as Ingredients

MCP templates are **ingredients** that get combined into a **recipe**:
- **Trigger** (required): How the function is invoked (HTTP, timer, Cosmos change, etc.)
- **Bindings** (optional): Input/output connections (read from X, write to Y)
- **Custom Logic**: User's business rules and transformations

## Algorithm (Recipe Composition)

\`\`\`
INPUT: language, user_requirements
OUTPUT: Composed deployable project

PHASE 0: VERIFY MCP TOOLS AVAILABLE
───────────────────────────────────
0. Attempt to call functions_template_get(language) to list templates
   
   IF success (returns template list):
     → MCP tools loaded, proceed to PHASE 1
   
   IF error (tool not found, timeout, or empty response):
     → MCP tools NOT available, go to FALLBACK PLAN

PHASE 1: DISCOVER
─────────────────
1. Call functions_template_get(language) to list all templates
   → Each template has: templateName, description, resource, infrastructure
   → Description indicates if it's a trigger or binding demo

PHASE 2: ANALYZE USER REQUIREMENTS
──────────────────────────────────
2. Parse user request to identify:
   a. PRIMARY TRIGGER (required - exactly one)
      - "HTTP API" → http trigger
      - "every 5 minutes" → timer trigger
      - "when document changes" → cosmos trigger
   
   b. BINDINGS (optional - zero or more)
      - "read from cosmos" → cosmos input binding
      - "write to blob" → blob output binding
      - "send to queue" → queue output binding
   
   c. IaC PREFERENCE
      - "use terraform" → infrastructure: "terraform"
      - default → infrastructure: "bicep"

PHASE 3: SELECT TEMPLATES
─────────────────────────
3. Select TRIGGER template (required):
   - Filter: templates where description mentions trigger type
   - Match: user's primary trigger requirement
   - Selection priority:
     a. AZD template with matching IaC (bicep/terraform)
     b. AZD template with any IaC
     c. Non-AZD template (if no AZD exists for this trigger)
   → This becomes the BASE project
   → If non-AZD: agent must generate IaC

4. Select BINDING templates (optional, one per binding):
   - For each binding in user requirements:
     - Find template where description demonstrates that binding
     - Selection priority:
       a. AZD template for this binding
       b. Non-AZD template (if no AZD exists for this binding)
   → These provide binding patterns to extract
   → If non-AZD: agent must generate IaC for that binding's resource

PHASE 4: FETCH ALL TEMPLATES
────────────────────────────
5. Fetch trigger template:
   functions_template_get(language, template=trigger_template)
   → If AZD: Returns complete project with IaC
   → If non-AZD: Returns source code only, agent generates IaC

6. Fetch each binding template (can be parallel):
   functions_template_get(language, template=binding_template_1)
   functions_template_get(language, template=binding_template_2)
   → Returns binding patterns and configurations

PHASE 5: COMPOSE RECIPE
───────────────────────
7. Start with TRIGGER template as base:
   
   IF trigger template is AZD:
     ✅ Project structure (complete)
     ✅ azure.yaml (complete)
     ✅ infra/main.bicep (complete IaC)
     ✅ infra/app/rbac.bicep (base RBAC)
   
   IF trigger template is NON-AZD:
     ✅ Function source code (use as-is)
     ⚠️ FIND related AZD template (similar trigger type)
     ⚠️ COPY IaC structure from related AZD
     ⚠️ ADAPT IaC for this trigger's resource
     ⚠️ GENERATE azure.yaml using AZD pattern

8. TRIM UNUSED from base template:
   ⛔ Remove any demo triggers not requested by user
   ⛔ Remove any demo bindings not requested by user
   ⛔ Remove IaC resources for unused bindings (if AZD)
   ⛔ Remove RBAC roles for unused resources (if AZD)
   ⛔ Remove unused package dependencies

9. For each BINDING template, EXTRACT only what's needed:

   IF binding template is AZD:
     | Extract From Binding Template | Merge Into Base Project |
     |------------------------------|------------------------|
     | Binding decorator/attribute | Function source code |
     | Resource connection config | local.settings.json |
     | IaC resource definition | infra/app/*.bicep |
     | RBAC role assignment | infra/app/rbac.bicep |
     | Package dependencies | requirements.txt/package.json |
   
   IF binding template is NON-AZD:
     | From Non-AZD Template | From Related AZD Reference |
     |----------------------|---------------------------|
     | Binding decorator ✅ | IaC resource pattern |
     | Package dependencies ✅ | RBAC role GUIDs |
     | Connection config ✅ | Managed identity config |
     
     → Find related AZD template (similar resource type)
     → Use non-AZD for function code
     → Use AZD reference for IaC generation
   
   ⛔ DO NOT include demo triggers from binding templates
   ⛔ DO NOT include unrelated bindings from binding templates

10. ADD user's custom business logic:
    - Data transformations
    - Business rules
    - API calls
    - Error handling

PHASE 6: WRITE & DEPLOY
───────────────────────
11. Write all composed files to project directory

12. Deploy:
    azd env set AZURE_LOCATION <region>
    azd up --no-prompt
\`\`\`

## Trimming Unused Components

Templates are **samples** that may include demo bindings/triggers not needed by user. 
**Always trim to only what the user requested.**

### ⚠️ Exception: Required Runtime Resources

Some resources are **required by Azure Functions runtime** — never trim these:

| Resource | Why Required | Setting |
|----------|-------------|---------|
| Storage Account | Function runtime needs it | `AzureWebJobsStorage` |
| App Insights | Monitoring (optional but recommended) | `APPLICATIONINSIGHTS_CONNECTION_STRING` |

> **AzureWebJobsStorage** is required for trigger management, logging, and internal state.
> Keep the storage account and its RBAC even if user didn't request blob bindings.

### What to TRIM from Templates

| Component | Trim If... | Example |
|-----------|-----------|---------|
| Trigger | User requested different trigger | Timer trigger demo in HTTP template |
| Input Binding | User didn't request this input | Cosmos input in blob trigger sample |
| Output Binding | User didn't request this output | Queue output in timer sample |
| IaC Resource | No binding uses this resource **AND** not required by runtime | CosmosDB module when user only needs timer |
| RBAC Role | No binding needs this permission **AND** not required by runtime | Cosmos Data Contributor when only using timer |
| Package | No code uses this dependency | `azure-cosmos` package when only using HTTP |

### What to KEEP (Even If Not Explicitly Requested)

| Component | Always Keep | Reason |
|-----------|------------|--------|
| Storage Account | ✅ Yes | `AzureWebJobsStorage` required |
| Storage Blob Data Owner role | ✅ Yes | Runtime needs blob access |
| App Insights | ✅ Recommended | Monitoring |
| Function App resource | ✅ Yes | Core resource |
| Managed Identity | ✅ Yes | Secure connections |

### Example: Trimming a Template

**User:** "Create a timer function" (no bindings requested)

**Timer template might include:**
```python
# Demo sample shows timer + blob output
@app.timer_trigger(...)      # ✅ KEEP - user requested timer
@app.blob_output(...)        # ⛔ REMOVE - user didn't request blob OUTPUT binding
def main(timer):
    # demo writes to blob    # ⛔ REMOVE - replace with user logic
    blob.set(data)
```

**After trimming:**

```python
@app.timer_trigger(...)      # ✅ KEEP
def main(timer):
    # user's custom logic    # ✅ ADD user logic
    pass
```

**IaC trimming:**

```
infra/app/storage.bicep      # ✅ KEEP - required for AzureWebJobsStorage
infra/app/cosmos.bicep       # ⛔ REMOVE - no cosmos binding
infra/app/rbac.bicep:
  - Storage Blob Data Owner  # ✅ KEEP - runtime needs this for AzureWebJobsStorage
  - Cosmos Data Contributor  # ⛔ REMOVE - no cosmos binding
```

> **Note:** Storage account and its base RBAC stay because `AzureWebJobsStorage` requires them.
> Only remove IaC for resources not needed by runtime AND not requested by user.

## Example: Composed Recipe

**User:** "Create an HTTP function that reads from Cosmos DB and writes results to Blob storage"

\`\`\`
Analysis:
├── Trigger: HTTP (primary)
├── Input Binding: Cosmos DB
├── Output Binding: Blob storage
└── Custom Logic: Transform data

Templates to Fetch:
├── http-trigger-python-azd (BASE - has IaC, azure.yaml)
├── cosmos-input-python-azd (extract binding pattern)
└── blob-output-python-azd (extract binding pattern)

Composed Result:
function_app.py:
  @app.route(...)  ← from http template
  @app.cosmos_db_input(...)  ← from cosmos template
  @app.blob_output(...)  ← from blob template
  def main():
      # user's custom transformation logic

infra/app/rbac.bicep:
  Storage Blob Data Contributor  ← from blob template
  Cosmos DB Data Contributor     ← from cosmos template
\`\`\`

## Simple vs Composed

| Request Type | Templates Needed | Composition |
|--------------|-----------------|-------------|
| "Create timer function" | 1 (trigger only) | None - use as-is |
| "HTTP that writes to blob" | 2 (trigger + binding) | Merge binding into trigger |
| "Timer reads cosmos, writes to 3 outputs" | 4 (trigger + 3 bindings) | Merge all bindings |

## Key Principles

> ⛔ **NEVER hardcode template names** — discover dynamically
> ⛔ **NEVER include unused triggers/bindings** — trim to user's needs
> ⛔ **NEVER include unused IaC/RBAC** — remove resources for unused bindings
> ✅ **Use descriptions** — to identify trigger vs binding templates
> ✅ **Trigger template = base** — provides IaC, azure.yaml, project structure
> ✅ **Binding templates = ingredients** — extract only the binding pattern needed
> ✅ **Trim aggressively** — templates are samples, user gets only what they asked for
> ✅ **Preserve only relevant RBAC** — roles for bindings user actually uses
> ✅ **Verify tools first** — check MCP availability before depending on it

```

---

## Tool Availability Detection & Fallback

### How to Verify MCP Tools Are Loaded

**Detection Method:** Attempt a list call and check the response

\`\`\`
VERIFY MCP TOOLS:
1. Call: functions_template_get(language: "python")  // or user's language
2. Check response:

   IF response contains templateList with triggers[]:
     → ✅ MCP tools LOADED and working
     → Proceed with MCP-based composition
   
   IF error "tool not found" or "unknown tool":
     → ❌ MCP server NOT connected
     → Use FALLBACK PLAN A (azd init)
   
   IF timeout or no response:
     → ❌ MCP server unresponsive
     → Use FALLBACK PLAN A (azd init)
   
   IF empty response or missing templateList:
     → ⚠️ MCP tools loaded but no templates
     → Use FALLBACK PLAN B (func CLI)
\`\`\`

### Error Patterns to Detect

| Error Pattern | Meaning | Action |
|--------------|---------|--------|
| `"tool not found"` | MCP server not connected | Fallback Plan A |
| `"unknown function"` | Tool doesn't exist in MCP | Fallback Plan A |
| `"timeout"` / no response | MCP server unresponsive | Fallback Plan A |
| `"templateList": { "triggers": [] }` | No templates for language | REMOVED |
| `"authentication failed"` | Azure auth issue | Fix auth, retry |

---

## Fallback Plans (When MCP Unavailable)

### Fallback Plan A: Direct Manifest Access (Preferred)

Use the Azure Functions templates manifest directly - same source MCP uses.

**Manifest URL:**
\`\`\`
https://cdn.functions.azure.com/public/templates-manifest/manifest.json
\`\`\`

**Algorithm:**
\`\`\`
1. FETCH manifest from CDN URL

2. PARSE JSON to get template list
   → manifest.templates[] contains all available templates
   → Each template has: name, language, description, files, repo info

3. FILTER by language
   templates.filter(t => t.language == user_language)

4. SELECT template(s) based on trigger/binding needs
   (Same selection logic as MCP path)

5. DOWNLOAD template files:
   
   IF template is MONO REPO (multiple templates in one repo):
     → Download ZIP from repo release
     → Extract only needed template folder
     → URL pattern: https://github.com/{org}/{repo}/archive/refs/heads/main.zip
   
   IF template is FOLDER-BASED (single template per folder):
     → Use RAW GitHub URLs to fetch individual files
     → Avoids GitHub API rate limiting
     → URL pattern: https://raw.githubusercontent.com/{org}/{repo}/main/{path}

6. COMPOSE recipe (same as MCP path)
   → Trigger template as base
   → Extract bindings from binding templates
   → Trim unused, add custom logic

7. WRITE files and DEPLOY
\`\`\`

**Example: Fetching from Manifest**
\`\`\`javascript
// 1. Fetch manifest
const manifest = await fetch('https://cdn.functions.azure.com/public/templates-manifest/manifest.json')
  .then(r => r.json());

// 2. Filter by language
const pythonTemplates = manifest.templates.filter(t => t.language === 'python');

// 3. Find matching template
const httpTemplate = pythonTemplates.find(t => 
  t.description.toLowerCase().includes('http trigger')
);

// 4. Download files
// For folder-based: use raw GitHub URLs
const fileContent = await fetch(
  `https://raw.githubusercontent.com/${httpTemplate.repo}/main/${httpTemplate.path}/function_app.py`
).then(r => r.text());

// For mono repo: download zip and extract
const zipUrl = `https://github.com/${httpTemplate.repo}/archive/refs/heads/main.zip`;
\`\`\`

**Advantages:**
- ✅ Same templates as MCP (same source)
- ✅ Dynamic discovery (parse manifest)
- ✅ No CLI dependencies (works in any environment)
- ✅ Raw GitHub URLs avoid API rate limits
- ✅ CDN manifest is fast and reliable

### Fallback Plan B: Func CLI + Learn Docs (Last Resort)

Use `func` CLI when other methods unavailable.

\`\`\`bash
func init <project-name> --worker-runtime <language>
func new --name <function-name> --template "<TriggerType>"
\`\`\`

**Then manually add:**
- IaC (Bicep/Terraform) — agent must generate
- azure.yaml — agent must create  
- RBAC roles — agent must look up GUIDs

**Limitations:**
- No IaC included
- No RBAC roles
- More work, higher error risk

---

## Fallback Decision Tree

\`\`\`
START
  │
  ▼
┌─────────────────────────────────┐
│ Try: functions_template_get()   │
│      (MCP Tools)                │
└─────────────────────────────────┘
  │
  ├── Success (templates returned)
  │     │
  │     ▼
  │   ✅ USE MCP (Primary Path)
  │
  └── Error: tool not found / timeout
        │
        ▼
      ┌─────────────────────────────────────────┐
      │ Fetch: cdn.functions.azure.com/         │
      │        public/templates-manifest/       │
      │        manifest.json                    │
      └─────────────────────────────────────────┘
        │
        ├── Success (manifest fetched)
        │     │
        │     ▼
        │   ✅ USE MANIFEST (Fallback A)
        │      Filter by language
        │      Download via raw GitHub URLs
        │
        └── Error: CDN unreachable
              │
              ▼
            ┌─────────────────────────────┐
            │ Try: azd init --template    │
            └─────────────────────────────┘
              │
              ├── Success
              │     ▼
              │   ⚠️ USE AZD (Fallback B)
              │
              └── Error
                    │
                    ▼
                  ┌─────────────────────────┐
                  │ Try: func init          │
                  └─────────────────────────┘
                    │
                    ▼
                  ⚠️ USE FUNC CLI (Fallback B)
                     + Generate IaC manually
\`\`\`

---

## Template Download Strategies

### Mono Repo Templates (Multiple templates in one repo)

\`\`\`
Repository structure:
github.com/Azure/functions-templates/
├── templates/
│   ├── http-trigger-python/
│   ├── timer-trigger-python/
│   ├── cosmos-trigger-python/
│   └── ...

Download strategy:
1. Download ZIP: https://github.com/Azure/functions-templates/archive/refs/heads/main.zip
2. Extract only needed folder: templates/http-trigger-python/
3. Avoids multiple API calls
\`\`\`

### Folder-Based Templates (Single template repos)

\`\`\`
Repository structure:
github.com/Azure-Samples/functions-quickstart-python-http-azd/
├── function_app.py
├── infra/
├── azure.yaml
└── ...

Download strategy (RAW URLs - no rate limiting):
1. Get file list from manifest
2. Fetch each file via raw.githubusercontent.com:
   https://raw.githubusercontent.com/Azure-Samples/functions-quickstart-python-http-azd/main/function_app.py
   https://raw.githubusercontent.com/Azure-Samples/functions-quickstart-python-http-azd/main/azure.yaml
3. No GitHub API calls = no rate limits
\`\`\`

### Why Raw GitHub URLs?

| Method | Rate Limit | Speed | Auth Required |
|--------|-----------|-------|---------------|
| GitHub API | 60/hr (unauth) | Slower | Optional |
| Raw URLs | None | Fast | No |
| ZIP Download | None | Fast (bulk) | No |

> **Always prefer raw URLs** for folder-based repos to avoid rate limiting.
> **Use ZIP download** for mono repos to reduce requests.

---

## Skill Instructions for Fallback

\`\`\`markdown
## MCP Tool Verification & Fallback

### Step 1: Try MCP Tools
Call \`functions_template_get(language)\` to verify MCP is available.

### Step 2: If MCP Unavailable, Use Manifest
\`\`\`
Fetch: https://cdn.functions.azure.com/public/templates-manifest/manifest.json
Filter: templates where language matches
Download: 
  - Mono repo → ZIP download + extract
  - Folder repo → Raw GitHub URLs
\`\`\`

### Step 3: If Manifest Unavailable, Use AZD/func CLI
- \`azd init --template <name>\` from Awesome AZD
- \`func init\` + \`func new\` (no IaC included)

## Fallback Comparison

| Method | IaC | RBAC | Dynamic Discovery | Dependencies |
|--------|-----|------|-------------------|--------------|
| MCP (Primary) | ✅ | ✅ | ✅ Via tool | MCP server |
| Manifest (A) | ✅ | ✅ | ✅ Via manifest | HTTP only |
| AZD (B) | ✅ | ✅ | ❌ Manual lookup | azd CLI |
| func CLI + Learn (C) | ❌ | ❌ | ⚠️ Learn search | func CLI |

**Manifest fallback is nearly as good as MCP** — same templates, same content.
\`\`\`

## Template Response Structure

\`\`\`json
// List call: functions_template_get(language: "python")
{
  "templateList": {
    "language": "python",
    "triggers": [
      {
        "templateName": "cosmos-trigger-python-azd",
        "displayName": "Cosmos DB Trigger (Python + AZD + Bicep)",
        "resource": "cosmos",           // ← Use this to filter
        "infrastructure": "bicep"       // ← Prefer this
      },
      {
        "templateName": "http-trigger-python-azd",
        "displayName": "HTTP Trigger (Python + AZD + Bicep)",
        "resource": "http",
        "infrastructure": "bicep"
      }
      // ... more templates
    ]
  }
}
\`\`\`

## Fallback (MCP Unavailable)

If MCP tools are not available:
\`\`\`bash
# Browse Awesome AZD for template names
# https://azure.github.io/awesome-azd/?tags=functions
azd init -t <template-name> -e "$ENV_NAME" --no-prompt
azd up --no-prompt
\`\`\`
```

---

## What MCP Templates Provide (COMPLETE AZD Samples)

### Every Template Includes ✅

| Category | Contents |
|----------|----------|
| **Source Code** | `function_app.py`, `index.ts`, `*.cs` — trigger + bindings |
| **IaC (Bicep)** | `infra/main.bicep`, `infra/app/*.bicep` — complete infrastructure |
| **IaC (Terraform)** | Available for C# (`*-terraform` suffix) |
| **RBAC Roles** | `infra/app/rbac.bicep` — correct role GUIDs pre-configured |
| **Managed Identity** | UAMI setup with `__credential` and `__clientId` patterns |
| **VNet Integration** | Private endpoints, network isolation |
| **AZD Config** | `azure.yaml` — service definitions, hooks |
| **Project Config** | `host.json`, `local.settings.json` |
| **DevEx** | `.vscode/`, README, architecture diagrams |

### RBAC Roles in Templates (Pre-Configured)

Templates include correct role assignments in `infra/app/rbac.bicep`:

| Integration | Role | GUID (in template) |
|-------------|------|-------------------|
| Storage | Storage Blob Data Owner | `b7e6dc6d-f1e8-4753-8033-0f276bb0955b` |
| Cosmos DB | Cosmos DB Built-in Data Contributor | `00000000-0000-0000-0000-000000000002` |
| Event Hubs | Event Hubs Data Receiver | `a638d3c7-ab3a-418d-83e6-5f17a39d4fde` |
| Service Bus | Service Bus Data Receiver | `4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0` |
| SQL | SQL DB Contributor | `9b7fa17d-e63e-47b0-bb0a-15c516ac86ec` |

> **Skills no longer need to maintain RBAC GUIDs** — templates have them built-in.

---

## What Skills Still Own (Minimal)

| Skill Responsibility | Why |
|---------------------|-----|
| **Selection logic** | Detect integration type from user request/code |
| **Template mapping** | Map integration → MCP template name |
| **AZD preference** | Instruct agent to always choose `-azd` templates |
| **Deployment guidance** | `azd provision` → wait → `azd deploy` pattern |
| **Edge case handling** | Fallback instructions if MCP unavailable |

---

## Benefits (Enhanced)

| Aspect | Current (Hardcoded) | Proposed (MCP) |
|--------|---------------------|----------------|
| **Freshness** | Manual updates needed | Always current |
| **Maintenance** | 70+ files to update | ~5 files (selection logic only) |
| **Context Loading** | All 70+ files load upfront | Only requested template loads |
| **Token Efficiency** | ~50K tokens (all languages) | ~2K tokens (one language) |
| **RBAC Roles** | Manually maintained GUIDs | Pre-configured in templates |
| **UAMI Config** | Separate docs | Built into templates |
| **Consistency** | May drift from AZD | Guaranteed sync |
| **Coverage** | Limited templates | All AZD templates + AI agents |
| **Validation** | Static | MCP team validates |
| **IaC Quality** | Hand-maintained Bicep | Production-tested templates |
| **Scalability** | More templates = larger skill | More templates = no change |

---

## Risks & Mitigations (Simplified)

| Risk | Mitigation |
|------|------------|
| MCP tool unavailable | Fallback to `azd init -t <template>` from Awesome AZD |
| Missing integration template | Use HTTP base + manual trigger code (rare) |
| Template bug | Report to MCP team; they own correctness |

> **Note**: Since templates include RBAC and UAMI, there's no risk of "missing security config" anymore.

---

## Migration Evaluation Criteria

### Token Comparison: Before vs After

| Metric | Before (Hardcoded) | After (MCP Dynamic) | Improvement |
|--------|-------------------|---------------------|-------------|
| **Static context loaded** | ~50K tokens | ~500 tokens | **99% reduction** |
| **Per-request tokens** | 0 (already loaded) | ~2K tokens | On-demand |
| **Total for single request** | ~50K tokens | ~2.5K tokens | **95% reduction** |
| **Multi-language support** | 50K × loaded | 2K × requested | Only loads needed |

### Detailed Token Breakdown

**BEFORE (Hardcoded - loads everything):**

```
templates/
├── recipes/
│   ├── http/source/python.md       ~800 tokens
│   ├── http/source/typescript.md   ~800 tokens
│   ├── http/source/csharp.md       ~900 tokens
│   ├── http/source/java.md         ~900 tokens
│   ├── http/bicep/main.bicep.md    ~600 tokens
│   ├── timer/source/*.md           ~3200 tokens
│   ├── cosmos/source/*.md          ~3200 tokens
│   ├── eventhub/source/*.md        ~3200 tokens
│   ├── blob/source/*.md            ~3200 tokens
│   └── ... (48 source files)       ~38K tokens
├── common/uami-bindings.md         ~2000 tokens
├── bicep.md                        ~1500 tokens
├── terraform.md                    ~1500 tokens
├── triggers.md                     ~1000 tokens
└── selection.md                    ~800 tokens
                                    ─────────────
                          TOTAL:    ~50K tokens
```

**AFTER (MCP Dynamic - loads on-demand):**

```
templates/
├── README.md (MCP instructions)    ~500 tokens (always loaded)
└── selection.md (intent mapping)   ~200 tokens (always loaded)
                                    ─────────────
                   STATIC TOTAL:    ~700 tokens

Per-request (MCP tool call):
├── Template list response          ~500 tokens
└── Single template content         ~1500 tokens
                                    ─────────────
                  REQUEST TOTAL:    ~2000 tokens
```

### Evaluation Scenarios

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| Python HTTP function | 50K | 2.2K | 95% |
| TypeScript timer function | 50K | 2.2K | 95% |
| C# Cosmos trigger | 50K | 2.2K | 95% |
| Multi-binding recipe (3 templates) | 50K | 5K | 90% |
| Agent browsing (no request) | 50K | 0.7K | 99% |

### Success Criteria

| Criteria | Target | Measurement |
|----------|--------|-------------|
| **Token reduction** | >90% for single requests | Compare context size |
| **Template freshness** | Always current | No hardcoded versions |
| **RBAC accuracy** | 100% correct GUIDs | Templates are source of truth |
| **Deployment success** | Same or better | `azd up` works first time |
| **Fallback coverage** | 100% | All triggers have fallback path |

### How to Measure

```bash
# Before: Count tokens in hardcoded files
find templates/recipes -name "*.md" -exec cat {} \; | wc -w
# Approximate: words × 1.3 ≈ tokens

# After: Count tokens in MCP response
# Log MCP tool call response sizes during testing
```

---

## Implementation Checklist (Simplified)

### Week 1: Update Skill Instructions

- [ ] Update `functions/README.md` with MCP-first guidance
- [ ] Update `templates/selection.md` to just be template mapping table
- [ ] Simplify `templates/recipes/composition.md` to 20 lines

### Week 2: Delete Hardcoded Files

- [ ] Delete all `recipes/*/source/*.md` files (48 files)
- [ ] Delete all `recipes/*/bicep/` folders
- [ ] Delete `bicep.md`, `terraform.md`, `triggers.md`, `http.md`
- [ ] Delete `common/uami-bindings.md` (covered by templates)

### Week 3: Update Tests

- [ ] Update eval files to expect MCP tool calls
- [ ] Remove tests for hardcoded content
- [ ] Add tests for template selection logic

---

## Example: Complete Workflow (Dynamic Discovery)

```markdown
## User Request: "Create a Cosmos DB triggered function in Python"

### Agent Workflow

1. **Discover Templates** (REQUIRED FIRST):
   \`\`\`
   functions_template_get(language: "python")
   \`\`\`
   → Returns list:
   \`\`\`json
   {
     "triggers": [
       {"templateName": "http-trigger-python-azd", "resource": "http", "infrastructure": "bicep"},
       {"templateName": "cosmos-trigger-python-azd", "resource": "cosmos", "infrastructure": "bicep"},
       {"templateName": "timer-trigger-python-azd", "resource": "timer", "infrastructure": "bicep"},
       {"templateName": "mcp-server-remote-python", "resource": "mcp", "infrastructure": "bicep"},
       ...
     ]
   }
   \`\`\`

2. **Detect Resource Type**:
   User said "Cosmos DB" → resource type = "cosmos"

3. **Filter & Select AZD Template**:
   - Filter: templates where resource == "cosmos"
   - Found: `cosmos-trigger-python-azd` with infrastructure: "bicep" ✅
   - This is AZD-enabled (bicep) — select it

4. **Generate Project**:
   \`\`\`
   functions_template_get(
     language: "python",
     template: "cosmos-trigger-python-azd"  // ← From discovery, not hardcoded
   )
   \`\`\`
   → Returns complete project with:
   - function_app.py (Cosmos trigger code)
   - infra/main.bicep (complete IaC)
   - infra/app/rbac.bicep (RBAC with correct GUIDs)
   - azure.yaml (AZD config)
   - requirements.txt, host.json, etc.

5. **Write All Files**: Write every file from BOTH `functionFiles[]` AND `projectFiles[]`:
   - `functionFiles[]` — Function source code (function_app.py)
   - `projectFiles[]` — IaC (infra/), config (azure.yaml, host.json), dependencies

6. **Deploy**:
   \`\`\`bash
   azd up --no-prompt
   \`\`\`

### What the Agent Did NOT Do:
- ❌ Hardcode template name "cosmos-trigger-python-azd"
- ❌ Look up RBAC GUIDs
- ❌ Configure UAMI settings manually
- ❌ Merge base + recipe
- ❌ Reference hardcoded skill docs
```

---

## Conclusion (Updated)

MCP Functions templates are **complete AZD samples** that include everything needed for production deployment:

| What Templates Include | Skill Responsibility |
|-----------------------|---------------------|
| ✅ Source code | Detect integration type |
| ✅ Complete IaC (Bicep/Terraform) | Map to template name |
| ✅ **RBAC roles (correct GUIDs)** | Instruct "always use -azd" |
| ✅ **UAMI configuration** | Provide deployment guidance |
| ✅ VNet integration | Handle fallback cases |
| ✅ azure.yaml for AZD | |

### Impact

| Metric | Before | After |
|--------|--------|-------|
| Hardcoded files | ~70 | ~5 |
| RBAC GUIDs to maintain | 10+ | 0 |
| Code samples to update | 48 | 0 |
| Composition algorithm | 200+ lines | 20 lines |

### Key Instruction for Skills

> **Dynamic Discovery + IaC Selection:**
>
> 1. **ALWAYS call list first** — `functions_template_get(language)` to discover templates
> 2. **Filter by resource type** — match user intent to `resource` field
> 3. **Select IaC type:**
>    - **Default**: `infrastructure: "bicep"`
>    - **If user requests Terraform**: `infrastructure: "terraform"`
> 4. **NEVER hardcode template names** — they may change
>
> Both Bicep and Terraform templates are complete, production-ready
> AZD projects with RBAC, managed identity, and VNet support.
