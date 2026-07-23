from __future__ import annotations

import os
import sys
from pathlib import Path

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    TextBlock,
)
from fastapi import FastAPI
from pydantic import BaseModel, Field

INSTRUCTIONS = """You are a concise customer-support agent.
For every order-status question, call get_order_status before answering.
Only report facts returned by the tool. If an order is not found, ask the
customer to verify the order ID.
"""

MCP_SERVER_PATH = Path(__file__).with_name("mcp_server.py")

app = FastAPI(title="Claude Agent SDK order support")


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)


class ChatResponse(BaseModel):
    response: str


def build_options() -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        system_prompt=INSTRUCTIONS,
        model=os.getenv("CLAUDE_MODEL") or None,
        tools=[],
        mcp_servers={
            "order-support": {
                "type": "stdio",
                "command": sys.executable,
                "args": [str(MCP_SERVER_PATH)],
            }
        },
        strict_mcp_config=True,
        allowed_tools=["mcp__order-support__get_order_status"],
        max_turns=3,
    )


async def run(prompt: str) -> str:
    options = build_options()
    response_parts: list[str] = []
    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        response_parts.append(block.text)
    return "\n".join(response_parts)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    response = await run(prompt=request.prompt)
    return ChatResponse(response=response)
