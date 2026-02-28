/**
 * Integration Tests for azure-cloud-migrate
 *
 * Tests skill behavior with a real Copilot agent session.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */
 
import {
  shouldSkipIntegrationTests,
  getIntegrationSkipReason,
  useAgentRunner,
  isSkillInvoked
} from "../utils/agent-runner";
import { cloneRepo } from "../utils/git-clone";
import { expectFiles } from "../utils/evaluate";
 
const SKILL_NAME = "azure-cloud-migrate";
const FACE_BLUR_REPO = "https://github.com/aws-samples/serverless-face-blur-service.git";
const WEBAPP_REPO = "https://github.com/aws-samples/lambda-refarch-webapp.git";
 
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();
 
if (skipTests && skipReason) {
  console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}
 
const describeIntegration = skipTests ? describe.skip : describe;
const migrationTestTimeoutMs = 2700000;
const FOLLOW_UP_PROMPT = ["Go with recommended options and test it locally."];
 
describeIntegration(`${SKILL_NAME} - Integration Tests`, () => {
  const agent = useAgentRunner();
 
  describe("brownfield-lambda", () => {
    test("migrates serverless-face-blur-service Lambda to Azure", async () => {
      let workspacePath: string | undefined;
 
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({
            repoUrl: FACE_BLUR_REPO,
            targetDir: workspace,
            depth: 1,
          });
        },
        prompt: "Migrate this Lambda to Azure. "+
        "Use the eastus2 region. " +
        "Use my current subscription. ",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
 
      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);
 
      // Verify migrated files exist in the -azure directory
      expect(workspacePath).toBeDefined();
      const migratedPath = workspacePath + "-azure";
      expectFiles(migratedPath, [
        /src\/app\.js$/,
        /src\/detectFaces\.js$/,
        /src\/blurFaces\.js$/,
        /migration-status\.md$/,
        /migration-assessment-report\.md$/
      ], []);
    }, migrationTestTimeoutMs);
  });
 
  describe("brownfield-lambda-webapp", () => {
    test("migrates lambda-refarch-webapp to Azure", async () => {
      let workspacePath: string | undefined;
 
      const agentMetadata = await agent.run({
        setup: async (workspace: string) => {
          workspacePath = workspace;
          await cloneRepo({
            repoUrl: WEBAPP_REPO,
            targetDir: workspace,
            depth: 1,
          });
        },
        prompt: "Migrate this Lambda to Azure. "+
        "Use the eastus2 region. " +
        "Use my current subscription. ",
        nonInteractive: true,
        followUp: FOLLOW_UP_PROMPT,
      });
 
      const isSkillUsed = isSkillInvoked(agentMetadata, SKILL_NAME);
      expect(isSkillUsed).toBe(true);
 
      // Verify migrated files exist in the -azure directory
      expect(workspacePath).toBeDefined();
      const migratedPath = workspacePath + "-azure";
      expectFiles(migratedPath, [
        /migration-status\.md$/,
        /migration-assessment-report\.md$/
      ], []);
    }, migrationTestTimeoutMs);
  });
});