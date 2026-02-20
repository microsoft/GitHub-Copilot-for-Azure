import { type AgentMetadata, getAllAssistantMessages, isSkillInvoked } from "../utils/agent-runner";
import { softCheckSkill } from "../utils/evaluate";
export { expectFiles } from "../azure-prepare/utils";

/**
 * Common Azure deployment link patterns
 * Patterns ensure the domain ends properly to prevent matching evil.com/azurewebsites.net or similar
 */
const DEPLOY_LINK_PATTERNS = [
  // Azure App Service URLs (matches domain followed by path, query, fragment, whitespace, or punctuation)
  /https?:\/\/[\w.-]+\.azurewebsites\.net(?=[/\s?#)\]]|$)/i,
  // Azure Static Web Apps URLs
  /https:\/\/[\w.-]+\.azurestaticapps\.net(?=[/\s?#)\]]|$)/i,
  // Azure Container Apps URLs
  /https:\/\/[\w.-]+\.azurecontainerapps\.io(?=[/\s?#)\]]|$)/i
];

/**
 * Check if the agent response contains any Azure deployment links
 */
export function hasDeployLinks(agentMetadata: AgentMetadata): boolean {
  const content = getAllAssistantMessages(agentMetadata);

  return DEPLOY_LINK_PATTERNS.some(pattern => pattern.test(content));
}

export function softCheckDeploySkills(agentMetadata: AgentMetadata): void {
  softCheckSkill(agentMetadata, "azure-deploy");
  softCheckSkill(agentMetadata, "azure-validate");
  softCheckSkill(agentMetadata, "azure-prepare");
}
