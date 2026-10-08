# Validation Gates

Step 4 of the create-flow runs four read-only checks before the Plan Card is shown. Azure MCP has no command to list VM sizes or images or to recommend a region, and its `quota_usage_check` returns only a partial view, so these checks use the Azure CLI (see [mcp-tools.md](mcp-tools.md)). Do **not** substitute generic guidance tools (`get_azure_bestpractices`, `pricing`) — they don't validate quota, SKU availability, or region support.

## Checks

Add `--subscription <subscription>` (the deployment subscription) to every command below; otherwise they check the CLI's active subscription.

| Check | Command | What to verify |
|---|---|---|
| SKU exists in region | `az vm list-skus --location <region> --size <size>` | A row with that exact size name (`--size` also matches longer names), no `restrictions` in target zone |
| Image is current | `az vm image show --location <region> --urn <urn>` (for the default `Ubuntu2404`: `Canonical:ubuntu-24_04-lts:server:latest`) | The URN exists in that region (map an alias first with `az vm image list --output table`) |
| vCPU quota | `az vm list-usage --location <region>` (family and regional `cores`) | `currentValue + requestedVCPUs ≤ limit` |
| Region availability | `az vm list-skus --size <size>` (all regions) | The region lists that exact size. A default location set with `az config` limits this to one region |

For a `/sharedGalleries/<name>/images/<definition>/versions/<version>` image, check with `az sig image-version show-shared --location <region> --gallery-unique-name <name> --gallery-image-definition <definition> --gallery-image-version <version>` instead of `--urn`.

## Outcomes

| Result | Action |
|---|---|
| ✅ Sufficient | Proceed to Step 5 (Plan Card) |
| ⚠️ Near limit (>80%) | Proceed but flag in Plan Card; suggest quota increase |
| ❌ Insufficient / SKU missing | Propose alternate SKU or region; do not generate output |

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `az vm list-skus` returns no rows | Size not offered in region, or restricted for this subscription | Try a neighbouring size or another region |
| Quota at limit | Subscription cap | Smaller SKU / different family / different region / quota-increase request |
| Image URN unresolved | Wrong alias; deprecated image | Switch to `publisher`/`offer`/`sku`/`version` form; check Marketplace |
| Region rejects family | Family not GA in region | Run `az vm list-skus --size <size>` without `--location` to find regions that offer it (unless a default location is set with `az config`) |

## When the Azure CLI isn't available

The checks didn't run: tell the user, and mark the SKU, image and quota rows on the Plan Card as unverified. The artifact is still allowed.
