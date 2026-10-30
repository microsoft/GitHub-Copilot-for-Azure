# Sdk Runner Lifecycle

This article documents necessary knowledge for understanding how the sdk runners manage agent lifecycle during evaluation.

## Session

An agent session contains all the context that can influence future LLM output, including user prompts, tool call requests, tool call results and LLM responses. In most cases, our sdk agent runners handle all interactions in one agent session for each test case.

## Turn

Vally defines a turn as the interactions between when a user submits a prompt and the agent concludes that when there is no more work to be done until the next user prompt. It's worth noting that agent sdks have different concepts that are also called turns.

## Copilot Sdk Runner

Copilot Sdk runner manages the lifecycle of an agent session by subscribing to the events emitted by the CopilotSession object. The emitted sessions contain key information that allows the runner to identify the state of the session.

Here are some important events that the runner keeps track of.

- **"session.start", "session.shutdown"**. These events indicate the start and the end of a session.
- **"user.message"**. These events indicate the user prompts explicitly sent to the agent.
- **"assistant.message"**. These events indicate the plain text response received from the LLM.
- **"assistant.turn_start", "assistant.turn_end"**. These events indicate the start and the end of a Copilot Sdk's turn. A Copilot Sdk's turn is defined as the interactions between when a request is sent to the LLM and when the LLM sends the response back.
- **"tool.execution_start", "tool.execution_complete"**. These events indicate the agent executing tool call requests from the LLM and the results of the execution.
- **"skill.invoked"**. These events indicate a skill is loaded. We are interested in identifying which skills are invoked since this project is built for skills.

> Note: A turn under our definition may contain multiple Copilot Sdk turns if the agent makes more than one request to the LLM.

Here is an example to illustrate the difference between Vally's turn definition and Copilot Sdk's turn definition. Suppose a user asks the agent to use AzCli to query the tags of a resource group.

- Start of our turn 1
    - Start of Copilot Sdk turn 1
        - agent sends user prompt to the LLM
        - LLM responds with tool call request to call AzCli
        - agent calls AzCli and gets the response
    - End of Copilot Sdk turn 1
    - Start of Copilot Sdk turn 2
        - agent sends the AzCli response to the LLM
        - LLM generates a plain text response from the tool call results and indicates there is no more work to be done
        - agent presents the LLM response to the user
    - End of Copilot Sdk turn 2
- End of our turn 1

There are 2 Copilot Sdk turns but there is only 1 turn in Vally's definition. If we need to write a grader that is scoped to a specific turn or use `maxTurns` property, the turn number needs to be set following Vally's turn definition.
