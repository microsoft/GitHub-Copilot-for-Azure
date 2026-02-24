/**
 * Utility helpers for azure-hosted-copilot-sdk integration tests.
 *
 * - Workspace setup: scaffolds Express / Copilot-SDK mock projects using
 *   static resource files from the adjacent resources/ directory.
 * - Invocation-rate measurement: runs a prompt N times and logs the rate.
 * - Token sanitization: redacts bearer / JWT tokens from metadata output.
 */

import {
  useAgentRunner,
  isSkillInvoked,
  type AgentMetadata,
} from "../utils/agent-runner";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, "resources");

// --- Workspace setup helpers ---

/** Base Express + TypeScript app (no copilot SDK) */
export async function setupExpressApp(workspace: string): Promise<void> {
  fs.copyFileSync(path.join(RESOURCES_DIR, "express-app-package.json"), path.join(workspace, "package.json"));
  fs.copyFileSync(path.join(RESOURCES_DIR, "express-app-server.ts.txt"), path.join(workspace, "server.ts"));
  fs.copyFileSync(path.join(RESOURCES_DIR, "express-app-tsconfig.json"), path.join(workspace, "tsconfig.json"));
}

/** Express + TypeScript app WITH @github/copilot-sdk already installed */
export async function setupCopilotSdkApp(workspace: string): Promise<void> {
  fs.copyFileSync(path.join(RESOURCES_DIR, "copilot-sdk-app-package.json"), path.join(workspace, "package.json"));
  fs.copyFileSync(path.join(RESOURCES_DIR, "copilot-sdk-app-server.ts.txt"), path.join(workspace, "server.ts"));
  fs.copyFileSync(path.join(RESOURCES_DIR, "express-app-tsconfig.json"), path.join(workspace, "tsconfig.json"));
}

// --- Invocation rate helpers ---

export function logRate(skillName: string, label: string, successCount: number, runsPerPrompt: number): number {
  const rate = successCount / runsPerPrompt;
  const msg = `${skillName} invocation rate for ${label}: ${(rate * 100).toFixed(1)}% (${successCount}/${runsPerPrompt})`;
  console.log(msg);
  const reportsDir = path.join(__dirname, "..", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.appendFileSync(path.join(reportsDir, `result-${skillName}.txt`), msg + "\n");
  return rate;
}

export async function measureInvocationRate(
  agent: ReturnType<typeof useAgentRunner>,
  skillName: string,
  config: { prompt: string; setup?: (workspace: string) => Promise<void> },
  label: string,
  runsPerPrompt: number
): Promise<number> {
  let successCount = 0;
  for (let i = 0; i < runsPerPrompt; i++) {
    try {
      const metadata = await agent.run(config);
      if (isSkillInvoked(metadata, skillName)) {
        successCount++;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message?.includes("Failed to load @github/copilot-sdk")) {
        console.log("⏭️  SDK not loadable, skipping remaining runs");
        return -1; // signal to skip assertion
      }
      throw e;
    }
  }
  return logRate(skillName, label, successCount, runsPerPrompt);
}

// --- Token sanitization ---

/** Patterns that match common token / secret formats */
const TOKEN_PATTERNS = [
  // JWT tokens (three base64 segments separated by dots)
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // Bearer tokens in headers
  /Bearer\s+[A-Za-z0-9_\-.~+/]{20,}/gi,
  // GitHub tokens
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  // Azure / generic API keys (hex strings 32+ chars preceded by key/secret keyword)
  /(?:api[_-]?key|secret|token|password|credential)\s*[:=]\s*["']?[0-9a-fA-F]{32,}/gi,
];

/**
 * Redact token-like values from a string.
 * Returns the string with tokens replaced by `[REDACTED]`.
 */
export function redactTokens(text: string): string {
  let result = text;
  for (const pattern of TOKEN_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * Return a sanitized copy of AgentMetadata with token values redacted
 * from all string fields in events.
 */
export function sanitizeMetadata(metadata: AgentMetadata): AgentMetadata {
  return {
    ...metadata,
    events: metadata.events.map((event) => ({
      ...event,
      data: sanitizeData(event.data as Record<string, unknown>),
    })) as AgentMetadata["events"],
  };
}

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      result[key] = redactTokens(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? redactTokens(item)
          : item && typeof item === "object" && !Array.isArray(item)
            ? sanitizeData(item as Record<string, unknown>)
            : item
      );
    } else if (value && typeof value === "object") {
      result[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
