# Managed Harness Agent Tools

A Managed Harness Agent prefers tools declared directly in the Agent service's `tools[]`. Use a Toolbox only when explicitly requested.

| Capability | Authoring | Connection |
|---|---|---|
| Copilot built-ins | `github_copilot_toolset_preview` | No |
| Web Search | `web_search` | No |
| Code Interpreter | `code_interpreter` | No |
| File Search | `file_search` | Existing vector store |
| Work IQ | Connection-authenticated `mcp` | Existing Work IQ connection |

Read the specific reference before editing:

- [GitHub Copilot Toolset](tool-github-copilot-toolset.md)
- [Web Search](tool-web-search.md)
- [Code Interpreter](tool-code-interpreter.md)
- [File Search](tool-file-search.md)
- [Work IQ](tool-work-iq.md)

Standard tool entries use Foundry REST field names, normally `snake_case`. Except for the Copilot toolset, azd validates little beyond a non-empty `type`; Foundry validates nested fields.

Do not add unsupported tools by guessing their schema. Do not create a connection or Toolbox unless the user explicitly requests creation.
