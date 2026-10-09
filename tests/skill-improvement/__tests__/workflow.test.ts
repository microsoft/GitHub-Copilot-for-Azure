import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const workflow = fs.readFileSync(
  fileURLToPath(new URL("../../../.github/workflows/skill-improvement.yml", import.meta.url)),
  "utf8"
);

describe("skill improvement workflow", () => {
  test("uses the dedicated evaluation environment", () => {
    expect(workflow).toContain("environment: skill-improvement-evals");
    expect(workflow).not.toContain("environment: cideploytest");
  });

  test("allows setup and cleanup headroom beyond the engine deadline", () => {
    expect(workflow).toContain("timeout-minutes: 420");
  });

  test("serializes runs sharing the same run specification", () => {
    expect(workflow).toContain(
      "group: skill-improvement-${{ inputs.run-spec }}"
    );
    expect(workflow).not.toContain(
      "group: skill-improvement-${{ inputs.run-spec }}-${{ inputs.baseline-ref }}"
    );
    expect(workflow).toContain("cancel-in-progress: false");
  });

  test("always publishes the concise summary and retains the GitHub artifact", () => {
    expect(workflow).toContain("cat \"$RUN_OUTPUT/report-summary.md\" >> \"$GITHUB_STEP_SUMMARY\"");
    expect(workflow).toContain("retention-days: 30");
    expect(workflow).toContain("issueMode: \"never\"");
  });

  test("publishes a best-effort-redacted Azure Storage report with OIDC login", () => {
    const dispatchConfiguration = workflow.slice(
      workflow.indexOf("on:"),
      workflow.indexOf("concurrency:")
    );
    expect(workflow).toContain("- name: Publish report to Azure Storage");
    expect(workflow).toContain("if: always() && vars.REPORT_STORAGE_ACCOUNT != ''");
    expect(workflow).toContain("STORAGE_ACCOUNT: ${{ vars.REPORT_STORAGE_ACCOUNT }}");
    expect(workflow).toContain(
      "STORAGE_CONTAINER: ${{ vars.SKILL_IMPROVEMENT_STORAGE_CONTAINER }}"
    );
    expect(dispatchConfiguration).not.toMatch(/storage|container|prefix/i);
    expect(workflow).toContain(
      "SKILL_IMPROVEMENT_STORAGE_CONTAINER must be configured when REPORT_STORAGE_ACCOUNT is set."
    );
    expect(workflow).toContain('if [[ -z "$STORAGE_CONTAINER" ]]');
    expect(workflow).toContain('--destination "$STORAGE_CONTAINER"');
    expect(workflow).not.toContain('--destination "skill-improvement-runs"');
    expect(workflow).toContain('PREFIX="${DATE}/${GITHUB_RUN_ID}/${SKILL}/"');
    expect(workflow).toContain("redact-output.ts");
    expect(workflow).toContain("az storage blob upload-batch");
    expect(workflow).toContain("--auth-mode login");
    expect(workflow).not.toContain("- name: Add Azure Storage report location");
    expect(workflow).not.toContain("id: publish-report");
    expect(workflow).not.toContain("steps.publish-report.");
    expect(workflow).not.toContain("issue-summary.md");
    const publishStep = workflow.slice(
      workflow.indexOf("- name: Publish report to Azure Storage"),
      workflow.indexOf("- name: Create result issue")
    );
    expect(publishStep).not.toContain("continue-on-error");
    expect(publishStep.indexOf('if [[ -z "$STORAGE_CONTAINER" ]]')).toBeLessThan(
      publishStep.indexOf("az storage blob upload-batch")
    );
    expect(publishStep).not.toContain("az storage container create");
    expect(publishStep).not.toContain("az storage container set-permission");
    expect(publishStep).toContain("--only-show-errors");
    expect(publishStep).toContain("--output none");
    expect(publishStep).not.toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).not.toMatch(/account-key|connection-string|sas-token/i);
    expect(workflow).not.toMatch(/--public-access (blob|container)/i);
  });

  test("uses artifact-relative patches and does not require a result issue for draft PRs", () => {
    expect(workflow).toContain(
      'git apply --index "$RUN_OUTPUT/${{ steps.metadata.outputs.patch }}"'
    );
    expect(workflow).toContain('cp "$RUN_OUTPUT/report-summary.md" "$issue_body"');
    expect(workflow).toContain('if [[ -n "${{ steps.issue.outputs.url }}" ]]');
    expect(workflow).toContain("--body-file \"$body_file\"");
  });

  test("always stops managed evaluation resources after execution", () => {
    expect(workflow).toContain(
      "AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}"
    );
    expect(workflow).toContain(
      "AZURE_EVALS_SUBSCRIPTION_ID: ${{ vars.AZURE_EVALS_SUBSCRIPTION_ID }}"
    );
    expect(workflow).toContain(
      "AZURE_EVALS_RESOURCE_GROUP: ${{ vars.AZURE_EVALS_RESOURCE_GROUP }}"
    );
    expect(workflow).toContain(
      "- name: Ensure managed evaluation resources are stopped"
    );
    expect(workflow).toContain(
      "npm run skill-improvement -- cleanup-resources"
    );
  });
});
