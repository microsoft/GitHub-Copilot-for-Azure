from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import uuid

from fastapi import FastAPI
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel, Field

from customer_support_agent.agent import order_tools, root_agent

APP_NAME = "order-support"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await order_tools.close()


app = FastAPI(title="Google ADK order support", lifespan=lifespan)


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)


class ChatResponse(BaseModel):
    response: str


async def run(prompt: str) -> str:
    user_id = "eval-user"
    session_id = str(uuid.uuid4())
    response_parts: list[str] = []
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service,
    )
    message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=prompt)],
    )
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            text = "".join(part.text or "" for part in event.content.parts)
            if text:
                response_parts.append(text)
    return "\n".join(response_parts)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    response = await run(prompt=request.prompt)
    return ChatResponse(response=response)
