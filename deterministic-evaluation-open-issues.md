# Azure fixture pre-provisioning — open issues

Tracking gaps between [deterministic-evaluation.md](deterministic-evaluation.md), the schema and script in
[tests/azure-fixtures/provision-fixture.ts](tests/azure-fixtures/provision-fixture.ts), and the example fixture under
`evals/azure-skills/azure-resource-lookup/fixture/missing-tag/`.

Resolved so far: template scope, template parameter set, stale-name collision guard, `resolveBicepParameter`
undefined check.

## Blocking an end-to-end run

### No machine-readable output for the executor

The spec says the vally executor "injects context of the fixture resources into the 1st user prompt", but the script
emits only `console.log`. Nothing tells the executor which resource group was provisioned. Needs a defined contract —
JSON on stdout, or a file written to a known path — covering both the freshly-provisioned and the already-up-to-date
early-return paths.

### Fixture is not wired into any eval

`evals/azure-skills/azure-resource-lookup/eval.yaml` has no `environment.commands` invoking the script and no stimulus
referencing the fixture, so nothing runs it.

### Ground truth cannot be expressed

Storage account names derive from `uniqueString`, so a grader cannot hardcode the expected answer. The template emits
`untaggedStorageAccountName` and `taggedStorageAccountNames` as outputs, but the script never reads deployment outputs
or surfaces them. This is the point of the whole design (motivation 2 in the spec) and is currently unreachable.

### No teardown

The spec has the executor scheduling deletion of read-write fixtures after a run. Nothing records what was created and
there is no teardown script. `DeleteAfter` is the only backstop.

## Spec promises with no implementation

| Spec statement | Status |
| --- | --- |
| Read-write fixtures error when resources already exist | Not implemented; only `readOnly` does a lookup |
| Artificial delay by polling for RBAC propagation | Not implemented |
| Override persist-by-default for read-only fixtures | Impossible; `shouldPersist` was removed from the schema, persistence is hardcoded to `type === "readOnly"` |
| Data-plane scripts can seed fixtures | Blocked for read-only fixtures — see below |

## Ordering and lifecycle bugs

### ReadOnly lock is applied before post-provision scripts

The lock goes on at the end of `provision`, but `runPostProvisionScripts` runs after the whole `bicepConfigs` loop. Any
data-plane seeding against a read-only fixture is blocked, and `listKeys` is blocked too, so a script cannot even fetch a
storage key. Either move the lock after the scripts, or run scripts per-config before locking.

### Version bump is a two-step manual process

Bump `version` → run → deletion is scheduled and the run fails on the name-collision guard → change
`resourceGroupNameBase` → run again. Folding the version into the computed resource group name would make this
automatic, since each version targets a name never previously used.

### Untagged resource groups are deleted

`Number(undefined)` is `NaN`, so a group carrying a matching `FixtureId` but no `FixtureVersion` falls into the delete
branch. Small blast radius, but confirm it is intentional.

Author's note: Yes, this is intentional.

## Schema fields that do nothing

- `schemaVersion` — never read. Should be checked before anything else so an old script fails loudly against a newer
  manifest.
- `timeoutSec` — never applied to any `az` call.
- `resolveBicepParameter` indexes `FixtureRunContext` by parameter name, so `resourceGroupNames` resolves to the entire
  map. There is no way to request one group by base name.

Author's note: It's by design to let the resolveBicepParameter get all the resource group names.

## Cleanup script integration

- No `Owners` tag. [eng/scripts/test-sub-cleanup.ps1](eng/scripts/test-sub-cleanup.ps1) uses `Owners` as its compliance
  signal, so persisted fixtures will be flagged non-compliant.
- `DeleteAfter` is written as `MM/DD/YYYY HH:mm:ss` in UTC. The format is culture-sensitive; confirm the PowerShell side
  parses it with invariant culture.
- The sweep skips any locked resource group, so a read-only fixture must always be unlocked by whatever deletes it.

Author's note: we aren't actually using Owners tag. It's not required. DeleteAfter uses the date string format we are currently using so that's fine.

## Smaller items

- `provision` is `async` but contains no `await`; every call is `execFileSync`.
- `type`, `useRandomSuffix`, and the removed persistence flag have no validated matrix. A read-only fixture with a random
  suffix would never be found again by name, only by tag.
- No manifest validation or CI uniqueness check for `fixtureId`, which the spec calls for in prose only.
- `az group list --tag` matches tag values case-sensitively; keep `fixtureId` values normalized.
- Spec still frames conflict avoidance around resource group names and does not mention `fixtureId` at all.
