# Beginner / fast-path

Goal: get to a working Plan Card in **≤ 2 questions**, then show defaults and let the user edit.

| # | Question | Default if skipped |
|---|---|---|
| 1 | "What region? I can recommend if you're not sure." | `eastus` |
| 2 | "Linux or Windows? Default is Ubuntu 24.04." | `Ubuntu2404` (Linux) |

## Silent defaults (show in Plan Card, don't ask)

- **Size:** `Standard_D2s_v5` (2 vCPU / 8 GB)
- **Auth:** SSH key from `~/.ssh/id_rsa.pub` (Linux) — read the file; ask only if missing
- **VNet:** create new `<vm-name>-vnet` with `10.0.0.0/16`
- **Subnet:** `default` with `10.0.0.0/24`
- **NSG:** create new, allow SSH 22 (Linux) or RDP 3389 (Windows) from `*` *— flag this in the Plan Card with a warning so the user can restrict*
- **Public IP:** Standard SKU, dynamic
- **OS disk:** 30 GB Premium SSD
- **Zone:** none (regional)

If the user is in a region you haven't validated, call `compute_vm_list-skus` to confirm `Standard_D2s_v5` is available there before locking it in. If not, fall back to whatever the recommender suggests.
