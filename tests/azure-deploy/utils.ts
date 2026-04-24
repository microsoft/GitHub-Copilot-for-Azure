import { type AgentMetadata, getAllAssistantMessages } from "../utils/agent-runner";
import { matchesCommand, softCheckSkill } from "../utils/evaluate";

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
 * Common Azure deployment link patterns.
 * Lookahead ensures the domain ends properly (not a substring of a longer host).
 * Includes `*` to handle markdown bold-wrapped URLs (`**url**`).
 */
const DEPLOY_LINK_PATTERNS = [
  // Azure App Service URLs
  /https?:\/\/[\w.-]+\.azurewebsites\.net(?=[/\s.`'"?#)\]*]|$)/i,
  // Azure Static Web Apps URLs
  /https:\/\/[\w.-]+\.azurestaticapps\.net(?=[/\s.`'"?#)\]*]|$)/i,
  // Azure Container Apps URLs
  /https:\/\/[\w.-]+\.azurecontainerapps\.io(?=[/\s.`'"?#)\]*]|$)/i,
  // static website from a storage account
  /https:\/\/[\w.-]+\.web\.core\.windows\.net(?=[/\s.`'"?#)\]*]|$)/i
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

export function shouldEarlyTerminateForCompletedDeployment(agentMetadata: AgentMetadata): boolean {
  const containsDeployLinks = hasDeployLinks(agentMetadata);
  if (containsDeployLinks) {
    const commentToAdd = "✅ Found link of the deployed web app in the response. Deployment completed successfully.";
    if (!agentMetadata.testComments.some((testComment) => testComment === commentToAdd)) {
      agentMetadata.testComments.push(commentToAdd);
    }
  }
  return containsDeployLinks;
}

export function shouldEarlyTerminateForAzdProvision(agentMetadata: AgentMetadata): boolean {
  const hasCalledProvision = matchesCommand(agentMetadata, /azd\s+(provision|up)\b/i);
  if (hasCalledProvision) {
    const commentToAdd = "✅ azd provision/up was called. Terminating early — infrastructure provisioning has started.";
    if (!agentMetadata.testComments.some((testComment) => testComment === commentToAdd)) {
      agentMetadata.testComments.push(commentToAdd);
    }
  }
  return hasCalledProvision;
}
