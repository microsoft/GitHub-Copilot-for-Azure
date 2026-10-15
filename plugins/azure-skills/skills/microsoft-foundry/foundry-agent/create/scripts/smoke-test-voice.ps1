# Smoke-test a deployed Microsoft Foundry Voice Agent over its managed voice WebSocket endpoint.
#
# Usage:
#   .\foundry-agent\create\scripts\smoke-test-voice.ps1 `
#     -Endpoint <project-endpoint> `
#     -AgentName <voice-agent-name> `
#     [-Text <prompt-text>] `
#     [-Timeout <seconds>] `
#     [-OutputAudio <file-path>] `
#     [-DryRun] `
#     [-Help]
#
# Options:
#   -Endpoint <url>        Foundry project endpoint (https://<host>/api/projects/<project>)
#   -AgentName <name>      Deployed Voice Agent name (kind: voice wrapper or Prompt Voice agent)
#   -Text <prompt>         Prompt text to send after session initialization (default: "In one short sentence, introduce yourself.")
#   -Timeout <seconds>     Positive integer timeout in seconds (default: 180)
#   -OutputAudio <path>    Optional file path to write decoded PCM audio bytes
#   -DryRun                Print resolved WebSocket URL and execution plan without connecting
#   -Help                  Show this help text and exit 0
#
# Exit Codes:
#   0  Smoke test passed (or -Help / -DryRun succeeded)
#   1  Smoke test failed (missing Python/websockets, auth failure, WebSocket error, empty transcript/audio, or timeout)
#   2  Usage or argument validation error

param(
    [string]$Endpoint = "",
    [string]$AgentName = "",
    [string]$Text = "In one short sentence, introduce yourself.",
    [string]$Timeout = "180",
    [string]$OutputAudio = "",
    [switch]$DryRun,
    [switch]$Help,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

function Show-Usage {
    $lines = Get-Content -LiteralPath $PSCommandPath | Select-Object -First 25
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
import subprocess
import sys
import uuid

ws_url_base, agent_name, prompt_text, timeout_raw, output_audio = sys.argv[1:6]
timeout_sec = int(timeout_raw)

try:
    import websockets
except ImportError as exc:
    print(
        f"ERROR: Missing WebSocket client dependency ({exc}). Install with: pip install websockets",
        file=sys.stderr,
    )
    sys.exit(1)


def acquire_token() -> str:
    try:
        token = subprocess.check_output(
            [
                "az",
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
    sent_turn = False
    greeting_in_progress = False
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
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=timeout_sec)
                event = json.loads(raw_msg)
                ev_type = event.get("type", "")
                events.append(ev_type)

                if not sent_turn:
                    if ev_type == "response.created":
                        greeting_in_progress = True
                    elif ev_type == "session.updated" and not greeting_in_progress:
                        await send_user_turn(ws, prompt_text)
                        sent_turn = True
                    elif ev_type == "response.done" and greeting_in_progress:
                        greeting_in_progress = False
                        await send_user_turn(ws, prompt_text)
                        sent_turn = True
                    elif ev_type == "error":
                        print(f"ERROR: Voice session returned error event: {json.dumps(event)}", file=sys.stderr)
                        return 1
                    continue

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
    except TimeoutError:
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
        "status": completed_status,
        "transcript": text,
        "audio_base64_characters": audio_bytes,
        "event_types": events,
    }

    if completed_status != "completed" or not text or audio_bytes <= 0:
        print(f"ERROR: Incomplete Voice Agent response: {json.dumps(result)}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2))
    return 0


sys.exit(asyncio.run(run_smoke_test()))
'@

$pyScript | & $pythonCmd - $wsUrl $AgentName $Text $Timeout $OutputAudio
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
exit 0
