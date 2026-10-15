# Smoke-test a deployed Microsoft Foundry Voice Agent over its managed voice WebSocket endpoint.
#
# Usage:
#   .\foundry-agent\create\scripts\smoke-test-voice.ps1 `
#     -Endpoint <project-endpoint> `
#     -AgentName <voice-agent-name> `
#     [-Text <prompt-text>] `
#     [-ExpectedMarker <substring>] `
#     [-Timeout <seconds>] `
#     [-OutputAudio <file-path>] `
#     [-DryRun] `
#     [-Help]
#
# Options:
#   -Endpoint <url>          Foundry project endpoint (https://<host>/api/projects/<project>)
#   -AgentName <name>        Deployed Voice Agent name (kind: voice wrapper or Prompt Voice agent)
#   -Text <prompt>           Prompt text to send after session initialization (default: "In one short sentence, introduce yourself.")
#   -ExpectedMarker <text>   Optional substring that must appear in the requested turn's transcript
#   -Timeout <seconds>       Positive integer timeout in seconds (default: 180)
#   -OutputAudio <path>      Optional file path to write decoded PCM audio bytes
#   -DryRun                  Print resolved WebSocket URL and execution plan without connecting
#   -Help                    Show this help text and exit 0
#
# Exit Codes:
#   0  Smoke test passed (or -Help / -DryRun succeeded)
#   1  Smoke test failed (missing Python/websockets, auth failure, WebSocket error, empty transcript/audio, missing expected marker, or timeout)
#   2  Usage or argument validation error

param(
    [string]$Endpoint = "",
    [string]$AgentName = "",
    [string]$Text = "In one short sentence, introduce yourself.",
    [string]$ExpectedMarker = "",
    [string]$Timeout = "180",
    [string]$OutputAudio = "",
    [switch]$DryRun,
    [switch]$Help,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

function Show-Usage {
    $lines = Get-Content -LiteralPath $PSCommandPath | Select-Object -First 27
    foreach ($line in $lines) {
        if ($line -match '^#\s?(.*)$') {
            Write-Output $Matches[1]
        }
    }
}

if ($Help) {
    Show-Usage
    exit 0
}

if ($null -ne $RemainingArgs -and $RemainingArgs.Count -gt 0) {
    Write-Error "ERROR: Unknown argument(s): $($RemainingArgs -join ' ')"
    Show-Usage
    exit 2
}

if ([string]::IsNullOrWhiteSpace($Endpoint)) {
    Write-Error "ERROR: -Endpoint is required."
    Show-Usage
    exit 2
}

if ([string]::IsNullOrWhiteSpace($AgentName)) {
    Write-Error "ERROR: -AgentName is required."
    Show-Usage
    exit 2
}

if ([string]::IsNullOrWhiteSpace($Text)) {
    Write-Error "ERROR: -Text must not be empty."
    Show-Usage
    exit 2
}

if ($Timeout -notmatch '^[1-9][0-9]*$') {
    Write-Error "ERROR: -Timeout must be a positive integer (got '$Timeout')."
    exit 2
}

$trimmedEndpoint = $Endpoint.TrimEnd('/')
if ($trimmedEndpoint.StartsWith("https://")) {
    $wsBase = "wss://" + $trimmedEndpoint.Substring("https://".Length)
} elseif ($trimmedEndpoint.StartsWith("wss://")) {
    $wsBase = $trimmedEndpoint
} else {
    Write-Error "ERROR: -Endpoint must start with https:// or wss:// (got '$Endpoint')."
    exit 2
}

if ($wsBase -like "*/protocols/voice*") {
    $wsUrl = $wsBase
} else {
    $wsUrl = "$wsBase/agents/$AgentName/endpoint/protocols/voice?api-version=v1"
}

if ($DryRun) {
    Write-Output "DRY-RUN: Voice Agent WebSocket Smoke Test"
    Write-Output "  Project Endpoint : $Endpoint"
    Write-Output "  Agent Name       : $AgentName"
    Write-Output "  WebSocket URL    : $wsUrl&agent_session_id=<uuid>"
    Write-Output "  Headers          : Foundry-Features: VoiceAgents=V1Preview"
    Write-Output "  Prompt Text      : $Text"
    if (-not [string]::IsNullOrWhiteSpace($ExpectedMarker)) {
        Write-Output "  Expected Marker  : $ExpectedMarker"
    } else {
        Write-Output "  Expected Marker  : (none)"
    }
    Write-Output "  Timeout (s)      : $Timeout"
    if (-not [string]::IsNullOrWhiteSpace($OutputAudio)) {
        Write-Output "  Output Audio     : $OutputAudio"
    } else {
        Write-Output "  Output Audio     : (none)"
    }
    Write-Output "  Auth Resource    : https://ai.azure.com (az account get-access-token)"
    exit 0
}

$pythonCmd = $null
if (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} else {
    Write-Error "ERROR: Python 3 is required to run the Voice WebSocket smoke test."
    exit 1
}

$pyScript = @'
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
'@

$env:SMOKE_WS_URL = $wsUrl
$env:SMOKE_AGENT_NAME = $AgentName
$env:SMOKE_PROMPT_TEXT = $Text
$env:SMOKE_TIMEOUT = $Timeout
$env:SMOKE_OUTPUT_AUDIO = $OutputAudio
$env:SMOKE_EXPECTED_MARKER = $ExpectedMarker

$pyScript | & $pythonCmd -
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
exit 0
