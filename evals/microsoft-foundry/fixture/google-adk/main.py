from __future__ import annotations

import os
import uuid

from fastapi import FastAPI
from google.adk.runners import Runner
from google.adk.sessions.database_session_service import DatabaseSessionService
from google.genai import types
from pydantic import BaseModel, Field

from customer_support_agent.agent import root_agent

APP_NAME = "order-support"
app = FastAPI(title="Google ADK order support")


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    user_id: str = Field(default="eval-user", min_length=1)
    session_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        min_length=1,
    )


class ChatResponse(BaseModel):
    response: str
    user_id: str
    session_id: str


async def run(prompt: str, user_id: str, session_id: str) -> str:
    db_url = os.getenv(
        "ADK_SESSION_DB",
        "sqlite+aiosqlite:///./sessions.sqlite",
    )
    response_parts: list[str] = []
    async with DatabaseSessionService(db_url) as session_service:
        session = await session_service.get_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )
        if session is None:
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
    response = await run(
        prompt=request.prompt,
        user_id=request.user_id,
        session_id=request.session_id,
    )
    return ChatResponse(
        response=response,
        user_id=request.user_id,
        session_id=request.session_id,
    )
