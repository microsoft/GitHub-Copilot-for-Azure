/**
 * Integration Tests for azure-compute
 *
 * Tests skill behavior with a real Copilot agent session.
 * Runs prompts multiple times to measure skill invocation rate.
 *
 * Prerequisites:
 * 1. npm install -g @github/copilot-cli
 * 2. Run `copilot` and authenticate
 */

import {
    useAgentRunner,
    isSkillInvoked,
    shouldSkipIntegrationTests,
    getIntegrationSkipReason,
} from "../utils/agent-runner";
import * as fs from "fs";

const SKILL_NAME = "azure-compute";
const RUNS_PER_PROMPT = 5;
const EXPECTED_INVOCATION_RATE = 0.6; // 60% minimum invocation rate

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

if (skipTests && skipReason) {
    console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
    const agent = useAgentRunner();

    describe("skill-invocation", () => {
        test("invokes azure-compute skill for VM recommendation prompt", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Which Azure VM size should I use for a web server handling 500 concurrent users?",
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
                `${SKILL_NAME} invocation rate for VM recommendation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `${SKILL_NAME} invocation rate for VM recommendation prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });

        test("invokes azure-compute skill for GPU VM prompt", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "I need a GPU VM on Azure for training a deep learning model. What do you recommend?",
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
                `${SKILL_NAME} invocation rate for GPU VM prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `${SKILL_NAME} invocation rate for GPU VM prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });

        test("invokes azure-compute skill for VMSS autoscale prompt", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Should I use a VM Scale Set with autoscaling for my API backend on Azure?",
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
                `${SKILL_NAME} invocation rate for VMSS autoscale prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `${SKILL_NAME} invocation rate for VMSS autoscale prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });

        test("invokes azure-compute skill for VM pricing prompt", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "How much does a Standard_D4s_v5 Azure VM cost per hour in East US?",
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
                `${SKILL_NAME} invocation rate for VM pricing prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `${SKILL_NAME} invocation rate for VM pricing prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });

        test("invokes azure-compute skill for VM family comparison prompt", async () => {
            let successCount = 0;

            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Compare Azure VM families for a memory-optimized database workload",
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
                `${SKILL_NAME} invocation rate for VM family comparison prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})`
            );
            fs.appendFileSync(
                `./result-${SKILL_NAME}.txt`,
                `${SKILL_NAME} invocation rate for VM family comparison prompt: ${(invocationRate * 100).toFixed(1)}% (${successCount}/${RUNS_PER_PROMPT})\n`
            );
            expect(invocationRate).toBeGreaterThanOrEqual(EXPECTED_INVOCATION_RATE);
        });
    });
});
