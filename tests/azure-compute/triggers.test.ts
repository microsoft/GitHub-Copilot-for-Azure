/**
 * Trigger Tests for azure-compute
 *
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 *
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
      "How much does a Standard_D4s_v5 Azure VM cost per hour in East US?",
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

  describe("Should Trigger - VM Troubleshooting: Unable to RDP", () => {
    const rdpPrompts: string[] = [
      "I can't connect to my Azure VM via RDP",
      "RDP to my Azure VM shows a black screen",
      "Azure VM RDP connection times out on port 3389",
      "I get an internal error when trying to RDP to my Azure VM",
    ];

    test.each(rdpPrompts)(
      'triggers on RDP prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: Unable to SSH", () => {
    const sshPrompts: string[] = [
      "SSH connection to my Azure VM is refused",
      "I can't SSH into my Azure Linux VM anymore",
      "Permission denied publickey when connecting to Azure VM via SSH",
      "SSH to my Azure VM hangs, troubleshoot connectivity issue",
    ];

    test.each(sshPrompts)(
      'triggers on SSH prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: Network / Firewall", () => {
    const networkPrompts: string[] = [
      "My Azure VM is unreachable after updating NSG rules",
      "Troubleshoot why I can't reach my VM on port 3389",
      "Azure VM has no public IP and I can't connect",
      "NSG is blocking connectivity to my Azure VM, troubleshoot port access",
    ];

    test.each(networkPrompts)(
      'triggers on network/firewall prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: Firewall Blocking (Guest OS)", () => {
    const firewallPrompts: string[] = [
      "Windows Firewall blocking RDP, can't connect to my Azure VM",
      "iptables is blocking SSH on my Azure Linux VM",
      "Guest OS firewall blocking, can't connect to my Azure VM",
    ];

    test.each(firewallPrompts)(
      'triggers on guest firewall prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: Credential / Auth", () => {
    const credentialPrompts: string[] = [
      "How do I reset the password on my Azure VM?",
      "Credentials did not work, need to reset password on Azure VM",
      "Permission denied password, troubleshoot Azure VM connectivity",
      "Azure VM access denied, need to reset password",
    ];

    test.each(credentialPrompts)(
      'triggers on credential/auth prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: VM Agent / Tools", () => {
    const vmAgentPrompts: string[] = [
      "I need to troubleshoot my Azure VM agent, Run Command is not working",
      "How do I access Azure Serial Console to troubleshoot connectivity on my VM?",
      "Azure VM agent not responding, I can't connect via Run Command",
    ];

    test.each(vmAgentPrompts)(
      'triggers on VM agent/tools prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: RDP Service / Config", () => {
    const rdpServicePrompts: string[] = [
      "Remote Desktop service stopped, can't connect to my Azure VM",
      "RDP disabled on my Azure VM, troubleshoot connectivity",
      "RDP port changed from 3389 on my Azure VM, can't connect",
      "Azure VM RDP certificate expired, troubleshoot connectivity error",
      "Azure VM licensing error, can't connect via Remote Desktop",
    ];

    test.each(rdpServicePrompts)(
      'triggers on RDP service/config prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - VM Troubleshooting: General", () => {
    const generalPrompts: string[] = [
      "Azure VM connectivity issue after reboot",
    ];

    test.each(generalPrompts)(
      'triggers on general troubleshooting prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });

  describe("Should Trigger - Capacity Reservation", () => {
    const capacityReservationPrompts: string[] = [
      "How do I create a Capacity Reservation Group in Azure?",
      "I need to reserve VM capacity in East US for Standard_D4s_v5",
      "Help me set up a CRG to guarantee compute capacity for my production VMs",
      "How do I associate a VM with a Capacity Reservation Group?",
      "I want to pre-provision capacity for GPU VMs before a product launch",
      "Disassociate my VMSS from a capacity reservation group",
      "How do I guarantee Azure VM capacity in a specific zone?",
      "Reserve Azure VM capacity for 10 Standard_E8s_v5 instances in West Europe zone 1",
    ];

    test.each(capacityReservationPrompts)(
      'triggers on capacity reservation prompt: "%s"',
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
      "Create a serverless function on AWS", // Wrong cloud provider
      "What is Docker Compose and how does it work?", // Unrelated
      "Help me configure nginx as a reverse proxy", // Unrelated
      "Deploy my Node.js app to Azure"
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
  });
});
