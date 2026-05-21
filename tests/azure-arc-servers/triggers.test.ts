/**
 * Trigger Tests for azure-arc-servers
 *
 * Tests that verify the skill triggers on appropriate prompts (on-prem,
 * other-cloud, and edge servers being projected into Azure via the
 * Connected Machine agent) and does NOT trigger on unrelated prompts
 * (in particular: Azure VM creation, which belongs to azure-compute).
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-arc-servers";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger - Onboarding (single server)", () => {
    const onboardPrompts: string[] = [
      "How do I onboard my on-prem Windows Server to Azure Arc?",
      "Connect my Linux VM running in AWS to Azure Arc",
      "Install the Connected Machine agent on my server and project it into Azure",
      "Generate an Azure Arc onboarding script for my Windows server",
      "Help me azcmagent connect my server to Azure",
      "Onboard my hybrid server to Azure Arc so I can manage it with Azure Policy",
      "Project my datacenter Linux server into Azure as an Arc-enabled server",
      "How do I install the Azure Connected Machine agent on Ubuntu?",
    ];

    test.each(onboardPrompts)('triggers on onboard prompt: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Should Trigger - At-scale onboarding", () => {
    const atScalePrompts: string[] = [
      "How do I onboard 500 servers to Azure Arc using Group Policy?",
      "Use Configuration Manager to onboard my server fleet to Arc",
      "Run an Ansible playbook to onboard my Linux servers to Azure Arc",
      "Create a Service Principal for at-scale Azure Arc onboarding",
      "Roll out the Connected Machine agent across my domain with Group Policy",
      "At-scale Arc onboarding with SCCM for Windows servers",
    ];

    test.each(atScalePrompts)(
      'triggers on at-scale onboard prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - Connectivity (Private Link / Arc Gateway / proxy)", () => {
    const connectivityPrompts: string[] = [
      "Set up an Azure Arc Private Link Scope for my onboarded servers",
      "Onboard my server to Arc using Private Link",
      "Configure Arc Gateway as a single egress point for my Connected Machine agents",
      "My Arc server needs to go through a corporate proxy, how do I configure it?",
      "Azure Arc agent connectivity through Private Endpoint",
    ];

    test.each(connectivityPrompts)(
      'triggers on connectivity prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - Troubleshooting", () => {
    const troubleshootPrompts: string[] = [
      "My Azure Arc server shows Disconnected, how do I troubleshoot it?",
      "Connected Machine agent status is Expired on my Arc server",
      "azcmagent show says Error, fix my Arc server connectivity",
      "Arc server agent status is Disconnected but the machine is online",
      "Why is my Connected Machine agent showing as Expired in the portal?",
      "Troubleshoot azcmagent on my hybrid server",
    ];

    test.each(troubleshootPrompts)(
      'triggers on troubleshoot prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - Agent upgrade / management", () => {
    const managePrompts: string[] = [
      "How do I upgrade the Connected Machine agent on all my Arc servers?",
      "Enable automatic agent upgrade for my Azure Arc servers",
      "Manually upgrade azcmagent on my Linux Arc server",
      "What is the current version of the Azure Connected Machine agent?",
    ];

    test.each(managePrompts)('triggers on manage prompt: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Should Trigger - Extended Security Updates (ESU)", () => {
    const esuPrompts: string[] = [
      "Enable Extended Security Updates for my Windows Server 2012 Arc machine",
      "Buy ESU through Azure Arc for my end-of-support Windows servers",
      "How do I attach an ESU license to my Arc-enabled server?",
      "Activate Extended Security Updates on my Arc Windows Server 2012 R2",
    ];

    test.each(esuPrompts)('triggers on ESU prompt: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Should Trigger - Hotpatch on Arc", () => {
    const hotpatchPrompts: string[] = [
      "Enable Hotpatch on my Azure Arc Windows Server 2025",
      "How do I turn on Hotpatching for my Arc server?",
      "Set up Hotpatch on Arc-enabled Windows Server",
    ];

    test.each(hotpatchPrompts)(
      'triggers on Hotpatch prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - Pay-as-you-go Windows Server", () => {
    const paygoPrompts: string[] = [
      "Switch my Arc Windows server to pay-as-you-go licensing",
      "Enable PAYG for Windows Server on my Arc machine",
      "Bring my Software Assurance benefits to my Arc-enabled Windows server",
    ];

    test.each(paygoPrompts)('triggers on PAYG prompt: "%s"', (prompt) => {
      const result = triggerMatcher.shouldTrigger(prompt);
      expect(result.triggered).toBe(true);
      expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Should NOT Trigger - unrelated topics", () => {
    const shouldNotTriggerPrompts: string[] = [
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "Help me with AWS Systems Manager",
      "Configure my PostgreSQL database",
      "How do I write a Python web scraper?",
      "Set up a Kubernetes cluster with Helm",
      "Create a serverless function on AWS",
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
      const longPrompt = "Azure Arc server ".repeat(500);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger(
        "ONBOARD MY SERVER TO AZURE ARC"
      );
      const result2 = triggerMatcher.shouldTrigger(
        "onboard my server to azure arc"
      );
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
