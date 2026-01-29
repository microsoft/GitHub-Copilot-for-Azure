/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CopilotClient, SessionEvent } from "@github/copilot-sdk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

// Works around the fact that these global constants are not available when using EcmaScript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type EvaluateResult = {
    isTestPassed: boolean,
    details?: string
};

export type AgentMetadata = {
    events: SessionEvent[];
};

export type TestConfig = {
    setup?: (workspace: string) => Promise<void>,
    prompt: string,
    shouldEarlyTerminate?: (partialAgentMetadata: AgentMetadata) => boolean
};

export async function run(config: TestConfig): Promise<AgentMetadata> {
    const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), `skill-test-`));

    try {
        if (config.setup) {
            await config.setup(testWorkspace);
        }

        const client = new CopilotClient({
            logLevel: "all",
            cwd: testWorkspace
        });

        const skillDirectory = path.resolve(__dirname, "../../plugin/skills");

        const session = await client.createSession({
            model: "claude-opus-4.5",
            skillDirectories: [skillDirectory],
            mcpServers: {
                azure: {
                    type: "stdio",
                    command: "npx",
                    args: ["-y", "@azure/mcp", "server", "start"],
                    tools: ["*"]
                }
            }
        });

        const agentMetadata: AgentMetadata = { events: [] };

        const done = new Promise<void>((resolve) => {
            session.on(async (event) => {
                console.log(`=== session event ${event.type}`);

                // Todo: filter out events that we are not interested in

                if (event.type === "session.idle") {
                    resolve();
                    return;
                }

                // Add all events to agentMetadata unless explicitly filtered out
                agentMetadata.events.push(event);
                if (config.shouldEarlyTerminate) {
                    if (config.shouldEarlyTerminate(agentMetadata)) {
                        resolve();
                        session.abort();
                        return;
                    }
                }

                // Log data of selected events for debugging
                if (event.type === "assistant.message") {
                    console.log("Assistant.message:", event.data.content);
                } else if (event.type === "assistant.message_delta") {
                    console.log("Assistant.message_delta:", event.data.deltaContent);
                } else if (event.type === "tool.execution_start") {
                    console.log("tool.execution_start:", event.data.toolName);
                } else if (event.type === "assistant.reasoning") {
                    console.log("assistant.reasoning:", event.data.content);
                } else if (event.type === "assistant.reasoning_delta") {
                    console.log("assistant.reasoning_delta:", event.data.deltaContent);
                } else if (event.type === "session.error") {
                    console.error("Assistant:", event.data.message);
                }
            });
        });

        await session.send({
            prompt: config.prompt
        });

        await done;

        await session.destroy();
        await client.stop();

        return agentMetadata;
    } catch (error) {
        // Todo: reveal error details for troubleshooting. Exceptions are neither success nor failure since they aren't expected.
        console.error(error);
        throw error;
    } finally {
        // Todo: possible clean up
    }
}

type AssistantMessageKeywordOptions = {
    // Default is false
    caseSensitive?: boolean;
}

/**
 * Checks if the assistant messages contain a given keyword.
 */
export function doesAssistantMessageIncludeKeyword(agentMetadata: AgentMetadata, keyword: string, options?: AssistantMessageKeywordOptions): boolean {
    // Merge all the messages and message deltas
    const allMessages: {[messageId: string]: string} = {};
    agentMetadata.events.forEach((event) => {
        if (event.type === "assistant.message") {
            allMessages[event.data.messageId] = event.data.content;
        }
        if (event.type === "assistant.message_delta") {
            if (allMessages[event.data.messageId]) {
                allMessages[event.data.messageId] += event.data.deltaContent;
            } else {
                allMessages[event.data.messageId] = event.data.deltaContent;
            }
        }
    });

    // Todo: remove this after testing
    console.log("allMessages", JSON.stringify(allMessages));
    return Object.keys(allMessages).some((messageId) => {
        if (options?.caseSensitive) {
            allMessages[messageId].includes(keyword);
        } else {
            return allMessages[messageId].toLowerCase().includes(keyword.toLowerCase());
        }
    });
}

/**
 * Checks if a skill is invoked.
 */
export function isSkillInvoked(agentMetadata: AgentMetadata, skillName: string): boolean {
    return agentMetadata.events
        .filter((event) => event.type === "tool.execution_start")
        .filter((event) => event.data.toolName === "skill")
        .some((event) => {
            const args = event.data.arguments;
            const isExpectedSkill = JSON.stringify(args).includes(skillName);
            return isExpectedSkill;
        });
}

/**
 * Checks if all the tool calls for a given tool are successful.
 */
export function areToolCallsSuccess(agentMetadata: AgentMetadata, toolName: string): boolean {
    const executionStartEvents = agentMetadata.events
        .filter((event) => event.type === "tool.execution_start")
        .filter((event) => event.data.toolName === toolName);
    const executionCompleteEvents = agentMetadata.events
        .filter((event) => event.type === "tool.execution_complete");

    return executionStartEvents.length > 0 && executionStartEvents.every((startEvent) => {
        const toolCallId = startEvent.data.toolCallId;
        return executionCompleteEvents.some((completeEvent) => completeEvent.data.toolCallId === toolCallId && completeEvent.data.success);
    });
}