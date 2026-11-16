# Observability offline tests

Run from the repository root with Python 3.12 or later. Context-budget tests
require the peer's pinned `tiktoken==0.12.0`; keep it in an ignored virtualenv
rather than changing the global Python installation:

```powershell
python -m venv tmp\observability-super-skill\venv
tmp\observability-super-skill\venv\Scripts\python.exe -m pip install -r tests\skills\observability-super-skill\requirements-dev.txt
.\tmp\observability-super-skill\venv\Scripts\Activate.ps1
python -B -m unittest discover -s tests\skills\observability-super-skill -p test_*.py
python -B plugins\observability-super-skill\scripts\context_budget.py
```

The first tokenizer run may download public encoding tables into tiktoken's
cache. No Azure credentials or service access are used. The plugin-scoped
`scripts/validate.py` runs both commands with the selected interpreter.

These are local behavioral, source-pin, instruction-contract, and packaging tests.
They do not validate installed-host routing, models, Azure access, or cloud behavior.
Temporary test repositories and evidence are created under the repository's ignored
`tmp/observability-super-skill/` directory, not inside the packaged skills.

`candidate-inventory.json` preserves the supplied ZIP's original version, layout,
counts, and source hashes. Its role and verification boundary are annotated, but
its source hashes are **not** regenerated after adaptation. It is not a claim of
current payload byte parity. Specialist source pins and unchanged-resource tests
remain independent regression gates.

`host-acceptance/` and `journey-cases.json` are contributor-only acceptance
specifications, not completed host runs or runtime instructions.

The peer's Foundry `references/context-map.json` also remains unchanged.
Retained-source tests reverse only the exact `references/shared/` link
relocation before applying the peer's byte offsets and hashes. Live skill-local
links are validated independently; hashes are not regenerated for local edits.

For an explicitly requested current-layout snapshot, run:

```powershell
python -B plugins/observability-super-skill/scripts/update_inventory.py
```

This prints a scoped plugin inventory to stdout without changing the source
inventory or writing generated files. Generate final snapshots only after all
payload edits are complete.
