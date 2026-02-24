/**
 * Regression Detectors
 *
 * Functions that scan AgentMetadata events for known failure patterns
 * in GHCP SDK → Azure deployment scenarios. Each detector returns a
 * count so tests can assert "≤ maxAllowed".
 */

import { type AgentMetadata } from "./agent-runner";
import { getAllAssistantMessages, argsString, getToolResults, getAllToolText } from "./evaluate";

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
  const writeTools = ["create", "edit", "powershell"];

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
 * Count ACR auth spirals — consecutive failed ACR login/push/pull attempts.
 */
export function countAcrAuthSpirals(metadata: AgentMetadata): number {
  const acrPattern = /(?:acr|docker)\s+(?:login|push|pull)|az\s+acr/i;
  let consecutiveFailures = 0;
  let maxSpiral = 0;

  // Pre-index completions by toolCallId for O(1) lookup
  const completionsByCallId = new Map<string, { success: boolean }>();
  for (const event of metadata.events) {
    if (event.type === "tool.execution_complete") {
      completionsByCallId.set(
        event.data.toolCallId as string,
        { success: (event.data as Record<string, unknown>).success as boolean }
      );
    }
  }

  for (const event of metadata.events) {
    if (event.type === "tool.execution_start" && acrPattern.test(argsString(event))) {
      const completion = completionsByCallId.get(event.data.toolCallId as string);
      if (completion && !completion.success) {
        consecutiveFailures++;
        maxSpiral = Math.max(maxSpiral, consecutiveFailures);
      } else {
        consecutiveFailures = 0;
      }
    }
  }
  return maxSpiral;
}

/**
 * Count port binding confusion — conflicting PORT/WEBSITES_PORT/EXPOSE values.
 */
export function countPortBindingConfusion(metadata: AgentMetadata): number {
  const allText = getAllAssistantMessages(metadata) + "\n" + getAllToolText(metadata);

  const portRefs: Record<string, Set<string>> = {};
  const portPatterns: Array<{ name: string; regex: RegExp }> = [
    { name: "WEBSITES_PORT", regex: /WEBSITES_PORT\s*[:=]\s*["']?(\d+)/gi },
    { name: "PORT", regex: /(?:^|\s)PORT\s*[:=]\s*["']?(\d+)/gi },
    { name: "EXPOSE", regex: /EXPOSE\s+(\d+)/gi },
    { name: "listen", regex: /\.listen\(\s*(\d+)/gi },
  ];

  for (const { name, regex } of portPatterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null = null;
    while ((match = regex.exec(allText)) !== null) {
      if (!portRefs[name]) portRefs[name] = new Set();
      portRefs[name].add(match[1]);
    }
  }

  // Count confusion: different port numbers referenced for different config points
  const allPorts = new Set<string>();
  for (const ports of Object.values(portRefs)) {
    for (const p of ports) allPorts.add(p);
  }

  // If multiple distinct ports are referenced, that's confusion
  return allPorts.size > 1 ? allPorts.size - 1 : 0;
}

/**
 * Count hosting choice thrashing — reversals between Web App and Container Apps.
 */
export function countHostingThrashing(metadata: AgentMetadata): number {
  const text = getAllAssistantMessages(metadata);
  const lines = text.split("\n");

  type HostingChoice = "webapp" | "container-apps" | null;
  let current: HostingChoice = null;
  let reversals = 0;

  const webAppPattern = /\b(?:web\s*app|app\s*service|microsoft\.web\/sites)\b/i;
  const acaPattern = /\b(?:container\s*apps?|ACA|microsoft\.app\/containerApps)\b/i;

  for (const line of lines) {
    const isWebApp = webAppPattern.test(line);
    const isAca = acaPattern.test(line);

    let detected: HostingChoice = null;
    if (isWebApp && !isAca) detected = "webapp";
    if (isAca && !isWebApp) detected = "container-apps";

    if (detected && current && detected !== current) {
      reversals++;
    }
    if (detected) current = detected;
  }

  return reversals;
}

/**
 * Count managed identity / DefaultAzureCredential failures in tool results.
 */
export function countManagedIdentityFailures(metadata: AgentMetadata): number {
  const errorPatterns = [
    /DefaultAzureCredential/i,
    /managed\s*identity.*(?:fail|error|denied)/i,
    /ManagedIdentityCredential/i,
    /AADSTS\d+/i,
  ];

  let count = 0;
  for (const result of getToolResults(metadata)) {
    if (!result.success) {
      const text = result.content + " " + result.error;
      for (const pattern of errorPatterns) {
        if (pattern.test(text)) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

/**
 * Count SSE streaming configuration issues.
 * Looks for proxy buffering problems in Bicep/Dockerfile/nginx config.
 */
export function countSseStreamingBreaks(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata);
  const problemPatterns = [
    /proxy_buffering\s+on/i,
    /X-Accel-Buffering.*yes/i,
    /response[_-]?buffering.*true/i,
  ];

  let count = 0;
  for (const pattern of problemPatterns) {
    if (pattern.test(allText)) count++;
  }
  return count;
}

/**
 * Count "model not found" / "deployment not found" errors for AI model deployments.
 */
export function countModelDeploymentMissing(metadata: AgentMetadata): number {
  const errorPatterns = [
    /model.*not\s*found/i,
    /deployment.*not\s*found/i,
    /resource.*not\s*found.*openai/i,
    /DeploymentNotFound/i,
  ];

  let count = 0;
  const allText = getAllToolText(metadata);
  for (const pattern of errorPatterns) {
    const matches = allText.match(new RegExp(pattern.source, "gi"));
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Detect raw OpenAI SDK usage when Foundry SDK should be used.
 */
export function countFoundryConfusion(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata);
  const confusionPatterns = [
    /from\s+["']openai["']/g,
    /require\s*\(\s*["']openai["']\s*\)/g,
    /import\s+OpenAI\s+from/g,
    /new\s+OpenAI\s*\(/g,
  ];

  let count = 0;
  for (const pattern of confusionPatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Count agent API format mismatch errors (webhook / SSE format translation).
 */
export function countAgentApiFormatMismatch(metadata: AgentMetadata): number {
  const errorPatterns = [
    /invalid.*(?:webhook|payload|format)/i,
    /SSE.*(?:parse|format|invalid)/i,
    /content[_-]?type.*mismatch/i,
    /unexpected.*(?:event|stream)\s*format/i,
  ];

  let count = 0;
  for (const result of getToolResults(metadata)) {
    if (!result.success) {
      const text = result.content + " " + result.error;
      for (const pattern of errorPatterns) {
        if (pattern.test(text)) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

/**
 * Count AI Search connection failures.
 */
export function countAiSearchConnectionFailures(metadata: AgentMetadata): number {
  const errorPatterns = [
    /search.*(?:index|service).*(?:not\s*found|error|fail)/i,
    /grounding.*(?:fail|error)/i,
    /data\s*source.*(?:not\s*found|error)/i,
  ];

  let count = 0;
  for (const result of getToolResults(metadata)) {
    if (!result.success) {
      const text = result.content + " " + result.error;
      for (const pattern of errorPatterns) {
        if (pattern.test(text)) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

/**
 * Detect ACR admin credential usage in generated Bicep/code.
 * Skill requires managed identity; adminUserEnabled: true is banned.
 */
export function countAcrAdminCredentialUsage(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata);
  const antiPatterns = [
    /adminUserEnabled\s*:\s*true/gi,
    /listCredentials\(\)/gi,
    /\.listCredentials\(\)\.passwords/gi,
    /\.listCredentials\(\)\.username/gi,
  ];

  let count = 0;
  for (const pattern of antiPatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Detect GITHUB_TOKEN passed as plain Bicep @secure parameter instead of Key Vault.
 * Counts instances where the token is wired as a direct secret value rather than
 * via Key Vault secretUri reference.
 */
export function countMissingKeyVaultForToken(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata);

  // Positive: Key Vault is used (these reduce the count)
  const kvPatterns = [
    /keyVaultUrl/i,
    /Microsoft\.KeyVault\/vaults\/secrets/i,
    /secretUri/i,
    /@Microsoft\.KeyVault\(/i,
  ];
  const hasKeyVault = kvPatterns.some(p => p.test(allText));

  // Negative: token passed as direct secret value
  const directSecretPatterns = [
    /name:\s*'github-token'\s*\n\s*value:\s*githubToken/gi,
    /@secure\(\)\s*\n.*param\s+githubToken/gi,
    /secret.*value.*githubToken(?!.*keyVault)/gi,
  ];

  let count = 0;
  for (const pattern of directSecretPatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
  }

  // If Key Vault is present alongside direct refs, reduce severity
  return hasKeyVault ? Math.max(0, count - 1) : count;
}

/**
 * Detect wrong session.on() usage pattern in generated Copilot SDK code.
 * The correct API is session.on((event) => { switch(event.type) ... })
 * NOT session.on("event_name", handler).
 */
export function countWrongSessionOnPattern(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata);
  const wrongPatterns = [
    /session\.on\s*\(\s*["']/g,           // session.on("... or session.on('...
    /\.on\s*\(\s*["']assistant\./g,       // .on("assistant.message_delta"...
    /\.on\s*\(\s*["']tool\./g,            // .on("tool.execution_start"...
    /\.on\s*\(\s*["']session\./g,         // .on("session.idle"...
  ];

  // Exclude common non-SDK patterns (Express app.on, process.on)
  const excludePatterns = [
    /app\.on\s*\(/g,
    /process\.on\s*\(/g,
    /server\.on\s*\(/g,
    /emitter\.on\s*\(/g,
  ];

  let count = 0;
  for (const pattern of wrongPatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
  }

  // Subtract false positives from non-SDK .on() calls
  for (const pattern of excludePatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count -= matches.length;
  }

  // Also check for wrong event name
  const wrongEventNames = [
    /tool\.execution_end/g,
    /assistant\.message_end/g,
    /session\.done/g,
  ];
  for (const pattern of wrongEventNames) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
  }

  return Math.max(0, count);
}

/**
 * Detect inline HTML embedded as string literals in TypeScript/JavaScript.
 * The correct pattern is to create a separate public/test.html file
 * and serve via express.static().
 */
export function countInlineHtmlInCode(metadata: AgentMetadata): number {
  const allText = getAllToolText(metadata) + "\n" + getAllAssistantMessages(metadata);

  const inlinePatterns = [
    /const\s+\w*HTML\w*\s*=\s*`<!DOCTYPE/gi,        // const TEST_PAGE_HTML = `<!DOCTYPE
    /const\s+\w*html\w*\s*=\s*`<!DOCTYPE/gi,        // const htmlContent = `<!DOCTYPE
    /res\.send\s*\(\s*`<!DOCTYPE/g,                  // res.send(`<!DOCTYPE
    /res\.send\s*\(\s*\w*HTML/g,                     // res.send(TEST_PAGE_HTML)
  ];

  let count = 0;
  for (const pattern of inlinePatterns) {
    pattern.lastIndex = 0;
    const matches = allText.match(pattern);
    if (matches) count += matches.length;
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
