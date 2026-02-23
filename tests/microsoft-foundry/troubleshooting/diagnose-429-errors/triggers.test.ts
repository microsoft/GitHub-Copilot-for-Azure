/**
 * Trigger Tests for diagnose-429-errors
 * 
 * Tests that verify the skill triggers on appropriate prompts
 * and does NOT trigger on unrelated prompts.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { TriggerMatcher } from "../../../utils/trigger-matcher";
import { LoadedSkill } from "../../../utils/skill-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILL_FILE = path.resolve(
  __dirname,
  "../../../../plugin/skills/microsoft-foundry/troubleshooting/diagnose-429-errors.md"
);

function loadTroubleshootingSkill(): LoadedSkill {
  const fileContent = fs.readFileSync(SKILL_FILE, "utf-8");
  const { data: metadata, content } = matter(fileContent);
  return {
    metadata: {
      name: metadata.name as string,
      description: metadata.description as string,
      ...metadata,
    },
    content: content.trim(),
    path: path.dirname(SKILL_FILE),
    filePath: SKILL_FILE,
  };
}

describe("diagnose-429-errors - Trigger Tests", () => {
  let triggerMatcher: TriggerMatcher;
  let skill: LoadedSkill;

  beforeAll(() => {
    skill = loadTroubleshootingSkill();
    triggerMatcher = new TriggerMatcher(skill);
  });

  describe("Should Trigger", () => {
    const shouldTriggerPrompts: string[] = [
      "I'm getting 429 errors on my Azure OpenAI deployment",
      "Rate limit exceeded on my Foundry model",
      "My deployment is being throttled with Too Many Requests",
      "How do I handle rate limiting in Azure OpenAI?",
      "Token rate limit exceeded on my GPT-4 deployment",
      "I keep getting RateLimitReached errors",
      "My TPM limit is too low for my deployment",
      "How to increase RPM limit on Azure OpenAI?",
      "Retry-After header keeps appearing in my responses",
      "Help with capacity planning for my Azure OpenAI deployment",
      "Why am I getting rate limited on my model deployment?",
      "Quota exceeded error on my Foundry resource",
    ];

    test.each(shouldTriggerPrompts)(
      'triggers on: "%s"',
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
      "Help me with AWS Lambda",
      "Configure my PostgreSQL database",
      "How do I write Python code?",
      "Help me with Kubernetes pods",
      "Set up a virtual network in Azure",
      "Create a new storage account",
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
      const longPrompt = "429 rate limit error ".repeat(100);
      const result = triggerMatcher.shouldTrigger(longPrompt);
      expect(typeof result.triggered).toBe("boolean");
    });

    test("is case insensitive", () => {
      const result1 = triggerMatcher.shouldTrigger("RATE LIMIT 429 ERROR AZURE OPENAI");
      const result2 = triggerMatcher.shouldTrigger("rate limit 429 error azure openai");
      expect(result1.triggered).toBe(result2.triggered);
    });
  });
});
