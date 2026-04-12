---
name: azure-resource-visualizer
description: "Generate Azure architecture diagrams (Mermaid or Draw.io) from live resource groups, sketches, whiteboard photos, or text descriptions. WHEN: \"create architecture diagram\", \"draw.io diagram\", \"sketch to diagram\", \"whiteboard photo\", \"image to diagram\", \"visualize Azure resources\", \"resource topology\", \"map Azure infrastructure\", \"generate Mermaid diagram\". DO NOT USE FOR: comparing against live Azure or Bicep (use azure-infrastructure-sync), Bicep templates (use azure-iac-generator)."
license: MIT
metadata:
  author: Microsoft
  version: "2.0.0"
---

# Azure Resource Visualizer

Generate architecture diagrams from Azure resource groups, sketches, or descriptions.

**Requires:** Azure CLI + active session (required); Draw.io MCP server (recommended); Draw.io VS Code extension (optional).

## Routing

| Trigger | Workflow |
|---|---|
| "sketch" / "whiteboard" / "description" / "draw.io from text" | [sketch-to-diagram-workflow.md](references/sketch-to-diagram-workflow.md) |
| "draw.io" / "drawio" / "rich diagram" | [azure-to-diagram-workflow.md](references/azure-to-diagram-workflow.md) |
| "mermaid" / default | [mermaid-diagram-workflow.md](references/mermaid-diagram-workflow.md) |

## Error Handling

| Error | Cause | Remediation |
|---|---|---|
| No resources found | Empty/wrong resource group | Verify name and subscription |
| Permission denied | Missing RBAC | Check Reader role |
| Draw.io MCP not found | MCP not configured | Outputs `.drawio` XML; open with VS Code Draw.io extension |
| 50+ resources | Large resource group | Split by layer or use Draw.io |

## Quality Standards

- Read-only analysis — never modify Azure resources
- Include every resource; show all significant connections
- ❌ Never proceed without confirming resource group selection
