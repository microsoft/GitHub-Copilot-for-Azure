import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import {
  query,
  type Options as ClaudeAgentOptions,
  type SDKAssistantMessage,
  type SDKMessage,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { SessionEvent } from "@github/copilot-sdk";
import {
  computeToolAndSkillStats,
  type AgentMetadata,
  type AgentRunConfig,
  type AgentRunnerConfig,
  type IAgentRunner,
  type TokenUsage,
} from "./agent-runner.ts";
import { getSkillsForTest } from "./skill-loader.ts";

type AssistantMessageEvent = Extract<SessionEvent, { type: "assistant.message" }>;
type UserMessageEvent = Extract<SessionEvent, { type: "user.message" }>;
const MISSING_MESSAGE_TIMESTAMP = "1970-01-01T00:00:00.000Z";
type ToolCall = {
  model: string;
  name: string;
};
type PendingSkill = {
  requestedName: string;
};
type TranslationState = {
  assistantEvents: Map<string, AssistantMessageEvent>;
  mcpServerNames: string[];
  pendingSkill?: PendingSkill;
  toolCalls: Map<string, ToolCall>;
  userEvents: Map<string, UserMessageEvent>;
};
type RunnerResource = {
  abortController: AbortController;
  preserveWorkspace: boolean;
  workspace: string;
};

/**
 * You can use CAPI as the LLM service for the Claude Agent SDK.
 * To do so, set these environment variables before starting agent:
 * export ANTHROPIC_BASE_URL=https://api.githubcopilot.com
 * export ANTHROPIC_AUTH_TOKEN=$(gh auth token)
 */
export function useClaudeAgentRunner(_agentRunnerConfig: AgentRunnerConfig): IAgentRunner {
  const resources = new Set<RunnerResource>();

  async function cleanup(): Promise<void> {
    const cleanupErrors: unknown[] = [];

    for (const resource of resources) {
      resource.abortController.abort();
      try {
        if (!resource.preserveWorkspace) {
          fs.rmSync(resource.workspace, { recursive: true, force: true });
        }
      } catch (error) {
        cleanupErrors.push(error);
      } finally {
        resources.delete(resource);
      }
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(cleanupErrors, "Failed to clean up Claude agent runner resources.");
    }
  }

  async function run(runConfig: AgentRunConfig): Promise<AgentMetadata> {
    if (runConfig.takeScreenshot) {
      throw new Error("takeScreenshot is not supported by useClaudeAgentRunner.");
    }

    const workspace = runConfig.workspace
      ?? fs.mkdtempSync(path.join(os.tmpdir(), "claude-skill-test-"));
    const abortController = new AbortController();
    const resource: RunnerResource = {
      abortController,
      preserveWorkspace: runConfig.preserveWorkspace ?? false,
      workspace,
    };
    resources.add(resource);

    const metadata: AgentMetadata = {
      events: [],
      testComments: [],
      turnCount: 0,
      toolCounts: {},
      skillFiles: {},
      skillsLoaded: [],
      tokenUsage: createEmptyTokenUsage(),
    };
    const translationState: TranslationState = {
      assistantEvents: new Map(),
      mcpServerNames: [],
      toolCalls: new Map(),
      userEvents: new Map(),
    };
    let lastEventId: string | null = null;
    let sessionId: string | undefined;
    let timedOut = false;
    const timeout = runConfig.timeout === undefined
      ? undefined
      : setTimeout(() => {
        timedOut = true;
        abortController.abort();
      }, runConfig.timeout);

    try {
      await runConfig.setup?.(workspace);

      const { skillsLoaded, skillDirectories } = await getSkillsForTest(
        runConfig.requiredSkills,
        runConfig.includeSkills,
      );
      metadata.skillsLoaded = skillsLoaded;

      // Note: Claude Sdk runner doesn't support loading ad-hoc skills outside a plugin.
      // The "skills" option only allow lists skill that can be detected by the agent.
      const plugins: ClaudeAgentOptions["plugins"] = [
        ...new Set(skillDirectories.map(skillsDirectory => path.dirname(skillsDirectory))),
      ].map(pluginDirectory => ({
        type: "local",
        path: pluginDirectory,
        skipMcpDiscovery: false,
      }));

      const baseOptions: ClaudeAgentOptions = {
        abortController,
        canUseTool: async (_toolName, input) => ({
          behavior: "allow",
          updatedInput: input,
        }),
        cwd: workspace,
        env: {
          ...process.env,
          ...runConfig.env,
          AZURE_MCP_COLLECT_TELEMETRY: "false",
        },
        maxTurns: runConfig.maxTurns,
        model: runConfig.model,
        plugins,
        systemPrompt: toClaudeSystemPrompt(runConfig),
      };

      for (const prompt of [runConfig.prompt, ...(runConfig.followUp ?? [])]) {
        const eventCountBeforePrompt = metadata.events.length;
        const response = query({
          prompt,
          options: {
            ...baseOptions,
            ...(sessionId ? { resume: sessionId } : {}),
          },
        });

        for await (const message of response) {
          sessionId = "session_id" in message ? message.session_id : sessionId;

          lastEventId = appendSessionEvents(
            metadata,
            translationState,
            message,
            runConfig.model,
            eventCountBeforePrompt,
            lastEventId,
          );

          if (runConfig.shouldEarlyTerminate?.(metadata)) {
            abortController.abort();
            break;
          }
        }
      }

      const { toolCounts, skillFiles } = computeToolAndSkillStats(
        metadata.events,
        skillDirectories,
      );
      metadata.toolCounts = toolCounts;
      metadata.skillFiles = skillFiles;

      // Todo: support screenshot feature

      return metadata;
    } catch (error) {
      if (timedOut) {
        throw new Error(`Claude agent run timed out after ${runConfig.timeout} ms.`, {
          cause: error,
        });
      }
      throw error;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      resources.delete(resource);
      if (!resource.preserveWorkspace) {
        fs.rmSync(resource.workspace, { recursive: true, force: true });
      }
    }
  }

  return { run, cleanup };
}

function appendSessionEvents(
  metadata: AgentMetadata,
  state: TranslationState,
  message: SDKMessage,
  model: string | undefined,
  eventCountBeforePrompt: number,
  parentId: string | null,
): string | null {
  let lastEventId = parentId;
  const timestamp = getMessageTimestamp(message);

  if (message.type === "system" && message.subtype === "init") {
    state.mcpServerNames = message.mcp_servers.map(server => server.name);
    metadata.tokenUsage!.model = message.model;
    const event: Extract<SessionEvent, { type: "session.start" }> = {
      type: "session.start",
      id: message.uuid,
      parentId: lastEventId,
      timestamp,
      data: {
        copilotVersion: message.claude_code_version,
        producer: "claude-agent-sdk",
        selectedModel: message.model,
        sessionId: message.session_id,
        startTime: timestamp,
        version: 1,
      },
    };
    metadata.events.push(event);
    return event.id;
  }

  if (message.type === "system" && message.subtype === "hook_started") {
    const event: Extract<SessionEvent, { type: "hook.start" }> = {
      type: "hook.start",
      id: message.uuid,
      parentId: lastEventId,
      timestamp,
      data: {
        hookInvocationId: message.hook_id,
        hookType: message.hook_event,
      },
    };
    metadata.events.push(event);
    return event.id;
  }

  if (message.type === "system" && message.subtype === "hook_response") {
    const event: Extract<SessionEvent, { type: "hook.end" }> = {
      type: "hook.end",
      id: message.uuid,
      parentId: lastEventId,
      timestamp,
      data: {
        hookInvocationId: message.hook_id,
        hookType: message.hook_event,
        output: message.output,
        success: message.outcome === "success",
        ...(message.outcome === "error"
          ? { error: { message: message.stderr || message.output } }
          : {}),
      },
    };
    metadata.events.push(event);
    return event.id;
  }

  if (message.type === "user") {
    return appendUserResponse(metadata, state, message, model, lastEventId);
  }

  if (message.type === "assistant" && message.parent_tool_use_id === null) {
    return appendAssistantResponse(metadata, state, message, lastEventId);
  }

  if (message.type !== "result") {
    return lastEventId;
  }

  appendTokenUsage(metadata.tokenUsage!, message);

  const isError = message.subtype !== "success" || message.is_error;
  let messageEventIndex = 0;
  if (isError) {
    const details = message.subtype === "success"
      ? message.result
      : message.errors.join("\n");
    const errorEvent: Extract<SessionEvent, { type: "session.error" }> = {
      type: "session.error",
      id: getMessageEventId(message.uuid, messageEventIndex++),
      parentId: lastEventId,
      timestamp,
      data: {
        errorType: message.subtype,
        message: details,
      },
    };
    metadata.events.push(errorEvent);
    lastEventId = errorEvent.id;
  }

  if (
    !isError
    && message.subtype === "success"
    && (
      metadata.events.length === eventCountBeforePrompt
      || !metadata.events.slice(eventCountBeforePrompt)
        .some(event => event.type === "assistant.message")
    )
  ) {
    const event = createAssistantMessageEvent(
      message.uuid,
      message.result,
      model,
      lastEventId,
      timestamp,
      getMessageEventId(message.uuid, messageEventIndex++),
    );
    metadata.events.push(event);
    state.assistantEvents.set(event.data.messageId, event);
    lastEventId = event.id;
  }

  const turnEndEvent: Extract<SessionEvent, { type: "assistant.turn_end" }> = {
    type: "assistant.turn_end",
    id: getMessageEventId(message.uuid, messageEventIndex),
    parentId: lastEventId,
    timestamp,
    data: {
      model,
      turnId: message.user_message_uuid ?? message.uuid,
    },
  };
  metadata.events.push(turnEndEvent);
  metadata.turnCount++;
  return turnEndEvent.id;
}

function createEmptyTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalApiDurationMs: 0,
    apiCallCount: 0,
    model: "",
    perCallUsage: [],
  };
}

function appendTokenUsage(
  tokenUsage: TokenUsage,
  message: Extract<SDKMessage, { type: "result" }>,
): void {
  tokenUsage.inputTokens += message.usage.input_tokens;
  tokenUsage.outputTokens += message.usage.output_tokens;
  tokenUsage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
  tokenUsage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
  tokenUsage.totalApiDurationMs += message.duration_api_ms;
  tokenUsage.apiCallCount += message.num_turns;

  const models = Object.keys(message.modelUsage);
  if (models.length === 1) {
    tokenUsage.model = models[0];
  }
}

function appendAssistantResponse(
  metadata: AgentMetadata,
  state: TranslationState,
  message: SDKAssistantMessage,
  parentId: string | null,
): string | null {
  let lastEventId = parentId;
  let messageEventIndex = 0;

  for (const block of message.message.content) {
    if (block.type === "thinking") {
      if (block.thinking) {
        const event: Extract<SessionEvent, { type: "assistant.reasoning" }> = {
          type: "assistant.reasoning",
          id: getMessageEventId(message.uuid, messageEventIndex++),
          parentId: lastEventId,
          timestamp: getMessageTimestamp(message),
          data: {
            content: block.thinking,
            reasoningId: `${message.message.id}:${metadata.events.length}`,
          },
        };
        metadata.events.push(event);
        lastEventId = event.id;
      }
      continue;
    }

    if (block.type === "tool_use") {
      const toolName = normalizeToolName(block.name);
      const mcp = getMcpToolMetadata(block.name, state.mcpServerNames);
      const toolArguments = toolName === "skill"
        ? normalizeSkillToolArguments(block.input)
        : toToolArguments(block.input);
      const event: Extract<SessionEvent, { type: "tool.execution_start" }> = {
        type: "tool.execution_start",
        id: getMessageEventId(message.uuid, messageEventIndex++),
        parentId: lastEventId,
        timestamp: getMessageTimestamp(message),
        data: {
          toolCallId: block.id,
          toolName: mcp ? `${mcp.shortServerName}-${mcp.toolName}` : toolName,
          arguments: toolArguments,
          model: message.message.model,
          ...(mcp
            ? {
              mcpConfigServerName: mcp.serverName,
              mcpServerName: mcp.serverName,
              mcpToolName: mcp.toolName,
            }
            : {}),
        },
      };
      metadata.events.push(event);
      state.toolCalls.set(block.id, {
        model: message.message.model,
        name: toolName,
      });
      if (toolName === "skill") {
        const requestedName = getSkillRequestName(block.input);
        if (requestedName) {
          state.pendingSkill = {
            requestedName,
          };
        }
      }
      lastEventId = event.id;
      continue;
    }

    if (block.type === "text") {
      const existingEvent = state.assistantEvents.get(message.message.id);
      if (existingEvent) {
        existingEvent.data.content += block.text;
        continue;
      }

      const event = createAssistantMessageEvent(
        message.message.id,
        block.text,
        message.message.model,
        lastEventId,
        getMessageTimestamp(message),
        getMessageEventId(message.uuid, messageEventIndex++),
      );
      metadata.events.push(event);
      state.assistantEvents.set(message.message.id, event);
      lastEventId = event.id;
    }
  }

  return lastEventId;
}

function appendUserResponse(
  metadata: AgentMetadata,
  state: TranslationState,
  message: SDKUserMessage,
  model: string | undefined,
  parentId: string | null,
): string | null {
  const messageId = message.uuid ?? randomUUID();

  if (typeof message.message.content !== "string") {
    let lastEventId = parentId;
    let messageEventIndex = 0;
    const textBlocks: string[] = [];

    for (const block of message.message.content) {
      if (block.type === "tool_result") {
        const toolCall = state.toolCalls.get(block.tool_use_id);
        const content = stringifyToolResult(block.content);
        const success = block.is_error !== true;
        const event: Extract<SessionEvent, { type: "tool.execution_complete" }> = {
          type: "tool.execution_complete",
          id: getMessageEventId(messageId, messageEventIndex++),
          parentId: lastEventId,
          timestamp: getMessageTimestamp(message),
          data: {
            toolCallId: block.tool_use_id,
            model: toolCall?.model ?? model,
            success,
            ...(success
              ? { result: { content, detailedContent: content } }
              : { error: { message: content } }),
          },
        };
        metadata.events.push(event);
        state.toolCalls.delete(block.tool_use_id);
        lastEventId = event.id;
        continue;
      }

      if (block.type === "text") {
        textBlocks.push(block.text);
      }
    }

    const content = textBlocks.join("");
    if (!content) {
      return lastEventId;
    }

    const skill = parseSkillContent(content, state.pendingSkill);
    if (skill) {
      const event: Extract<SessionEvent, { type: "skill.invoked" }> = {
        type: "skill.invoked",
        id: getMessageEventId(messageId, messageEventIndex),
        parentId: lastEventId,
        timestamp: getMessageTimestamp(message),
        data: {
          name: skill.name,
          path: skill.path,
          content: skill.content,
          model,
          pluginName: skill.pluginName,
          source: "plugin",
          trigger: "agent-invoked",
        },
      };
      metadata.events.push(event);
      state.pendingSkill = undefined;
      return event.id;
    }

    return appendUserMessage(
      metadata,
      state.userEvents,
      message,
      content,
      lastEventId,
      getMessageEventId(messageId, messageEventIndex),
    );
  }

  return appendUserMessage(
    metadata,
    state.userEvents,
    message,
    message.message.content,
    parentId,
    messageId,
  );
}

function appendUserMessage(
  metadata: AgentMetadata,
  userEvents: Map<string, UserMessageEvent>,
  message: SDKUserMessage,
  content: string,
  parentId: string | null,
  eventId: string,
): string | null {
  const messageId = message.uuid ?? eventId;
  const existingEvent = userEvents.get(messageId);
  if (existingEvent) {
    existingEvent.data.content += content;
    return parentId;
  }

  const event = createUserMessageEvent(
    messageId,
    content,
    message.timestamp,
    parentId,
    eventId,
  );
  metadata.events.push(event);
  userEvents.set(messageId, event);
  return event.id;
}

function normalizeToolName(name: string): string {
  return name.toLowerCase();
}

function toToolArguments(
  input: unknown,
): Extract<SessionEvent, { type: "tool.execution_start" }>["data"]["arguments"] {
  return JSON.parse(JSON.stringify(input));
}

function normalizeSkillToolArguments(
  input: unknown,
): Extract<SessionEvent, { type: "tool.execution_start" }>["data"]["arguments"] {
  const argumentsValue = toToolArguments(input);
  if (
    typeof argumentsValue === "object"
    && argumentsValue !== null
    && !Array.isArray(argumentsValue)
    && typeof argumentsValue.skill === "string"
  ) {
    argumentsValue.skill = argumentsValue.skill.split(":").at(-1) ?? argumentsValue.skill;
  }

  return argumentsValue;
}

function getMcpToolMetadata(
  claudeToolName: string,
  serverNames: string[],
): {
  serverName: string;
  shortServerName: string;
  toolName: string;
} | undefined {
  if (!claudeToolName.startsWith("mcp__")) {
    return undefined;
  }

  const encodedName = claudeToolName.slice("mcp__".length);
  const serverName = [...serverNames]
    .sort((left, right) => right.length - left.length)
    .find(candidate => encodedName.startsWith(`${candidate.replaceAll(/[^a-zA-Z0-9]/g, "_")}__`));
  if (!serverName) {
    return undefined;
  }

  return {
    serverName,
    shortServerName: serverName.split(":").at(-1) ?? serverName,
    toolName: encodedName.slice(
      `${serverName.replaceAll(/[^a-zA-Z0-9]/g, "_")}__`.length,
    ),
  };
}

function getSkillRequestName(input: unknown): string | undefined {
  if (
    typeof input === "object"
    && input !== null
    && "skill" in input
    && typeof input.skill === "string"
  ) {
    return input.skill;
  }

  return undefined;
}

function parseSkillContent(
  value: string,
  pendingSkill: PendingSkill | undefined,
): {
  content: string;
  name: string;
  path: string;
  pluginName?: string;
} | undefined {
  if (!pendingSkill) {
    return undefined;
  }

  const match = /^Base directory for this skill: ([^\r\n]+)\r?\n\r?\n([\s\S]*)$/u.exec(value);
  if (!match) {
    return undefined;
  }

  const requestedNameParts = pendingSkill.requestedName.split(":");
  return {
    content: match[2],
    name: requestedNameParts.at(-1) ?? pendingSkill.requestedName,
    path: path.join(match[1], "SKILL.md"),
    ...(requestedNameParts.length > 1 ? { pluginName: requestedNameParts[0] } : {}),
  };
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map(item => {
      if (
        typeof item === "object"
        && item !== null
        && "type" in item
        && item.type === "text"
        && "text" in item
        && typeof item.text === "string"
      ) {
        return item.text;
      }
      return JSON.stringify(item);
    }).join("");
  }

  return JSON.stringify(content) ?? String(content);
}

function createUserMessageEvent(
  messageId: string,
  content: string,
  timestamp: string | undefined,
  parentId: string | null,
  eventId: string,
): UserMessageEvent {
  return {
    type: "user.message",
    id: eventId,
    parentId,
    timestamp: timestamp ?? MISSING_MESSAGE_TIMESTAMP,
    data: {
      content,
      messageId,
    },
  };
}

function createAssistantMessageEvent(
  messageId: string,
  content: string,
  model: string | undefined,
  parentId: string | null,
  timestamp: string,
  eventId: string,
): AssistantMessageEvent {
  return {
    type: "assistant.message",
    id: eventId,
    parentId,
    timestamp,
    data: {
      content,
      messageId,
      model,
    },
  };
}

function getMessageEventId(messageId: string, eventIndex: number): string {
  return eventIndex === 0 ? messageId : `${messageId}:${eventIndex}`;
}

function getMessageTimestamp(message: SDKMessage): string {
  if ("timestamp" in message && typeof message.timestamp === "string") {
    return message.timestamp;
  }

  return MISSING_MESSAGE_TIMESTAMP;
}

function toClaudeSystemPrompt(
  runConfig: AgentRunConfig,
): ClaudeAgentOptions["systemPrompt"] {
  const systemPrompt = runConfig.systemPrompt;
  if (!systemPrompt) {
    return undefined;
  }

  if (systemPrompt.mode === "replace") {
    return systemPrompt.content;
  }

  if (systemPrompt.mode === "customize" && systemPrompt.sections) {
    throw new Error(
      "Customized Copilot system prompt sections cannot be translated to Claude Agent SDK.",
    );
  }

  return {
    type: "preset",
    preset: "claude_code",
    append: systemPrompt.content,
  };
}
