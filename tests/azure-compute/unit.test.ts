/**
 * Unit Tests for azure-compute
 *
 * Tests isolated skill logic, metadata, and sub-skill content validation.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-compute";

describe(`${SKILL_NAME} - Unit Tests`, () => {
    let skill: LoadedSkill;

    beforeAll(async () => {
        skill = await loadSkill(SKILL_NAME);
    });

    describe("Skill Metadata", () => {
        test("has valid SKILL.md with required fields", () => {
            expect(skill.metadata).toBeDefined();
            expect(skill.metadata.name).toBe(SKILL_NAME);
            expect(skill.metadata.description).toBeDefined();
            expect(skill.metadata.description.length).toBeGreaterThan(10);
        });

        test("description is appropriately sized", () => {
            // Descriptions should be 150-1024 chars for Medium-High compliance
            expect(skill.metadata.description.length).toBeGreaterThan(150);
            expect(skill.metadata.description.length).toBeLessThan(1024);
        });

        test("description contains USE FOR triggers", () => {
            expect(skill.metadata.description).toMatch(/USE FOR:/i);
        });

        test("description contains DO NOT USE FOR anti-triggers", () => {
            expect(skill.metadata.description).toMatch(/DO NOT USE FOR:/i);
        });

        test("description mentions VM and VMSS keywords", () => {
            const desc = skill.metadata.description.toLowerCase();
            expect(desc).toMatch(/vm/);
            expect(desc).toMatch(/vmss|scale set/);
        });

        test("description mentions workload types", () => {
            const desc = skill.metadata.description.toLowerCase();
            expect(desc).toMatch(/web|database|ml|batch|hpc/);
        });
    });

    describe("Skill Content", () => {
        test("has substantive content", () => {
            expect(skill.content).toBeDefined();
            expect(skill.content.length).toBeGreaterThan(100);
        });

        test("contains expected sections", () => {
            expect(skill.content).toContain("## Sub-Skills");
            expect(skill.content).toContain("## Intent Routing");
            expect(skill.content).toContain("## When to Use This Skill");
            expect(skill.content).toContain("## Error Handling");
        });

        test("contains intent routing decision tree", () => {
            expect(skill.content).toContain("RECOMMENDER sub-skill");
        });

        test("documents when to use this skill", () => {
            expect(skill.content).toMatch(/VM size recommendation/i);
            expect(skill.content).toMatch(/VM famil/i);
            expect(skill.content).toMatch(/scale set/i);
        });

        test("contains error handling table", () => {
            expect(skill.content).toContain("User intent unclear");
            expect(skill.content).toContain("Sub-skill not found");
        });
    });

    describe("Sub-Skills Reference", () => {
        test("has Sub-Skills table", () => {
            expect(skill.content).toContain("## Sub-Skills");
        });

        test("references recommender sub-skill in table", () => {
            expect(skill.content).toContain("recommender");
            expect(skill.content).toContain("recommender/SKILL.md");
        });

        test("contains mandatory read warning for sub-skills", () => {
            expect(skill.content).toMatch(/MANDATORY.*read.*sub-skill/i);
        });
    });

    describe("Recommender Sub-Skill Content", () => {
        let recommenderSkill: LoadedSkill;

        beforeAll(async () => {
            recommenderSkill = await loadSkill("azure-compute/recommender");
        });

        test("has valid SKILL.md with required fields", () => {
            expect(recommenderSkill.metadata).toBeDefined();
            expect(recommenderSkill.metadata.name).toBe("recommender");
            expect(recommenderSkill.metadata.description).toBeDefined();
            expect(recommenderSkill.metadata.description.length).toBeGreaterThan(50);
        });

        test("description mentions VM and VMSS", () => {
            const desc = recommenderSkill.metadata.description.toLowerCase();
            expect(desc).toMatch(/vm/);
            expect(desc).toMatch(/vmss|scale set/i);
        });

        test("description mentions pricing", () => {
            const desc = recommenderSkill.metadata.description.toLowerCase();
            expect(desc).toMatch(/pric/);
        });

        test("has substantive content", () => {
            expect(recommenderSkill.content).toBeDefined();
            expect(recommenderSkill.content.length).toBeGreaterThan(500);
        });

        test("documents When to Use section", () => {
            expect(recommenderSkill.content).toContain("## When to Use This Skill");
        });

        test("documents the full workflow", () => {
            expect(recommenderSkill.content).toContain("### Step 1: Gather Requirements");
            expect(recommenderSkill.content).toContain("### Step 2: Determine VM vs VMSS");
            expect(recommenderSkill.content).toContain("### Step 3: Select VM Family");
            expect(recommenderSkill.content).toContain("### Step 4: Look Up Pricing");
            expect(recommenderSkill.content).toContain("### Step 5: Present Recommendations");
            expect(recommenderSkill.content).toContain("### Step 6: Offer Next Steps");
        });

        test("documents requirements gathering table", () => {
            expect(recommenderSkill.content).toContain("Workload type");
            expect(recommenderSkill.content).toContain("vCPU / RAM needs");
            expect(recommenderSkill.content).toContain("GPU needed?");
            expect(recommenderSkill.content).toContain("Budget priority");
            expect(recommenderSkill.content).toContain("Region");
        });

        test("documents VM vs VMSS decision tree", () => {
            expect(recommenderSkill.content).toContain("Needs autoscaling?");
            expect(recommenderSkill.content).toContain("Multiple identical instances needed?");
        });

        test("contains VM vs VMSS signal table", () => {
            expect(recommenderSkill.content).toContain("Autoscale on CPU, memory, or schedule");
            expect(recommenderSkill.content).toContain("Single long-lived server");
            expect(recommenderSkill.content).toContain("Flexible");
        });

        test("documents recommendation presentation columns", () => {
            expect(recommenderSkill.content).toContain("Deployment Model");
            expect(recommenderSkill.content).toContain("VM Size");
            expect(recommenderSkill.content).toContain("vCPUs / RAM");
            expect(recommenderSkill.content).toContain("Estimated $/hr");
        });

        test("contains error handling section", () => {
            expect(recommenderSkill.content).toContain("## Error Handling");
            expect(recommenderSkill.content).toContain("API returns empty results");
            expect(recommenderSkill.content).toContain("User unsure of workload type");
            expect(recommenderSkill.content).toContain("Region not specified");
        });

        test("references companion documents", () => {
            expect(recommenderSkill.content).toContain("## References");
            expect(recommenderSkill.content).toContain("vm-families.md");
            expect(recommenderSkill.content).toContain("retail-prices-api.md");
            expect(recommenderSkill.content).toContain("vmss-guide.md");
        });

        test("contains web_fetch documentation verification pattern", () => {
            expect(recommenderSkill.content).toContain("web_fetch");
            expect(recommenderSkill.content).toContain("learn.microsoft.com");
        });

        test("mentions Retail Prices API for pricing", () => {
            expect(recommenderSkill.content).toContain("Azure Retail Prices API");
        });

        test("documents next steps including deploy skill handoff", () => {
            expect(recommenderSkill.content).toContain("azure-deploy");
            expect(recommenderSkill.content).toContain("Azure Pricing Calculator");
        });
    });

    describe("Recommender Reference Files", () => {
        let vmFamiliesContent: string;
        let retailPricesApiContent: string;
        let vmssGuideContent: string;

        beforeAll(async () => {
            const fs = await import("fs/promises");
            const path = await import("path");
            const refsDir = path.join(
                SKILLS_PATH,
                "azure-compute/recommender/references"
            );

            vmFamiliesContent = await fs.readFile(
                path.join(refsDir, "vm-families.md"),
                "utf-8"
            );
            retailPricesApiContent = await fs.readFile(
                path.join(refsDir, "retail-prices-api.md"),
                "utf-8"
            );
            vmssGuideContent = await fs.readFile(
                path.join(refsDir, "vmss-guide.md"),
                "utf-8"
            );
        });

        test("vm-families reference file exists and has content", () => {
            expect(vmFamiliesContent).toBeDefined();
            expect(vmFamiliesContent.length).toBeGreaterThan(100);
        });

        test("retail-prices-api reference file exists and has content", () => {
            expect(retailPricesApiContent).toBeDefined();
            expect(retailPricesApiContent.length).toBeGreaterThan(100);
        });

        test("vmss-guide reference file exists and has content", () => {
            expect(vmssGuideContent).toBeDefined();
            expect(vmssGuideContent.length).toBeGreaterThan(100);
        });
    });
});
