# Optional GPU Day-2 Handoff

Use `airunway-aks-setup` for initial GPU node-pool, controller, provider, and
model setup. Consider the optional `aks-gpu-inference` skill only for a Day-2
incident affecting an existing AKS GPU or inference deployment. Never offer it
during initial setup or to customers who are not on AKS, and do not repeat an
offer or a decline already visible in this conversation.

1. Read the host-provided available-skill inventory, or use an approved
   read-only host capability query. Do not require a CLI on a skill-only remote
   host and do not infer availability from an `aks-` prefix.
2. If `aks-gpu-inference` is available, invoke it through the host-native skill
   mechanism.
3. If it is absent and would help, explain the focused GPU/inference diagnostic
   benefit and ask before installation. Use only the installation path
   supported by the current host after approval, as described in
   [Install steps](#install-steps). If the host activates the plugin only in a
   new session or after a restart, say so, continue the base workflow now, and
   report `aks-gpu-inference` as installed but not yet active rather than used.
4. If installation is declined or unsupported, continue the base setup/error
   workflow and reason from supplied evidence. Do not claim that the optional
   skill ran.

Installation or invocation is not approval to mutate the cluster. Preserve the
separate confirmation gates for install, deployment, and remediation actions.

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
