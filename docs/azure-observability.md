# Contributing to Azure Observability skill plugin

The [installed-user README](../plugins/azure-observability/README.md)
contains the product overview, prerequisites, examples, permission boundaries,
troubleshooting and telemetry disclosure. This guide contains contributor-only
build and validation instructions; it is not shipped with the plugin.

## Composition

The integration follows reviewed source candidate 0.3.40:

- Four core skills: connection, health assessment, coordination and recovery.
- Canonical `azure-diagnostics` and `microsoft-foundry` discovered externally,
  rather than copied into this plugin.
- Unique bounded investigation resources retained beneath the coordinator.
- Microsoft authorship metadata, with individual ownership in CODEOWNERS.
- Existing receiving-repository hooks, empty MCP declarations, license and
  automatic versioning preserved.

The candidate number identifies the isolated input, not a package version.
Leave source manifest and skill metadata versions at `0.0.0-placeholder`.
Keep each skill's `version.json`; see [automatic versioning](VERSIONING.md).

## Skill-local shared resources

The receiving reference validator requires every local Markdown link to stay
inside its own skill. The connection and recovery skills therefore contain
derived `references/shared/` resources from the coordinator. These are copies
of this plugin's own shared guidance, not copies of external canonical skills.

Edit the coordinator's originals, then materialize the exact linked closure
with an approved Python 3.12+ interpreter:

```powershell
python -B eng\azure-observability\materialize-shared.py --write
```

The closure also retains the investigation helper and source notice. Incoming
cross-skill Markdown links are rebased to the local copies. The copies preserve
the originals' bytes; do not edit them independently. To check without writing:

```powershell
python -B eng\azure-observability\materialize-shared.py
```

These are contributor commands, never automatic customer setup or runtime jobs.

## Validate locally

Use the existing dependencies and commands documented in
[onboarding](Onboarding.md). Installing dependencies needs applicable approval.
Do not treat a dependency failure as a passing validation result.

From the repository root, the plugin's offline Python suite and named-tokenizer
checks run through:

```powershell
python -B tests\skills\azure-observability\tools\validate.py
```

Python 3.12+ and the pinned development tokenizer are required for the aggregate
command. The unit tests use synthetic inputs, local subprocesses and mocked
service responses; they do not authorize cloud reads or live evaluations.
Do not install these development dependencies for ordinary evidence review.
The [offline test guide](../tests/skills/azure-observability/README.md)
records coverage and the separate installed-host gates.
The [integration test report](azure-observability-test-report.md) lists
all executed receiving-suite test IDs, module purposes and current blockers.

With the receiving repository's JavaScript dependencies already installed:

```powershell
npm run build
npm --prefix scripts run frontmatter -- ..\output\azure-observability\skills
npm --prefix scripts run references -- azure-observability
npm --prefix scripts run tokens -- --help
```

Consult token-command help for its current supported selectors before use.
Validate frontmatter in built output: source version placeholders intentionally
are not final semver values and fail the output-oriented version rule.
Build output and source validation are different checks. The build stamps
versions and assembles shared telemetry hooks into the plugin output; do not
run the hooks merely to validate Markdown. Do not copy contributor directories
or this entire repository into the plugin payload.

The receiving `npm run test` runner does not execute Python tests automatically.
TypeScript migration remains deferred; these checks do not resolve that request.

## Exercise an installed host separately

Use a reviewed built payload through the host's supported plugin flow.
Keep VS Code and Copilot CLI results distinct. For each host, observe actual
core-skill loading, external canonical-specialist discovery and loading,
missing/declined/blocked setup, retained approvals and the evidence-only path.

Host acceptance specifications and routing smoke evaluations are not completed
evaluations. A response naming a skill does not prove it loaded. Installing the
plugin does not establish telemetry access, service compatibility or recovery.
Evaluation runs, synthetic traffic and service operations require their own
approval; no such run is an automatic validation step.

Keep the existing telemetry disclosure and opt-out in the installed-user
README. Read the [provenance and permission record](azure-observability-provenance.md)
before publication. Local edits and offline validation do not authorize
commits, pushes, PR publication or deployment.
