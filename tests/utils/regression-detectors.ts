/**
 * Regression Detectors
 *
 * Functions that scan AgentMetadata events for known failure patterns
 * in GHCP SDK → Azure deployment scenarios. Each detector returns a
 * count so tests can assert "≤ maxAllowed".
 */

import { type AgentMetadata } from "./agent-runner";
import { argsString, getAllToolText } from "./evaluate";

// ─── Detectors ───────────────────────────────────────────────────────────────

/**
 * Detect hardcoded secrets in generated code.
 * Scans file-write tool calls for suspicious patterns.
 */
export function countSecretsInCode(metadata: AgentMetadata): number {
  const secretPatterns = [
    /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}/gi,
    /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']{8,}/gi,
    /(?:secret|token)\s*[:=]\s*["'][A-Za-z0-9+/=]{16,}/gi,
    /(?:connection[_-]?string)\s*[:=]\s*["'][^"']{20,}/gi,
    // Azure-specific patterns
    /DefaultEndpointsProtocol=https;AccountName=/i,
    /SharedAccessSignature=sv=/i,
  ];

  let count = 0;
  const writeTools = ["create", "edit", "powershell", "bash"];

  for (const event of metadata.events) {
    if (event.type !== "tool.execution_start") continue;
    const toolName = event.data.toolName as string;
    if (!writeTools.some(t => toolName.includes(t))) continue;

    const args = argsString(event);
    for (const pattern of secretPatterns) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      const matches = args.match(pattern);
      if (matches) count += matches.length;
    }
  }
  return count;
}

/**
 * Detect API key usage in BYOM provider config when Azure endpoints are the target.
 * Azure BYOM should use `bearerToken` via `DefaultAzureCredential`, never `apiKey`.
 */
export function countApiKeyInByomConfig(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata);

  // Only flag if Azure BYOM context is present
  const azureByomPatterns = [
    /AZURE_AI_FOUNDRY_PROJECT_ENDPOINT/i,
    /DefaultAzureCredential/i,
    /bearerToken/i,
  ];
  const azureByomDomains = [
    ".services.ai.azure.com",
    ".openai.azure.com",
  ];
  const lowerText = allText.toLowerCase();

  const hasAzureByom = azureByomPatterns.some(p => p.test(allText)) ||
    azureByomDomains.some(d => lowerText.includes(d));
  if (!hasAzureByom) return 0;

  // Count apiKey usage in provider config context
  const apiKeyPatterns = [
    /apiKey\s*[:=]\s*(?:process\.env|["'])/gi,
    /provider\s*:\s*\{[^}]*apiKey/gi,
    /AZURE_OPENAI_(?:API_)?KEY/gi,
  ];

  let count = 0;
  for (const pattern of apiKeyPatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}
