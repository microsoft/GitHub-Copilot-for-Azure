# VS Code installation guidance

Use the manifest's `<plugin-name>`, not its directory: `azure` lives in `azure-skills`.
Guidance is not approval: obtain user approval before installation; respect client trust and organization policy.

Confirm the exact name in the [Awesome Copilot catalog](https://raw.githubusercontent.com/github/awesome-copilot/main/.github/plugin/marketplace.json) or a verified catalog page. Supplied verified metadata also suffices. Failed/unavailable lookup means **unknown**, not absent.

**Absent or unknown listing: output documentation links only. Do not print any native install URI or catalog page for that plugin, even to reject it.**

For a confirmed listing, substitute the name in both routes:

| Entry point | Route |
| --- | --- |
| Install in VS Code | `vscode://chat-plugin/install?source=github%2Fawesome-copilot&plugin=<plugin-name>` |
| Browser fallback | `https://awesome-copilot.github.com/plugin/<plugin-name>/` |

For example, Azure uses `vscode://chat-plugin/install?source=github%2Fawesome-copilot&plugin=azure` and [its catalog page](https://awesome-copilot.github.com/plugin/azure/).

If absent or unknown, do not invent a catalog URL or VS Code source URI, even as a negative example. Catalog absence does not prove VS Code lacks other install sources: say the native route is unverified. Offer [VS Code plugin documentation](https://code.visualstudio.com/docs/agent-customization/agent-plugins) and [Microsoft's published plugin documentation](https://github.com/microsoft/azure-skills); use only a documented source supported by that client. CLI slash commands are not VS Code installation instructions.

If deep links are unavailable, use the HTTPS fallback. Catalog versions can differ from the direct Microsoft marketplace. Avoid duplicate extension-managed skills or plugin copies. After installation, check the plugin is enabled and skills are visible in a fresh conversation; MCP runtime/sign-in and Azure permissions are separate.
