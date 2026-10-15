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
#   -Text <prompt>         Prompt text to send after session initialization (default: "Hello, briefly introduce yourself.")
#   -Timeout <seconds>     Positive integer timeout in seconds (default: 30)
#   -OutputAudio <path>    Optional file path to write received PCM16 audio bytes
#   -DryRun                Print resolved WebSocket URL and execution plan without connecting
#   -Help                  Show this help text and exit 0
#
# Exit Codes:
#   0  Smoke test passed (or -Help / -DryRun succeeded)
#   1  Smoke test failed (missing Python/SDK, auth failure, WebSocket error, or timeout)
#   2  Usage or argument validation error

param(
    [string]$Endpoint = "",
    [string]$AgentName = "",
    [string]$Text = "Hello, briefly introduce yourself.",
    [string]$Timeout = "30",
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
    Write-Output "  WebSocket URL    : $wsUrl"
    Write-Output "  Prompt Text      : $Text"
    Write-Output "  Timeout (s)      : $Timeout"
    if (-not [string]::IsNullOrWhiteSpace($OutputAudio)) {
        Write-Output "  Output Audio     : $OutputAudio"
    } else {
        Write-Output "  Output Audio     : (none)"
    }
    Write-Output "  Auth Scope       : https://ai.azure.com/.default (DefaultAzureCredential)"
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
'@

$pyScript | & $pythonCmd - $wsUrl $AgentName $Text $Timeout $OutputAudio
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
exit 0
