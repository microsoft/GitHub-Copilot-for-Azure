/**
 * Integration Tests for azure-compute/recommender sub-skill
 *
 * Tests that the recommender sub-skill is invoked by the agent
 * for VM recommendation, VMSS, and pricing prompts.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
    useAgentRunner,
    isSkillInvoked,
    doesAssistantMessageIncludeKeyword,
    shouldSkipIntegrationTests,
    getIntegrationSkipReason,
} from "../../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-compute";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6;

const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
    console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}/recommender_ - Integration Tests`, () => {
    const agent = useAgentRunner();

    describe("vm-recommendation", () => {
        test("recommends VM size for a web workload", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Recommend an Azure VM size for a Node.js web server with 4 vCPUs and 16 GB RAM",
                    });

                    if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
                        successCount++;
                    }
                } catch (e: unknown) {
                    if (
                        e instanceof Error &&
                        e.message?.includes("Failed to load @github/copilot-sdk")
                    ) {
                        console.log("⏭️  SDK not loadable, skipping test");
                        return;
                    }
                    throw e;
                }
            }

            const invocationRate = successCount / RUNS_PER_PROMPT;
            console.log(
                `recommender invocation rate for web workload: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `recommender invocation rate for web workload: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });

        test("recommends GPU VM for ML training", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Which Azure GPU VM should I use for training a large language model?",
                    });

                    if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
                        successCount++;
                    }
                } catch (e: unknown) {
                    if (
                        e instanceof Error &&
                        e.message?.includes("Failed to load @github/copilot-sdk")
                    ) {
                        console.log("⏭️  SDK not loadable, skipping test");
                        return;
                    }
                    throw e;
                }
            }

            const invocationRate = successCount / RUNS_PER_PROMPT;
            console.log(
                `recommender invocation rate for GPU ML prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `recommender invocation rate for GPU ML prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });
    });

    describe("vmss-recommendation", () => {
        test("recommends VMSS for autoscaling scenario", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Should I use a VM Scale Set for my API that needs to autoscale based on CPU usage?",
                    });

                    if (isSkillInvoked(agentMetadata, SKILL_NAME)) {
                        successCount++;
                    }
                } catch (e: unknown) {
                    if (
                        e instanceof Error &&
                        e.message?.includes("Failed to load @github/copilot-sdk")
                    ) {
                        console.log("⏭️  SDK not loadable, skipping test");
                        return;
                    }
                    throw e;
                }
            }

            const invocationRate = successCount / RUNS_PER_PROMPT;
            console.log(
                `recommender invocation rate for VMSS autoscale prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `recommender invocation rate for VMSS autoscale prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });
    });
});
