/**
 * Trigger Matcher Utility
 * 
 * Tests whether prompts should trigger a specific skill based on
 * the skill's description and keywords.
 */

import { LoadedSkill } from "./skill-loader";

export interface TriggerResult {
  triggered: boolean;
  confidence: number;
  reason: string;
  matchedKeywords: string[];
}

export interface PromptTestResult extends TriggerResult {
  prompt: string;
}

/**
 * TriggerMatcher class for testing skill activation
 */
export class TriggerMatcher {
  private skill: LoadedSkill;
  private keywords: string[];

  constructor(skill: LoadedSkill) {
    this.skill = skill;
    this.keywords = this._extractKeywords();
  }

  /**
   * Extract trigger keywords from skill metadata and content
   */
  private _extractKeywords(): string[] {
    const keywords = new Set<string>();
    
    // Extract from name (split on hyphens)
    if (this.skill.metadata.name) {
      this.skill.metadata.name.split("-").forEach(word => {
        if (word.length > 2) keywords.add(word.toLowerCase());
      });
    }

    // Extract from description
    if (this.skill.metadata.description) {
      const descWords = this.skill.metadata.description
        .toLowerCase()
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .filter(word => word.length > 3);
      descWords.forEach(word => keywords.add(word));
    }

    // Common Azure-related keywords to look for in content
    const azureKeywords = [
      "azure", "storage", "cosmos", "sql", "redis", "keyvault", "key vault",
      "function", "app service", "container", "aks", "kubernetes",
      "bicep", "terraform", "deploy", "monitor", "diagnostic",
      "security", "rbac", "identity", "entra", "authentication",
      "cli", "mcp", "validation", "networking", "observability"
    ];

    const contentLower = this.skill.content.toLowerCase();
    azureKeywords.forEach(kw => {
      if (contentLower.includes(kw)) {
        keywords.add(kw);
      }
    });

    return Array.from(keywords);
  }

  /**
   * Get extracted keywords for snapshot testing
   */
  getKeywords(): string[] {
    return this.keywords.sort();
  }

  /**
   * Test if a prompt should trigger this skill
   */
  shouldTrigger(prompt: string): TriggerResult {
    if (!prompt || typeof prompt !== "string") {
      return {
        triggered: false,
        confidence: 0,
        reason: "Empty or invalid prompt",
        matchedKeywords: []
      };
    }

    const promptLower = prompt.toLowerCase();
    const matchedKeywords: string[] = [];

    // Check for keyword matches
    for (const keyword of this.keywords) {
      if (promptLower.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }

    // Calculate confidence based on matches
    const confidence = matchedKeywords.length / Math.max(this.keywords.length, 1);
    
    // Threshold for triggering (at least 2 keywords or 20% match)
    const triggered = matchedKeywords.length >= 2 || confidence >= 0.2;

    return {
      triggered,
      confidence: Math.min(confidence, 1),
      reason: triggered 
        ? `Matched ${matchedKeywords.length} keywords` 
        : `Only matched ${matchedKeywords.length} keywords (need >= 2 or 20% confidence)`,
      matchedKeywords
    };
  }

  /**
   * Test multiple prompts and return results
   */
  testPrompts(prompts: string[]): PromptTestResult[] {
    return prompts.map(prompt => ({
      prompt,
      ...this.shouldTrigger(prompt)
    }));
  }
}

/**
 * Create a trigger matcher for a skill
 */
export function createTriggerMatcher(skill: LoadedSkill): TriggerMatcher {
  return new TriggerMatcher(skill);
}
