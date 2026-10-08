# MCP tools used by vm-creator

The Azure MCP server exposes the `compute` area as a single namespace proxy: `mcp__azure__compute({intent, command, parameters})`. The commands below are what the workflow dispatches against it.

## Read-only validation (Step 4)

Azure MCP has no command to list VM sizes or images or to recommend a region, and its `quota_usage_check` returns only a partial view (at most three sizes per family). Run these checks with the Azure CLI:

| Check | Command |
|---|---|
| Size available in region | `az vm list-skus --location <region> --size <size> --resource-type virtualMachines --output table` (`--size` matches partial names; check the exact row and its `Restrictions`) |
| Image available in region | `az vm image show --location <region> --urn <urn>`; `az vm image list --output table` maps aliases to URNs |
| vCPU quota (family and regional) | `az vm list-usage --location <region> --output table` (see [vm-quotas.md](../../../references/vm-quotas.md)) |
| Regions offering the size | `az vm list-skus --size <size> --resource-type virtualMachines --output table` (no `--location`; a default location set with `az config` would limit it to that region) |

## Apply (Step 6, Adapter 4)

| Command | Purpose |
|---|---|
| `compute_vm_create` | Create a single VM from Plan Card fields |
| `compute_vmss_create` | Create a VMSS (adds `instance-count`, `upgrade-policy`) |
| `compute_vm_get` | Inspect after create |
| `compute_vm_update` | Tag changes, size resize, identity attach |
| `compute_vm_delete` | Cleanup |

See [output-adapters/mcp-apply.md](output-adapters/mcp-apply.md) for the full parameter mapping and failure-handling table.

## Without Azure MCP

Use `az vm create ...` (see [az-cli.md](output-adapters/az-cli.md)) instead of `compute_vm_create`.

## Why the proxy form matters

The CLI / tool host shows `mcp__azure__compute` as a single tool. Sub-operations like `compute_vm_create` and `compute_vm_get` are not separate tools — they are passed through the `command` parameter. Every command is invoked as:

```
mcp__azure__compute({
  command: "compute_vm_get",
  parameters: { "resource-group": "dev-vm-01-rg", "vm-name": "dev-vm-01" }
})
```

When tracing tool calls or writing must-call rubrics, look for the `command=` argument, not a distinct tool name.
