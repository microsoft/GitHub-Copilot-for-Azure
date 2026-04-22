# /// script
# dependencies = [
#   "openai>=1.0",
#   "azure-identity",
# ]
# ///
"""
score_dataset.py — Assess training data quality using an LLM judge.

Scores each example on correctness and relevance, optionally filters
out low-quality examples.

Usage:
  # Score all examples
  python score_dataset.py --input training.jsonl --output scored.jsonl

  # Score and filter (keep only score >= 7)
  python score_dataset.py --input training.jsonl --output filtered.jsonl --min-score 7

  # Custom scoring dimensions
  python score_dataset.py --input training.jsonl --output scored.jsonl \
      --dimensions "correctness,clarity,completeness"
"""

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser

import openai


QUALITY_PROMPT = """You are a data quality assessor for machine learning training data.

## Task
Evaluate this training example for quality.

## User input (what the model receives)
{user_content}

## Assistant output (what the model should learn to produce)
{assistant_content}

## Scoring dimensions
{dimensions_text}

Rate each dimension on a scale of 1-10.

Return ONLY a JSON object with dimension names as keys and integer scores as values.
Example: {example_json}"""


DEFAULT_DIMENSIONS = {
    "correctness": "Is the assistant's output factually/functionally correct?",
    "relevance": "Does the output directly address the user's request?",
    "quality": "Is the output well-written, well-formatted, and professional?",
}


def get_client(endpoint, api_key):
    return openai.AzureOpenAI(
        azure_endpoint=endpoint, api_key=api_key, api_version="2025-04-01-preview"
    )


def score_example(client, model, user_content, assistant_content, dimensions):
    """Score a single training example."""
    dims_text = "\n".join(f"**{k}** (1-10): {v}" for k, v in dimensions.items())
    example = {k: 8 for k in dimensions}

    prompt = QUALITY_PROMPT.format(
        user_content=user_content[:2000],
        assistant_content=assistant_content[:2000],
        dimensions_text=dims_text,
        example_json=json.dumps(example),
    )

    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=200,
            )
            text = resp.choices[0].message.content.strip()
            match = re.search(r'\{[^}]+\}', text)
            if match:
                scores = json.loads(match.group())
                return {k: int(scores.get(k, 0)) for k in dimensions}
        except Exception:
            if attempt < 2:
                time.sleep(2)

    return {k: 0 for k in dimensions}


def main():
    parser = HelpOnErrorParser(description="Score training data quality with LLM judge")
    parser.add_argument("--endpoint", default=os.environ.get("AZURE_OPENAI_ENDPOINT"))
    parser.add_argument("--api-key", default=os.environ.get("AZURE_OPENAI_API_KEY"))
    parser.add_argument("--model", default="gpt-4o", help="Judge model")
    parser.add_argument("--input", required=True, help="Input JSONL file")
    parser.add_argument("--output", required=True, help="Output JSONL file (with scores)")
    parser.add_argument("--min-score", type=float, default=None,
                        help="Minimum average score to keep (filters below this)")
    parser.add_argument("--dimensions", default=None,
                        help="Comma-separated dimension names (default: correctness,relevance,quality)")
    parser.add_argument("--concurrency", type=int, default=4, help="Parallel scoring workers")
    args = parser.parse_args()

    if not args.endpoint or not args.api_key:
        print("Error: Set --endpoint/--api-key or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY")
        sys.exit(1)

    client = get_client(args.endpoint, args.api_key)

    # Parse dimensions
    if args.dimensions:
        dim_names = [d.strip() for d in args.dimensions.split(",")]
        dimensions = {d: f"Rate the {d} of the output" for d in dim_names}
    else:
        dimensions = DEFAULT_DIMENSIONS

    # Load data
    examples = []
    with open(args.input) as f:
        for line in f:
            ex = json.loads(line)
            msgs = ex.get("messages", [])
            user = next((m["content"] for m in msgs if m["role"] == "user"), "")
            asst = next((m["content"] for m in msgs if m["role"] == "assistant"), "")
            examples.append({"data": ex, "user": user, "assistant": asst})

    print(f"Loaded {len(examples)} examples. Scoring with {args.model}...")

    # Score in parallel
    def score_one(idx):
        ex = examples[idx]
        scores = score_example(client, args.model, ex["user"], ex["assistant"], dimensions)
        return idx, scores

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(score_one, i): i for i in range(len(examples))}
        done = 0
        for future in as_completed(futures):
            idx, scores = future.result()
            examples[idx]["scores"] = scores
            done += 1
            if done % 25 == 0:
                print(f"  Scored {done}/{len(examples)}")

    # Calculate stats
    all_avgs = []
    for ex in examples:
        scores = ex.get("scores", {})
        if any(v > 0 for v in scores.values()):
            avg = sum(scores.values()) / len(scores)
            ex["avg_score"] = avg
            all_avgs.append(avg)

    if all_avgs:
        print(f"\nQuality Distribution:")
        print(f"  Mean:   {sum(all_avgs)/len(all_avgs):.1f}")
        print(f"  Min:    {min(all_avgs):.1f}")
        print(f"  Max:    {max(all_avgs):.1f}")
        print(f"  Median: {sorted(all_avgs)[len(all_avgs)//2]:.1f}")

    # Filter and write
    kept = 0
    filtered = 0
    with open(args.output, "w", encoding="utf-8") as f:
        for ex in examples:
            # Add scores as metadata
            ex["data"]["_quality_scores"] = ex.get("scores", {})
            ex["data"]["_avg_quality"] = ex.get("avg_score", 0)

            if args.min_score and ex.get("avg_score", 0) < args.min_score:
                filtered += 1
                continue

            f.write(json.dumps(ex["data"], ensure_ascii=False) + "\n")
            kept += 1

    print(f"\nKept: {kept}, Filtered: {filtered}")
    if args.min_score:
        print(f"(min_score threshold: {args.min_score})")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
