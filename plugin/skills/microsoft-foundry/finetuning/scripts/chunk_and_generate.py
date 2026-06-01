# /// script
# dependencies = [
#   "openai>=1.0",
#   "azure-identity",
#   "azure-ai-projects>=1.0.0b9",
# ]
# ///
"""
chunk_and_generate.py — Work around Foundry SimpleQnA per-source saturation.

A single SimpleQnA job on one source produces ~100-150 unique pairs regardless
of max_samples. This script:
  1. Splits a local file into N chunks
  2. Uploads each chunk
  3. Submits N parallel datagen jobs (bounded by --concurrency)
  4. Polls each job to completion
  5. Downloads outputs and dedupes by question text

Bound --concurrency by the teacher's TPM budget. Each job reads the full chunk
plus multiple internal passes — rule of thumb: chunks ≤ 150 KB and
concurrency ≤ TPM / 150_000.

Usage:
  python chunk_and_generate.py \
      --input big_doc.md --chunk-size 50000 \
      --teacher gpt-4.1 --recipe SimpleQnA --scenario sft \
      --max-samples-per-chunk 150 --concurrency 2 \
      --output big_doc_dataset.jsonl
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass  # Stream not reconfigurable (older Python or non-tty); default encoding is fine

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser, get_clients


def chunk_text(text, chunk_size, overlap=2000):
    """Split text into chunks with a small overlap at boundaries."""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        # Try to break on a paragraph boundary for cleaner chunks
        if end < len(text):
            nl = text.rfind("\n\n", start + chunk_size // 2, end)
            if nl > 0:
                end = nl
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return chunks


def submit_and_wait(project_client, openai_client, chunk_text_str, chunk_idx, args):
    """Upload a chunk, submit datagen, poll, return list of dicts (rows).

    Cleans up the uploaded chunk file in a finally block — without it, each
    chunked run permanently consumes a Foundry file-quota slot.
    """
    chunk_path = Path(args.work_dir) / f"chunk_{chunk_idx:03d}.md"
    chunk_path.write_text(chunk_text_str, encoding="utf-8")
    print(f"[chunk {chunk_idx}] {len(chunk_text_str)} chars  uploading...")

    with open(chunk_path, "rb") as f:
        up = openai_client.files.create(file=f, purpose="fine-tune")
    print(f"[chunk {chunk_idx}] file_id={up.id}  submitting...")

    rows = []
    try:
        job = project_client.fine_tuning.datagen.jobs.create(
            source={"type": "file", "file_id": up.id},
            recipe={"type": args.recipe},
            scenario=args.scenario,
            teacher_model=args.teacher,
            max_samples=args.max_samples_per_chunk,
            name=f"{args.name_prefix}-chunk{chunk_idx}",
        )
        print(f"[chunk {chunk_idx}] job_id={job.id}  polling...")

        start = time.time()
        deadline = start + args.timeout_seconds
        last_status = None
        while time.time() < deadline:
            j = project_client.fine_tuning.datagen.jobs.retrieve(job.id)
            status = str(getattr(j, "status", "unknown")).lower()
            if status != last_status:
                print(f"[chunk {chunk_idx}] t+{int(time.time() - start)}s  status={status}")
                last_status = status
            if status in ("succeeded", "failed", "cancelled"):
                if status != "succeeded":
                    err = getattr(j, "error", None) or getattr(j, "last_error", None)
                    print(f"[chunk {chunk_idx}] ❌ {status}: {err}")
                    return rows
                result_file_id = getattr(j, "result_file_id", None) or getattr(j, "output_file_id", None)
                if not result_file_id:
                    return rows
                content = openai_client.files.content(result_file_id).read()
                if isinstance(content, bytes):
                    content = content.decode("utf-8")
                for line in content.splitlines():
                    if line.strip():
                        try:
                            rows.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass  # Skip malformed rows from the datagen output; surface count in the summary
                print(f"[chunk {chunk_idx}] ✅ {len(rows)} rows")
                return rows
            time.sleep(args.poll_seconds)
        print(f"[chunk {chunk_idx}] ⏰ timed out")
        return rows
    finally:
        try:
            openai_client.files.delete(up.id)
        except Exception as e:
            print(f"[chunk {chunk_idx}] ⚠️ failed to delete uploaded chunk file {up.id}: {e}",
                  file=sys.stderr)


def _user_text(msg):
    """Extract plain text from a message's content field (handles str or list parts)."""
    c = msg.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "\n".join(part.get("text", "") for part in c
                         if isinstance(part, dict) and part.get("type") == "text")
    return ""


def dedup_by_first_user(rows):
    """Dedupe rows by the first user message text (after normalizing content)."""
    seen = set()
    unique = []
    for row in rows:
        msgs = row.get("messages") or []
        first_user = next((m for m in msgs if m.get("role") == "user"), None)
        if not first_user:
            continue
        key = _user_text(first_user).strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(row)
    return unique


def main():
    parser = HelpOnErrorParser(description="Chunk a source + run parallel Foundry datagen jobs")
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"))
    parser.add_argument("--project-endpoint", default=os.environ.get("AZURE_AI_PROJECT_ENDPOINT"))
    parser.add_argument("--endpoint", default=os.environ.get("AZURE_OPENAI_ENDPOINT"))
    parser.add_argument("--api-key", default=os.environ.get("AZURE_OPENAI_API_KEY"))

    parser.add_argument("--input", required=True, help="Local source file (text/markdown)")
    parser.add_argument("--chunk-size", type=int, default=50000, help="Chunk size in characters")
    parser.add_argument("--chunk-overlap", type=int, default=2000)
    parser.add_argument("--teacher", required=True, help="Teacher model deployment")
    parser.add_argument("--recipe", default="SimpleQnA", choices=["SimpleQnA", "QnA", "Conversation"])
    parser.add_argument("--scenario", default="sft", choices=["sft", "dpo"])
    parser.add_argument("--max-samples-per-chunk", type=int, default=150)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--output", required=True)
    parser.add_argument("--name-prefix", default="chunked")
    parser.add_argument("--work-dir", default="./chunks", help="Where to write chunk files")
    parser.add_argument("--poll-seconds", type=int, default=10)
    parser.add_argument("--timeout-seconds", type=int, default=7200)
    args = parser.parse_args()

    if args.chunk_overlap >= args.chunk_size:
        parser.error(f"--chunk-overlap ({args.chunk_overlap}) must be < --chunk-size ({args.chunk_size})")

    Path(args.work_dir).mkdir(parents=True, exist_ok=True)

    text = Path(args.input).read_text(encoding="utf-8")
    chunks = chunk_text(text, args.chunk_size, args.chunk_overlap)
    print(f"Source: {args.input}  ({len(text)} chars)  →  {len(chunks)} chunks")

    openai_client, _ = get_clients(
        base_url=args.base_url, azure_endpoint=args.endpoint,
        project_endpoint=args.project_endpoint, api_key=args.api_key,
    )

    from azure.ai.projects import AIProjectClient
    from azure.identity import DefaultAzureCredential
    if not args.project_endpoint:
        parser.error("--project-endpoint is required (set AZURE_AI_PROJECT_ENDPOINT)")
    project_client = AIProjectClient(endpoint=args.project_endpoint, credential=DefaultAzureCredential())

    all_rows = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(submit_and_wait, project_client, openai_client, c, i, args): i
                   for i, c in enumerate(chunks)}
        for f in as_completed(futures):
            all_rows.extend(f.result())

    print(f"\nConcatenated: {len(all_rows)} rows  (across {len(chunks)} chunks)")
    unique = dedup_by_first_user(all_rows)
    print(f"After dedup by user text: {len(unique)} rows")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        for row in unique:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"✅ Wrote {len(unique)} unique rows → {args.output}")


if __name__ == "__main__":
    main()
