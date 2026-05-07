# Error Handling

| Condition | Action |
|-----------|--------|
| **No project files found** | Enter [zero-code path](zero-code-path.md). |
| **Detected vs stated conflict** | See [conflict-resolution.md](conflict-resolution.md). |
| **Build/fix fails** | Mark `needsFixes`, surface error, continue remaining checks. |
| **Workspace too large** | Use exclusion list. 20+ dirs with no matches → ask for root hint. |
| **Stale session (>24h)** | Ask: *"Resume or start fresh?"* Staleness from `lastModifiedUtc`. |
| **Sparse session after failure** | Report what's missing. Do not proceed incomplete. |
| **Override changes stack** | Re-run from Step 3 with constraints. Don't restart. |
| **Build timeout (>5 min)** | ⚠️ WARN — suggest CI/CD. Don't retry. |
| **Specialized routing detected** | Note in findings (e.g., Copilot SDK → **azure-hosted-copilot-sdk**). Don't block. |
