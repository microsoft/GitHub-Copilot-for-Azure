# /// script
# dependencies = [
#   "openai>=1.0",
#   "requests",
#   "azure-identity",
#   "azure-ai-projects",
# ]
# ///
"""
submit_training.py — Submit SFT, DPO, or RFT training jobs on Azure AI Foundry.

Handles both SDK and REST API submission (REST fallback for OSS models).
Supports /v1/ project endpoint (preferred) and Azure endpoint (fallback).

Usage:
  python submit_training.py --base-url https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/ \
      --api-key KEY --training-file training.jsonl --validation-file validation.jsonl \
      --model gpt-4.1-mini --type sft --epochs 2 --lr 1.0

  python submit_training.py --endpoint https://<resource>.openai.azure.com --api-key KEY \
      --training-file-id file-abc123 --validation-file-id file-def456 \
      --model gpt-oss-20b --type sft --epochs 2 --lr 0.5 --use-rest

  python submit_training.py --base-url <url> --api-key KEY \
      --training-file-id file-abc123 --validation-file-id file-def456 \
      --model o4-mini-2025-04-16 --type rft --grader-file grader.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser

import openai
import requests


def get_client(base_url=None, endpoint=None, api_key=None):
    """Create client. Prefer /v1/ project URL (OpenAI) over Azure endpoint."""
    if base_url:
        return openai.OpenAI(base_url=base_url, api_key=api_key)
    return openai.AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2025-04-01-preview",
    )


def upload_file(client, filepath):
    """Upload a file and wait for processing."""
    print(f"Uploading {filepath}...")
    with open(filepath, "rb") as f:
        result = client.files.create(purpose="fine-tune", file=f)
    print(f"  File ID: {result.id}, waiting for processing...")
    client.files.wait_for_processing(result.id)
    print(f"  Ready.")
    return result.id


def submit_sft_sdk(client, model, train_id, val_id, epochs=2, lr=1.0, batch_size=None, suffix=None):
    """Submit SFT job using the Python SDK."""
    hp = {"n_epochs": epochs, "learning_rate_multiplier": lr}
    if batch_size:
        hp["batch_size"] = batch_size

    kwargs = dict(
        model=model,
        training_file=train_id,
        validation_file=val_id,
        method={"type": "supervised"},
        hyperparameters=hp,
    )
    if suffix:
        kwargs["suffix"] = suffix

    job = client.fine_tuning.jobs.create(**kwargs)
    return {"id": job.id, "status": job.status, "model": model, "method": "sdk"}


def submit_sft_rest(endpoint, api_key, model, train_id, val_id, epochs=2, lr=1.0, batch_size=None):
    """Submit SFT job via REST API (fallback for models like gpt-oss-20b)."""
    url = f"{endpoint}/openai/fine_tuning/jobs?api-version=2025-04-01-preview"
    body = {
        "model": model,
        "training_file": train_id,
        "validation_file": val_id,
        "method": {"type": "supervised"},
        "hyperparameters": {"n_epochs": epochs, "learning_rate_multiplier": lr},
        "trainingType": "globalStandard",
    }
    if batch_size:
        body["hyperparameters"]["batch_size"] = batch_size

    resp = requests.post(url, headers={
        "Content-Type": "application/json",
        "api-key": api_key,
    }, json=body)

    if resp.status_code in (200, 201):
        data = resp.json()
        return {"id": data["id"], "status": data["status"], "model": model, "method": "rest"}
    else:
        raise RuntimeError(f"REST submission failed ({resp.status_code}): {resp.text}")


def submit_rft(client, model, train_id, val_id, grader_source):
    """Submit RFT job."""
    job = client.fine_tuning.jobs.create(
        model=model,
        training_file=train_id,
        validation_file=val_id,
        method={
            "type": "reinforcement",
            "reinforcement": {
                "grader": {
                    "type": "python",
                    "name": "custom_grader",
                    "source": grader_source,
                },
            },
        },
    )
    return {"id": job.id, "status": job.status, "model": model, "method": "sdk-rft"}


def main():
    parser = HelpOnErrorParser(description="Submit fine-tuning jobs on Azure AI Foundry")
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"),
                        help="Project /v1/ URL (preferred). Uses openai.OpenAI().")
    parser.add_argument("--endpoint", default=os.environ.get("AZURE_OPENAI_ENDPOINT"),
                        help="Azure OpenAI endpoint (fallback). Uses AzureOpenAI().")
    parser.add_argument("--api-key", default=os.environ.get("AZURE_OPENAI_API_KEY"),
                        help="API key")
    parser.add_argument("--model", required=True, help="Base model name (e.g., gpt-4.1-mini)")
    parser.add_argument("--type", choices=["sft", "dpo", "rft"], default="sft",
                        help="Training type: sft, dpo, or rft")

    # Data files — either paths (will upload) or IDs (already uploaded)
    parser.add_argument("--training-file", help="Path to training JSONL file (will upload)")
    parser.add_argument("--validation-file", help="Path to validation JSONL file (will upload)")
    parser.add_argument("--training-file-id", help="Already-uploaded training file ID")
    parser.add_argument("--validation-file-id", help="Already-uploaded validation file ID")

    # Hyperparameters
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--lr", type=float, default=1.0, help="Learning rate multiplier")
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--suffix", help="Model suffix for identification")

    # DPO-specific
    parser.add_argument("--beta", type=float, default=0.1, help="DPO beta (alignment strength)")

    # RFT-specific
    parser.add_argument("--grader-file", help="Path to Python grader file (for RFT)")

    # REST fallback
    parser.add_argument("--use-rest", action="store_true",
                        help="Force REST API (needed for gpt-oss-20b)")

    args = parser.parse_args()

    if not args.api_key:
        print("Error: Set --api-key or AZURE_OPENAI_API_KEY")
        sys.exit(1)
    if not args.base_url and not args.endpoint:
        print("Error: Set --base-url or --endpoint (or env vars OPENAI_BASE_URL / AZURE_OPENAI_ENDPOINT)")
        sys.exit(1)

    client = get_client(base_url=args.base_url, endpoint=args.endpoint, api_key=args.api_key)

    # Resolve file IDs
    train_id = args.training_file_id
    val_id = args.validation_file_id
    if args.training_file:
        train_id = upload_file(client, args.training_file)
    if args.validation_file:
        val_id = upload_file(client, args.validation_file)

    if not train_id or not val_id:
        print("Error: Provide training and validation file paths or IDs")
        sys.exit(1)

    # Submit
    try:
        if args.type == "rft":
            if not args.grader_file:
                print("Error: --grader-file required for RFT")
                sys.exit(1)
            with open(args.grader_file) as f:
                grader_source = f.read()
            result = submit_rft(client, args.model, train_id, val_id, grader_source)
        elif args.type == "dpo":
            job = client.fine_tuning.jobs.create(
                model=args.model,
                training_file=train_id,
                validation_file=val_id,
                suffix=args.suffix or None,
                method={
                    "type": "dpo",
                    "dpo": {
                        "hyperparameters": {
                            "n_epochs": args.epochs,
                            "beta": args.beta,
                            "learning_rate_multiplier": args.lr,
                        },
                    },
                },
            )
            result = {"id": job.id, "status": job.status, "model": args.model, "method": "sdk-dpo"}
        elif args.use_rest:
            result = submit_sft_rest(args.endpoint, args.api_key, args.model,
                                     train_id, val_id, args.epochs, args.lr, args.batch_size)
        else:
            result = submit_sft_sdk(client, args.model, train_id, val_id,
                                    args.epochs, args.lr, args.batch_size, args.suffix)
    except Exception as e:
        if "does not support fine-tuning with Standard TrainingType" in str(e):
            if not args.endpoint:
                print(f"SDK failed for {args.model}. REST fallback requires --endpoint or AZURE_OPENAI_ENDPOINT.")
                sys.exit(1)
            print(f"SDK failed for {args.model}, falling back to REST API...")
            result = submit_sft_rest(args.endpoint, args.api_key, args.model,
                                     train_id, val_id, args.epochs, args.lr, args.batch_size)
        else:
            raise

    print(f"\nJob submitted successfully:")
    print(json.dumps(result, indent=2))

    # Save job info
    outfile = f"ft_job_{result['id']}.json"
    with open(outfile, "w") as f:
        json.dump({**result, "epochs": args.epochs, "lr": args.lr,
                    "batch_size": args.batch_size, "train_file": train_id,
                    "val_file": val_id}, f, indent=2)
    print(f"Job info saved to {outfile}")


if __name__ == "__main__":
    main()
