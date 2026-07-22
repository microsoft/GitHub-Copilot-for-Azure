from __future__ import annotations

import json
import os
import uuid
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    TextBlock,
    create_sdk_mcp_server,
    tool,
)
from fastapi import FastAPI
from pydantic import BaseModel, Field

INSTRUCTIONS = """You are a concise customer-support agent.
For every order-status question, call get_order_status before answering.
Only report facts returned by the tool. If an order is not found, ask the
customer to verify the order ID.
"""

ORDERS = {
    "A100": {
        "status": "shipped",
        "tracking_number": "ZX-42",
        "estimated_delivery": "2026-07-24",
    },
    "B200": {
        "status": "processing",
        "estimated_ship_date": "2026-07-23",
    },
}


@tool(
    "get_order_status",
    "Look up an order by its order ID.",
    {"order_id": str},
)
async def get_order_status(args: dict[str, Any]) -> dict[str, Any]:
    order_id = args["order_id"].strip().upper()
    order = ORDERS.get(order_id)
    result = (
        {"found": True, "order_id": order_id, **order}
        if order
        else {"found": False, "order_id": order_id}
    )
    return {"content": [{"type": "text", "text": json.dumps(result)}]}


support_tools = create_sdk_mcp_server(
    name="order-support",
    version="1.0.0",
    tools=[get_order_status],
)

app = FastAPI(title="Claude Agent SDK order support")


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    session_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    resume: bool = False


class ChatResponse(BaseModel):
    response: str
    session_id: str


def build_options(session_id: str, resume: bool) -> ClaudeAgentOptions:
    return ClaudeAgentOptions(
        system_prompt=INSTRUCTIONS,
        model=os.getenv("CLAUDE_MODEL") or None,
        tools=[],
        mcp_servers={"support": support_tools},
        strict_mcp_config=True,
        allowed_tools=["mcp__support__get_order_status"],
        max_turns=3,
        session_id=None if resume else session_id,
        resume=session_id if resume else None,
    )


async def run(prompt: str, session_id: str, resume: bool) -> str:
    options = build_options(session_id, resume)
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
    session_id = str(request.session_id)
    response = await run(
        prompt=request.prompt,
        session_id=session_id,
        resume=request.resume,
    )
    return ChatResponse(response=response, session_id=session_id)
