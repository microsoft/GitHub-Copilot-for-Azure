# /// script
# dependencies = [
#   "azure-ai-evaluation>=1.0.0",
#   "azure-identity",
# ]
# ///
"""
content_safety_check.py — Pre-screen training data for Azure FT safety violations.

Azure Fine-Tuning preprocessing rejects whole submissions when ANY row contains
content above the safety severity threshold (~2 for FT, lower than the default
4 used in public Content Safety scenarios). This script flags those rows BEFORE
submission so the rejection isn't all-or-nothing.

Uses the Azure AI Evaluation SDK's ContentSafetyEvaluator with user content as
`query` and assistant content as `response`, so the harm signal is attributed
correctly per turn. Splits the input into a passing JSONL (--output) and a
dropped JSONL (--output.dropped.jsonl) with per-category severities for review.

Usage:
  python content_safety_check.py \
      --input training.jsonl \
      --output training.safe.jsonl \
      --project-endpoint https://...services.ai.azure.com/api/projects/myproj \
      --threshold 2 --concurrency 4
"""

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser


HARM_CATEGORIES = ("hate_unfairness", "sexual", "violence", "self_harm")

# Azure Content Safety severity bands. The ContentSafetyEvaluator generally
# returns integers in this set, but older SDK builds returned strings.
SEVERITY_BANDS = {"safe": 0, "very low": 1, "low": 2, "medium": 4, "high": 6}


def row_text_split(row):
    """Return (user_text, assistant_text) concatenated across all turns.

    ContentSafetyEvaluator scores `query` vs `response` separately. We send
    user turns as the query and assistant turns as the response so the
    severity attribution matches what Azure FT preprocessing will see.
    """
    user_parts = []
    asst_parts = []
    for m in row.get("messages", []):
        if m.get("role") not in ("user", "assistant"):
            continue
        c = m.get("content")
        if isinstance(c, str):
            chunk = c
        elif isinstance(c, list):
            chunk = "\n".join(part.get("text", "") for part in c
                              if isinstance(part, dict) and part.get("type") == "text")
        else:
            chunk = ""
        if not chunk:
            continue
        (user_parts if m["role"] == "user" else asst_parts).append(chunk)
    return "\n".join(user_parts), "\n".join(asst_parts)


def severity_to_int(value):
    """Normalize an SDK severity value to an int 0-7. Warn on unknown values."""
    if isinstance(value, bool):
        return 0  # bools are ints in Python; treat as missing
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        key = value.strip().lower()
        if key in SEVERITY_BANDS:
            return SEVERITY_BANDS[key]
        # Unknown string — don't silently pass; warn so users notice SDK drift.
        print(f"⚠️ Unknown severity value {value!r}; treating as 0", file=sys.stderr)
    return 0


def evaluate_row(evaluator, user_text, asst_text):
    """Returns (dict of category → severity int, worst severity overall)."""
    if not user_text.strip() and not asst_text.strip():
        return {cat: 0 for cat in HARM_CATEGORIES}, 0
    try:
        result = evaluator(query=user_text, response=asst_text)
    except Exception as e:
        print(f"⚠️ Evaluator error on row: {e}", file=sys.stderr)
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
    parser.add_argument("--concurrency", type=int, default=4,
                        help="Parallel evaluator workers")
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

    azure_ai_project = {"project_endpoint": args.project_endpoint}
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
                print(f"⚠️ Skipping malformed JSON on line {i+1}: {e}", file=sys.stderr)
    print(f"Loaded {len(rows)} rows. Scoring with ContentSafetyEvaluator (threshold={args.threshold}, concurrency={args.concurrency})...")

    def score_one(idx):
        u, a = row_text_split(rows[idx])
        sevs, worst = evaluate_row(evaluator, u, a)
        return idx, sevs, worst

    results = [None] * len(rows)
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(score_one, i): i for i in range(len(rows))}
        done = 0
        for fut in as_completed(futures):
            idx, sevs, worst = fut.result()
            results[idx] = (sevs, worst)
            done += 1
            if done % 50 == 0:
                print(f"  Scored {done}/{len(rows)}")

    kept = []
    dropped = []
    for i, row in enumerate(rows):
        sevs, worst = results[i] or ({c: 0 for c in HARM_CATEGORIES}, 0)
        if worst >= args.threshold:
            dropped.append({"row_index": i, "severities": sevs, "row": row})
        else:
            kept.append(row)

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
