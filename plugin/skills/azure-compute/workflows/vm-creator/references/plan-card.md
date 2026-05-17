# Plan Card

The Plan Card is the single source of truth for the create-flow. It renders **every decision** — explicit user answers and silent defaults — as a markdown table the user can read top-to-bottom and either approve or edit.

## Rendering rules

1. **Cost + quota on the top half.** The user must see both without scrolling.
2. **Source column is mandatory.** Each row says where the value came from: `user`, `default`, `inferred`, or the MCP tool that produced it.
3. **Flag risky defaults with ⚠.** Open NSG to `*`, public IP exposed, no managed identity, password auth on Windows — all get a marker so the user can edit.
4. **No invisible state.** If you defaulted it, it goes in the card.
5. **Re-emit on every change.** When the user edits a row, render the full card again — diffs in chat are easy to miss.

## Schema

| Column | Required? | Notes |
|---|---|---|
| Setting | yes | Human-readable label (`Region`, `Size`, `OS disk`) |
| Value | yes | The concrete value, in backticks if it's a literal |
| Source | yes | `user` / `default` / `inferred` / `<tool name>` |

## Example — Linux dev VM in eastus

```markdown
| Setting | Value | Source |
|---|---|---|
| Hosting model | Single VM | user |
| Name | `dev-vm-01` | default (`<purpose>-vm-<nn>`) |
| Region | `eastus` | user |
| Resource group | `dev-vm-01-rg` (new) | default |
| Image | `Ubuntu2404` | user |
| Size | `Standard_D2s_v5` (2 vCPU / 8 GB) | default |
| Auth | SSH key from `~/.ssh/id_rsa.pub` | inferred |
| VNet | new `dev-vm-01-vnet` (`10.0.0.0/16`) | default |
| Subnet | `default` (`10.0.0.0/24`) | default |
| NSG | SSH 22 from your public IP (`203.0.113.42`) | default — ⚠ change to `*` only if needed |
| Public IP | Standard, dynamic | default |
| OS disk | 30 GB Premium SSD | default |
| Boot diagnostics | Managed | default |
| Estimated cost | ~$0.096/hr (~$70/mo) | from `compute_vm_list-skus` |
| Quota | ✅ 4/100 vCPUs used in `standardDSv5Family` | from `compute_vm_check-quota` |
```

## After rendering

Ask: *"Approve as-is, edit a row, or change output format?"*

- **Approve** → proceed to Step 6 (Output Choice)
- **Edit** → ask which row(s), update, re-render the full card
- **Change output format** → re-render the **same** card via a different adapter — never re-ask questions
