# /// script
# dependencies = [
#   "openai>=1.0",
#   "azure-identity",
# ]
# ///
"""
diagnose_iteration.py — Classify why an auto-tune iteration regressed.

Given a task spec, per-candidate eval results, and the train/test datasets,
asks a strong judge model to pick a root cause from the standard taxonomy:

  wrong_hps_overfit | wrong_hps_underfit | data_quality | model_mismatch
  | distribution_shift | eval_problem | task_genuinely_hard | success_actually

See references/iteration-diagnosis.md for the full taxonomy and how each
maps to a next-iteration sweep.

Usage:
  python diagnose_iteration.py \
      --task-spec task_spec.json \
      --baseline baseline.json \
      --candidates evals_iter1/ \
      --train prepared/train.jsonl --test prepared/test.jsonl \
      --output diagnosis.json
"""

import json
import os
import random
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import HelpOnErrorParser, get_clients


TAXONOMY = [
    "wrong_hps_overfit",
    "wrong_hps_underfit",
    "data_quality",
    "model_mismatch",
    "distribution_shift",
    "eval_problem",
    "task_genuinely_hard",
    "success_actually",
]


JUDGE_PROMPT = """You are diagnosing why a fine-tuning iteration regressed or under-performed.

## Task spec
{task_spec}

## Baseline metrics (base model on test set)
{baseline}

## Candidates this iteration
{candidates}

## 3 random train rows (what the model learned from)
{train_samples}

## 3 random test rows the best candidate FAILED
{failed_samples}

## 3 random test rows the best candidate PASSED (may be empty)
{passed_samples}

## Pick ONE root cause from this list and explain

{taxonomy_table}

Return ONLY a JSON object:
{{
  "root_cause": "<one of: {taxonomy_csv}>",
  "evidence": "<2-4 sentence citation of specific metrics/rows above>",
  "recommendation": "<concrete next-iteration action — HPs to try, data filter to apply, base model to swap to, or STOP>",
  "confidence": <0.0 - 1.0>
}}
"""


TAXONOMY_TABLE = """
- `wrong_hps_overfit`         — train_loss << val_loss; FT regressed on test
- `wrong_hps_underfit`        — train+val loss plateau high; FT ≈ baseline
- `data_quality`              — failed test cases resemble noisy training rows
- `model_mismatch`            — lift saturates across HP sweeps; base model picks wrong framing
- `distribution_shift`        — train and test obviously differ in topic/style
- `eval_problem`              — FT outputs look good on inspection but evaluator scored low
- `task_genuinely_hard`       — needs retrieval / external knowledge; SFT cannot fix
- `success_actually`          — non-default metric did improve; treat as SHIP
""".strip()


def load_jsonl(path, k=None):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    if k is not None and len(rows) > k:
        return random.sample(rows, k)
    return rows


def discover_candidates(candidates_dir):
    """Each *.json in candidates_dir is one candidate's eval output."""
    candidates = []
    for path in sorted(Path(candidates_dir).glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                candidates.append({"name": path.stem, "result": json.load(f)})
        except Exception as e:
            print(f"⚠️ Skipped {path}: {e}")
    return candidates


def extract_pass_fail_samples(candidate_result, test_rows, k=3):
    """Split test rows into rows the candidate passed vs failed, sample k each."""
    rows_with_scores = candidate_result.get("rows", []) or candidate_result.get("results", [])
    fail_ids = []
    pass_ids = []
    for i, r in enumerate(rows_with_scores):
        # heuristic: row has a top-level numeric "score" or nested "outputs.*.score"
        score = r.get("score")
        if score is None:
            outputs = r.get("outputs", {}) if isinstance(r.get("outputs"), dict) else {}
            for v in outputs.values():
                if isinstance(v, (int, float)):
                    score = v
                    break
        if score is None:
            continue
        if score < 0.5:
            fail_ids.append(i)
        else:
            pass_ids.append(i)
    failed = [test_rows[i] for i in random.sample(fail_ids, min(k, len(fail_ids)))]
    passed = [test_rows[i] for i in random.sample(pass_ids, min(k, len(pass_ids)))]
    return failed, passed


def summarize_row(row, max_chars=400):
    """Compact a row to first user + last asst for prompt inclusion."""
    msgs = row.get("messages", [])
    user = next((m.get("content", "") for m in msgs if m.get("role") == "user"), "")
    asst = next((m.get("content", "") for m in reversed(msgs) if m.get("role") == "assistant"), "")
    user_s = (user or "")[:max_chars]
    asst_s = (asst or "")[:max_chars]
    return f"user: {user_s}\nassistant: {asst_s}"


def main():
    parser = HelpOnErrorParser(description="LLM-judge root-cause classifier for auto-tune iterations")
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL"))
    parser.add_argument("--project-endpoint", default=os.environ.get("AZURE_AI_PROJECT_ENDPOINT"))
    parser.add_argument("--endpoint", default=os.environ.get("AZURE_OPENAI_ENDPOINT"))
    parser.add_argument("--api-key", default=os.environ.get("AZURE_OPENAI_API_KEY"))
    parser.add_argument("--judge", default="gpt-4.1", help="Judge model deployment")

    parser.add_argument("--task-spec", required=True, help="task_spec.json from Phase 1")
    parser.add_argument("--baseline", required=True, help="baseline.json eval result")
    parser.add_argument("--candidates", required=True, help="Directory of per-candidate eval JSONs")
    parser.add_argument("--train", required=True, help="prepared/train.jsonl")
    parser.add_argument("--test", required=True, help="prepared/test.jsonl")
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    client, _ = get_clients(
        base_url=args.base_url, azure_endpoint=args.endpoint,
        project_endpoint=args.project_endpoint, api_key=args.api_key,
    )

    with open(args.task_spec, encoding="utf-8") as f:
        task_spec = json.load(f)
    with open(args.baseline, encoding="utf-8") as f:
        baseline = json.load(f)
    candidates = discover_candidates(args.candidates)
    if not candidates:
        print(f"❌ No candidate eval JSONs found in {args.candidates}")
        sys.exit(1)
    test_rows = load_jsonl(args.test)
    train_samples_rows = load_jsonl(args.train, k=args.samples)

    # Find best candidate by metrics.mean_score / metrics.pass_rate / score
    def cand_score(c):
        m = (c["result"].get("metrics") or {})
        return m.get("pass_rate") or m.get("mean_score") or m.get("score") or 0
    best = max(candidates, key=cand_score)
    failed, passed = extract_pass_fail_samples(best["result"], test_rows, k=args.samples)

    prompt = JUDGE_PROMPT.format(
        task_spec=json.dumps(task_spec, indent=2)[:2000],
        baseline=json.dumps(baseline.get("metrics") or baseline, indent=2)[:1000],
        candidates="\n".join(
            f"- {c['name']}: {json.dumps((c['result'].get('metrics') or {}), indent=2)[:300]}"
            for c in candidates),
        train_samples="\n---\n".join(summarize_row(r) for r in train_samples_rows),
        failed_samples="\n---\n".join(summarize_row(r) for r in failed) or "(no failures available)",
        passed_samples="\n---\n".join(summarize_row(r) for r in passed) or "(no passes available)",
        taxonomy_table=TAXONOMY_TABLE,
        taxonomy_csv=", ".join(TAXONOMY),
    )

    print(f"Calling judge {args.judge}...")
    resp = client.chat.completions.create(
        model=args.judge,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_completion_tokens=600,
    )
    text = (resp.choices[0].message.content or "").strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        print(f"❌ Judge returned non-JSON: {text[:200]}")
        sys.exit(1)
    try:
        diagnosis = json.loads(match.group())
    except json.JSONDecodeError as e:
        print(f"❌ Could not parse judge JSON: {e}\nRaw: {text[:500]}")
        sys.exit(1)

    if diagnosis.get("root_cause") not in TAXONOMY:
        print(f"⚠️ Judge picked non-taxonomy root_cause: {diagnosis.get('root_cause')}")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(diagnosis, f, indent=2, ensure_ascii=False)

    print(f"✅ root_cause = {diagnosis.get('root_cause')}  confidence = {diagnosis.get('confidence')}")
    print(f"   recommendation: {diagnosis.get('recommendation')}")
    print(f"   → {args.output}")


if __name__ == "__main__":
    main()
