# Optional AKS Operations Handoff

Baseline AKS intake, Azure-side health checks, Kubernetes evidence, and safe
remediation guidance remain in this guide. Offer the sibling `aks-skills`
plugin only when one focused workflow materially fits the current incident on
an existing AKS cluster. Never offer it during Day-0 planning or setup, or to
customers who are not on AKS. If an offer or a decline is already visible in
this conversation, do not repeat it.

## Select the focused skill

| Skill | Exact boundary |
|-------|----------------|
| `aks-troubleshooting` | A live AKS incident in any scope bucket, including workload crashes, node, networking, ingress, upgrade, or scaling problems, where deeper target-bound operational investigation would help. An application-level cause does not exclude an AKS workload incident. |
| `aks-known-issues` | An exact, fully qualified catalog signature is present. A quota error, unqualified capacity symptom, or incomplete wrapper is not enough; an exact fully qualified catalog capacity signature remains eligible. |
| `aks-network-capture` | The customer explicitly requests packet capture and separately approves the bounded `pcap` plan. Generic network troubleshooting stays here. |
| `aks-gpu-inference` | An existing AKS GPU or inference deployment has a Day-2 incident. Initial setup stays in `airunway-aks-setup`. |

## Host and consent flow

1. Use the host-provided available-skill inventory, or an approved read-only
   host capability query. Do not require a CLI just to inspect availability and
   do not guess from literal skill-name prefixes.
2. If the selected skill is present, invoke it through the host-native skill
   mechanism.
3. If it is missing and useful, explain the focused benefit and ask before
   using the host-supported plugin manager, as described in
   [Install steps](#install-steps). Do not silently install the plugin,
   add it as a dependency, or bypass host policy. After installation, confirm
   the selected skill appears in the host's available-skill inventory before
   invoking it. If the host activates newly installed components only in a new
   session or after a restart, say so, continue this baseline guide now, and
   report the focused skill as installed but not yet active rather than used.
4. If installation is declined or unsupported, continue this baseline guide
   with available reads or supplied evidence. Do not repeatedly prompt, stop
   without help, or pretend the optional skill executed.

Installing the plugin does not approve resource changes or packet capture.
Follow the selected workflow's separate execution and mutation approvals.

## Install steps

Per-host steps live in the published
[`aks-skills` README](https://github.com/microsoft/azure-skills/blob/main/.github/plugins/aks-skills/README.md#install).
Share the steps for the customer's host from there. In Copilot CLI and Claude
Code, the customer types these slash commands in the host's chat UI; they are
not shell commands:

1. `/plugin marketplace add microsoft/azure-skills`
2. `/plugin install aks-skills@azure-skills`

Claude Code then needs `/reload-plugins` or a new session, which only the
customer can run. For Codex and other hosts, follow the README; if it has no
steps for the host, say so rather than guessing.
