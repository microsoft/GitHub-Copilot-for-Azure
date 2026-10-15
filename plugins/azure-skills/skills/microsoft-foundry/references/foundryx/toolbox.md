# Toolboxes

For normal Agent building, use read-only `toolbox list`, `show [--version]` and
`version list`; follow [Discover and reuse tools](tool-discovery.md). These return
safe JSON configuration summaries, not credentials or proof of runtime health.

The remaining guide is **resource administration**, only for an explicit mutation
request. Existing permissions are unchanged. Three mutations (`create`, `version
create`, `publish`) wait for their operation and default to `--output table`
(`--output json` for JSON). FoundryX does not delete Toolboxes or persist definitions.

- **Hosted Agent integration**: Reuse an existing Toolbox for the builder path.
  When explicitly provisioning new MCP resources, create the connection before its
  Toolbox. Creating a Toolbox does not attach it to an Agent. Do not call a Toolbox
  MCP endpoint directly; verify through `foundryx agent invoke`. Read
  [Hosted Agent Toolbox](hosted-agent-toolbox.md).

## Toolbox definition schema

Write a complete snapshot to a YAML or JSON file (`description`, optional `metadata`, `tools`, optional `policies`). Foundry validates tool schemas; assign explicit `name` fields when combining multiple tools:

```yaml
description: Web research and Python analysis
tools:
  - type: web_search
    name: web
  - type: code_interpreter
    name: python
    container:
      type: auto
```

- `web_search` and `code_interpreter` (`container.type: auto` provisions a Foundry sandbox container) are connectionless.
- For MCP tools, reference the same-project `RemoteTool` connection name from [RemoteTool MCP connections](connection-create.md); never embed MCP URLs, headers, tokens, or secrets in the file.

## Create a Toolbox (`foundryx toolbox create`)

```text
foundryx toolbox create <toolbox-name> --from-file <definition-file> --project <project-id> [--output json]
```

Posting the first version implicitly creates the Toolbox, sets that version as the default, and returns `<toolbox-name>`, immutable `version`, and `endpoint`.

## Version or roll back (`foundryx toolbox version create`, `foundryx toolbox publish`)

```text
foundryx toolbox version create <toolbox-name> --from-file <definition-file> --project <project-id> [--output json]
foundryx toolbox publish <toolbox-name> <version> --project <project-id> [--output json]
```

`version create` leaves the default unchanged. Run `toolbox publish` (`{ "default_version": "<version>" }`) to promote a new version or roll back to an earlier `<version>` without creating another version. On failure, inspect `error.code` and `error.message`; on `unknown`, compare the FoundryX record with Foundry state before retrying.


