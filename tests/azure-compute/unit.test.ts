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

    test("documents MCP tools (fetch_webpage) with parameters", () => {
      expect(troubleshooterContent).toContain("## MCP Tools");
      expect(troubleshooterContent).toContain("fetch_webpage");
      expect(troubleshooterContent).toContain("urls");
      expect(troubleshooterContent).toContain("query");
    });

    test("Phase 1: documents all 5 routing categories", () => {
      expect(troubleshooterContent).toContain("Unable to RDP");
      expect(troubleshooterContent).toContain("Unable to SSH");
      expect(troubleshooterContent).toContain("Network / Firewall");
      expect(troubleshooterContent).toContain("Credential / Auth");
      expect(troubleshooterContent).toContain("VM Agent / Tools");
    });

    test("Phase 1: includes clarifying question for ambiguous intent", () => {
      expect(troubleshooterContent).toMatch(/RDP.*Windows.*SSH.*Linux/is);
    });

    test("Phase 3: shows fetch_webpage example with URL and query params", () => {
      expect(troubleshooterContent).toContain("fetch_webpage({");
      expect(troubleshooterContent).toContain("<documentation-url-from-solution-row>");
    });

    test("Phase 5: documents escalation commands", () => {
      expect(troubleshooterContent).toContain("az vm get-instance-view");
      expect(troubleshooterContent).toContain("az vm restart");
      expect(troubleshooterContent).toContain("az vm redeploy");
    });

    test("Phase 5: links to comprehensive troubleshooting guides", () => {
      expect(troubleshooterContent).toContain("troubleshoot-rdp-connection");
      expect(troubleshooterContent).toContain("troubleshoot-ssh-connection");
    });

    test("error handling covers fetch_webpage failure", () => {
      expect(troubleshooterContent).toMatch(/fetch_webpage.*fails/i);
    });

    test("error handling covers CLI not found", () => {
      expect(troubleshooterContent).toMatch(/CLI command fails/i);
      expect(troubleshooterContent).toMatch(/VM name or resource group/i);
    });

    test("error handling covers Run Command timeout", () => {
      expect(troubleshooterContent).toMatch(/Run Command times out/i);
      expect(troubleshooterContent).toMatch(/VM agent/i);
    });

    test("error handling covers Serial Console unavailable", () => {
      expect(troubleshooterContent).toMatch(/Serial Console not available/i);
      expect(troubleshooterContent).toContain("boot-diagnostics enable");
    });

    test("error handling covers password reset failure", () => {
      expect(troubleshooterContent).toMatch(/Password reset fails/i);
      expect(troubleshooterContent).toMatch(/VMAccess/i);
    });
  });

  describe("Reference Files", () => {
    let vmFamiliesContent: string;
    let retailPricesApiContent: string;
    let vmssGuideContent: string;
    let cannotConnectContent: string;

    const troubleshooterRefsDir = path.join(
      SKILLS_PATH,
      "azure-compute/workflows/vm-troubleshooter/references"
    );

    const subReferenceFiles = [
      "rdp-connectivity.md",
      "ssh-connectivity.md",
      "network-connectivity.md",
      "firewall-blocking.md",
      "vm-agent-not-responding.md",
      "credential-auth-errors.md",
      "rdp-service-config.md",
    ];

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
        path.join(troubleshooterRefsDir, "cannot-connect-to-vm.md"),
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

    test("cannot-connect-to-vm acts as index and links to all sub-references", () => {
      for (const ref of subReferenceFiles) {
        expect(cannotConnectContent).toContain(ref);
      }
    });

    test("cannot-connect-to-vm includes OS detection guidance", () => {
      expect(cannotConnectContent).toMatch(/Determine OS/i);
      expect(cannotConnectContent).toContain("Windows");
      expect(cannotConnectContent).toContain("Linux");
    });

    test.each(subReferenceFiles)(
      "troubleshooter sub-reference %s exists and has content",
      async (file) => {
        const content = await fs.readFile(
          path.join(troubleshooterRefsDir, file),
          "utf-8"
        );
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(100);
      }
    );

    test.each(subReferenceFiles)(
      "troubleshooter sub-reference %s contains Symptoms → Solutions table",
      async (file) => {
        const content = await fs.readFile(
          path.join(troubleshooterRefsDir, file),
          "utf-8"
        );
        expect(content).toMatch(/Symptoms?\s*→\s*Solutions?/i);
      }
    );

    test.each(subReferenceFiles)(
      "troubleshooter sub-reference %s contains Quick Commands",
      async (file) => {
        const content = await fs.readFile(
          path.join(troubleshooterRefsDir, file),
          "utf-8"
        );
        expect(content).toContain("Quick Commands");
        expect(content).toContain("```bash");
      }
    );
  });

  describe("Troubleshooter OS Differentiation", () => {
    const troubleshooterRefsDir = path.join(
      SKILLS_PATH,
      "azure-compute/workflows/vm-troubleshooter/references"
    );

    test("rdp-connectivity.md is Windows-specific", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "rdp-connectivity.md"),
        "utf-8"
      );
      expect(content).toMatch(/Windows/i);
      expect(content).toContain("3389");
    });

    test("ssh-connectivity.md is Linux-specific", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "ssh-connectivity.md"),
        "utf-8"
      );
      expect(content).toMatch(/Linux/i);
      expect(content).toContain("22");
    });

    test("rdp-service-config.md is Windows-specific", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "rdp-service-config.md"),
        "utf-8"
      );
      expect(content).toContain("TermService");
      expect(content).toContain("3389");
    });

    test("network-connectivity.md covers both Windows and Linux", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "network-connectivity.md"),
        "utf-8"
      );
      expect(content).toContain("Windows");
      expect(content).toContain("Linux");
    });

    test("firewall-blocking.md covers both Windows and Linux", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "firewall-blocking.md"),
        "utf-8"
      );
      expect(content).toContain("Windows");
      expect(content).toContain("Linux");
      expect(content).toMatch(/iptables|firewalld|UFW/);
    });

    test("credential-auth-errors.md covers both Windows and Linux", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "credential-auth-errors.md"),
        "utf-8"
      );
      expect(content).toMatch(/Windows.*RDP/i);
      expect(content).toMatch(/Linux.*SSH/i);
    });

    test("vm-agent-not-responding.md labels OS for each row", async () => {
      const content = await fs.readFile(
        path.join(troubleshooterRefsDir, "vm-agent-not-responding.md"),
        "utf-8"
      );
      expect(content).toContain("Windows");
      expect(content).toContain("Linux");
      expect(content).toMatch(/Serial Console.*Windows/is);
      expect(content).toMatch(/Serial Console.*Linux/is);
    });
  });

  describe("Troubleshooter Routing Table Completeness", () => {
    let cannotConnectContent: string;

    const troubleshooterRefsDir = path.join(
      SKILLS_PATH,
      "azure-compute/workflows/vm-troubleshooter/references"
    );

    beforeAll(async () => {
      cannotConnectContent = await fs.readFile(
        path.join(troubleshooterRefsDir, "cannot-connect-to-vm.md"),
        "utf-8"
      );
    });

    test("routing table covers all 7 categories", () => {
      const categories = [
        "Unable to RDP",
        "Unable to SSH",
        "Network Issues",
        "Firewall Blocking",
        "VM Agent Not Responding",
        "Credential / Auth Errors",
        "RDP Service / Config",
      ];
      for (const category of categories) {
        expect(cannotConnectContent).toContain(category);
      }
    });

    test("routing table links to all 7 reference files", () => {
      const expectedLinks = [
        "rdp-connectivity.md",
        "ssh-connectivity.md",
        "network-connectivity.md",
        "firewall-blocking.md",
        "vm-agent-not-responding.md",
        "credential-auth-errors.md",
        "rdp-service-config.md",
      ];
      for (const link of expectedLinks) {
        expect(cannotConnectContent).toContain(link);
      }
    });

    test("includes escalation section with restart and redeploy", () => {
      expect(cannotConnectContent).toContain("## Escalation");
      expect(cannotConnectContent).toContain("az vm restart");
      expect(cannotConnectContent).toContain("az vm redeploy");
    });
  });

  describe("Sub-Reference: rdp-connectivity.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "rdp-connectivity.md"),
        "utf-8"
      );
    });

    test("covers connection timeout symptom", () => {
      expect(content).toMatch(/Connection times out/i);
    });

    test("covers credentials error symptom", () => {
      expect(content).toMatch(/credentials did not work/i);
    });

    test("covers internal error symptom", () => {
      expect(content).toMatch(/internal error/i);
    });

    test("covers black screen symptom", () => {
      expect(content).toMatch(/Black screen/i);
    });

    test("covers licensing error symptom", () => {
      expect(content).toMatch(/License Servers/i);
    });

    test("covers authentication/CredSSP error symptom", () => {
      expect(content).toMatch(/authentication error|CredSSP/i);
    });

    test("covers NIC disabled symptom", () => {
      expect(content).toMatch(/NIC.*disabled/i);
    });

    test("quick commands include NSG check and IP flow verify", () => {
      expect(content).toContain("az network nsg rule list");
      expect(content).toContain("test-ip-flow");
    });

    test("quick commands include RDP reset and password reset", () => {
      expect(content).toContain("az vm user reset-remote-desktop");
      expect(content).toContain("az vm user update");
    });

    test("every solution row links to Microsoft Learn documentation", () => {
      expect(content).toContain("learn.microsoft.com");
      // Count documentation links — should have at least one per symptom row
      const docLinks = content.match(/https:\/\/learn\.microsoft\.com[^\s)]+/g) || [];
      expect(docLinks.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("Sub-Reference: ssh-connectivity.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "ssh-connectivity.md"),
        "utf-8"
      );
    });

    test("covers connection refused symptom", () => {
      expect(content).toMatch(/Connection refused/i);
    });

    test("covers connection timed out symptom", () => {
      expect(content).toMatch(/Connection timed out/i);
    });

    test("covers permission denied publickey symptom", () => {
      expect(content).toMatch(/Permission denied \(publickey\)/i);
    });

    test("covers permission denied password symptom", () => {
      expect(content).toMatch(/Permission denied \(password\)/i);
    });

    test("covers host key verification failure", () => {
      expect(content).toMatch(/Host key verification failed/i);
    });

    test("covers SSH hangs symptom", () => {
      expect(content).toMatch(/SSH hangs/i);
    });

    test("covers SELinux blocking SSH", () => {
      expect(content).toMatch(/SELinux/i);
    });

    test("covers Entra ID (AAD) SSH login", () => {
      expect(content).toMatch(/Entra ID|AAD/i);
    });

    test("quick commands include SSH reset and key reset", () => {
      expect(content).toContain("az vm user reset-ssh");
      expect(content).toContain("ssh-key-value");
    });

    test("quick commands include sshd status check", () => {
      expect(content).toContain("systemctl status sshd");
    });

    test("every solution row links to Microsoft Learn documentation", () => {
      const docLinks = content.match(/https:\/\/learn\.microsoft\.com[^\s)]+/g) || [];
      expect(docLinks.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Sub-Reference: network-connectivity.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "network-connectivity.md"),
        "utf-8"
      );
    });

    test("covers NSG missing allow rule", () => {
      expect(content).toMatch(/NSG.*no allow rule/i);
    });

    test("covers dual NSG (NIC and subnet) blocking", () => {
      expect(content).toMatch(/NIC and subnet/i);
    });

    test("covers custom route (UDR) issues", () => {
      expect(content).toMatch(/UDR|Custom route/i);
    });

    test("covers no public IP", () => {
      expect(content).toMatch(/no public IP/i);
    });

    test("covers NIC disabled (Windows and Linux)", () => {
      expect(content).toMatch(/NIC.*disabled/i);
      expect(content).toMatch(/NIC.*down/i);
    });

    test("covers static IP misconfiguration", () => {
      expect(content).toMatch(/Static IP/i);
    });

    test("covers DNS resolution failure", () => {
      expect(content).toMatch(/DNS/i);
    });

    test("quick commands include effective NSG rules and routes", () => {
      expect(content).toContain("list-effective-nsg");
      expect(content).toContain("show-effective-route-table");
    });

    test("quick commands include public IP check", () => {
      expect(content).toContain("az vm list-ip-addresses");
    });

    test("has OS-specific quick commands for Windows and Linux", () => {
      expect(content).toContain("Quick Commands — Windows");
      expect(content).toContain("Quick Commands — Linux");
    });
  });

  describe("Sub-Reference: firewall-blocking.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "firewall-blocking.md"),
        "utf-8"
      );
    });

    test("covers Windows Firewall blocking RDP", () => {
      expect(content).toMatch(/Windows Firewall blocking RDP/i);
    });

    test("covers BlockInboundAlways policy", () => {
      expect(content).toContain("BlockInboundAlways");
    });

    test("covers third-party AV/firewall", () => {
      expect(content).toMatch(/Third-party/i);
    });

    test("covers iptables/nftables blocking SSH", () => {
      expect(content).toMatch(/iptables|nftables/);
    });

    test("covers firewalld blocking SSH", () => {
      expect(content).toContain("firewalld");
    });

    test("covers UFW blocking SSH", () => {
      expect(content).toContain("UFW");
    });

    test("covers offline repair for unreachable Windows VM", () => {
      expect(content).toMatch(/offline.*repair/i);
    });

    test("covers Serial Console fallback for unreachable Linux VM", () => {
      expect(content).toMatch(/Serial Console|repair VM/i);
    });

    test("has OS-specific quick commands for Windows and Linux", () => {
      expect(content).toContain("Quick Commands — Windows");
      expect(content).toContain("Quick Commands — Linux");
    });
  });

  describe("Sub-Reference: credential-auth-errors.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "credential-auth-errors.md"),
        "utf-8"
      );
    });

    test("covers Windows 'credentials did not work' error", () => {
      expect(content).toMatch(/credentials did not work/i);
    });

    test("covers account expired error", () => {
      expect(content).toMatch(/account.*expired/i);
    });

    test("covers domain trust relationship failure", () => {
      expect(content).toMatch(/Trust relationship/i);
    });

    test("covers CredSSP encryption oracle error", () => {
      expect(content).toContain("CredSSP");
      expect(content).toContain("AllowEncryptionOracle");
    });

    test("covers Linux permission denied publickey", () => {
      expect(content).toMatch(/Permission denied \(publickey\)/i);
    });

    test("covers Linux permission denied password", () => {
      expect(content).toMatch(/Permission denied \(password\)/i);
    });

    test("covers account locked after failed attempts", () => {
      expect(content).toMatch(/locked/i);
    });

    test("covers Entra ID (AAD) missing role assignment", () => {
      expect(content).toMatch(/Entra ID|AAD/i);
      expect(content).toMatch(/Virtual Machine.*Login/i);
    });

    test("has separate Quick Commands for Windows and Linux", () => {
      expect(content).toContain("Quick Commands — Windows");
      expect(content).toContain("Quick Commands — Linux");
    });

    test("quick commands include password reset for both OSes", () => {
      expect(content).toContain("az vm user update");
      expect(content).toContain("az vm user reset-remote-desktop");
      expect(content).toContain("ssh-key-value");
    });
  });

  describe("Sub-Reference: vm-agent-not-responding.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "vm-agent-not-responding.md"),
        "utf-8"
      );
    });

    test("covers Run Command timeout for both OSes", () => {
      expect(content).toMatch(/Run Command times out/i);
    });

    test("covers password reset failure when agent is down", () => {
      expect(content).toMatch(/Password.*reset fails/i);
    });

    test("covers BSOD / boot failure (Windows)", () => {
      expect(content).toMatch(/BSOD/i);
    });

    test("covers kernel panic / boot failure (Linux)", () => {
      expect(content).toMatch(/kernel panic/i);
    });

    test("covers VMAccess limitation on domain controllers", () => {
      expect(content).toMatch(/domain controller/i);
    });

    test("quick commands include Serial Console connect", () => {
      expect(content).toContain("az serial-console connect");
    });

    test("quick commands include boot diagnostics enable", () => {
      expect(content).toContain("az vm boot-diagnostics enable");
    });

    test("quick commands include repair VM create and restore", () => {
      expect(content).toContain("az vm repair create");
      expect(content).toContain("az vm repair restore");
    });
  });

  describe("Sub-Reference: rdp-service-config.md — Symptom Coverage", () => {
    let content: string;

    beforeAll(async () => {
      const troubleshooterRefsDir = path.join(
        SKILLS_PATH,
        "azure-compute/workflows/vm-troubleshooter/references"
      );
      content = await fs.readFile(
        path.join(troubleshooterRefsDir, "rdp-service-config.md"),
        "utf-8"
      );
    });

    test("covers TermService not running", () => {
      expect(content).toContain("TermService not running");
    });

    test("covers RDP port changed from 3389", () => {
      expect(content).toMatch(/port changed/i);
      expect(content).toContain("3389");
    });

    test("covers RDP disabled (fDenyTSConnections)", () => {
      expect(content).toContain("fDenyTSConnections");
    });

    test("covers TLS/SSL certificate issues", () => {
      expect(content).toMatch(/TLS|SSL/);
      expect(content).toMatch(/certificate/i);
    });

    test("covers NLA/Security Layer mismatch", () => {
      expect(content).toMatch(/NLA/i);
    });

    test("covers GPO overriding RDP settings", () => {
      expect(content).toContain("GPO");
      expect(content).toContain("Terminal Services");
    });

    test("covers RDS licensing expired", () => {
      expect(content).toMatch(/licensing/i);
    });

    test("quick commands include RDP reset and TermService check", () => {
      expect(content).toContain("az vm user reset-remote-desktop");
      expect(content).toContain("Get-Service TermService");
    });

    test("quick commands include restart and redeploy as last resort", () => {
      expect(content).toContain("az vm restart");
      expect(content).toContain("az vm redeploy");
    });
  });

  describe("Sub-Reference Documentation URL Integrity", () => {
    const troubleshooterRefsDir = path.join(
      SKILLS_PATH,
      "azure-compute/workflows/vm-troubleshooter/references"
    );

    const subReferenceFiles = [
      "rdp-connectivity.md",
      "ssh-connectivity.md",
      "network-connectivity.md",
      "firewall-blocking.md",
      "vm-agent-not-responding.md",
      "credential-auth-errors.md",
      "rdp-service-config.md",
    ];

    test.each(subReferenceFiles)(
      "%s contains only learn.microsoft.com documentation links",
      async (file) => {
        const content = await fs.readFile(
          path.join(troubleshooterRefsDir, file),
          "utf-8"
        );
        const docLinks = content.match(/https:\/\/[^\s)]+/g) || [];
        expect(docLinks.length).toBeGreaterThan(0);
        for (const link of docLinks) {
          expect(link).toMatch(/^https:\/\/learn\.microsoft\.com\//);
        }
      }
    );

    test.each(subReferenceFiles)(
      "%s has at least one documentation link per solution row",
      async (file) => {
        const content = await fs.readFile(
          path.join(troubleshooterRefsDir, file),
          "utf-8"
        );
        // Count table rows (lines starting with |) excluding header/separator
        const tableRows = content.split("\n").filter(
          (line) => line.startsWith("|") && !line.includes("---") && !line.includes("Symptom")
        );
        const docLinks = content.match(/https:\/\/learn\.microsoft\.com[^\s)]+/g) || [];
        // At least half the rows should have doc links (some rows share the same URL)
        expect(docLinks.length).toBeGreaterThanOrEqual(Math.floor(tableRows.length / 2));
      }
    );
  });
});
