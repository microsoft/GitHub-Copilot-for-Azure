import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const workflow = fs.readFileSync(
  fileURLToPath(new URL("../../../.github/workflows/skill-improvement.yml", import.meta.url)),
  "utf8"
);

describe("skill improvement workflow", () => {
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
    expect(dispatchConfiguration).not.toMatch(/storage|container|prefix/i);
    expect(workflow).not.toContain("SKILL_IMPROVEMENT_STORAGE_CONTAINER");
    expect(workflow).not.toContain("STORAGE_CONTAINER:");
    expect(workflow).toContain('--destination "skill-improvement-runs"');
    expect(workflow).toContain('PREFIX="${DATE}/${GITHUB_RUN_ID}/${SKILL}/"');
    expect(workflow).toContain("redact-output.ts");
    expect(workflow).toContain("az storage blob upload-batch");
    expect(workflow).toContain("--auth-mode login");
    expect(workflow).not.toContain("- name: Add Azure Storage report location");
    expect(workflow).not.toContain("id: publish-report");
    expect(workflow).not.toContain("steps.publish-report.");
    const publishStep = workflow.slice(
      workflow.indexOf("- name: Publish report to Azure Storage"),
      workflow.indexOf("- name: Create result issue")
    );
    expect(publishStep).not.toContain("continue-on-error");
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
    expect(workflow).toContain('if [[ -n "${{ steps.issue.outputs.url }}" ]]');
    expect(workflow).toContain("--body-file \"$body_file\"");
  });
});
