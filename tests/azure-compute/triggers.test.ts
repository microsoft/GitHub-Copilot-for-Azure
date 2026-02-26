/**
 * Trigger Tests for azure-compute
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Covers both the parent azure-compute skill and the recommender sub-skill domain.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-compute";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
    let triggerMatcher: TriggerMatcher;
    let skill: LoadedSkill;

    beforeAll(async () => {
        skill = await loadSkill(SKILL_NAME);
        triggerMatcher = new TriggerMatcher(skill);
    });

    describe("Should Trigger - VM Recommendations", () => {
        const vmRecommendationPrompts: string[] = [
            "Which Azure VM should I use for my web server?",
            "Recommend a VM size for my database workload",
            "What is the best Azure VM for machine learning training?",
            "Compare Azure VM families for a batch processing job",
            "Recommend an Azure GPU VM for deep learning compute workloads",
            "What is the cheapest Azure VM size for a dev/test environment?",
            "Help me choose the best Azure VM family between D-series and E-series",
            "Which VM family is best for a memory-intensive workload?",
            "Recommend a burstable VM for my lightweight web app",
            "What Azure VM should I pick for HPC simulation?",
        ];

        test.each(vmRecommendationPrompts)(
            'triggers on: "%s"',
            (prompt) => {
                const result = triggerMatcher.shouldTrigger(prompt);
                expect(result.triggered).toBe(true);
                expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
            }
        );
    });

    describe("Should Trigger - VMSS / Scale Sets", () => {
        const vmssPrompts: string[] = [
            "Should I use a VM Scale Set for my Azure web tier?",
            "How do I autoscale VMs behind a load balancer on Azure?",
            "Recommend a VMSS configuration for horizontal scaling",
            "What's the difference between VMSS Flexible and Uniform orchestration?",
            "Should I use a single VM or a scale set for my API backend?",
            "How do I set up autoscale for Azure Virtual Machine Scale Sets?",
            "Recommend VM sizes for a scale set with load balancing",
        ];

        test.each(vmssPrompts)(
            'triggers on VMSS prompt: "%s"',
            (prompt) => {
                const result = triggerMatcher.shouldTrigger(prompt);
                expect(result.triggered).toBe(true);
                expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
            }
        );
    });

    describe("Should Trigger - Pricing & Cost", () => {
        const pricingPrompts: string[] = [
            "How much does an Azure VM cost per hour?",
            "Give me a cost estimate for a D4s v5 VM in East US",
            "Compare Azure VM pricing tiers for compute-optimized sizes",
            "What is the cheapest Azure VM for running a small website?",
            "Estimate monthly cost for an Azure VM scale set with autoscale",
        ];

        test.each(pricingPrompts)(
            'triggers on pricing prompt: "%s"',
            (prompt) => {
                const result = triggerMatcher.shouldTrigger(prompt);
                expect(result.triggered).toBe(true);
                expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
            }
        );
    });

    describe("Should NOT Trigger", () => {
        const shouldNotTriggerPrompts: string[] = [
            "What is the weather today?",
            "Help me write a poem",
            "Explain quantum computing",
            "Help me with AWS EC2 instances", // Wrong cloud provider
            "Configure my PostgreSQL database", // Different service, no azure keyword
            "How do I write a Python web scraper?", // Unrelated to Azure
            "Set up a Kubernetes cluster with Helm", // AKS, not VMs
            "Create a serverless function with AWS Lambda", // Wrong cloud provider
            "What is Docker Compose and how does it work?", // Unrelated
            "Help me configure nginx as a reverse proxy", // Unrelated
        ];

        test.each(shouldNotTriggerPrompts)(
            'does not trigger on: "%s"',
            (prompt) => {
                const result = triggerMatcher.shouldTrigger(prompt);
                expect(result.triggered).toBe(false);
            }
        );
    });

    describe("Trigger Keywords Snapshot", () => {
        test("skill keywords match snapshot", () => {
            expect(triggerMatcher.getKeywords()).toMatchSnapshot();
        });

        test("skill description triggers match snapshot", () => {
            expect({
                name: skill.metadata.name,
                description: skill.metadata.description,
                extractedKeywords: triggerMatcher.getKeywords(),
            }).toMatchSnapshot();
        });
    });

    describe("Edge Cases", () => {
        test("handles empty prompt", () => {
            const result = triggerMatcher.shouldTrigger("");
            expect(result.triggered).toBe(false);
        });

        test("handles very long prompt", () => {
            const longPrompt = "Azure VM ".repeat(1000);
            const result = triggerMatcher.shouldTrigger(longPrompt);
            expect(typeof result.triggered).toBe("boolean");
        });

        test("is case insensitive", () => {
            const result1 = triggerMatcher.shouldTrigger(
                "RECOMMEND AN AZURE VM SIZE"
            );
            const result2 = triggerMatcher.shouldTrigger(
                "recommend an azure vm size"
            );
            expect(result1.triggered).toBe(result2.triggered);
        });

        test("disambiguates from deploy intent", () => {
            // Deploy-only prompts should not trigger compute recommender
            const result = triggerMatcher.shouldTrigger(
                "Deploy my Node.js app to Azure"
            );
            expect(result.triggered).toBe(false);
        });
    });
});
