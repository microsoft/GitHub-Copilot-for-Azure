import { type AgentMetadata, getAllAssistantMessages, isSkillInvoked } from "../utils/agent-runner";
import { matchesCommand } from "../utils/evaluate";

/** Env-var patterns expected when deploying container-based Aspire apps. */
const CONTAINER_DEPLOY_ENV_PATTERNS: readonly RegExp[] = [
  /AZURE_CONTAINER_REGISTRY_ENDPOINT/i,
  /AZURE_CONTAINER_REGISTRY_MANAGED_IDENTITY_ID/i,
  /MANAGED_IDENTITY_CLIENT_ID/i,
];

/**
 * Soft-check that the agent set the expected container deploy env vars.
 * Emits warnings (testComments) instead of failing the test.
 */
export function softCheckContainerDeployEnvVars(agentMetadata: AgentMetadata): void {
  for (const pattern of CONTAINER_DEPLOY_ENV_PATTERNS) {
    if (!matchesCommand(agentMetadata, pattern)) {
      agentMetadata.testComments.push(
        `⚠️ Expected container deploy env var matching ${pattern} to be set, but it was not found.`
      );
    }
  }
}

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
