/**
 * Trigger Tests for azure-diagnostics
 *
 * Tests that VM troubleshooting prompts route to diagnostics.
 */

import { TriggerMatcher } from "../utils/trigger-matcher";
import { loadSkill, LoadedSkill } from "../utils/skill-loader";

const SKILL_NAME = "azure-diagnostics";

describe(`${SKILL_NAME} - Trigger Tests`, () => {
  let triggerMatcher: TriggerMatcher;

  beforeAll(async () => {
    const skill: LoadedSkill = await loadSkill(SKILL_NAME);
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger - VM Connectivity Troubleshooting", () => {
    const prompts: string[] = [
      "I can't connect to my Azure VM via RDP",
      "RDP to my Azure VM shows a black screen",
      "Azure VM RDP connection times out on port 3389",
      "SSH connection to my Azure VM is refused",
      "I can't SSH into my Azure Linux VM anymore",
      "NSG is blocking connectivity to my Azure VM, troubleshoot port access",
      "Windows Firewall blocking RDP, can't connect to my Azure VM",
      "How do I reset the password on my Azure VM?",
      "Azure VM agent not responding, I can't connect via Run Command",
      "Remote Desktop service stopped, can't connect to my Azure VM",
    ];

    test.each(prompts)(
      'triggers on VM troubleshooting prompt: "%s"',
      (prompt) => {
        const result = triggerMatcher.shouldTrigger(prompt);
        expect(result.triggered).toBe(true);
        expect(result.matchedKeywords.length).toBeGreaterThanOrEqual(2);
      }
    );
  });
});
