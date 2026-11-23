# Azure Local Skills

Azure Local planning, deployment, operations, and workload management skills, covering both standard and rack-scale deployments.

## Installation

Review the security and telemetry disclosures below before installing. Choose one route:

- **VS Code:** [Install in VS Code](vscode://chat-plugin/install?source=github%2Fawesome-copilot&plugin=azure-local-skills).
- **GitHub Copilot app:** [Install in GitHub Copilot app](ghapp://plugins/install?source=azure-local-skills%40awesome-copilot).
- **Copilot CLI (terminal):**

  ```text
  copilot plugin install azure-local-skills@awesome-copilot
  ```

If a client link does not open, use the [Awesome Copilot catalog page](https://awesome-copilot.github.com/plugin/azure-local-skills/) for installation options. Availability depends on your client version and organization policy; installation does not imply identical feature support across clients or grant Azure permissions.

### Direct Microsoft marketplace alternative

Run these slash commands inside an **interactive Copilot CLI session**, not a terminal shell:

```text
/plugin marketplace add microsoft/azure-skills
/plugin install azure-local-skills@azure-skills
```

Awesome Copilot pins a published package revision, so its version may differ from the direct Microsoft marketplace. For updates, retain the original source suffix: `azure-local-skills@awesome-copilot` or `azure-local-skills@azure-skills`. Avoid duplicate copies from different marketplaces or extension-managed skills. Confirm the plugin is enabled and its skills are visible, then start a fresh conversation.

## Security

> [!WARNING]
> The `azure-local-skills` plugin uses `npx` to download and run the Azure MCP Server, inheriting the local environment's `.npmrc` configuration. Install this plugin only on trusted devices. A compromised `.npmrc` configuration could cause `npx` to download and execute malicious code, potentially resulting in remote code execution.

## Telemetry

The `track-telemetry` hook installs a pinned native `ghcfa-telem` release asset
when needed, verifies its platform-specific SHA-256 digest before extraction,
and caches the executable for reuse. To opt out of telemetry collection, set
`AZURE_MCP_COLLECT_TELEMETRY=false` in the environment of the process running
the agent.

## Skills

- **azure-local** — Standard Azure Local (formerly Azure Stack HCI): 1-16 node hyperconverged, up to 64 disaggregated, and rack-aware clusters. Covers planning and deployment, day-2 operations and lifecycle updates, workloads (Azure Local VMs, AKS on Azure Local, images, disks, logical networks), SDN and network security, and troubleshooting.
- **azure-local-multi-rack** — Multi-rack (rack scale) deployments: preintegrated racks scaling to hundreds of machines, built on `Microsoft.NetworkCloud` and `Microsoft.ManagedNetworkFabric` with a Network Fabric Controller, Cluster Manager, SAN storage, and managed network fabric. Multi-rack is in preview.

### Choosing between them

Standard Azure Local and multi-rack use separate, non-interchangeable procedures for same-sounding tasks such as creating logical networks, VMs, and network security groups. Both skills establish the deployment scale before recommending procedures and hand off to each other when the scale does not match.

Both skills start read-only and ask for confirmation before updates, deletes, reimages, network or fabric changes, and VM power operations.
