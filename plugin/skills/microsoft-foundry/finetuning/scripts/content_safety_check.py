# /// script
# dependencies = [
#   "azure-ai-evaluation>=1.0.0",
#   "azure-identity",
# ]
# ///
"""
content_safety_check.py — Pre-screen training data for Azure FT safety violations.

Azure Fine-Tuning preprocessing rejects whole submissions when ANY row contains
content above the safety severity threshold (~2 for FT, not the 4 used in
public Content Safety defaults). This script flags those rows BEFORE submission.

Uses the Azure AI Evaluation SDK's ContentSafetyEvaluator. Splits the input
into a passing JSONL (--output) and a dropped JSONL (--output.dropped.jsonl)
with severity details for inspection.

Usage:
  python content_safety_check.py \
      --input training.jsonl \
      --output training.safe.jsonl \
      --project-endpoint https://...services.ai.azure.com/api/projects/myproj \
      --threshold 2
"""

import json
import os
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser


HARM_CATEGORIES = ("hate_unfairness", "sexual", "violence", "self_harm")


def row_text(row):
    """Concatenate all user/assistant content for safety scoring."""
    parts = []
    for m in row.get("messages", []):
        if m.get("role") in ("user", "assistant"):
            c = m.get("content")
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, list):
                for chunk in c:
                    if isinstance(chunk, dict) and chunk.get("type") == "text":
                        parts.append(chunk.get("text", ""))
    return "\n".join(p for p in parts if p)


def severity_to_int(value):
    """ContentSafetyEvaluator returns severity as 'Safe'/'Low'/'Medium'/'High' or int."""
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        return {"safe": 0, "very low": 1, "low": 2, "medium": 4, "high": 6}.get(value.lower(), 0)
    return 0


def evaluate_row(evaluator, text):
    """Returns dict of category → severity int, plus the worst severity overall."""
    if not text.strip():
        return {cat: 0 for cat in HARM_CATEGORIES}, 0
    try:
        result = evaluator(query=text, response="")
    except Exception as e:
        print(f"⚠️ Evaluator error on row: {e}")
        return {cat: 0 for cat in HARM_CATEGORIES}, 0
    sevs = {}
    for cat in HARM_CATEGORIES:
        for key in (f"{cat}_score", cat, f"{cat}_severity"):
            if key in result:
                sevs[cat] = severity_to_int(result[key])
                break
        else:
            sevs[cat] = 0
    return sevs, max(sevs.values())


def main():
    parser = HelpOnErrorParser(description="Pre-screen training JSONL with Foundry Content Safety")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True, help="Passing rows JSONL")
    parser.add_argument("--project-endpoint", default=os.environ.get("AZURE_AI_PROJECT_ENDPOINT"),
                        help="Required. Foundry project endpoint for ContentSafetyEvaluator.")
    parser.add_argument("--threshold", type=int, default=2,
                        help="Drop rows where any harm severity >= threshold. Default 2 (Azure FT cutoff).")
    args = parser.parse_args()

    if not args.project_endpoint:
        parser.error("--project-endpoint is required (set AZURE_AI_PROJECT_ENDPOINT)")

    try:
        from azure.ai.evaluation import ContentSafetyEvaluator
        from azure.identity import DefaultAzureCredential
    except ImportError as e:
        print(f"❌ azure-ai-evaluation not installed: {e}")
        print("   pip install azure-ai-evaluation")
        sys.exit(1)

    # Azure AI project config required by ContentSafetyEvaluator
    azure_ai_project = {
        "project_endpoint": args.project_endpoint,
    }
    evaluator = ContentSafetyEvaluator(
        credential=DefaultAzureCredential(),
        azure_ai_project=azure_ai_project,
    )

    rows = []
    with open(args.input, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"⚠️ Skipping malformed JSON on line {i+1}: {e}")
    print(f"Loaded {len(rows)} rows. Scoring with ContentSafetyEvaluator (threshold={args.threshold})...")

    kept = []
    dropped = []
    for i, row in enumerate(rows):
        sevs, worst = evaluate_row(evaluator, row_text(row))
        if worst >= args.threshold:
            dropped.append({"row_index": i, "severities": sevs, "row": row})
        else:
            kept.append(row)
        if (i + 1) % 50 == 0:
            print(f"  Scored {i+1}/{len(rows)} (kept {len(kept)}, dropped {len(dropped)})")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        for row in kept:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    dropped_path = str(args.output).rsplit(".", 1)[0] + ".dropped.jsonl"
    with open(dropped_path, "w", encoding="utf-8") as f:
        for item in dropped:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"\n✅ Kept {len(kept)} → {args.output}")
    print(f"   Dropped {len(dropped)} → {dropped_path}")
    if dropped:
        cats_hit = {}
        for d in dropped:
            for cat, sev in d["severities"].items():
                if sev >= args.threshold:
                    cats_hit[cat] = cats_hit.get(cat, 0) + 1
        print(f"   By category: {cats_hit}")


if __name__ == "__main__":
    main()
