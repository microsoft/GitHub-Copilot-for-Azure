# GitHub Copilot app installation guidance

Use the manifest's `<plugin-name>`, not its directory: `azure` lives in `azure-skills`.
Guidance is not approval: obtain user approval before installation; respect client trust and organization policy.

Confirm the exact name in the [Awesome Copilot catalog](https://raw.githubusercontent.com/github/awesome-copilot/main/.github/plugin/marketplace.json) or a verified catalog page. Supplied verified metadata also suffices. Failed/unavailable lookup means **unknown**, not absent.

**Absent or unknown listing: output documentation links only. Do not print any native install URI or catalog page for that plugin, even to reject it.**

For a confirmed listing, substitute the name in both routes:

| Entry point | Route |
| --- | --- |
| Install in GitHub Copilot app | `ghapp://plugins/install?source=<plugin-name>%40awesome-copilot` |
| Browser fallback | `https://awesome-copilot.github.com/plugin/<plugin-name>/` |

For example, Azure uses `ghapp://plugins/install?source=azure%40awesome-copilot` and [its catalog page](https://awesome-copilot.github.com/plugin/azure/).

If absent or unknown, do not invent a catalog URL or app deep link, even as a negative example. Catalog absence does not prove the app lacks other install sources: say the native route is unverified. Offer [Microsoft's published plugin documentation](https://github.com/microsoft/azure-skills) and use only a documented app-supported source. An HTTPS documentation fallback suffices when no supported app route is verified. Do not present CLI slash commands as app instructions.

If deep links are unavailable, use the HTTPS fallback. Catalog versions can differ from the direct Microsoft marketplace. Avoid duplicate copies. After installation, check the plugin is enabled and skills are visible in a fresh conversation; MCP runtime/sign-in and Azure permissions are separate.
