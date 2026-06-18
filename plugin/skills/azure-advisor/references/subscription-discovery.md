# Shared Reference — Subscription Discovery

> **Shared across all `azure-advisor` capabilities.** Any capability that operates on a
> subscription should link here instead of re-defining discovery logic.

Subscription **must never be hardcoded**. Resolve in this order and stop at the first hit:

1. **Repository config files** — scan the workspace for any of:
   - `azure.yaml` → `subscriptionId:` key
   - `.azure/*/config.json` → `subscriptionId` field
   - `*.bicepparam` / `*.parameters.json` → `subscriptionId` / `subscription` parameter
   - `.env*` files → `AZURE_SUBSCRIPTION_ID` line
   - `infra/**/main.parameters.json`
2. **Environment variable** `AZURE_SUBSCRIPTION_ID`.
3. **Ask the user.** Do not guess. Say which files were scanned and what was missing.

Always mention the *source* of the resolved subscription in the final chat summary
(e.g. "Subscription pulled from `infra/main.parameters.json`").
