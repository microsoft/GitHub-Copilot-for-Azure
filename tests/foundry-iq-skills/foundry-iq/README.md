# Foundry IQ helper regressions

These deterministic tests exercise resource ownership, ACK/provenance retention,
credential cleanup, shared readback contracts, File reuse, and direct/package
imports. Transports and SDK seams are offline; no Azure sign-in or resources are used.

`cli_regressions.py` runs the actual script/package entry points, argument parsing,
JSON input/output, and orchestration for Search creation and partial success,
File planning/reuse/local drift, Blob inventory planning/drift, and Prompt
reuse/prerequisite failure. HTTP, token acquisition, and SDK objects are synthetic;
these checks do **not** establish live Azure end-to-end behavior. Socket
connections are prohibited. Both import modes run through the Vitest wrapper.

For a packaged-output or baseline comparison, set `FOUNDRY_HELPERS` to the
absolute directory containing that version's helpers and run
`cli_regressions.py` directly. Set `FOUNDRY_IMPORT_MODE=package` for package mode;
otherwise direct-script mode is used. The same boundary fixtures and behavioral
assertions run against either version.

Run from the repository root with Python 3.12+ and the test dependencies installed:

```powershell
$env:PYTHON = 'C:\path\to\python.exe' # Optional when python on PATH is 3.12+
npm --prefix tests test -- foundry-iq-skills/foundry-iq/helpers.test.ts
```

```bash
PYTHON=/path/to/python3.12 npm --prefix tests test -- foundry-iq-skills/foundry-iq/helpers.test.ts
```

The underlying standard-library suite can also run directly:

```powershell
python -B .\tests\foundry-iq-skills\foundry-iq\helper_regressions.py
```

```bash
python3.12 -B ./tests/foundry-iq-skills/foundry-iq/helper_regressions.py
```

The real POSIX permission/link case skips on Windows; mocked descriptor transfer,
reverse cleanup, conversion failure, and primary-error cases run on both platforms.
CodeQL validation must still extract the full repository and run the complete
Python `security-and-quality` suite; these runtime tests do not substitute for it.
