# Azure Fixture Test Plan

This plan validates the persistent fixture defined in
`evals/azure-skills/azure-resource-lookup/fixture/missing-tag/azure-manifest.json`.

## 1. Static validation

- [ ] From `tests/`, run:

  ```bash
  npm run typecheck
  npm run lint
  npm test
  ```

- [ ] Confirm `azure-manifest.json` parses successfully.
- [ ] Confirm every referenced Bicep and TypeScript file exists.
- [ ] Confirm every substitution parameter is supported.
- [ ] Confirm every `fixtureId` is unique.
- [ ] Confirm every `resourceGroupNameBase` is unique.

## 2. Azure prerequisites

- [ ] Run `az account show`.
- [ ] Confirm Azure CLI is using the intended test subscription.
- [ ] Confirm Azure CLI is using the intended tenant.
- [ ] Confirm the signed-in principal can read resource groups.
- [ ] Confirm the signed-in principal can create and update resource groups.
- [ ] Confirm the signed-in principal can deploy Bicep templates.
- [ ] Confirm the signed-in principal can create storage accounts.
- [ ] Confirm the signed-in principal can resolve its Entra principal ID.
- [ ] Search for resource groups tagged:

  ```text
  FixtureId=azure-resource-lookup-missing-tag
  ```

- [ ] Record each matching resource group's name.
- [ ] Record each matching resource group's `FixtureVersion` tag.
- [ ] Record each matching resource group's `Completed` tag.
- [ ] Record each matching resource group's `DoNotDelete` tag.

## 3. First-run persistent provisioning

### Preparation

- [ ] Ensure no resource group matches both:

  ```text
  FixtureId=azure-resource-lookup-missing-tag
  FixtureVersion=1
  ```

### Execution

- [ ] From `tests/`, run:

  ```bash
  npm run test:vally -- --plugin azure-skills --skill azure-resource-lookup
  ```

### Verification

- [ ] Confirm exactly one new resource group was created.
- [ ] Confirm its name matches:

  ```text
  rg-fixture-resource-lookup-missing-tag-1-<suffix>
  ```

- [ ] Confirm it has `FixtureId=azure-resource-lookup-missing-tag`.
- [ ] Confirm it has `FixtureVersion=1`.
- [ ] Confirm it has `DoNotDelete=True`.
- [ ] Confirm it has `Completed=True`.
- [ ] Confirm it does not have a `DeleteAfter` tag.
- [ ] Confirm `Completed=False` was used during provisioning.
- [ ] Confirm `Completed=True` was set only after all Bicep deployments succeeded.
- [ ] Confirm exactly three storage accounts were created.
- [ ] Confirm two storage accounts have `foo=true`.
- [ ] Confirm one storage account does not have the `foo` tag.
- [ ] Confirm `postProvision.ts` ran.
- [ ] Confirm the post-provision output appeared in the test logs.
- [ ] Confirm the resource-group name was injected into the test prompt.
- [ ] Confirm the test reported the untagged storage account.
- [ ] Confirm `postTest.ts` ran after the test.
- [ ] Confirm the persistent resource group was not deleted.

## 4. Persistent fixture reuse

### Execution

- [ ] Keep the completed version `1` resource group.
- [ ] Run the same Vally command again:

  ```bash
  cd tests
  npm run test:vally -- --plugin azure-skills --skill azure-resource-lookup
  ```

### Verification

- [ ] Confirm no additional resource group was created.
- [ ] Confirm no new Bicep deployment was started.
- [ ] Confirm the existing resource-group name was returned.
- [ ] Confirm the existing resource-group name was injected into the prompt.
- [ ] Confirm the existing resources were usable.
- [ ] Confirm `postProvision.ts` ran against the reused fixture.
- [ ] Confirm `postTest.ts` ran after the test.
- [ ] Confirm the reused resource group remained after the run.

## 5. Incomplete fixture detection

### `Completed=False`

- [ ] Change the existing fixture resource group's tag to:

  ```text
  Completed=False
  ```

- [ ] Run the fixture-backed eval.
- [ ] Confirm provisioning failed before the agent test started.
- [ ] Confirm the error identified the incomplete resource group.
- [ ] Confirm no replacement resource group was created.
- [ ] Restore `Completed=True`.

### Missing `Completed` tag

- [ ] Remove the existing fixture resource group's `Completed` tag.
- [ ] Run the fixture-backed eval.
- [ ] Confirm provisioning failed before the agent test started.
- [ ] Confirm the error identified the incomplete resource group.
- [ ] Confirm no replacement resource group was created.
- [ ] Restore `Completed=True`.

## 6. Duplicate fixture detection

### Preparation

- [ ] Create a temporary second resource group with:

  ```text
  FixtureId=azure-resource-lookup-missing-tag
  FixtureVersion=1
  Completed=True
  DoNotDelete=True
  ```

### Execution and verification

- [ ] Run the fixture-backed eval.
- [ ] Confirm provisioning failed because multiple completed groups matched.
- [ ] Confirm the error listed both resource groups.
- [ ] Confirm neither resource group was modified.
- [ ] Confirm neither resource group was deleted.

### Cleanup

- [ ] Delete only the temporary duplicate resource group.
- [ ] Confirm one valid completed fixture remains.

## 7. Stale-version behavior

### Preparation

- [ ] Create or retag a temporary resource group with:

  ```text
  FixtureId=azure-resource-lookup-missing-tag
  FixtureVersion=0
  Completed=True
  ```

- [ ] Ensure no version `1` resource group exists.

### Execution and verification

- [ ] Run the fixture-backed eval.
- [ ] Confirm the version `0` resource group was ignored.
- [ ] Confirm a new version `1` fixture was provisioned.
- [ ] Confirm the version `0` resource group was not reused.
- [ ] Confirm the version `0` resource group was not modified.

### Cleanup

- [ ] Delete the temporary version `0` resource group.

## 8. Deployment failure behavior

### Preparation

- [ ] Use a temporary manifest or Bicep copy for this scenario.
- [ ] Introduce a deterministic Bicep validation or deployment failure.

### Execution and verification

- [ ] Run the fixture provisioning flow.
- [ ] Confirm the command exited nonzero.
- [ ] Confirm the resource group remained marked `Completed=False`.
- [ ] Confirm `postProvision.ts` did not run.
- [ ] Confirm the agent test did not start.
- [ ] Run the provisioning flow again without cleaning the incomplete group.
- [ ] Confirm the next run detected the incomplete fixture.
- [ ] Confirm the next run did not treat the incomplete fixture as reusable.

### Restoration

- [ ] Restore the original `missing-tag.bicep`.
- [ ] Delete the intentionally incomplete test resource group.

## 9. Hook failure behavior

### Post-provision failure

- [ ] Use a temporary copy of `postProvision.ts`.
- [ ] Make the temporary post-provision hook exit nonzero.
- [ ] Run the fixture provisioning flow.
- [ ] Confirm the fixture run failed before the agent test.
- [ ] Confirm the hook received:

  ```text
  --resource-groups <discovered-or-created-group>
  ```

### Post-test failure

- [ ] Use a temporary copy of `postTest.ts`.
- [ ] Make the temporary post-test hook exit nonzero.
- [ ] Run the fixture-backed eval.
- [ ] Confirm the post-test failure was surfaced.
- [ ] Confirm the hook received:

  ```text
  --resource-groups <discovered-or-created-group>
  ```

### Restoration

- [ ] Restore the original `postProvision.ts`.
- [ ] Restore the original `postTest.ts`.
- [ ] Remove temporary hook files.

## 10. Final cleanup and confirmation

- [ ] Delete resource groups created specifically for failure testing.
- [ ] Delete resource groups created specifically for duplicate testing.
- [ ] Delete resource groups created specifically for stale-version testing.
- [ ] Decide whether to retain the primary persistent fixture for future evals.
- [ ] If retaining it, confirm it has `Completed=True`.
- [ ] If retaining it, confirm it has `DoNotDelete=True`.
- [ ] Run one final successful fixture-backed eval.
- [ ] Confirm the final run reused the retained fixture.
- [ ] Search for all resource groups with the fixture ID.
- [ ] Confirm no unexpected resource groups remain.
- [ ] Save the successful test output as validation evidence.
- [ ] Save the final resource-group and tag listing as validation evidence.
