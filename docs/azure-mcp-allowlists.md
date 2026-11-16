# Azure MCP tool allowlists

The single shared Azure MCP allowlist source is
`plugins/allowed-azure-tools.json`. The
**Refresh Azure MCP allowlists** workflow checks daily and supports manual
dispatch. It selects the newest published `Azure.Mcp.Server-*` release from
`microsoft/mcp`, including prereleases, not the latest release of other products.

The workflow runs the exact release binary to discover command names and
namespace tools, and verifies that the matching `@azure/mcp` package exists.
Release execution uses no write credentials or Azure login. A separate job uses
the existing `GHCP4A_BOT_APP_ID` and `GHCP4A_BOT_PRIVATE_KEY` secrets to update
one PR on `automation/azure-mcp-allowlists`. The GitHub App needs contents and
pull-request write permissions on the upstream repository. Forks do not run
scheduled publication.

## File contract

The file contains exactly three object sections:

```json
{
  "commands": {"4.0.0-beta.4": ["subscription_list"]},
  "areas": {"4.0.0-beta.4": ["storage"]},
  "extensionTools": {"Azure extension": ["azure_auth-set_auth_context"]}
}
```

These example names are illustrative. Groups record when names were first
discovered; labels may be arbitrary. Names are matched case-sensitively.
The generator adds only names absent from every group in the same category.
It preserves removed tools and historical group memberships in the shared
source file. Extension helpers have already been captured in that file and
are preserved, not replaced by release tools. If the shared file is missing,
the refresh fails before writing anything: restore it from source control
to retain the helper baseline and historical groups. There is no embedded
reporter baseline or automatic recreation.

Commands and namespaces have no MCP client prefixes. Namespace entries permit
the namespace tool, not arbitrary commands below it. Helpers remain verbatim.
Empty sections are `{}`, never omitted; group arrays must be non-empty strings.
Malformed files, duplicate top-level sections, incomplete discovery, unavailable
packages, and mismatched portable/legacy MCP configurations fail the refresh
before target files are written.

The same PR updates existing Azure package arguments in portable `mcp.json`,
legacy `.mcp.json`, and Gemini configuration. Other servers and plugin manifest
versions remain unchanged. The generator never adds a server or creates
per-plugin allowlist copies.

## Manual refresh

Prefer dispatching `.github/workflows/refresh-azure-mcp-allowlist.yml` upstream.
For local generation, run these commands **from `scripts/`**, after installing
its dependencies. Download and extract the selected official release asset for
your OS; set the binary path to the extracted `azmcp` or `azmcp.exe`. Keep
temporary metadata outside the repository.

PowerShell:

```powershell
npm run generateAzureMcpAllowlist -- resolve --output "$env:TEMP\azure-mcp-release.json"
# Download/extract the release identified by that JSON, then set the binary path.
$binary = "C:\temp\azure-mcp\azmcp.exe"
npm run generateAzureMcpAllowlist -- discover --binary "$binary" --release "$env:TEMP\azure-mcp-release.json" --output "$env:TEMP\azure-mcp-discovery.json"
npm run generateAzureMcpAllowlist -- update --root .. --discovery "$env:TEMP\azure-mcp-discovery.json"
```

Bash:

```bash
npm run generateAzureMcpAllowlist -- resolve --output /tmp/azure-mcp-release.json
# Download/extract the release identified by that JSON, then set the binary path.
binary=/tmp/azure-mcp/azmcp
npm run generateAzureMcpAllowlist -- discover --binary "$binary" --release /tmp/azure-mcp-release.json --output /tmp/azure-mcp-discovery.json
npm run generateAzureMcpAllowlist -- update --root .. --discovery /tmp/azure-mcp-discovery.json
```

For the workflow's Linux ZIP, `verify-asset --release <release.json> --archive
<zip>` verifies the API-provided SHA-256 digest when supplied. Do not use that
Linux digest for a different platform asset.

Inspect the diff before committing. Repeating a refresh against the same
discovery makes no changes. The workflow fails visibly on download, discovery,
git, or PR API errors and never auto-merges. If its branch has non-bot edits,
review those edits before rerunning rather than overwriting them.
Unmerged release groups are retained when a newer release arrives. The bot
rebases its pending branch onto current `main`; merge conflicts fail the run
for review rather than discarding either history.
If a branch was pushed but PR creation failed, rerunning creates the missing PR
even when discovery generates no new changes. Rebases are also published when
pending changes remain, without requiring another generated commit.

The plugin build copies the shared source byte-for-byte to
`output/<plugin-name>/hooks/allowlists/allowed-tools.json` for every plugin,
beside `allowed-skills.txt` and `allowed-references.txt`. It preserves all
sections and named groups without parsing or rewriting the JSON, and fails if
the source cannot be read or the destination cannot be written. The generator
still maintains only the single shared source, not per-plugin source copies.
Commits changing the shared allowlist count toward every plugin's stamped
version and changelog, just like changes to shared hooks.

Both telemetry hooks pass all three installed paths to `ghcfa-telem`, which
requires them and includes no embedded fallback lists. The obsolete reporter
snapshot synchronization workflow has been retired.
