/**
 * Unit Tests for azure-compute
 *
 * Tests isolated skill logic, metadata, and content validation
 * for the azure-compute skill including VM/VMSS recommendations.
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
            expect(skill.metadata.description.length).toBeGreaterThanOrEqual(150);
            expect(skill.metadata.description.length).toBeLessThanOrEqual(1024);
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

        test("description covers VM recommendations", () => {
            const desc = skill.metadata.description.toLowerCase();
            expect(desc).toMatch(/recommend/);
            expect(desc).toMatch(/vm/);
        });

        test("description mentions pricing", () => {
            const desc = skill.metadata.description.toLowerCase();
            expect(desc).toMatch(/pric/);
        });
    });

    describe("Skill Content", () => {
        test("has substantive content", () => {
            expect(skill.content).toBeDefined();
            expect(skill.content.length).toBeGreaterThan(500);
        });

        test("contains expected sections", () => {
            expect(skill.content).toContain("## When to Use This Skill");
            expect(skill.content).toContain("## Workflow");
            expect(skill.content).toContain("## Error Handling");
            expect(skill.content).toContain("## References");
        });

        test("documents when to use this skill", () => {
            expect(skill.content).toMatch(/VM size recommendation/i);
            expect(skill.content).toMatch(/VM famil/i);
            expect(skill.content).toMatch(/scale set/i);
        });
    });

    describe("Core Workflows", () => {
        test("Step 1: documents requirements gathering", () => {
            expect(skill.content).toContain("### Step 1: Gather Requirements");
            expect(skill.content).toContain("Workload type");
            expect(skill.content).toContain("vCPU / RAM needs");
            expect(skill.content).toContain("GPU needed?");
            expect(skill.content).toContain("Storage needs");
            expect(skill.content).toContain("Budget priority");
            expect(skill.content).toContain("OS");
            expect(skill.content).toContain("Region");
        });

        test("Step 1: documents scaling-related requirements", () => {
            expect(skill.content).toContain("Instance count");
            expect(skill.content).toContain("Scaling needs");
            expect(skill.content).toContain("Availability needs");
            expect(skill.content).toContain("Load balancing");
        });

        test("Step 2: documents VM vs VMSS decision", () => {
            expect(skill.content).toContain("### Step 2: Determine VM vs VMSS");
            expect(skill.content).toContain("Needs autoscaling?");
        });

        test("Step 2: has signal-to-recommendation table", () => {
            expect(skill.content).toContain("Autoscale on CPU, memory, or schedule");
            expect(skill.content).toContain("**VMSS**");
            expect(skill.content).toContain("**VM**");
        });

        test("Step 3: documents VM family selection", () => {
            expect(skill.content).toContain("### Step 3: Select VM Family");
            expect(skill.content).toContain("vm-families.md");
        });

        test("Step 3: includes web_fetch verification pattern", () => {
            expect(skill.content).toContain("web_fetch");
            expect(skill.content).toContain(
                "learn.microsoft.com/en-us/azure/virtual-machines/sizes"
            );
        });

        test("Step 4: documents pricing lookup", () => {
            expect(skill.content).toContain("### Step 4: Look Up Pricing");
            expect(skill.content).toContain("Azure Retail Prices API");
            expect(skill.content).toContain("retail-prices-api.md");
        });

        test("Step 5: documents recommendation presentation format", () => {
            expect(skill.content).toContain("### Step 5: Present Recommendations");
            expect(skill.content).toContain("2–3 options");
            expect(skill.content).toContain("Hosting Model");
            expect(skill.content).toContain("VM Size");
            expect(skill.content).toContain("Estimated $/hr");
            expect(skill.content).toContain("Trade-off");
        });

        test("Step 6: documents next steps", () => {
            expect(skill.content).toContain("### Step 6: Offer Next Steps");
            expect(skill.content).toContain("Azure Pricing Calculator");
        });
    });

    describe("Error Handling Coverage", () => {
        test("handles API empty results", () => {
            expect(skill.content).toContain("API returns empty results");
        });

        test("handles unknown workload type", () => {
            expect(skill.content).toContain("User unsure of workload type");
            expect(skill.content).toMatch(/D-series/i);
        });

        test("handles missing region", () => {
            expect(skill.content).toContain("Region not specified");
            expect(skill.content).toContain("eastus");
        });

        test("handles unclear VM vs VMSS choice", () => {
            expect(skill.content).toContain(
                "Unclear if VM or VMSS needed"
            );
        });

        test("handles VMSS pricing questions", () => {
            expect(skill.content).toContain(
                "User asks VMSS pricing directly"
            );
        });
    });

    describe("Reference Files", () => {
        let vmFamiliesContent: string;
        let retailPricesApiContent: string;
        let vmssGuideContent: string;

        beforeAll(async () => {
            const fs = await import("fs/promises");
            const path = await import("path");
            const refsDir = path.join(
                SKILLS_PATH,
                "azure-compute/references"
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
