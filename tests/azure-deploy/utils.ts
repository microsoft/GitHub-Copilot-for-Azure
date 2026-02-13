import { type AgentMetadata, getAllAssistantMessages, isSkillInvoked, getToolCalls } from "../utils/agent-runner";

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
  const isDeploySkillUsed = isSkillInvoked(agentMetadata, "azure-deploy");
  const isValidateInvoked = isSkillInvoked(agentMetadata, "azure-validate");
  const isPrepareInvoked = isSkillInvoked(agentMetadata, "azure-prepare");

  if (!isDeploySkillUsed) {
    agentMetadata.testComments.push("⚠️ azure-deploy skill was expected to be used but was not used.");
  }
  if (!isValidateInvoked) {
    agentMetadata.testComments.push("⚠️ azure-validate skill was expected to be used but was not used.");
  }
  if (!isPrepareInvoked) {
    agentMetadata.testComments.push("⚠️ azure-prepare skill was expected to be used but was not used.");
  }
}

/**
 * Check if file-creation tool calls produced Terraform (.tf) files
 */
export function hasTerraformFiles(agentMetadata: AgentMetadata): boolean {
  const fileToolCalls = getToolCalls(agentMetadata, "create");
  return fileToolCalls.some(event => {
    const args = JSON.stringify(event.data);
    return /\.tf"/i.test(args);
  });
}

/**
 * Check if file-creation tool calls produced Bicep (.bicep) files
 */
export function hasBicepFiles(agentMetadata: AgentMetadata): boolean {
  const fileToolCalls = getToolCalls(agentMetadata, "create");
  return fileToolCalls.some(event => {
    const args = JSON.stringify(event.data);
    return /\.bicep"/i.test(args);
  });
}