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
    shouldSkipIntegrationTests,
    getIntegrationSkipReason,
} from "../utils/agent-runner";
import { softCheckSkill } from "../utils/evaluate";

const SKILL_NAME = "azure-compute";
const RUNS_PER_PROMPT = 5;

// Check if integration tests should be skipped at module level
const skipTests = shouldSkipIntegrationTests();
const skipReason = getIntegrationSkipReason();

// Log skip reason if skipping
if (skipTests && skipReason) {
    console.log(`⏭️  Skipping integration tests: ${skipReason}`);
}

const describeIntegration = skipTests ? describe.skip : describe;

describeIntegration(`${SKILL_NAME}_ - Integration Tests`, () => {
    const agent = useAgentRunner();

    describe("skill-invocation", () => {
        test("invokes azure-compute skill for VM recommendation prompt", async () => {
            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Which Azure VM size should I use for a web server handling 500 concurrent users?",
                    });

                    softCheckSkill(agentMetadata, SKILL_NAME);
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
        });

        test("invokes azure-compute skill for GPU VM prompt", async () => {
            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "I need a GPU VM on Azure for training a deep learning model. What do you recommend?",
                    });

                    softCheckSkill(agentMetadata, SKILL_NAME);
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
        });

        test("invokes azure-compute skill for VMSS autoscale prompt", async () => {
            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Should I use a VM Scale Set with autoscaling for my API backend on Azure?",
                    });

                    softCheckSkill(agentMetadata, SKILL_NAME);
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
        });

        test("invokes azure-compute skill for VM pricing prompt", async () => {
            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "How much does a Standard_D4s_v5 Azure VM cost per hour in East US?",
                    });

                    softCheckSkill(agentMetadata, SKILL_NAME);
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
        });

        test("invokes azure-compute skill for VM family comparison prompt", async () => {
            for (let i = 0; i < RUNS_PER_PROMPT; i++) {
                try {
                    const agentMetadata = await agent.run({
                        prompt:
                            "Compare Azure VM families for a memory-optimized database workload",
                    });

                    softCheckSkill(agentMetadata, SKILL_NAME);
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
        });
    });
});
