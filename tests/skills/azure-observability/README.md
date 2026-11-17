# Observability offline tests

Run from the repository root with an existing Python 3.12 or later interpreter:

```powershell
python -B -m unittest discover -s tests\skills\azure-observability -p test_*.py
```

The standard-library suite needs no installation, authentication, network,
Azure access or model jobs. It covers the reviewed discovery-first 0.3.40
contracts in the receiving layout, plus receiving manifest/version, registration
and scoped-inventory checks. Source versions are `0.0.0-placeholder`; the
repository build stamps real versions. These Python checks do not run through
`npm run test`; a TypeScript migration is deferred.

These are local behavioral, source-pin, instruction-contract, and packaging tests.
They do not validate installed-host routing, models, Azure access, or cloud behavior.
Temporary test repositories and evidence are created under the repository's ignored
`tests\skills\azure-observability\.test-work\` directory, not inside
the packaged skills.

`candidate-inventory.json` preserves the earlier 0.3.38 import's original layout,
counts and source hashes **only as historical provenance**, not the reviewed
0.3.40 source or current receiving payload. Its hashes are never regenerated.
The health helper source pins remain independent regression gates.

`host-acceptance/` and `journey-cases.json` are contributor-only acceptance
specifications, not completed host runs or runtime instructions. Both VS Code
and Copilot CLI gates remain **UNRUN**, including actual external
`azure-diagnostics` / `microsoft-foundry` discovery and load events.

The seven synthetic case files previously under runtime references now live
under `fixtures/<skill>/references/`. All 140 cases and their expectations were
preserved byte-for-byte during relocation. Runtime packaging rejects these
developer-only cases; the unit suite reads their new contributor-only paths.

Tests for the removed duplicate diagnostics/Foundry implementations were
retired (`test_diagnostics.py`, `test_foundry.py`, `test_foundry_context.py`,
`test_catalog_inputs.py`). `_adaptation.py` and its source-offset/link-reversal
hacks were removed. Runtime affected-path, Prometheus, safety, routing, closure,
standalone availability and recovery contracts remain covered. Actual local
shared-policy links must resolve inside their own skill. `shared_contracts.py`
declares the exact 18-file transitive closure derived from our coordinator
guidance for connection and recovery. Tests compare all content while
canonicalizing only local link destinations within that declared closure;
changed prose, missing files, escaped links and mismatched targets fail. The
Prometheus helper is compared with LF-normalized bytes. These are derived
copies of our shared guidance, not copied canonical external specialists or
historical peer byte-offset/hash adaptations.

Development tools live in `tools/`, outside the plugin, because the receiving
build ships every file under the plugin directory:

```powershell
python -B tests\skills\azure-observability\tools\validate.py
python -B tests\skills\azure-observability\tools\context_budget.py
```

`validate.py` runs the unit suite, then the separate tokenizer gate with the
same interpreter. The tokenizer gate requires the already available pinned
`tiktoken==0.12.0` and cached encoding tables; it blocks network and reports a
blocker rather than installing dependencies or downloading tables. Missing
tokenizer coverage is not a passing context-budget result.

For an explicitly requested current-layout snapshot, run:

```powershell
python -B tests\skills\azure-observability\tools\update_inventory.py
```

This prints a scoped plugin inventory to stdout without changing the source
inventory or writing generated files. Generate final snapshots only after all
payload edits are complete.

See the [contributor guide](../../../docs/azure-observability.md)
and [provenance](../../../docs/azure-observability-provenance.md).
