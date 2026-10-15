#!/usr/bin/env bash
# Smoke-test a deployed Microsoft Foundry Voice Agent over its managed voice WebSocket endpoint.
#
# Usage:
#   ./foundry-agent/create/scripts/smoke-test-voice.sh \
#     --endpoint <project-endpoint> \
#     --agent-name <voice-agent-name> \
#     [--text <prompt-text>] \
#     [--expected-marker <substring>] \
#     [--timeout <seconds>] \
#     [--output-audio <file-path>] \
#     [--dry-run] \
#     [--help]
#
# Options:
#   --endpoint <url>          Foundry project endpoint (https://<host>/api/projects/<project>)
#   --agent-name <name>       Deployed Voice Agent name (kind: voice wrapper or Prompt Voice agent)
#   --text <prompt>           Prompt text to send after session initialization (default: "In one short sentence, introduce yourself.")
#   --expected-marker <text>  Optional substring that must appear in the requested turn's transcript
#   --timeout <seconds>       Positive integer timeout in seconds (default: 180)
#   --output-audio <path>     Optional file path to write decoded PCM audio bytes
#   --dry-run                 Print resolved WebSocket URL and execution plan without connecting
#   -h, --help                Show this help text and exit 0
#
# Exit Codes:
#   0  Smoke test passed (or --help / --dry-run succeeded)
#   1  Smoke test failed (missing Python/websockets, auth failure, WebSocket error, empty transcript/audio, missing expected marker, or timeout)
#   2  Usage or argument validation error

set -euo pipefail

usage() {
  sed -n '2,28s/^# \{0,1\}//p' "$0"
}

ENDPOINT=""
AGENT_NAME=""
PROMPT_TEXT="In one short sentence, introduce yourself."
EXPECTED_MARKER=""
TIMEOUT="180"
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
    --expected-marker)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ]; then
        echo "ERROR: --expected-marker requires a non-empty value." >&2
        usage >&2
        exit 2
      fi
      EXPECTED_MARKER="$2"
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
  echo "  WebSocket URL    : ${WS_URL}&agent_session_id=<uuid>"
  echo "  Headers          : Foundry-Features: VoiceAgents=V1Preview"
  echo "  Prompt Text      : $PROMPT_TEXT"
  if [ -n "$EXPECTED_MARKER" ]; then
    echo "  Expected Marker  : $EXPECTED_MARKER"
  else
    echo "  Expected Marker  : (none)"
  fi
  echo "  Timeout (s)      : $TIMEOUT"
  if [ -n "$OUTPUT_AUDIO" ]; then
    echo "  Output Audio     : $OUTPUT_AUDIO"
  else
    echo "  Output Audio     : (none)"
  fi
  echo "  Auth Resource    : https://ai.azure.com (az account get-access-token)"
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

SMOKE_WS_URL="$WS_URL" \
SMOKE_AGENT_NAME="$AGENT_NAME" \
SMOKE_PROMPT_TEXT="$PROMPT_TEXT" \
SMOKE_TIMEOUT="$TIMEOUT" \
SMOKE_OUTPUT_AUDIO="$OUTPUT_AUDIO" \
SMOKE_EXPECTED_MARKER="$EXPECTED_MARKER" \
"$PYTHON_BIN" - <<'PY'
import asyncio
import base64
import json
import os
import shutil
import subprocess
import sys
import time
import uuid

ws_url_base = os.environ["SMOKE_WS_URL"]
agent_name = os.environ["SMOKE_AGENT_NAME"]
prompt_text = os.environ["SMOKE_PROMPT_TEXT"]
timeout_sec = int(os.environ["SMOKE_TIMEOUT"])
output_audio = os.environ.get("SMOKE_OUTPUT_AUDIO", "")
expected_marker = os.environ.get("SMOKE_EXPECTED_MARKER", "")
GREETING_GRACE_SECONDS = 1.0

try:
    import websockets
except ImportError as exc:
    print(
        f"ERROR: Missing WebSocket client dependency ({exc}). Install with: pip install websockets",
        file=sys.stderr,
    )
    sys.exit(1)


def acquire_token() -> str:
    az_bin = shutil.which("az.cmd" if os.name == "nt" else "az") or "az"
    try:
        token = subprocess.check_output(
            [
                az_bin,
                "account",
                "get-access-token",
                "--resource",
                "https://ai.azure.com",
                "--query",
                "accessToken",
                "-o",
                "tsv",
            ],
            text=True,
        ).strip()
        if token:
            return token
    except Exception:
        pass

    try:
        from azure.identity import DefaultAzureCredential

        return DefaultAzureCredential().get_token("https://ai.azure.com/.default").token
    except Exception as exc:
        raise RuntimeError(
            f"Failed to acquire Entra token for https://ai.azure.com via az CLI or DefaultAzureCredential: {exc}"
        ) from exc


async def send_user_turn(ws, text: str) -> None:
    await ws.send(
        json.dumps(
            {
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [{"type": "input_text", "text": text}],
                },
            }
        )
    )
    await ws.send(json.dumps({"type": "response.create"}))


async def run_smoke_test() -> int:
    try:
        token = acquire_token()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    sep = "&" if "?" in ws_url_base else "?"
    uri = (
        ws_url_base
        if "agent_session_id=" in ws_url_base
        else f"{ws_url_base}{sep}agent_session_id={uuid.uuid4()}"
    )
    headers = {
        "Authorization": "{} {}".format("Bearer", token),
        "Foundry-Features": "VoiceAgents=V1Preview",
    }

    events = []
    transcript = []
    final_transcript = ""
    audio_bytes = 0
    decoded_audio = bytearray()
    session_updated = False
    greeting_in_progress = False
    grace_deadline = None
    sent_turn = False
    completed_status = None

    try:
        try:
            ws_ctx = websockets.connect(
                uri,
                additional_headers=headers,
                open_timeout=60,
                close_timeout=10,
                max_size=16 * 1024 * 1024,
            )
        except TypeError:
            ws_ctx = websockets.connect(
                uri,
                extra_headers=headers,
                open_timeout=60,
                close_timeout=10,
                max_size=16 * 1024 * 1024,
            )

        async with ws_ctx as ws:
            while True:
                if not sent_turn:
                    if session_updated and not greeting_in_progress and grace_deadline is not None:
                        remaining_grace = grace_deadline - time.monotonic()
                        if remaining_grace <= 0:
                            await send_user_turn(ws, prompt_text)
                            sent_turn = True
                            continue
                        recv_timeout = min(float(timeout_sec), remaining_grace)
                    else:
                        recv_timeout = float(timeout_sec)

                    try:
                        raw_msg = await asyncio.wait_for(ws.recv(), timeout=recv_timeout)
                    except (TimeoutError, asyncio.TimeoutError):
                        if session_updated and not greeting_in_progress:
                            await send_user_turn(ws, prompt_text)
                            sent_turn = True
                            continue
                        raise

                    event = json.loads(raw_msg)
                    ev_type = event.get("type", "")
                    events.append(ev_type)

                    if ev_type == "error":
                        print(f"ERROR: Voice session returned error event: {json.dumps(event)}", file=sys.stderr)
                        return 1
                    if ev_type == "session.updated":
                        session_updated = True
                        if not greeting_in_progress:
                            grace_deadline = time.monotonic() + GREETING_GRACE_SECONDS
                    elif ev_type == "response.created" or ev_type.startswith("response.output_"):
                        greeting_in_progress = True
                        grace_deadline = None
                    elif ev_type == "response.done" and greeting_in_progress:
                        greeting_in_progress = False
                        grace_deadline = None
                        await send_user_turn(ws, prompt_text)
                        sent_turn = True
                    continue

                raw_msg = await asyncio.wait_for(ws.recv(), timeout=timeout_sec)
                event = json.loads(raw_msg)
                ev_type = event.get("type", "")
                events.append(ev_type)

                if ev_type == "response.output_audio_transcript.delta":
                    transcript.append(event.get("delta", ""))
                elif ev_type == "response.output_audio_transcript.done":
                    final_transcript = event.get("transcript", "")
                elif ev_type == "response.output_audio.delta":
                    b64_delta = event.get("delta", "")
                    audio_bytes += len(b64_delta)
                    if output_audio and b64_delta:
                        decoded_audio.extend(base64.b64decode(b64_delta))
                elif ev_type == "error":
                    print(f"ERROR: Voice session returned error event: {json.dumps(event)}", file=sys.stderr)
                    return 1
                elif ev_type == "response.done":
                    completed_status = event.get("response", {}).get("status")
                    break
    except (TimeoutError, asyncio.TimeoutError):
        print(f"ERROR: Timed out after {timeout_sec}s waiting for Voice Agent '{agent_name}'.", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR: Voice WebSocket smoke test failed for '{agent_name}': {exc}", file=sys.stderr)
        return 1

    if output_audio and decoded_audio:
        with open(output_audio, "wb") as fh:
            fh.write(decoded_audio)

    text = (final_transcript or "".join(transcript)).strip()
    result = {
        "agent": agent_name,
        "prompt_text": prompt_text,
        "status": completed_status,
        "transcript": text,
        "audio_base64_characters": audio_bytes,
        "event_types": events,
    }
    if expected_marker:
        result["expected_marker"] = expected_marker

    if completed_status != "completed" or not text or audio_bytes <= 0:
        print(f"ERROR: Incomplete Voice Agent response: {json.dumps(result)}", file=sys.stderr)
        return 1

    if expected_marker and expected_marker not in text:
        print(
            f"ERROR: Voice Agent transcript did not contain expected marker {expected_marker!r}: {json.dumps(result)}",
            file=sys.stderr,
        )
        return 1

    print(json.dumps(result, indent=2))
    return 0


sys.exit(asyncio.run(run_smoke_test()))
PY
