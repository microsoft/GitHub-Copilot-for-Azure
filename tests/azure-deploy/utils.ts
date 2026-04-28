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
  const hasStartedAzdUp = matchesCommand(agentMetadata, /azd\s+up\b/i);
  if (hasStartedAzdUp) {
    const commentToAdd = "✅ azd up started running. Terminating early — end-to-end provisioning/deployment has started.";
    if (!agentMetadata.testComments.some((testComment) => testComment === commentToAdd)) {
      agentMetadata.testComments.push(commentToAdd);
    }
    return true;
  }

  // For azd provision, terminate only after at least one matching tool call completed.
  const azdProvisionCallIds = new Set(
    agentMetadata.events
      .filter((event) => event.type === "tool.execution_start")
      .filter((event) => {
        if (event.data.toolName !== "bash" && event.data.toolName !== "powershell") {
          return false;
        }
        const args = event.data.arguments as { command?: string } | undefined;
        return /azd\s+provision\b/i.test(args?.command ?? "");
      })
      .map((event) => event.data.toolCallId)
      .filter((toolCallId): toolCallId is string => typeof toolCallId === "string"),
  );

  const hasSuccessfulAzdProvision =
    azdProvisionCallIds.size > 0
    && agentMetadata.events.some((event) =>
      event.type === "tool.execution_complete"
      && typeof event.data.toolCallId === "string"
      && event.data.success === true
      && azdProvisionCallIds.has(event.data.toolCallId)
    );

  if (hasSuccessfulAzdProvision) {
    const commentToAdd = "✅ At least one azd provision command completed successfully. Terminating early.";
    if (!agentMetadata.testComments.some((testComment) => testComment === commentToAdd)) {
      agentMetadata.testComments.push(commentToAdd);
    }
  }

  return hasSuccessfulAzdProvision;
}
