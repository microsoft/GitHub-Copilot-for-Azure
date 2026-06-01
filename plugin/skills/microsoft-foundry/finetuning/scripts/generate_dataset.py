# /// script
# dependencies = [
#   "openai>=1.0",
#   "azure-identity",
#   "azure-ai-projects>=1.0.0b9",
# ]
# ///
"""
generate_dataset.py — Submit a Foundry Data Generation job and download the output.

Wraps the Foundry Data Generation API across all source types and recipes:
  file    × {SimpleQnA, QnA, Conversation}     × {sft, dpo}
  openapi × {ToolUse}                          × {sft}
  traces  × (passthrough)                      × {sft}

Also includes a one-shot OpenAI-tools → OpenAPI 3.0 converter for cases where
you have a `tools=[...]` array but no spec.

Usage:
  # File → SimpleQnA → SFT
  python generate_dataset.py --source file --source-id file-abc123 \
      --recipe SimpleQnA --scenario sft --teacher gpt-4.1 \
      --max-samples 200 --name product-faq --output product_faq.jsonl

  # OpenAPI → ToolUse → SFT
  python generate_dataset.py --source openapi --source-file tools.openapi.json \
      --recipe ToolUse --scenario sft --teacher gpt-4.1 \
      --max-samples 300 --name agent-tools --output tools.jsonl

  # Traces → SFT (distillation)
  python generate_dataset.py --source traces \
      --agent-name my-agent --agent-version 3 --hours 168 \
      --scenario sft --max-samples 1000 --name distil --output traces_raw.jsonl

  # OpenAI tools → OpenAPI 3.0 converter (one-shot)
  python generate_dataset.py --convert-tools my_tools.json --out my_tools.openapi.json
"""

import json
import os
import sys
import time
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser, get_clients


def convert_openai_tools_to_openapi(tools):
    """Convert OpenAI tool defs (tools=[...]) to a minimal OpenAPI 3.0 doc."""
    paths = {}
    for tool in tools:
        fn = tool.get("function", tool)
        name = fn["name"]
        params = fn.get("parameters", {"type": "object", "properties": {}})
        paths[f"/{name}"] = {
            "post": {
                "operationId": name,
                "summary": fn.get("description", ""),
                "requestBody": {
                    "required": True,
                    "content": {"application/json": {"schema": params}},
                },
                "responses": {"200": {"description": "OK"}},
            }
        }
    return {
        "openapi": "3.0.0",
        "info": {"title": "Converted tools", "version": "1.0.0"},
        "paths": paths,
    }


def submit_file_job(project_client, source_id, recipe, scenario, teacher, max_samples, name):
    """Submit a file-source datagen job. Returns job_id."""
    return project_client.fine_tuning.datagen.jobs.create(
        source={"type": "file", "file_id": source_id},
        recipe={"type": recipe},
        scenario=scenario,
        teacher_model=teacher,
        max_samples=max_samples,
        name=name,
    ).id


def submit_openapi_job(project_client, openapi_doc, scenario, teacher, max_samples, name):
    """Submit an openapi-source ToolUse datagen job. Returns job_id."""
    return project_client.fine_tuning.datagen.jobs.create(
        source={"type": "openapi", "spec": openapi_doc},
        recipe={"type": "ToolUse"},
        scenario=scenario,
        teacher_model=teacher,
        max_samples=max_samples,
        name=name,
    ).id


def submit_traces_job(project_client, agent_name, agent_version, hours, scenario, max_samples, name):
    """Submit a traces-source datagen job. Returns job_id."""
    return project_client.fine_tuning.datagen.jobs.create(
        source={
            "type": "traces",
            "agent_name": agent_name,
            "agent_version": str(agent_version),
            "lookback_hours": hours,
        },
        scenario=scenario,
        teacher_model=None,
        max_samples=max_samples,
        name=name,
    ).id


def poll_until_done(project_client, job_id, poll_seconds=10, timeout_seconds=7200):
    """Poll a datagen job until terminal. Returns the final job object."""
    deadline = time.time() + timeout_seconds
    last_status = None
    while time.time() < deadline:
        job = project_client.fine_tuning.datagen.jobs.retrieve(job_id)
        status = getattr(job, "status", "unknown")
        if status != last_status:
            print(f"   t+{int(time.time() - (deadline - timeout_seconds))}s  status={status}")
            last_status = status
        if str(status).lower() in ("succeeded", "failed", "cancelled"):
            return job
        time.sleep(poll_seconds)
    raise TimeoutError(f"Datagen job {job_id} did not reach terminal status within {timeout_seconds}s")


def download_result(project_client, openai_client, job, output_path):
    """Download the SUCCEEDED job's output JSONL to output_path. Returns row count."""
    result_file_id = getattr(job, "result_file_id", None) or getattr(job, "output_file_id", None)
    if not result_file_id:
        raise RuntimeError(f"Job {job.id} succeeded but no result_file_id was returned")
    content = openai_client.files.content(result_file_id).read()
    if isinstance(content, bytes):
        content = content.decode("utf-8")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(content, encoding="utf-8")
    return sum(1 for line in content.splitlines() if line.strip())


def main():
    parser = HelpOnErrorParser(description="Submit Foundry Data Generation job and download output")
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"))
    parser.add_argument("--project-endpoint", default=os.environ.get("AZURE_AI_PROJECT_ENDPOINT"))
    parser.add_argument("--endpoint", default=os.environ.get("AZURE_OPENAI_ENDPOINT"))
    parser.add_argument("--api-key", default=os.environ.get("AZURE_OPENAI_API_KEY"))

    parser.add_argument("--convert-tools", help="One-shot mode: convert OpenAI tools JSON to OpenAPI 3.0; requires --out")
    parser.add_argument("--out", help="Output path for --convert-tools")

    parser.add_argument("--source", choices=["file", "openapi", "traces"])
    parser.add_argument("--recipe", choices=["SimpleQnA", "QnA", "Conversation", "ToolUse"])
    parser.add_argument("--scenario", choices=["sft", "dpo"], default="sft")
    parser.add_argument("--teacher", help="Teacher model deployment (required for file/openapi)")
    parser.add_argument("--max-samples", type=int, default=200)
    parser.add_argument("--name", help="Datagen job name prefix")
    parser.add_argument("--output", help="Output JSONL path")

    # source=file
    parser.add_argument("--source-id", help="Existing Foundry file id (file-xxx)")
    parser.add_argument("--source-file", help="Local file to upload (file or openapi source)")

    # source=traces
    parser.add_argument("--agent-name")
    parser.add_argument("--agent-version")
    parser.add_argument("--hours", type=int, default=168)

    parser.add_argument("--poll-seconds", type=int, default=10)
    parser.add_argument("--timeout-seconds", type=int, default=7200)
    args = parser.parse_args()

    # One-shot tools converter — no Foundry call needed.
    if args.convert_tools:
        if not args.out:
            parser.error("--out is required with --convert-tools")
        with open(args.convert_tools, encoding="utf-8") as f:
            tools = json.load(f)
        if isinstance(tools, dict) and "tools" in tools:
            tools = tools["tools"]
        spec = convert_openai_tools_to_openapi(tools)
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(spec, f, indent=2)
        print(f"✅ Converted {len(tools)} tools → {args.out}")
        return

    if not args.source or not args.scenario or not args.name or not args.output:
        parser.error("--source, --scenario, --name, and --output are required")

    openai_client, _ = get_clients(
        base_url=args.base_url, azure_endpoint=args.endpoint,
        project_endpoint=args.project_endpoint, api_key=args.api_key,
    )

    # Foundry SDK for datagen API
    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential

    project_endpoint = args.project_endpoint
    if not project_endpoint:
        parser.error("--project-endpoint is required for datagen submission (set AZURE_AI_PROJECT_ENDPOINT)")
    project_client = AIProjectClient(endpoint=project_endpoint, credential=DefaultAzureCredential())

    # Submit by source type
    if args.source == "file":
        if not args.recipe:
            parser.error("--recipe is required for source=file")
        if not args.teacher:
            parser.error("--teacher is required for source=file")
        source_id = args.source_id
        if not source_id:
            if not args.source_file:
                parser.error("--source-id or --source-file is required for source=file")
            print(f"📤 Uploading {args.source_file}...")
            with open(args.source_file, "rb") as f:
                up = openai_client.files.create(file=f, purpose="fine-tune")
            source_id = up.id
            print(f"   File ID: {source_id}")
        print(f"📤 Submitting '{args.name}' (source=file, recipe={args.recipe}, scenario={args.scenario})")
        job_id = submit_file_job(project_client, source_id, args.recipe, args.scenario,
                                 args.teacher, args.max_samples, args.name)

    elif args.source == "openapi":
        if not args.source_file:
            parser.error("--source-file is required for source=openapi")
        if not args.teacher:
            parser.error("--teacher is required for source=openapi")
        with open(args.source_file, encoding="utf-8") as f:
            openapi_doc = json.load(f) if args.source_file.endswith(".json") else f.read()
        print(f"📤 Submitting '{args.name}' (source=openapi, recipe=ToolUse, scenario={args.scenario})")
        job_id = submit_openapi_job(project_client, openapi_doc, args.scenario,
                                    args.teacher, args.max_samples, args.name)

    elif args.source == "traces":
        if not args.agent_name or not args.agent_version:
            parser.error("--agent-name and --agent-version are required for source=traces")
        print(f"📤 Submitting '{args.name}' (source=traces, agent={args.agent_name}@{args.agent_version}, hours={args.hours})")
        job_id = submit_traces_job(project_client, args.agent_name, args.agent_version, args.hours,
                                   args.scenario, args.max_samples, args.name)

    print(f"   job.id = {job_id}")
    print(f"   Polling every {args.poll_seconds}s.")
    job = poll_until_done(project_client, job_id, args.poll_seconds, args.timeout_seconds)

    final_status = str(getattr(job, "status", "unknown")).lower()
    if final_status != "succeeded":
        print(f"❌ Job ended with status: {final_status}")
        err = getattr(job, "error", None) or getattr(job, "last_error", None)
        if err:
            print(f"   error: {err}")
        sys.exit(1)

    rows = download_result(project_client, openai_client, job, args.output)
    print(f"✅ Generated {rows} samples → {args.output}")


if __name__ == "__main__":
    main()
