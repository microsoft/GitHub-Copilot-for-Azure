# Azure Functions Templates

Dynamic template selection for Azure Functions projects.

## Prerequisites: Check MCP Availability

Before proceeding, verify Azure MCP Server and Functions tools are available:

```
functions_template_get(language: "python")
```

| Result | Action |
|--------|--------|
| ✅ Returns template list | Use **Primary Path: MCP Tools** below |
| ❌ Tool not found / Error | Jump to **[Fallback (MCP Unavailable)](#fallback-mcp-unavailable)** |

---

## Primary Path: MCP Tools

**Use Azure MCP tools** — they provide complete, up-to-date AZD templates with IaC, RBAC, and managed identity.

### Step 1: Discover Templates

```
functions_template_get(language: "<python|csharp|typescript|javascript|java|powershell>")
```

Returns template list with metadata:

- `templateName` — pass to generate call
- `description` — use for selection (describes trigger, bindings, security features)
- `resource` — filter by trigger type (http, cosmos, timer, eventhub, blob, sql, mcp, ai)
- `infrastructure` — prefer `bicep` (default), use `terraform` if user requests

### Step 2: Select Template

**Use description to match user intent:**

| User Intent | Scan Description For | Resource Filter |
|-------------|---------------------|-----------------|
| MCP, server, tools, resource, prompt | "MCP", "MCP server", "remote tools", "remote server" | `mcp` |
| HTTP API, REST endpoint | "HTTP trigger" | `http` |
| Timer, Scheduled task, cron job | "Timer trigger", "scheduled" | `timer` |
| Cosmos, Database changes | "Cosmos DB trigger", "event-driven" | `cosmos` |
| Service Bus, Message processing topic, queue| "Service Bus" | `servicebus` |
| Event Hubs, Message processing | "Event Hub trigger" | `eventhub` |
| Blob, File processing | "Blob trigger", "EventGrid" | `blob` |
| AI agent, chatbot | "AI agent", "Copilot SDK", "Foundry", "LangChain" | `http` (scan description) |
| **No specific trigger mentioned / Intent unclear** | — | `http` (default) |

> **Default behavior:** When user intent cannot be determined or no trigger type is known, use HTTP as the default. HTTP is the most common trigger and provides a safe starting point.

**Single-template optimization:** If description mentions BOTH trigger AND binding user needs, fetch that one template only.

**IaC selection:**

- Default: `infrastructure: "bicep"`
- If user says "terraform": `infrastructure: "terraform"`

### Step 3: Generate Project

```
functions_template_get(
  language: "<language>",
  template: "<selected-template-name>"
)
```

### Step 4: Write All Files

Write every file from BOTH arrays:

- `functionFiles[]` — function source code
- `projectFiles[]` — IaC, azure.yaml, host.json, dependencies

**PRESERVE generated IaC security patterns** — keep RBAC, managed identity, and security config intact. When composing multiple templates, merge additively (see [composition.md](recipes/composition.md)).

### Step 5: Deploy

```bash
azd env set AZURE_LOCATION <region>
azd up --no-prompt
```

---

## Recipe Composition (Multiple Templates)

When user needs trigger + bindings not in a single template:

1. **Discover** all templates for language
2. **Select trigger template** as base (has complete project structure)
3. **Select binding templates** for additional integrations
4. **Fetch all** templates (parallel calls)
5. **Compose**:
   - Use trigger template as base
   - Extract binding patterns from binding templates
   - Merge IaC resources and RBAC roles
   - Add user's custom logic
6. **Trim** unused demo code from samples

> **AzureWebJobsStorage exception**: Always keep storage account + RBAC — runtime requires it.

---

## Fallback (MCP Unavailable)

If MCP tools are unavailable, download the CDN manifest which points to the same GitHub repos:

### Step 1: Fetch Manifest

```
GET https://cdn.functions.azure.com/public/templates-manifest/manifest.json
```

### Step 2: Filter Templates

Each template entry contains:

| Field | Description | Example |
|-------|-------------|---------|
| `language` | Programming language | `Python`, `TypeScript`, `JavaScript`, `Java`, `CSharp`, `PowerShell` |
| `resource` | Trigger type (see [selection.md](selection.md)) | `http`, `cosmos`, `timer`, `eventhub`, `servicebus`, `blob`, `sql`, `mcp`, `durable` |
| `iac` | Infrastructure type | `bicep`, `terraform` |
| `repositoryUrl` | GitHub repo with complete project | `https://github.com/Azure-Samples/functions-quickstart-python-http-azd` |
| `folderPath` | Path within repo | `.` or `src/api` |

Filter: `language == <user-lang> AND resource == <mapped-resource> AND iac == <user-iac>`

### Step 3: Download Template

**If `folderPath` is `.` (root):** ZIP download + unzip

```
GET https://github.com/{owner}/{repo}/archive/refs/heads/main.zip
unzip main.zip -d <project-dir>
```

**If `folderPath` is a subfolder:** Fetch tree + raw file downloads

```
1. GET https://api.github.com/repos/{owner}/{repo}/git/trees/main?recursive=1
2. Filter tree entries where path starts with {folderPath}/
3. For each file:
   GET https://raw.githubusercontent.com/{owner}/{repo}/main/{path}
```

**If downloads fail:** Fall back to git clone

```bash
git clone <repositoryUrl> --depth 1
# If folderPath != ".", copy only that folder
```

The downloaded content is the **same** as MCP `functionFiles[]` + `projectFiles[]`:

- Source code (function triggers, bindings)
- IaC (Bicep/Terraform with RBAC, managed identity)
- azure.yaml (azd configuration)
- host.json, dependencies

### Step 4: Deploy

```bash
azd up --no-prompt
```

---

## References

- [Composition Details](recipes/composition.md) — recipe algorithm
- [Selection Guide](selection.md) — intent→resource mapping
- [Recipes Index](recipes/README.md) — all available recipes
- [Base Template Eval](base/eval/summary.md) — HTTP base evaluation results

**Browse all:** [Awesome AZD Functions](https://azure.github.io/awesome-azd/?tags=functions)
