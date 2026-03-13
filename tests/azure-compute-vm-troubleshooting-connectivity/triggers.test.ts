/**
 * Trigger Tests for azure-compute-vm-troubleshooting-connectivity
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
 * Uses snapshot testing + parameterized tests for comprehensive coverage.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-compute-vm-troubleshooting-connectivity";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(async () => {
    skill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      // RDP issues
      "RDP not working for my Azure VM",
      "RDP connection timed out to my Windows VM",
      "I'm getting an RDP internal error",
      "RDP disconnections on my Azure VM connectivity",

      // SSH issues
      "SSH connection refused to my Azure VM",
      "Can't SSH into my Azure Linux VM troubleshoot",

      // NSG / Firewall
      "NSG is blocking traffic to my VM",
      "Firewall is blocking RDP on my VM",
      "Port 3389 is blocked on my Azure VM",

      // Credential / Auth
      "I need to reset my VM password",
      "Credential errors when connecting to my VM",

      // General connectivity
      "Can't connect to my Azure VM",
      "VM connectivity issues troubleshoot",
      "Public IP not working for my VM",

      // Specific tools
      "How do I access serial console for my VM",
      "VM black screen when I connect",
      "NIC disabled on my Azure VM",
      "Bastion connection problems with my VM",
    ];

    test.each(shouldTriggerPrompts)(
      "triggers on: \"%s\"",
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
      }
    );
  });

  describe("Should NOT Trigger", () => {
    const shouldNotTriggerPrompts: string[] = [
      // Non-Azure topics
      "What is the weather today?",
      "Help me write a poem",
      "Explain quantum computing",
      "How do I bake a cake?",

      // Wrong cloud provider
      "Can't SSH into my AWS EC2 instance",

      // VM performance (not connectivity)
      "My Azure VM is running slow",
      "High CPU usage on my VM",

      // Deploying new VMs (not troubleshooting)
      "Create a new VM in Azure",
      "Deploy a virtual machine",

      // Cost optimization
      "How can I save money on VMs?",

      // Monitoring setup (not troubleshooting)
      "Configure monitoring for my VM",
      "Set up alerts for my virtual machine",
    ];

    test.each(shouldNotTriggerPrompts)(
      "does not trigger on: \"%s\"",
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
        extractedKeywords: triggerMatcher.getKeywords()
      }).toMatchSnapshot();
    });
  });

  describe("Edge Cases", () => {
    test("handles empty prompt", () => {
      const result = triggerMatcher.shouldTrigger("");
      expect(result.triggered).toBe(false);
    });

    test("handles very long prompt", () => {
      const longPrompt = "Azure VM RDP SSH connectivity troubleshooting ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive for connectivity keywords", () => {
      const lowerResult = triggerMatcher.shouldTrigger("can't rdp to my azure vm");
      const upperResult = triggerMatcher.shouldTrigger("CAN'T RDP TO MY AZURE VM");
      const mixedResult = triggerMatcher.shouldTrigger("Can't RDP to my Azure VM");

      expect(lowerResult.triggered).toBe(upperResult.triggered);
      expect(lowerResult.triggered).toBe(mixedResult.triggered);
    });

    test("distinguishes between connectivity and deployment keywords", () => {
      const connectivity = triggerMatcher.shouldTrigger("troubleshoot VM connectivity RDP not working");
      const deployment = triggerMatcher.shouldTrigger("deploy a new virtual machine");

      expect(connectivity.triggered).toBe(true);
      expect(deployment.triggered).toBe(false);
    });
  });
});
