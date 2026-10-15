#!/usr/bin/env bash
# Smoke-test a deployed Microsoft Foundry Voice Agent over its managed voice WebSocket endpoint.
#
# Usage:
#   ./foundry-agent/create/scripts/smoke-test-voice.sh \
#     --endpoint <project-endpoint> \
#     --agent-name <voice-agent-name> \
#     [--text <prompt-text>] \
#     [--timeout <seconds>] \
#     [--output-audio <file-path>] \
#     [--dry-run] \
#     [--help]
#
# Options:
#   --endpoint <url>        Foundry project endpoint (https://<host>/api/projects/<project>)
#   --agent-name <name>     Deployed Voice Agent name (kind: voice wrapper or Prompt Voice agent)
#   --text <prompt>         Prompt text to send after session initialization (default: "Hello, briefly introduce yourself.")
#   --timeout <seconds>     Positive integer timeout in seconds (default: 30)
#   --output-audio <path>   Optional file path to write received PCM16 audio bytes
#   --dry-run               Print resolved WebSocket URL and execution plan without connecting
#   -h, --help              Show this help text and exit 0
#
# Exit Codes:
#   0  Smoke test passed (or --help / --dry-run succeeded)
#   1  Smoke test failed (missing Python/SDK, auth failure, WebSocket error, or timeout)
#   2  Usage or argument validation error

set -euo pipefail

usage() {
  sed -n '2,26s/^# \{0,1\}//p' "$0"
}

ENDPOINT=""
AGENT_NAME=""
PROMPT_TEXT="Hello, briefly introduce yourself."
TIMEOUT="30"
OUTPUT_AUDIO=""
DRY_RUN="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --endpoint)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ] || [ "${2#-}" != "$2" ]; then
        echo "ERROR: --endpoint requires a non-empty URL value." >&2
        usage >&2
        exit 2
      fi
      ENDPOINT="$2"
      shift 2
      ;;
    --agent-name)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ] || [ "${2#-}" != "$2" ]; then
        echo "ERROR: --agent-name requires a non-empty value." >&2
        usage >&2
        exit 2
      fi
      AGENT_NAME="$2"
      shift 2
      ;;
    --text)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ]; then
        echo "ERROR: --text requires a non-empty value." >&2
        usage >&2
        exit 2
      fi
      PROMPT_TEXT="$2"
      shift 2
      ;;
    --timeout)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ]; then
        echo "ERROR: --timeout requires a positive integer value." >&2
        usage >&2
        exit 2
      fi
      TIMEOUT="$2"
      shift 2
      ;;
    --output-audio)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ] || [ "${2#-}" != "$2" ]; then
        echo "ERROR: --output-audio requires a file path." >&2
        usage >&2
        exit 2
      fi
      OUTPUT_AUDIO="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    *)
      echo "ERROR: Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$ENDPOINT" ]; then
  echo "ERROR: --endpoint is required." >&2
  usage >&2
  exit 2
fi

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent-name is required." >&2
  usage >&2
  exit 2
fi

if ! printf '%s' "$TIMEOUT" | grep -Eq '^[1-9][0-9]*$'; then
  echo "ERROR: --timeout must be a positive integer (got '$TIMEOUT')." >&2
  exit 2
fi

TRIMMED_ENDPOINT="${ENDPOINT%/}"
case "$TRIMMED_ENDPOINT" in
  https://*)
    WS_BASE="wss://${TRIMMED_ENDPOINT#https://}"
    ;;
  wss://*)
    WS_BASE="$TRIMMED_ENDPOINT"
    ;;
  *)
    echo "ERROR: --endpoint must start with https:// or wss:// (got '$ENDPOINT')." >&2
    exit 2
    ;;
esac

case "$WS_BASE" in
  */protocols/voice*)
    WS_URL="$WS_BASE"
    ;;
  *)
    WS_URL="${WS_BASE}/agents/${AGENT_NAME}/endpoint/protocols/voice?api-version=v1"
    ;;
esac

if [ "$DRY_RUN" = "true" ]; then
  echo "DRY-RUN: Voice Agent WebSocket Smoke Test"
  echo "  Project Endpoint : $ENDPOINT"
  echo "  Agent Name       : $AGENT_NAME"
  echo "  WebSocket URL    : $WS_URL"
  echo "  Prompt Text      : $PROMPT_TEXT"
  echo "  Timeout (s)      : $TIMEOUT"
  if [ -n "$OUTPUT_AUDIO" ]; then
    echo "  Output Audio     : $OUTPUT_AUDIO"
  else
    echo "  Output Audio     : (none)"
  fi
  echo "  Auth Scope       : https://ai.azure.com/.default (DefaultAzureCredential)"
  exit 0
fi

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "ERROR: Python 3 is required to run the Voice WebSocket smoke test." >&2
  exit 1
fi

"$PYTHON_BIN" - "$WS_URL" "$AGENT_NAME" "$PROMPT_TEXT" "$TIMEOUT" "$OUTPUT_AUDIO" <<'PY'
import asyncio
import base64
import json
import sys

ws_url, agent_name, prompt_text, timeout_raw, output_audio = sys.argv[1:6]
timeout_sec = int(timeout_raw)

try:
    from azure.identity import DefaultAzureCredential
except ImportError as exc:
    print(
        f"ERROR: Missing required package ({exc}). Install with: pip install \"azure-ai-projects[voice]\" azure-identity",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import websockets
except ImportError as exc:
    print(
        f"ERROR: Missing WebSocket client dependency ({exc}). Install with: pip install \"azure-ai-projects[voice]\" azure-identity websockets",
        file=sys.stderr,
    )
    sys.exit(1)


async def run_smoke_test() -> int:
    credential = DefaultAzureCredential()
    try:
        token = credential.get_token("https://ai.azure.com/.default").token
    except Exception as exc:
        print(f"ERROR: Failed to acquire Entra token for https://ai.azure.com/.default: {exc}", file=sys.stderr)
        return 1

    headers = {"Authorization": f"Bearer {token}"}
    transcript_parts = []
    audio_bytes = bytearray()
    got_session_event = False
    got_response_output = False

    connect_kwargs = {"additional_headers": headers}
    try:
        async with asyncio.timeout(timeout_sec):
            try:
                ws_ctx = websockets.connect(ws_url, **connect_kwargs)
            except TypeError:
                ws_ctx = websockets.connect(ws_url, extra_headers=headers)

            async with ws_ctx as ws:
                await ws.send(
                    json.dumps(
                        {
                            "type": "conversation.item.create",
                            "item": {
                                "type": "message",
                                "role": "user",
                                "content": [{"type": "input_text", "text": prompt_text}],
                            },
                        }
                    )
                )
                await ws.send(json.dumps({"type": "response.create"}))

                async for raw_msg in ws:
                    if isinstance(raw_msg, bytes):
                        audio_bytes.extend(raw_msg)
                        got_response_output = True
                        continue

                    event = json.loads(raw_msg)
                    ev_type = event.get("type", "")

                    if ev_type in ("session.created", "session.updated", "session.Initialized"):
                        got_session_event = True
                    elif ev_type in (
                        "response.audio_transcript.delta",
                        "response.text.delta",
                        "response.TextDelta",
                    ):
                        delta = event.get("delta") or event.get("text") or ""
                        transcript_parts.append(delta)
                        got_response_output = True
                    elif ev_type == "response.audio.delta":
                        b64_chunk = event.get("delta", "")
                        if b64_chunk:
                            audio_bytes.extend(base64.b64decode(b64_chunk))
                            got_response_output = True
                    elif ev_type == "error":
                        print(f"ERROR: Voice session returned error event: {json.dumps(event)}", file=sys.stderr)
                        return 1
                    elif ev_type in ("response.done", "response.Done"):
                        break
    except TimeoutError:
        if not (got_session_event or got_response_output):
            print(f"ERROR: Timed out after {timeout_sec}s waiting for Voice Agent '{agent_name}'.", file=sys.stderr)
            return 1
    except Exception as exc:
        print(f"ERROR: Voice WebSocket smoke test failed for '{agent_name}': {exc}", file=sys.stderr)
        return 1

    if output_audio and audio_bytes:
        with open(output_audio, "wb") as fh:
            fh.write(audio_bytes)

    if not (got_session_event or got_response_output):
        print(f"ERROR: No session or response events received from Voice Agent '{agent_name}'.", file=sys.stderr)
        return 1

    transcript = "".join(transcript_parts).strip()
    print(
        f"PASS: Voice Agent '{agent_name}' responded over voice WebSocket "
        f"(audio_bytes={len(audio_bytes)}, transcript={json.dumps(transcript[:160])})."
    )
    return 0


sys.exit(asyncio.run(run_smoke_test()))
PY
