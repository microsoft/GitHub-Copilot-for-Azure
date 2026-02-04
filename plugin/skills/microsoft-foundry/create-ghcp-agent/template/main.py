import asyncio
import datetime
import time
import random
import string
import os
import base64
import mimetypes
from pathlib import Path
from typing import Dict, Optional, List, Any, Set
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from copilot import CopilotClient

from azure.ai.agentserver.core import AgentRunContext, FoundryCBAgent
from azure.ai.agentserver.core.models import Response as OpenAIResponse
from azure.ai.agentserver.core.models.projects import (
    ItemContentOutputText,
    ResponsesAssistantMessageItemResource,
    ResponseTextDeltaEvent,
    ResponseTextDoneEvent,
    ResponseCreatedEvent,
    ResponseOutputItemAddedEvent,
    ResponseCompletedEvent,
)

# Get the directory path, skills directory, and outputs directory
CURRENT_DIR = Path(__file__).parent
SKILLS_DIR = (CURRENT_DIR / 'skills').resolve()
OUTPUTS_DIR = (CURRENT_DIR / 'outputs').resolve()

# Ensure outputs directory exists
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

print(f'Skills directory: {SKILLS_DIR}')
print(f'Outputs directory: {OUTPUTS_DIR}')

# Streaming timeout in seconds (5 minutes)
STREAMING_TIMEOUT = 300


def create_download_message(filename: str) -> str:
    """Create a download message with embedded file content as base64 data URL"""
    file_path = OUTPUTS_DIR / filename
    try:
        # Read file content
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        # Encode as base64
        base64_content = base64.b64encode(file_content).decode('utf-8')
        
        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            # Default MIME types for common code files
            ext = Path(filename).suffix.lower()
            mime_map = {
                '.py': 'text/x-python',
                '.js': 'text/javascript',
                '.ts': 'text/typescript',
                '.json': 'application/json',
                '.yaml': 'text/yaml',
                '.yml': 'text/yaml',
                '.md': 'text/markdown',
                '.txt': 'text/plain',
                '.html': 'text/html',
                '.css': 'text/css',
                '.sh': 'text/x-shellscript',
                '.dockerfile': 'text/plain',
            }
            mime_type = mime_map.get(ext, 'application/octet-stream')
        
        # Create data URL
        data_url = f"data:{mime_type};base64,{base64_content}"

        print(f"Created download link for {filename} (MIME: {mime_type})")
        print(f"Data URL length: {len(data_url)} characters")
        print(f"Data URL: {data_url}...")
        
        # File size for display
        file_size = len(file_content)
        size_str = f"{file_size} bytes" if file_size < 1024 else f"{file_size / 1024:.1f} KB"
        
        return f"""

---

✅ **Your file is ready!**

📥 **[Click here to download: {filename}]({data_url})**

📊 *File size: {size_str}*

💡 *Right-click the link and select "Save link as..." to download with the correct filename.*

---
"""
    except Exception as e:
        print(f"Error creating download for {filename}: {e}")
        return f"\n\n⚠️ File created: {filename} (could not create download link: {e})\n\n"


class OutputFileHandler(FileSystemEventHandler):
    """Watch for new files in the outputs directory"""
    def __init__(self, on_new_file):
        self.on_new_file = on_new_file
        self.notified_files: Set[str] = set()
        # Track existing files
        self.existing_files: Set[str] = set()
        try:
            for f in OUTPUTS_DIR.iterdir():
                self.existing_files.add(f.name)
        except Exception as e:
            print(f"Could not read outputs dir: {e}")

    def on_created(self, event):
        if not event.is_directory:
            filename = Path(event.src_path).name
            if filename not in self.existing_files and filename not in self.notified_files:
                # Small delay to ensure file is written
                asyncio.get_event_loop().call_later(0.5, self._check_and_notify, filename)

    def _check_and_notify(self, filename: str):
        if filename in self.notified_files:
            return
        try:
            file_path = OUTPUTS_DIR / filename
            if file_path.exists() and file_path.stat().st_size > 0:
                self.notified_files.add(filename)
                print(f"✓ New file detected: {filename} ({file_path.stat().st_size} bytes)")
                self.on_new_file(filename)
        except Exception as e:
            print(f"File not ready yet: {e}")


class CopilotService:
    def __init__(self):
        self.client = None
        self.sessions: Dict[str, Dict[str, Any]] = {}  # Store sessions by sessionId

    async def initialize(self):
        if not self.client:
            print("Initializing Copilot client...")
            try:
                # Initialize with debug logging enabled
                self.client = CopilotClient()
                print("✓ Copilot client created")

                # Start the client explicitly
                await self.client.start()
                print("✓ Copilot client started")

                # Verify connectivity with ping
                try:
                    await self.client.ping()
                    print("✓ Copilot CLI server is responsive")
                except Exception as ping_error:
                    print(f"⚠ Warning: Ping test failed, but continuing: {ping_error}")

                print("✓ Copilot client initialized successfully")
            except Exception as error:
                print(f"Error initializing Copilot client: {error}")
                import traceback
                print(f"Error details: {traceback.format_exc()}")
                raise

    def _generate_session_id(self) -> str:
        """Generate a unique session ID"""
        timestamp = int(time.time() * 1000)
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
        return f"session_{timestamp}_{random_suffix}"

    async def create_new_session(self, model: str = "opus-4.2") -> str:
        """Create a new session and return its ID"""
        await self.initialize()

        session_id = self._generate_session_id()
        print(f"Creating new session: {session_id} with model: {model}")

        session = await self.client.create_session({
            "model": model,
            "streaming": True,
            "skill_directories": [str(SKILLS_DIR)],
        })

        self.sessions[session_id] = {
            "session": session,
            "model": model,
            "created_at": datetime.datetime.now(),
            "message_count": 0,
        }

        print(f"✓ Session {session_id} created successfully")
        return session_id

    async def get_or_create_session(self, session_id: Optional[str] = None, model: str = "opus-4.2") -> str:
        """Get an existing session or create a new one"""
        if session_id and session_id in self.sessions:
            print(f"Using existing session: {session_id}")
            return session_id
        return await self.create_new_session(model)

    def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        if session_id in self.sessions:
            print(f"Deleting session: {session_id}")
            session_data = self.sessions[session_id]
            # Destroy the actual copilot session if possible
            try:
                session = session_data.get("session")
                if session and hasattr(session, 'destroy'):
                    session.destroy()
            except Exception as e:
                print(f"Could not destroy session: {e}")
            del self.sessions[session_id]
            return True
        return False

    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all active sessions"""
        session_list = []
        for session_id, data in self.sessions.items():
            session_list.append({
                "id": session_id,
                "model": data["model"],
                "created_at": data["created_at"],
                "message_count": data["message_count"],
            })
        return session_list

    async def send_prompt(
        self,
        prompt: str,
        model: str = "opus-4.2",
        streaming: bool = False,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a prompt and return the response"""
        await self.initialize()

        # Check if we should reuse an existing session
        if session_id and session_id in self.sessions:
            # Reuse existing session
            session_data = self.sessions[session_id]
            session = session_data["session"]
            session_data["message_count"] += 1
            print(f"Reusing existing session: {session_id} (message #{session_data['message_count']})")
        else:
            # Create new session
            print(f"Creating new session: {session_id or 'one-time'} with model: {model}, streaming: {streaming}")

            session = await self.client.create_session({
                "model": model,
                "streaming": streaming,
                "skill_directories": [str(SKILLS_DIR)],
            })

            # Store session if session_id provided
            if session_id:
                self.sessions[session_id] = {
                    "session": session,
                    "model": model,
                    "created_at": datetime.datetime.now(),
                    "message_count": 1,
                }

            print("✓ Session created successfully")

        print(f"Active sessions: {len(self.sessions)}")

        try:

            full_response = ""
            chunks = []
            received_idle = False

            # Create event handler (synchronous - called by copilot SDK)
            def handle_event(event):
                nonlocal full_response, chunks, received_idle

                event_type = event.type.value if hasattr(event.type, 'value') else str(event.type)
                print(f"Session event: {event_type}")

                if event_type == "assistant.message_delta":
                    delta_content = getattr(event.data, 'delta_content', '') if hasattr(event, 'data') else ''
                    full_response += delta_content
                    chunks.append(delta_content)
                elif event_type == "assistant.message":
                    # Full message event (non-streaming)
                    content = getattr(event.data, 'content', '') if hasattr(event, 'data') else ''
                    full_response = content
                    print(f"✓ Received full message: {content[:100] if content else ''}")
                elif event_type == "session.idle":
                    received_idle = True
                    print("✓ Session idle, resolving with response")
                elif event_type == "error":
                    error_msg = getattr(event.data, 'message', 'Unknown error') if hasattr(event, 'data') else 'Unknown error'
                    print(f"Session error event: {error_msg}")
                    raise Exception(error_msg)

            # Register event handler
            session.on(handle_event)

            print("Sending prompt to session...")
            await session.send_and_wait({"prompt": prompt})
            print("✓ sendAndWait completed")

            # If we didn't receive idle event, wait a bit
            if not received_idle:
                await asyncio.sleep(1)
                if not received_idle:
                    print("No idle event received, resolving anyway")

            return {"full_response": full_response, "chunks": chunks}

        except Exception as error:
            print(f"Error creating session or sending prompt: {error}")
            raise

    async def send_prompt_streaming_generator(
        self,
        prompt: str,
        model: str = "opus-4.2",
        session_id: Optional[str] = None
    ):
        """Send a prompt with streaming response, yields chunks"""
        await self.initialize()

        # Use conversation_id as session key to reuse sessions
        if session_id and session_id in self.sessions:
            # Reuse existing session for this conversation
            current_session_id = session_id
            session_data = self.sessions[current_session_id]
            session = session_data["session"]
            session_data["message_count"] += 1
            print(f"Reusing existing session: {current_session_id} (message #{session_data['message_count']})")
        else:
            # Create new session only if one doesn't exist
            current_session_id = session_id or self._generate_session_id()
            print(f"Creating new streaming session: {current_session_id} with model: {model}")

            session = await self.client.create_session(
                {"model": model,
                "streaming": True,
                "skill_directories": [str(SKILLS_DIR)],}
            )

            self.sessions[current_session_id] = {
                "session": session,
                "model": model,
                "created_at": datetime.datetime.now(),
                "message_count": 1,
            }

            print(f"✓ Streaming session {current_session_id} created with streaming: True")

        print(f"Active sessions: {len(self.sessions)}")

        has_completed = False
        has_error = False
        has_received_content = False
        chunks_queue = asyncio.Queue()
        loop = asyncio.get_event_loop()
        notified_files: Set[str] = set()

        # Track existing files to detect new ones
        existing_files: Set[str] = set()
        try:
            for f in OUTPUTS_DIR.iterdir():
                existing_files.add(f.name)
        except Exception as e:
            print(f"Could not read outputs dir: {e}")

        def check_for_new_files():
            """Check for new files in outputs directory"""
            try:
                for f in OUTPUTS_DIR.iterdir():
                    filename = f.name
                    if filename not in existing_files and filename not in notified_files:
                        if f.stat().st_size > 0:
                            notified_files.add(filename)
                            print(f"✓ File found: {filename} ({f.stat().st_size} bytes)")
                            download_message = create_download_message(filename)
                            asyncio.run_coroutine_threadsafe(
                                chunks_queue.put(download_message), loop
                            )
            except Exception as e:
                print(f"Could not check for new files: {e}")

        # Set up file watcher
        file_handler = None
        observer = None
        try:
            def on_new_file(filename: str):
                if filename not in notified_files:
                    notified_files.add(filename)
                    download_message = create_download_message(filename)
                    if not has_completed and not has_error:
                        asyncio.run_coroutine_threadsafe(
                            chunks_queue.put(download_message), loop
                        )

            file_handler = OutputFileHandler(on_new_file)
            file_handler.existing_files = existing_files
            observer = Observer()
            observer.schedule(file_handler, str(OUTPUTS_DIR), recursive=False)
            observer.start()
        except Exception as e:
            print(f"Could not set up file watcher: {e}")

        def cleanup():
            nonlocal observer
            if observer:
                try:
                    observer.stop()
                    observer.join(timeout=1)
                except Exception as e:
                    print(f"Error stopping observer: {e}")
                observer = None

        # Timeout handler
        timeout_handle = None

        def on_timeout():
            nonlocal has_completed
            if not has_completed and not has_error:
                print("⚠ Streaming timeout - completing request")
                check_for_new_files()
                cleanup()
                has_completed = True
                asyncio.run_coroutine_threadsafe(
                    chunks_queue.put(None), loop
                )

        timeout_handle = loop.call_later(STREAMING_TIMEOUT, on_timeout)

        # Event handler (synchronous - called by copilot SDK)
        def handle_event(event):
            nonlocal has_completed, has_error, has_received_content

            try:
                event_type = event.type.value if hasattr(event.type, 'value') else str(event.type)
                event_data = event.data if hasattr(event, 'data') else {}
                print("========================================")
                print(f"Event received: {event_type}")
                print(f"Event data: {str(event_data)[:200]}")
                print("========================================")

                if event_type == "assistant.message_delta":
                    if not has_completed and not has_error:
                        content = getattr(event_data, 'delta_content', '') or getattr(event_data, 'deltaContent', '') or ''
                        if content:
                            has_received_content = True
                            print(f"Streaming delta: {content[:50]}")
                            asyncio.run_coroutine_threadsafe(
                                chunks_queue.put(content), loop
                            )

                elif event_type == "assistant.reasoning_delta":
                    if not has_completed and not has_error:
                        content = getattr(event_data, 'delta_content', '') or getattr(event_data, 'deltaContent', '') or ''
                        if content:
                            has_received_content = True
                            print(f"Reasoning delta: {content[:50]}")
                            # Send reasoning to client so they see real-time progress
                            asyncio.run_coroutine_threadsafe(
                                chunks_queue.put(content), loop
                            )

                elif event_type in ["assistant.message", "message"]:
                    # Final complete message - only use if no deltas received
                    if not has_completed and not has_error and not has_received_content:
                        content = getattr(event_data, 'content', '') or ''
                        if content:
                            print(f"Full message (no streaming): {content[:100]}")
                            asyncio.run_coroutine_threadsafe(
                                chunks_queue.put(content), loop
                            )

                elif event_type == "tool.execution_start":
                    if not has_completed and not has_error:
                        tool_name = getattr(event_data, 'tool_name', '') or getattr(event_data, 'toolName', '') or 'tool'
                        print(f"Tool execution started: {tool_name}")

                elif event_type == "tool.execution_complete":
                    if not has_completed and not has_error:
                        tool_call_id = getattr(event_data, 'tool_call_id', '') or getattr(event_data, 'toolCallId', '') or ''
                        print(f"Tool execution complete: {tool_call_id}")

                elif event_type in ["session.idle", "idle", "done", "complete"]:
                    if not has_completed and not has_error:
                        print("✓ Session idle - stream complete")
                        if timeout_handle:
                            timeout_handle.cancel()

                        # Small delay to ensure files are written
                        def complete_stream():
                            nonlocal has_completed
                            check_for_new_files()
                            cleanup()
                            has_completed = True
                            print(f"✓ Stream completed for session: {current_session_id}")
                            asyncio.run_coroutine_threadsafe(
                                chunks_queue.put(None), loop
                            )

                        loop.call_later(1.0, complete_stream)

                elif event_type in ["session.error", "error"]:
                    if not has_error:
                        if timeout_handle:
                            timeout_handle.cancel()
                        cleanup()
                        has_error = True
                        error_msg = getattr(event_data, 'message', 'Unknown error') or 'Unknown error'
                        print(f"Session error: {error_msg}")
                        error = Exception(error_msg)
                        asyncio.run_coroutine_threadsafe(
                            chunks_queue.put(error), loop
                        )

                else:
                    print(f"Unhandled streaming event type: {event_type}")

            except Exception as error:
                print(f"Error in session event handler: {error}")
                import traceback
                traceback.print_exc()
                if not has_completed and not has_error:
                    has_error = True
                    asyncio.run_coroutine_threadsafe(
                        chunks_queue.put(error), loop
                    )

        # Register event handler
        print("Registering event handler on session...")
        session.on(handle_event)

        # Send the prompt using send() for streaming (not sendAndWait)
        print("Sending prompt to streaming session...")
        print(f"Prompt: {prompt[:100]}")
        try:
            message_id = await session.send({"prompt": prompt})
            print(f"✓ Prompt sent successfully, message ID: {message_id}")
            print("Waiting for streaming events...")
        except Exception as send_error:
            if timeout_handle:
                timeout_handle.cancel()
            cleanup()
            print(f"Error sending prompt: {send_error}")
            raise

        # Yield chunks from the queue
        while True:
            chunk = await chunks_queue.get()
            if chunk is None:  # Completion signal
                break
            if isinstance(chunk, Exception):
                raise chunk
            yield chunk

    async def stop(self):
        """Stop the Copilot client"""
        if self.client:
            print("Stopping Copilot client...")
            try:
                # Destroy all sessions first
                for session_id, session_data in list(self.sessions.items()):
                    try:
                        session = session_data.get("session")
                        if session and hasattr(session, 'destroy'):
                            await session.destroy()
                    except Exception as e:
                        print(f"Could not destroy session {session_id}: {e}")
                self.sessions.clear()

                await self.client.stop()
                print("✓ Copilot client stopped")
            except Exception as error:
                print(f"Error stopping Copilot client: {error}")
            self.client = None


# Global service instance
copilot_service = CopilotService()


def extract_user_message(context: AgentRunContext) -> str:
    """Extract the user message from the context"""
    # Try to get from input field first
    input_data = context.request.get("input")
    if input_data:
        # Handle input as string
        if isinstance(input_data, str):
            return input_data
        # Handle input as list of message objects (deployed environment format)
        elif isinstance(input_data, list):
            for item in input_data:
                if isinstance(item, dict):
                    # Check for message type with content
                    if item.get("type") == "message" and item.get("role") == "user":
                        content = item.get("content")
                        if isinstance(content, str):
                            return content
                        elif isinstance(content, list):
                            # Extract text from content items
                            text_parts = []
                            for content_item in content:
                                if isinstance(content_item, dict) and "text" in content_item:
                                    text_parts.append(content_item["text"])
                            if text_parts:
                                return ' '.join(text_parts)
                    # Fallback: look for any 'content' field
                    elif "content" in item:
                        content = item["content"]
                        if isinstance(content, str):
                            return content

    # Try to get from messages
    messages = context.request.get("messages", [])
    if messages:
        for message in reversed(messages):
            if isinstance(message, dict) and message.get("role") == "user":
                content = message.get("content")
                if isinstance(content, str):
                    return content
                elif isinstance(content, list):
                    # Handle content as list of items
                    text_parts = []
                    for item in content:
                        if isinstance(item, dict) and "text" in item:
                            text_parts.append(item["text"])
                    if text_parts:
                        return ' '.join(text_parts)

    return "Hello"  # Default message   

async def agent_run(context: AgentRunContext):
    """Main agent run function for Azure AI Agent Server"""
    agent = context.request.get("agent")

    # Extract the user's message
    user_message = extract_user_message(context)

    # Get model from request or use default
    model = context.request.get("model", "opus-4.2")

    try:
        if context.stream:
            # Streaming mode

            async def stream_events():
                # Initial empty response context (pattern from MCP sample)
                yield ResponseCreatedEvent(response=OpenAIResponse(output=[], conversation=context.get_conversation_object()))

                # Create assistant message item
                assistant_item = ResponsesAssistantMessageItemResource(
                    id=context.id_generator.generate_message_id(),
                    status="in_progress",
                    content=[ItemContentOutputText(text="", annotations=[])],
                )
                yield ResponseOutputItemAddedEvent(output_index=0, item=assistant_item)

                assembled = ""
                try:
                    async for chunk in copilot_service.send_prompt_streaming_generator(
                        prompt=user_message,
                        model=model,
                        session_id=context.conversation_id
                    ):
                        assembled += chunk
                        yield ResponseTextDeltaEvent(
                            output_index=0,
                            content_index=0,
                            delta=chunk
                        )

                    # Done with text
                    yield ResponseTextDoneEvent(
                        output_index=0,
                        content_index=0,
                        text=assembled
                    )
                except Exception as e:
                    print(f"Error in streaming: {e}")
                    import traceback
                    traceback.print_exc()
                    # Yield error as text
                    error_text = f"Error: {str(e)}"
                    assembled = error_text
                    yield ResponseTextDeltaEvent(
                        output_index=0,
                        content_index=0,
                        delta=error_text
                    )
                    yield ResponseTextDoneEvent(
                        output_index=0,
                        content_index=0,
                        text=error_text
                    )

                # Final response with completed status
                final_response = OpenAIResponse(
                    agent=context.get_agent_id_object(),
                    conversation=context.get_conversation_object(),
                    metadata={},
                    temperature=0.0,
                    top_p=0.0,
                    user="copilot_user",
                    id=context.response_id,
                    created_at=datetime.datetime.now(),
                    output=[
                        ResponsesAssistantMessageItemResource(
                            id=assistant_item.id,
                            status="completed",
                            content=[
                                ItemContentOutputText(text=assembled, annotations=[])
                            ],
                        )
                    ],
                )
                yield ResponseCompletedEvent(response=final_response)

            return stream_events()
        else:
            # Non-streaming mode
            print("Running in non-streaming mode")
            result = await copilot_service.send_prompt(
                prompt=user_message,
                model=model,
                streaming=False,
                session_id=context.conversation_id
            )

            response_text = result.get("full_response", "No response received")

            # Build assistant output content
            output_content = [
                ItemContentOutputText(
                    text=response_text,
                    annotations=[],
                )
            ]

            response = OpenAIResponse(
                metadata={},
                temperature=0.0,
                top_p=0.0,
                user="copilot_user",
                id=context.response_id,
                created_at=datetime.datetime.now(),
                output=[
                    ResponsesAssistantMessageItemResource(
                        id=context.id_generator.generate_message_id(),
                        status="completed",
                        content=output_content,
                    )
                ],
            )
            return response

    except Exception as e:
        print(f"Error in agent_run: {e}")
        import traceback
        traceback.print_exc()

        # Return error response
        error_text = f"Error processing request: {str(e)}"

        if context.stream:
            async def error_stream():
                yield ResponseCreatedEvent(response=OpenAIResponse(output=[], conversation=context.get_conversation_object()))
                assistant_item = ResponsesAssistantMessageItemResource(
                    id=context.id_generator.generate_message_id(),
                    status="in_progress",
                    content=[ItemContentOutputText(text="", annotations=[])],
                )
                yield ResponseOutputItemAddedEvent(output_index=0, item=assistant_item)
                yield ResponseTextDeltaEvent(
                    output_index=0,
                    content_index=0,
                    delta=error_text
                )
                yield ResponseTextDoneEvent(
                    output_index=0,
                    content_index=0,
                    text=error_text
                )
                final_response = OpenAIResponse(
                    agent=context.get_agent_id_object(),
                    conversation=context.get_conversation_object(),
                    metadata={},
                    temperature=0.0,
                    top_p=0.0,
                    user="copilot_user",
                    id=context.response_id,
                    created_at=datetime.datetime.now(),
                    output=[
                        ResponsesAssistantMessageItemResource(
                            id=assistant_item.id,
                            status="failed",
                            content=[ItemContentOutputText(text=error_text, annotations=[])],
                        )
                    ],
                )
                yield ResponseCompletedEvent(response=final_response)
            return error_stream()
        else:
            output_content = [
                ItemContentOutputText(
                    text=error_text,
                    annotations=[],
                )
            ]
            response = OpenAIResponse(
                metadata={},
                temperature=0.0,
                top_p=0.0,
                user="copilot_user",
                id=context.response_id,
                created_at=datetime.datetime.now(),
                output=[
                    ResponsesAssistantMessageItemResource(
                        id=context.id_generator.generate_message_id(),
                        status="failed",
                        content=output_content,
                    )
                ],
            )
            return response


class CopilotAgent(FoundryCBAgent):
    """GitHub Copilot agent for Azure AI Foundry"""

    async def agent_run(self, context: AgentRunContext):
        """Implements the FoundryCBAgent contract"""
        return await agent_run(context)


my_agent = CopilotAgent()


if __name__ == "__main__":
    my_agent.run()
