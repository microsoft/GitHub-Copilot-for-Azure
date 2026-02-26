/**
 * Unit Tests for azure-compute/recommender sub-skill
 *
 * Tests the recommender sub-skill's metadata, content structure,
 * workflow documentation, and reference file integrity.
 */

import { loadSkill, LoadedSkill } from "../../utils/skill-loader";
import * as fs from "fs/promises";
import * as path from "path";

const PARENT_SKILL_NAME = "azure-compute";
const SUB_SKILL_PATH = "azure-compute/recommender";

describe(`${SUB_SKILL_PATH} - Unit Tests`, () => {
    let parentSkill: LoadedSkill;
    let recommenderSkill: LoadedSkill;

    beforeAll(async () => {
        parentSkill = await loadSkill(PARENT_SKILL_NAME);
        recommenderSkill = await loadSkill(SUB_SKILL_PATH);
    });

    describe("Parent Skill Integration", () => {
        test("parent skill references recommender sub-skill", () => {
            expect(parentSkill.content).toContain("recommender/SKILL.md");
        });

        test("parent skill lists recommender in Sub-Skills table", () => {
            expect(parentSkill.content).toContain("## Sub-Skills");
            expect(parentSkill.content).toContain("**recommender**");
        });

        test("parent routes VM recommendation intents to recommender", () => {
            expect(parentSkill.content).toContain("RECOMMENDER sub-skill");
        });
    });

    describe("Skill Metadata", () => {
        test("has valid SKILL.md with required fields", () => {
            expect(recommenderSkill.metadata).toBeDefined();
            expect(recommenderSkill.metadata.name).toBe("recommender");
            expect(recommenderSkill.metadata.description).toBeDefined();
            expect(recommenderSkill.metadata.description.length).toBeGreaterThan(50);
        });

        test("description covers VM recommendations", () => {
            const desc = recommenderSkill.metadata.description.toLowerCase();
            expect(desc).toMatch(/recommend/);
            expect(desc).toMatch(/vm/);
        });

        test("description covers VMSS", () => {
            const desc = recommenderSkill.metadata.description.toLowerCase();
            expect(desc).toMatch(/vmss|scale set/);
        });

        test("description mentions no Azure account required", () => {
            const desc = recommenderSkill.metadata.description.toLowerCase();
            expect(desc).toMatch(/no azure (account|subscription) required/i);
        });

        test("description mentions pricing", () => {
            const desc = recommenderSkill.metadata.description.toLowerCase();
            expect(desc).toMatch(/pric/);
        });
    });

    describe("Skill Content - Structure", () => {
        test("has substantive content", () => {
            expect(recommenderSkill.content.length).toBeGreaterThan(500);
        });

        test("contains When to Use section", () => {
            expect(recommenderSkill.content).toContain("## When to Use This Skill");
        });

        test("contains Workflow section", () => {
            expect(recommenderSkill.content).toContain("## Workflow");
        });

        test("contains Error Handling section", () => {
            expect(recommenderSkill.content).toContain("## Error Handling");
        });

        test("contains References section", () => {
            expect(recommenderSkill.content).toContain("## References");
        });
    });

    describe("Core Workflows", () => {
        test("Step 1: documents requirements gathering", () => {
            expect(recommenderSkill.content).toContain("### Step 1: Gather Requirements");
            expect(recommenderSkill.content).toContain("Workload type");
            expect(recommenderSkill.content).toContain("vCPU / RAM needs");
            expect(recommenderSkill.content).toContain("GPU needed?");
            expect(recommenderSkill.content).toContain("Storage needs");
            expect(recommenderSkill.content).toContain("Budget priority");
            expect(recommenderSkill.content).toContain("OS");
            expect(recommenderSkill.content).toContain("Region");
        });

        test("Step 1: documents scaling-related requirements", () => {
            expect(recommenderSkill.content).toContain("Instance count");
            expect(recommenderSkill.content).toContain("Scaling needs");
            expect(recommenderSkill.content).toContain("Availability needs");
            expect(recommenderSkill.content).toContain("Load balancing");
        });

        test("Step 2: documents VM vs VMSS decision", () => {
            expect(recommenderSkill.content).toContain("### Step 2: Determine VM vs VMSS");
            expect(recommenderSkill.content).toContain("Needs autoscaling?");
        });

        test("Step 2: has signal-to-recommendation table", () => {
            expect(recommenderSkill.content).toContain("Autoscale on CPU, memory, or schedule");
            expect(recommenderSkill.content).toContain("**VMSS**");
            expect(recommenderSkill.content).toContain("**VM**");
        });

        test("Step 3: documents VM family selection", () => {
            expect(recommenderSkill.content).toContain("### Step 3: Select VM Family");
            expect(recommenderSkill.content).toContain("vm-families.md");
        });

        test("Step 3: includes web_fetch verification pattern", () => {
            expect(recommenderSkill.content).toContain("web_fetch");
            expect(recommenderSkill.content).toContain(
                "learn.microsoft.com/en-us/azure/virtual-machines/sizes"
            );
        });

        test("Step 4: documents pricing lookup", () => {
            expect(recommenderSkill.content).toContain("### Step 4: Look Up Pricing");
            expect(recommenderSkill.content).toContain("Azure Retail Prices API");
            expect(recommenderSkill.content).toContain("retail-prices-api.md");
        });

        test("Step 5: documents recommendation presentation format", () => {
            expect(recommenderSkill.content).toContain("### Step 5: Present Recommendations");
            expect(recommenderSkill.content).toContain("2–3 options");
            expect(recommenderSkill.content).toContain("Deployment Model");
            expect(recommenderSkill.content).toContain("VM Size");
            expect(recommenderSkill.content).toContain("Estimated $/hr");
            expect(recommenderSkill.content).toContain("Trade-off");
        });

        test("Step 6: documents next steps", () => {
            expect(recommenderSkill.content).toContain("### Step 6: Offer Next Steps");
            expect(recommenderSkill.content).toContain("azure-deploy");
            expect(recommenderSkill.content).toContain("Azure Pricing Calculator");
        });
    });

    describe("Error Handling Coverage", () => {
        test("handles API empty results", () => {
            expect(recommenderSkill.content).toContain("API returns empty results");
        });

        test("handles unknown workload type", () => {
            expect(recommenderSkill.content).toContain("User unsure of workload type");
            expect(recommenderSkill.content).toMatch(/D-series/i);
        });

        test("handles missing region", () => {
            expect(recommenderSkill.content).toContain("Region not specified");
            expect(recommenderSkill.content).toContain("eastus");
        });

        test("handles unclear VM vs VMSS choice", () => {
            expect(recommenderSkill.content).toContain(
                "Unclear if VM or VMSS needed"
            );
        });

        test("handles VMSS pricing questions", () => {
            expect(recommenderSkill.content).toContain(
                "User asks VMSS pricing directly"
            );
        });
    });

    describe("Reference Files", () => {
        const refsDir = path.join(
            global.SKILLS_PATH || path.resolve(__dirname, "../../../plugin/skills"),
            "azure-compute/recommender/references"
        );

        test("vm-families.md reference exists and has content", async () => {
            const content = await fs.readFile(
                path.join(refsDir, "vm-families.md"),
                "utf-8"
            );
            expect(content.length).toBeGreaterThan(100);
        });

        test("retail-prices-api.md reference exists and has content", async () => {
            const content = await fs.readFile(
                path.join(refsDir, "retail-prices-api.md"),
                "utf-8"
            );
            expect(content.length).toBeGreaterThan(100);
        });

        test("vmss-guide.md reference exists and has content", async () => {
            const content = await fs.readFile(
                path.join(refsDir, "vmss-guide.md"),
                "utf-8"
            );
            expect(content.length).toBeGreaterThan(100);
        });
    });
});
