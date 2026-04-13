/**
 * Unit Tests for azure-compute
 *
 * Tests the azure-compute router skill, its workflows
 * (vm-recommender and vm-troubleshooter), and reference files.
 */

import { loadSkill, LoadedSkill } from "../utils/skill-loader";
import * as fs from "fs/promises";
import * as path from "path";

const SKILL_NAME = "azure-compute";

describe(`${SKILL_NAME} - Unit Tests`, () => {
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
  });

  describe("Router Skill Metadata", () => {
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

    test("description contains WHEN triggers", () => {
      expect(skill.metadata.description).toMatch(/WHEN:/i);
    });

    test("description covers both recommendation and troubleshooting", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/recommend|vm size|pricing/);
      expect(desc).toMatch(/troubleshoot|can't connect|rdp|ssh/);
    });

    test("description mentions VM and VMSS keywords", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/vm/);
      expect(desc).toMatch(/vmss|scale set/);
    });

    test("description mentions pricing", () => {
      const desc = skill.metadata.description.toLowerCase();
      expect(desc).toMatch(/pric/);
    });
  });

  describe("Router Skill Content", () => {
    test("has substantive content", () => {
      expect(skill.content).toBeDefined();
      expect(skill.content.length).toBeGreaterThan(100);
    });

    test("contains routing section", () => {
      expect(skill.content).toContain("## Routing");
    });

    test("contains workflows section", () => {
      expect(skill.content).toContain("## Workflows");
    });

    test("routes to vm-recommender", () => {
      expect(skill.content).toContain("vm-recommender.md");
      expect(skill.content).toContain("VM Recommender");
    });

    test("routes to vm-troubleshooter", () => {
      expect(skill.content).toContain("vm-troubleshooter.md");
      expect(skill.content).toContain("VM Troubleshooter");
    });

    test("routes to capacity-reservation", () => {
      expect(skill.content).toContain("capacity-reservation.md");
      expect(skill.content).toContain("Capacity Reservation");
    });

    test("documents when to use this skill", () => {
      expect(skill.content).toContain("## When to Use This Skill");
    });

    test("includes decision tree for routing", () => {
      expect(skill.content).toMatch(/Recommend.*VM Recommender/s);
      expect(skill.content).toMatch(/connect.*VM Troubleshooter/is);
    });
  });

  describe("VM Recommender Workflow", () => {
    let recommenderContent: string;

    beforeAll(async () => {
      const agentFile = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-recommender/vm-recommender.md"
      );
      recommenderContent = await fs.readFile(agentFile, "utf-8");
    });

    test("file exists and has content", () => {
      expect(recommenderContent).toBeDefined();
      expect(recommenderContent.length).toBeGreaterThan(500);
    });

    test("contains expected sections", () => {
      expect(recommenderContent).toContain("## When to Use This Skill");
      expect(recommenderContent).toContain("## Workflow");
      expect(recommenderContent).toContain("## Error Handling");
      expect(recommenderContent).toContain("## References");
    });

    test("Step 1: documents requirements gathering", () => {
      expect(recommenderContent).toContain("### Step 1: Gather Requirements");
      expect(recommenderContent).toContain("Workload type");
      expect(recommenderContent).toContain("vCPU / RAM needs");
      expect(recommenderContent).toContain("GPU needed?");
      expect(recommenderContent).toContain("Storage needs");
      expect(recommenderContent).toContain("Budget priority");
      expect(recommenderContent).toContain("OS");
      expect(recommenderContent).toContain("Region");
    });

    test("Step 1: documents scaling-related requirements", () => {
      expect(recommenderContent).toContain("Instance count");
      expect(recommenderContent).toContain("Scaling needs");
      expect(recommenderContent).toContain("Availability needs");
      expect(recommenderContent).toContain("Load balancing");
    });

    test("Step 2: documents VM vs VMSS decision", () => {
      expect(recommenderContent).toContain("### Step 2: Determine VM vs VMSS");
      expect(recommenderContent).toContain("Needs autoscaling?");
    });

    test("Step 2: has signal-to-recommendation table", () => {
      expect(recommenderContent).toContain("Autoscale on CPU, memory, or schedule");
      expect(recommenderContent).toContain("**VMSS**");
      expect(recommenderContent).toContain("**VM**");
    });

    test("Step 3: documents VM family selection", () => {
      expect(recommenderContent).toContain("### Step 3: Select VM Family");
      expect(recommenderContent).toContain("vm-families.md");
    });

    test("Step 3: includes web_fetch verification pattern", () => {
      expect(recommenderContent).toContain("web_fetch");
      expect(recommenderContent).toContain(
        "learn.microsoft.com/en-us/azure/virtual-machines/sizes"
      );
    });

    test("Step 4: documents pricing lookup", () => {
      expect(recommenderContent).toContain("### Step 4: Look Up Pricing");
      expect(recommenderContent).toContain("Azure Retail Prices API");
      expect(recommenderContent).toContain("retail-prices-api.md");
    });

    test("Step 5: documents recommendation presentation format", () => {
      expect(recommenderContent).toContain("### Step 5: Present Recommendations");
      expect(recommenderContent).toContain("2–3 options");
      expect(recommenderContent).toContain("Hosting Model");
      expect(recommenderContent).toContain("VM Size");
      expect(recommenderContent).toContain("Estimated $/hr");
      expect(recommenderContent).toContain("Trade-off");
    });

    test("Step 6: documents next steps", () => {
      expect(recommenderContent).toContain("### Step 6: Offer Next Steps");
      expect(recommenderContent).toContain("Azure Pricing Calculator");
    });

    test("handles API empty results", () => {
      expect(recommenderContent).toContain("API returns empty results");
    });

    test("handles unknown workload type", () => {
      expect(recommenderContent).toContain("User unsure of workload type");
      expect(recommenderContent).toMatch(/D-series/i);
    });

    test("handles missing region", () => {
      expect(recommenderContent).toContain("Region not specified");
      expect(recommenderContent).toContain("eastus");
    });

    test("handles unclear VM vs VMSS choice", () => {
      expect(recommenderContent).toContain(
        "Unclear if VM or VMSS needed"
      );
    });

    test("handles VMSS pricing questions", () => {
      expect(recommenderContent).toContain(
        "User asks VMSS pricing directly"
      );
    });

    test("references use relative paths to shared references dir", () => {
      expect(recommenderContent).toContain("../../references/vm-families.md");
      expect(recommenderContent).toContain("../../references/retail-prices-api.md");
      expect(recommenderContent).toContain("../../references/vmss-guide.md");
    });
  });

  describe("VM Troubleshooter Workflow", () => {
    let troubleshooterContent: string;

    beforeAll(async () => {
      const agentFile = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/vm-troubleshooter.md"
      );
      troubleshooterContent = await fs.readFile(agentFile, "utf-8");
    });

    test("file exists and has content", () => {
      expect(troubleshooterContent).toBeDefined();
      expect(troubleshooterContent.length).toBeGreaterThan(500);
    });

    test("contains expected sections", () => {
      expect(troubleshooterContent).toContain("## Workflow");
      expect(troubleshooterContent).toContain("## Error Handling");
      expect(troubleshooterContent).toContain("## References");
    });

    test("documents connectivity troubleshooting triggers", () => {
      expect(troubleshooterContent).toContain("## Triggers");
      expect(troubleshooterContent).toMatch(/RDP/);
      expect(troubleshooterContent).toMatch(/SSH/);
      expect(troubleshooterContent).toMatch(/NSG/);
    });

    test("Phase 1: documents user intent determination", () => {
      expect(troubleshooterContent).toContain("### Phase 1: Determine User Intent");
    });

    test("Phase 2: routes to solution via reference file", () => {
      expect(troubleshooterContent).toContain("### Phase 2: Route to Solution");
      expect(troubleshooterContent).toContain("cannot-connect-to-vm.md");
    });

    test("Phase 3: fetches live documentation", () => {
      expect(troubleshooterContent).toContain("### Phase 3: Fetch Documentation");
      expect(troubleshooterContent).toContain("fetch_webpage");
    });

    test("Phase 4: documents diagnose and respond workflow", () => {
      expect(troubleshooterContent).toContain("### Phase 4: Diagnose and Respond");
    });

    test("Phase 5: documents escalation path", () => {
      expect(troubleshooterContent).toContain("### Phase 5: Escalation");
    });

    test("references use local workflow reference path", () => {
      expect(troubleshooterContent).toContain("references/cannot-connect-to-vm.md");
    });
  });

  describe("Reference Files", () => {
    let vmFamiliesContent: string;
    let retailPricesApiContent: string;
    let vmssGuideContent: string;
    let cannotConnectContent: string;
    let crOverviewContent: string;
    let crAssociationContent: string;

    beforeAll(async () => {
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
      cannotConnectContent = await fs.readFile(
        path.join(
          SKILLS_PATH,
          "azure-compute/workflows/vm-troubleshooter/references/cannot-connect-to-vm.md"
        ),
        "utf-8"
      );
      crOverviewContent = await fs.readFile(
        path.join(
          SKILLS_PATH,
          "azure-compute/workflows/capacity-reservation/references/capacity-reservation-overview.md"
        ),
        "utf-8"
      );
      crAssociationContent = await fs.readFile(
        path.join(
          SKILLS_PATH,
          "azure-compute/workflows/capacity-reservation/references/association-disassociation.md"
        ),
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

    test("cannot-connect-to-vm reference file exists and has content", () => {
      expect(cannotConnectContent).toBeDefined();
      expect(cannotConnectContent.length).toBeGreaterThan(100);
    });

    test("capacity-reservation-overview reference exists and has content", () => {
      expect(crOverviewContent).toBeDefined();
      expect(crOverviewContent.length).toBeGreaterThan(100);
    });

    test("association-disassociation reference exists and has content", () => {
      expect(crAssociationContent).toBeDefined();
      expect(crAssociationContent.length).toBeGreaterThan(100);
    });
  });

  describe("Capacity Reservation Workflow", () => {
    let crContent: string;

    beforeAll(async () => {
      const agentFile = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/capacity-reservation/capacity-reservation.md"
      );
      crContent = await fs.readFile(agentFile, "utf-8");
    });

    test("file exists and has content", () => {
      expect(crContent).toBeDefined();
      expect(crContent.length).toBeGreaterThan(500);
    });

    test("contains expected sections", () => {
      expect(crContent).toContain("## When to Use This Workflow");
      expect(crContent).toContain("## Workflow");
      expect(crContent).toContain("## Error Handling");
      expect(crContent).toContain("## Key Concepts");
    });

    test("documents proactive suggestion patterns", () => {
      expect(crContent).toContain("proactively suggest");
      expect(crContent).toContain("Deployment failure is unacceptable");
      expect(crContent).toContain("Known scale-out events");
      expect(crContent).toContain("In-demand SKUs");
    });

    test("Step 1: documents requirements gathering", () => {
      expect(crContent).toContain("### Step 1: Gather Requirements");
      expect(crContent).toContain("Region");
      expect(crContent).toContain("VM size(s)");
      expect(crContent).toContain("Quantity");
      expect(crContent).toContain("Availability Zone(s)");
      expect(crContent).toContain("Resource group");
    });

    test("Step 1: quantity must always be asked", () => {
      expect(crContent).toContain("Always ask — do not infer");
    });

    test("Step 1: zones should not be inferred", () => {
      expect(crContent).toContain("Do not pick a zone on the user's behalf");
    });

    test("Step 2: documents CRG and reservation creation", () => {
      expect(crContent).toContain("### Step 2: Create Capacity Reservation Group and Reservation");
      expect(crContent).toContain("az capacity reservation group create");
      expect(crContent).toContain("az capacity reservation create");
    });

    test("Step 3: documents verification", () => {
      expect(crContent).toContain("### Step 3: Verify Reservation");
      expect(crContent).toContain("az capacity reservation show");
    });

    test("Step 4: documents next steps", () => {
      expect(crContent).toContain("### Step 4: Offer Next Steps");
    });

    test("documents managing existing reservations", () => {
      expect(crContent).toContain("## Managing Existing Reservations");
      expect(crContent).toContain("Associate a VM or VMSS");
      expect(crContent).toContain("Disassociate a VM or VMSS");
      expect(crContent).toContain("Find a matching CRG");
    });

    test("error handling covers common failures", () => {
      expect(crContent).toContain("SKU not available in region/zone");
      expect(crContent).toContain("Quota exceeded");
      expect(crContent).toContain("Insufficient platform capacity");
      expect(crContent).toContain("Duplicate SKU + zone in CRG");
    });

    test("references local workflow reference files", () => {
      expect(crContent).toContain("references/capacity-reservation-overview.md");
      expect(crContent).toContain("references/association-disassociation.md");
    });

    test("key concepts table documents billing model", () => {
      expect(crContent).toContain("Charges begin as soon as the reservation is created");
    });
  });

});
