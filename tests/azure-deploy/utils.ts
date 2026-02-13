import { type AgentMetadata, getAllAssistantMessages, getToolCalls } from "../utils/agent-runner";

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

/**
 * Check if file-creation tool calls produced Terraform (.tf) files
 */
export function hasTerraformFiles(agentMetadata: AgentMetadata): boolean {
  const fileToolCalls = getToolCalls(agentMetadata, "create_file");
  return fileToolCalls.some(event => {
    const args = JSON.stringify(event.data);
    return /\.tf"/i.test(args);
  });
}

/**
 * Check if file-creation tool calls produced Bicep (.bicep) files
 */
export function hasBicepFiles(agentMetadata: AgentMetadata): boolean {
  const fileToolCalls = getToolCalls(agentMetadata, "create_file");
  return fileToolCalls.some(event => {
    const args = JSON.stringify(event.data);
    return /\.bicep"/i.test(args);
  });
}