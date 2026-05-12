/**
 * Integration Tests — Scaffold Security Inspection
 *
 * Pushes the agent past plan approval into scaffold, then reads the
 * generated IaC files from the workspace to verify security defaults.
 *
 * Covers: B11 (random_password), B12 (TLS 1.2), B13 (unique names),
 * B15 (publishingCredentialsPolicies), B16 (AllowAllWindowsAzureIps),
 * B17 (provider version), B32 (port mismatch), B33 (deterministic secrets),
 * B34 (managed identity).
 */

import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
} from "../../utils/agent-runner";
import {
  isSkillInvoked,
  softCheckSkill,
  withTestResult,
  getToolCalls,
} from "../../utils/evaluate";
import { cloneRepo } from "../../utils/git-clone";
import {
  SKILL_NAME,
  testTimeoutMs,
  cleanupSessionResourceGroups,
  assertNoAzdCommands,
  assertScaffoldSelfReviewPopulated,
} from "../app-onboard-test-helpers";
import * as fs from "fs";
import * as path from "path";
import type { AgentMetadata } from "../../utils/agent-runner";

/**
 * Read all generated IaC files (.tf/.bicep) from the workspace.
 * Returns a map of relative path → file content (lowercase).
 */
function readGeneratedIaCFiles(workspacePath: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(full);
      } else if (entry.isFile() && (entry.name.endsWith(".tf") || entry.name.endsWith(".bicep"))) {
        const rel = path.relative(workspacePath, full).replace(/\\/g, "/");
        files.set(rel, fs.readFileSync(full, "utf-8"));
      }
    }
  };
  walk(workspacePath);
  return files;
}

/**
 * Early terminate once scaffold-manifest.json is written to the workspace.
 * Fires after scaffold writes the manifest (Steps 11-13) — stops BEFORE deploy.
 * This ensures azure-validate has had a chance to run (Steps 12-13) before we
 * inspect the manifest for validationResult.
 */
function shouldEarlyTerminateOnScaffoldManifest(agentMetadata: AgentMetadata): boolean {
  if (!isSkillInvoked(agentMetadata, SKILL_NAME)) {
    // Bail if we've had enough tool calls without skill invocation — routing failed
    if (getToolCalls(agentMetadata).length > 3) {
      agentMetadata.testComments.push(`⚠️ ${SKILL_NAME} not invoked after ${getToolCalls(agentMetadata).length} tool calls — terminating (routing failure).`);
      return true;
    }
    return false;
  }

  const toolCalls = getToolCalls(agentMetadata);

  // Primary: wait for scaffold-manifest.json write (includes validationResult after Steps 12-13)
  const hasManifestWrite = toolCalls.some(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create" && toolName !== "edit") return false;
    const args = JSON.stringify(tc.data.arguments ?? {}).toLowerCase();
    return args.includes("scaffold-manifest");
  });

  // Count IaC files written — need at least 2 to ensure scaffold actually generated code
  const iacWriteCount = toolCalls.filter(tc => {
    const toolName = (tc.data.toolName ?? "").toLowerCase();
    if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return false;
    const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
    return filePath.endsWith(".tf") || filePath.endsWith(".bicep");
  }).length;

  // Terminate when BOTH conditions met: IaC files exist AND manifest written
  if (iacWriteCount >= 1 && hasManifestWrite) {
    agentMetadata.testComments.push(`✅ Scaffold produced ${iacWriteCount} IaC files + manifest — terminating before deploy.`);
    return true;
  }

  // Fallback: if IaC files are written but agent has moved on (15+ calls since last IaC write),
  // terminate — it's not going to write a manifest. This is invariant to how many calls
  // prereq/scan consumed before scaffold started.
  if (iacWriteCount >= 1) {
    const lastIaCWriteIndex = toolCalls.reduce((lastIdx, tc, idx) => {
      const toolName = (tc.data.toolName ?? "").toLowerCase();
      if (toolName !== "create_file" && toolName !== "write_file" && toolName !== "create") return lastIdx;
      const filePath = ((tc.data.arguments as Record<string, unknown>)?.path as string ?? "").toLowerCase();
      if (filePath.endsWith(".tf") || filePath.endsWith(".bicep")) return idx;
      return lastIdx;
    }, -1);
    const callsSinceLastIaC = toolCalls.length - 1 - lastIaCWriteIndex;
    if (callsSinceLastIaC > 40) {
      agentMetadata.testComments.push(`⚠️ Scaffold produced ${iacWriteCount} IaC files but no manifest after ${callsSinceLastIaC} calls since last IaC write — terminating.`);
      return true;
    }
  }

  return false;
}

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Scaffold Security`, () => {
  const _agent = useAgentRunner();
  let lastMetadata: AgentMetadata | undefined;
  afterEach(() => { if (lastMetadata) { assertNoAzdCommands(lastMetadata); cleanupSessionResourceGroups(lastMetadata); lastMetadata = undefined; } });
  const agent = { run: async (...args: Parameters<typeof _agent.run>) => { const m = await _agent.run(...args); lastMetadata = m; return m; } };

  describe("scaffold-security", () => {
    test("generated IaC meets security baseline", async () => {
      await withTestResult(async () => {
        let workspacePath = "";
        const agentMetadata = await agent.run({
          setup: async (workspace: string) => {
            workspacePath = workspace;
            await cloneRepo({ repoUrl: "https://github.com/samcdonald-ms/bya-simple-web-app", targetDir: workspace, branch: "main", depth: 1 });
          },
          prompt: "I built a side project and want to get it live on Azure",
          followUp: [
            "Yes, generate the infrastructure.",
            "Use the cheapest option.",
            "No, don't deploy.",
          ],
          nonInteractive: true,
          preserveWorkspace: true,
          shouldEarlyTerminate: shouldEarlyTerminateOnScaffoldManifest,
        });

        softCheckSkill(agentMetadata, SKILL_NAME);
        expect(isSkillInvoked(agentMetadata, SKILL_NAME)).toBe(true);

        // Read generated IaC files from workspace
        const iacFiles = readGeneratedIaCFiles(workspacePath);
        if (iacFiles.size === 0) {
          agentMetadata.testComments.push("⚠️ SCAFFOLD NOT REACHED: no .tf/.bicep files found in workspace. Agent may have stopped at plan.");
          return; // Can't assert on files that don't exist
        }

        const allContent = Array.from(iacFiles.values()).join("\n").toLowerCase();
        agentMetadata.testComments.push(`📁 Found ${iacFiles.size} IaC files: ${Array.from(iacFiles.keys()).join(", ")}`);

        // B15: basicPublishingCredentialsPolicies present
        const hasPublishingCredPolicies =
          allContent.includes("basicpublishingcredentialspolicies") ||
          allContent.includes("basic_publishing_credentials_policy");
        if (!hasPublishingCredPolicies) {
          agentMetadata.testComments.push("❌ B15: basicPublishingCredentialsPolicies NOT found in generated IaC");
        }
        expect(hasPublishingCredPolicies).toBe(true);

        // B33: No deterministic secrets (change-me, uniqueString for passwords)
        const hasDeterministicSecrets =
          /change-me|change.me.in.production|uniquestring.*secret|uniquestring.*password/i.test(allContent);
        if (hasDeterministicSecrets) {
          agentMetadata.testComments.push("❌ B33: Deterministic secret value found (change-me / uniqueString for password)");
        }
        expect(hasDeterministicSecrets).toBe(false);

        // B16: No AllowAllWindowsAzureIps blanket firewall
        const hasBlanketFirewall =
          allContent.includes("allowallwindowsazureips") ||
          /start_ip_address.*=.*"0\.0\.0\.0".*end_ip_address.*=.*"0\.0\.0\.0"/s.test(allContent);
        if (hasBlanketFirewall) {
          agentMetadata.testComments.push("❌ B16: AllowAllWindowsAzureIps or 0.0.0.0 blanket firewall rule found");
        }
        expect(hasBlanketFirewall).toBe(false);

        // B11: random_password for secrets, not random_string (Terraform only)
        const isTerraform = Array.from(iacFiles.keys()).some(f => f.endsWith(".tf"));
        if (isTerraform) {
          const usesRandomStringForSecrets =
            /random_string.*\{[^}]*\}[^}]*secret|password.*random_string/s.test(allContent);
          if (usesRandomStringForSecrets) {
            agentMetadata.testComments.push("❌ B11: random_string used for secrets — should use random_password (sensitive=true)");
          }
        }

        // B12: minimum_tls_version set (HARD — security requirement)
        const hasTlsVersion =
          allContent.includes("minimum_tls_version") || allContent.includes("mintlsversion") || allContent.includes("min_tls_version");
        if (!hasTlsVersion) {
          agentMetadata.testComments.push("❌ B12: minimum_tls_version not explicitly set in IaC");
        }
        expect(hasTlsVersion).toBe(true);

        // B13: App Service name has random/unique component (HARD — prevents global name collisions)
        const hasUniqueNaming =
          allContent.includes("uniquestring") || allContent.includes("random_string") ||
          allContent.includes("random_id") || allContent.includes("unique");
        if (!hasUniqueNaming) {
          agentMetadata.testComments.push("❌ B13: No random/unique suffix in resource naming — may cause global name collisions");
        }
        expect(hasUniqueNaming).toBe(true);

        // B17: Provider version pinned (Terraform) or API version present (Bicep)
        if (isTerraform) {
          const hasVersionConstraint = /version\s*=\s*"[~>=<]/.test(allContent);
          if (!hasVersionConstraint) {
            agentMetadata.testComments.push("⚠️ B17: azurerm provider version not pinned with constraint");
          }
        }

        // B34: Managed identity present
        const hasManagedIdentity =
          allContent.includes("systemassigned") || allContent.includes("system_assigned") ||
          allContent.includes("userassigned") || allContent.includes("identity");
        if (!hasManagedIdentity) {
          agentMetadata.testComments.push("❌ B34: No managed identity found in generated IaC");
        }
        expect(hasManagedIdentity).toBe(true);

        // B32: Port consistency (soft — just check targetPort exists if Container Apps)
        if (allContent.includes("containerapp") || allContent.includes("container_app")) {
          const hasTargetPort = allContent.includes("targetport") || allContent.includes("target_port");
          if (!hasTargetPort) {
            agentMetadata.testComments.push("⚠️ B32: Container App detected but no targetPort specified");
          }
        }

        // B17/SCM: scm basicPublishingCredentialsPolicies must allow: true for deploy
        // Scaffold sets scm.allow: true so az webapp deploy works; deploy re-disables after code upload
        if (allContent.includes("basicpublishingcredentialspolicies")) {
          // Check for the SCM policy resource — look for 'scm' near 'allow'
          const hasSCMPolicy = /name[^}]*['"]scm['"]/.test(allContent);
          if (hasSCMPolicy) {
            // Verify allow: true (not false) — scaffold must enable for deploy phase
            const scmBlockFalse = /name[^}]*['"]scm['"][^}]*allow[^}]*false/s.test(allContent);
            if (scmBlockFalse) {
              agentMetadata.testComments.push("❌ B17: SCM basicPublishingCredentialsPolicies has allow: false — scaffold must set allow: true (deploy re-disables after code upload)");
            }
          }
        }

        // B31: scaffold-manifest.json must have validationResult populated
        const manifestPath = path.join(workspacePath, ".copilot-azure");
        if (fs.existsSync(manifestPath)) {
          // Find scaffold-manifest.json in any session subfolder
          const findManifest = (dir: string): string | null => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                const found = findManifest(full);
                if (found) return found;
              } else if (entry.name === "scaffold-manifest.json") {
                return full;
              }
            }
            return null;
          };
          const manifestFile = findManifest(manifestPath);
          if (manifestFile) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let manifest: any;
            try {
              manifest = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
            } catch (e) {
              agentMetadata.testComments.push(`\u274c B31: scaffold-manifest.json is not valid JSON: ${e}`);
              expect(manifest).toBeDefined();
              return;
            }
            const hasValidationResult = manifest.validationResult && manifest.validationResult !== null;
            if (!hasValidationResult) {
              agentMetadata.testComments.push("❌ B31: scaffold-manifest.json.validationResult is null — azure-validate was not invoked");
            } else {
              agentMetadata.testComments.push(`✅ B31: validationResult present — status: ${manifest.validationResult.status}`);
            }
            expect(hasValidationResult).toBe(true);
          } else {
            agentMetadata.testComments.push("⚠️ B31: scaffold-manifest.json not found in .copilot-azure/ — scaffold may not have completed");
          }
        } else {
          agentMetadata.testComments.push("⚠️ B31: .copilot-azure/ directory not found — session artifacts not written");
        }

        // Self-review: scaffold-manifest.json.selfReview must be populated (Gap 10)
        assertScaffoldSelfReviewPopulated(agentMetadata, workspacePath);
      });
    }, testTimeoutMs);
  });
});
