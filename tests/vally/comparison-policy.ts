import type { ExecutorOptions, Stimulus } from "@microsoft/vally";
import type { MCPServerConfig } from "@github/copilot-sdk";
import { DEFAULT_SKILL_CHAR_BUDGET, getFormattedSkillDescription, listPlugins, loadSkill, type SkillRef } from "../utils/skill-loader.ts";

export function isComparisonRun(): boolean {
  return process.env.VALLY_FAIR_COMPARISON === "true";
}

export function comparisonStimulus(stimulus: Stimulus, options: ExecutorOptions): Stimulus {
  if (!options.model?.trim() || process.env.MODEL_OVERRIDE?.trim()) {
    throw new Error("Fair comparison requires an explicit model and no MODEL_OVERRIDE.");
  }
  if (process.env.NO_SKILLS === "true") {
    throw new Error("Fair comparison requires skills; unset NO_SKILLS.");
  }
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
    throw new Error("Fair comparison requires a positive shared timeout.");
  }
  for (const key of ["CLAUDE_CONFIG_DIR", "SKILL_CHAR_BUDGET", "SKILLS_INSTRUCTIONS"]) {
    if (Object.keys(options.env ?? {}).some(name => name.toUpperCase() === key)) {
      throw new Error(`Comparison manages ${key}; remove it from environment.env.`);
    }
  }
  if (stimulus.tags?.takeScreenshot !== undefined) {
    throw new Error("Remove takeScreenshot from comparison evals; Claude cannot apply it.");
  }
  if (stimulus.constraints?.max_turns !== undefined) {
    throw new Error("Remove max_turns from comparison evals; runtimes count turns differently. Use the shared timeout.");
  }
  if (options.maxAgentDurationMs !== undefined || options.reasoningEffort !== undefined
    || options.executorConfig !== undefined || options.skills?.length) {
    throw new Error("Comparison supports neither max_agent_duration, reasoning_effort, executor config nor environment.skills. Select skills with requiredSkills.");
  }
  if (stimulus.supported_executors
    && !["claude-cli", "integration-test-agent-runner"].every(name => stimulus.supported_executors?.includes(name))) {
    throw new Error("Comparison stimuli must support both claude-cli and integration-test-agent-runner.");
  }
  getCommonSystemPrompt(stimulus);
  comparisonMcpServers(options);
  const tags = { ...stimulus.tags };
  if (tags.earlyTerminate !== undefined) {
    console.warn(`[${stimulus.name}] Fair comparison disables earlyTerminate for both clients.`);
    delete tags.earlyTerminate;
  }
  return { ...stimulus, tags };
}

export function getCommonSystemPrompt(stimulus: Stimulus): { mode: "append" | "replace"; content: string } | undefined {
  const value = stimulus.tags?.systemPrompt;
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error("systemPrompt must be a JSON string.");
  const prompt: unknown = JSON.parse(value);
  if (typeof prompt !== "object" || prompt === null || !("content" in prompt)
    || typeof prompt.content !== "string"
    || ("mode" in prompt && prompt.mode !== "append" && prompt.mode !== "replace")
    || Object.keys(prompt).some(key => key !== "mode" && key !== "content")) {
    throw new Error("systemPrompt supports only append/replace mode and string content.");
  }
  return { mode: "mode" in prompt && prompt.mode === "replace" ? "replace" : "append", content: prompt.content };
}

export async function comparisonSkills(stimulus: Stimulus): Promise<SkillRef[]> {
  const names = stimulus.tags?.requiredSkills ?? stimulus.tags?.skill;
  const required = typeof names === "string" ? [names] : names;
  if (!required?.length) throw new Error("Comparison requires skill or requiredSkills tags.");
  const allSkills = listPlugins().flatMap(plugin => plugin.skills);
  const refs = [...new Set(required)].sort().map(name => {
    const matches = allSkills.filter(ref => ref.name === name);
    if (matches.length !== 1) throw new Error(`Expected one built skill '${name}', found ${matches.length}. Run npm run build.`);
    return matches[0];
  });
  let chars = 0;
  for (const ref of refs) {
    const skill = await loadSkill(ref);
    chars += (await getFormattedSkillDescription(skill.metadata.name, skill.metadata.description)).length + 1;
  }
  if (chars > DEFAULT_SKILL_CHAR_BUDGET) {
    throw new Error("Comparison requiredSkills exceed the Copilot skill description budget. Reduce the shared skill set.");
  }
  return refs;
}

export function comparisonMcpServers(options: ExecutorOptions): NonNullable<ExecutorOptions["mcpServers"]> {
  const servers = options.mcpServers ?? {};
  for (const [name, server] of Object.entries(servers)) {
    // Upstream writes these fields verbatim to Claude's config, which does not
    // implement Vally's per-server timeout or working-directory fields.
    if (server.timeout !== undefined || ("cwd" in server && server.cwd !== undefined)) {
      throw new Error(`MCP server '${name}': comparison does not support timeout/cwd overrides.`);
    }
  }
  return servers;
}

export function comparisonCopilotMcpServers(options: ExecutorOptions): Record<string, MCPServerConfig> {
  return Object.fromEntries(Object.entries(comparisonMcpServers(options)).map(([name, server]) => {
    if (server.type === "stdio") {
      return [name, { type: "stdio", command: server.command, args: server.args, env: server.env, tools: ["*"] }];
    }
    return [name, { type: server.type, url: server.url, headers: server.headers, tools: ["*"] }];
  }));
}
