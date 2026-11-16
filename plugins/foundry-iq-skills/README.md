# foundry-iq-skills

Diagnose Foundry IQ and Azure AI Search access and ingestion issues, and configure Azure AI Search and Foundry IQ with source-aware security and verified API guidance. Build and query entity graphs, topic graphs and ontologies over your documents.

## Skills

- [`foundry-iq`](skills/foundry-iq/SKILL.md)

## Try the graph demo

After installing, paste this prompt:

> Show me what Foundry IQ graph can do.

The demo asks its questions once, then shows each approval before it changes Azure or spends money.

## Install in Codex

Codex loads the portable `plugin.json`, `mcp.json` and `skills/` at this package root.
Register a local marketplace, install from it, then check the graph server starts:

1. Place this folder at `<marketplace-root>/foundry-iq-skills` and create
   `<marketplace-root>/.agents/plugins/marketplace.json`:

   ```json
   {"name": "foundry-iq-local", "plugins": [{"name": "foundry-iq-skills",
     "source": {"source": "local", "path": "./foundry-iq-skills"},
     "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
     "category": "Productivity"}]}
   ```

2. Register and install:

   ```text
   codex plugin marketplace add <marketplace-root>
   codex plugin add foundry-iq-skills@foundry-iq-local
   codex mcp list
   ```

   Codex copies the plugin to `~/.codex/plugins/cache/foundry-iq-local/foundry-iq-skills/local/`.
3. Check the server's launch command from that installed copy. It prints `"status": "ready"`
   once the entity runtime is prepared (the first run prepares it):

   ```text
   node "<installed-plugin>/graph/runtime/launch-python.mjs" status entity
   ```

Then start a new Codex session; the `foundry-iq-graph` tools should be listed.

## Harness-independent Python runtimes

Use an absolute installed or extracted package root from your chosen harness.
No `copilot plugin list`, global tool install or PATH change is required.
Bootstrap discovers an existing local Python 3.12, 3.13 or 3.14 with standard venv and pip; it never installs Python.
Run preflight or setup directly for the user to prepare only the chosen route:

```text
python -I "<package-root>\graph\runtime\bootstrap.py" setup entity
python -I "<package-root>\graph\runtime\bootstrap.py" setup topicgraph
python -I "<package-root>\graph\runtime\bootstrap.py" setup ontology
python -I "<package-root>\graph\runtime\bootstrap.py" setup grounding
python -I "<package-root>\graph\runtime\bootstrap.py" run entity entity-graph-build --help
```

Use `run <domain> <entry-point>` for later commands. Successful setup records its exact
interpreter per domain/artifact in the external cache; later callers re-enter that interpreter
even when the MCP launcher starts another Python version.
For explicit selection, set FOUNDRY_IQ_PYTHON to an absolute Python 3.12, 3.13 or 3.14 executable.
Without an override/binding, bootstrap uses its caller when that is a supported version,
otherwise it auto-discovers the newest supported local Python.
Each Python version gets its own isolated runtime environment and matching dependency lock.
Cold run/status auto-prepare an absent isolated runtime on first launch or wheel update.
Generated MCP servers start `node <plugin-root>/graph/runtime/launch-python.mjs`, which runs bootstrap
with the first working supported `python3.X`, `python3`, `python` or (Windows) `py`; no per-host paths.
If none is on the host's PATH, set FOUNDRY_IQ_PYTHON to an absolute Python 3.12, 3.13 or 3.14 executable
in the environment the host starts from.
Do not change global PATH/defaults. Corrupt bindings and incomplete/tampered caches fail closed.
Require initialize, notifications/initialized and nonempty tools/list before MCP use;
startup exits or unavailable tools are blocked even in autopilot, not a passing readiness check.
Bare executable names in skills are shorthand. Warm run/status never install or repair.
Setup honors configured package sources and verifies the complete hashed dependency lock.
The plugin-owned external cache is keyed by wheel, dependency and Python/platform fingerprints.
Updates select a new environment without changing active older sessions or project dependencies.
Python 3.12, 3.13 or 3.14 locks cover Windows x64, Linux x64/ARM64 and macOS Apple Silicon; macOS Intel is unsupported.
Other interpreter/platform combinations fail explicitly; lock resolution is not execution acceptance.
No global commands, PATH changes, virtual environments or site-packages ship in this plugin.
`graph/runtime/manifest.json` records wheel, source revision/tree/hash, dependency and asset provenance.
Source stays inspectable at the recorded repository/revision/path; wheels replace source copies.
Set PLUGIN_ROOT for optional doctor artifact-version checks, not Azure readiness.
See [route checks](skills/foundry-iq/workflows/graph/graph-guide/references/install-and-checks.md) for details.

## Optional MCP Apps host

The plugin includes the localhost MCP Apps viewer; no separate archive,
source checkout, npm install or frontend build is required.
Localhost uses small HTML plus packaged JS/CSS; embedded hosts retain single-file HTML.
Complete the [runtime and private configuration prerequisites](graph/apps-host/README.md),
then run with an explicit Node 22.13+ executable:

```powershell
node "<installed-plugin>\graph\apps-host\launch.mjs" --config "<operator-config.json>"
```

Open the exact loopback URL printed when ready. Type `quit` or press Ctrl+C
to stop the host and its owned Apps servers before relaunching.
The host uses the actual Entity Graph, Topic Graph, ontology and grounding Apps resources over MCP.
It is a selected-context viewer, not an agent conversation or model backend.
Entity Graph Ask supports traversal, server-side Knowledge Base (KB / NL→GQL) and raw GQL modes;
scalar GQL results render as tables rather than fabricated graphs.
Ordinary skills remain CLI-first.

## Provenance

Generated by release/scripts/package_plugin.py from skills/, graph/runtime/ and graph/apps-host/. Do not edit by hand.

Generating this package does not establish release assurance or approval.
Publication requires separate approval. The internal repository retains
manifests, release records, private fixtures,
approvals, security evidence, and benchmark exports; only the files here
are contributed to `microsoft/GitHub-Copilot-for-Azure` at
`plugins/foundry-iq-skills`.
