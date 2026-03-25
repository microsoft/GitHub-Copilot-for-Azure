#!/usr/bin/env python3
"""
GEPA auto-evaluator for sensei.

Discovers a skill's existing test harness at runtime and builds a GEPA-compatible
evaluator. Zero manual configuration — reads triggers.test.ts, unit.test.ts, and
integration.test.ts to construct the fitness function.

Usage:
    # Score a skill (no optimization, no LLM calls)
    python auto_evaluator.py score --skill azure-deploy --skills-dir plugin/skills --tests-dir tests

    # Optimize a skill (requires LLM API)
    python auto_evaluator.py optimize --skill azure-deploy --skills-dir plugin/skills --tests-dir tests

    # Score all skills
    python auto_evaluator.py score-all --skills-dir plugin/skills --tests-dir tests

    # JSON output
    python auto_evaluator.py score --skill azure-deploy --json
"""

import argparse
import json
import os
import re
import subprocess
from pathlib import Path


# ── Keyword matching (mirrors trigger-matcher.ts) ──────────────────────────

AZURE_KEYWORDS = [
    "azure", "storage", "cosmos", "sql", "redis", "keyvault", "key vault",
    "function", "app service", "container", "aks", "kubernetes", "bicep",
    "terraform", "deploy", "monitor", "diagnostic", "security", "rbac",
    "identity", "entra", "authentication", "cli", "mcp", "validation",
    "networking", "observability", "foundry", "agent", "model",
]

STOP_WORDS = {
    "the", "and", "for", "with", "this", "that", "from", "have", "has",
    "are", "was", "were", "been", "being", "will", "would", "could",
    "should", "may", "might", "can", "shall", "not", "use", "when",
    "what", "how", "why", "who", "which", "where", "does", "don",
    "your", "its", "our", "their", "these", "those", "some", "any",
    "all", "each", "every", "both", "such", "than", "also", "only",
}


def strip_frontmatter(content: str) -> str:
    """Strip YAML frontmatter from skill content, safely handling malformed files."""
    lines = content.splitlines()
    if lines and lines[0].strip() == "---":
        closing_idx = None
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                closing_idx = i
                break
        if closing_idx is not None:
            return "\n".join(lines[closing_idx + 1 :]).strip()
    return content


def stem(word: str) -> str:
    """Minimal stemmer for keyword matching."""
    for suffix in ("ation", "ting", "ing", "ies", "ied", "es", "ed", "ly", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def extract_keywords(skill_name: str, description: str) -> list[str]:
    """Extract keywords from skill name + description."""
    keywords = set()
    for part in skill_name.split("-"):
        if len(part) > 2:
            keywords.add(part.lower())
    desc_lower = description.lower()
    for word in re.split(r"\s+", desc_lower):
        clean = re.sub(r"[^a-z0-9-]", "", word)
        if clean == "ai" or len(clean) > 3:
            if clean not in STOP_WORDS:
                keywords.add(clean)
    for kw in AZURE_KEYWORDS:
        if kw in desc_lower:
            keywords.add(kw)
    return sorted(keywords)


def check_trigger(prompt: str, keywords: list[str]) -> tuple[bool, list[str], float]:
    """Check if a prompt triggers based on keyword matching with stemming."""
    prompt_lower = prompt.lower()
    matched = []
    for kw in keywords:
        kw_stem = stem(kw)
        if kw in prompt_lower or kw_stem in prompt_lower:
            matched.append(kw)
            continue
        for word in re.split(r"\s+", prompt_lower):
            clean = re.sub(r"[^a-z0-9-]", "", word)
            if clean and stem(clean) == kw_stem:
                matched.append(kw)
                break
    confidence = len(matched) / max(len(keywords), 1)
    triggered = len(matched) >= 2 or confidence >= 0.2
    return triggered, matched, confidence


# ── Test harness discovery ─────────────────────────────────────────────────

def parse_trigger_arrays(test_file: Path) -> dict:
    """Parse shouldTrigger/shouldNotTrigger arrays from a triggers.test.ts file.

    Uses regex to extract string arrays without needing a TS parser.
    """
    content = test_file.read_text()
    result = {"should_trigger": [], "should_not_trigger": []}

    # Match arrays like: shouldTrigger = ["...", "..."] or const shouldTriggerPrompts = [...]
    for var_pattern, key in [
        (r"shouldTrigger(?:Prompts)?(?:\s*:\s*\w+(?:\[\])?)?\s*=\s*\[", "should_trigger"),
        (r"shouldNotTrigger(?:Prompts)?(?:\s*:\s*\w+(?:\[\])?)?\s*=\s*\[", "should_not_trigger"),
    ]:
        match = re.search(var_pattern, content, re.IGNORECASE)
        if match:
            start = match.end()
            # Find the closing bracket, handling nested strings
            depth = 1
            i = start
            while i < len(content) and depth > 0:
                if content[i] == "[":
                    depth += 1
                elif content[i] == "]":
                    depth -= 1
                i += 1
            array_text = content[start : i - 1]
            # Strip single-line comments to avoid extracting commented-out examples
            array_text = re.sub(r"//.*", "", array_text)
            # Strip multi-line comments
            array_text = re.sub(r"/\*.*?\*/", "", array_text, flags=re.DOTALL)
            # Extract strings from the array
            strings = re.findall(r'["\']([^"\']+)["\']', array_text)
            result[key] = strings

    return result


def discover_test_harness(tests_dir: Path, skill_name: str) -> dict:
    """Discover available test files for a skill.

    Returns dict with:
      - has_triggers: bool
      - has_integration: bool
      - has_unit: bool
      - trigger_prompts: {should_trigger: [...], should_not_trigger: [...]}
    """
    skill_test_dir = tests_dir / skill_name
    result = {
        "has_triggers": False,
        "has_integration": False,
        "has_unit": False,
        "trigger_prompts": {"should_trigger": [], "should_not_trigger": []},
    }

    if not skill_test_dir.exists():
        return result

    # Check for test files (search recursively for nested dirs like microsoft-foundry/foundry-agent/)
    for trigger_file in skill_test_dir.rglob("triggers.test.ts"):
        result["has_triggers"] = True
        prompts = parse_trigger_arrays(trigger_file)
        result["trigger_prompts"]["should_trigger"].extend(prompts["should_trigger"])
        result["trigger_prompts"]["should_not_trigger"].extend(prompts["should_not_trigger"])

    for _ in skill_test_dir.rglob("integration.test.ts"):
        result["has_integration"] = True
        break

    for _ in skill_test_dir.rglob("unit.test.ts"):
        result["has_unit"] = True
        break

    return result


# ── Content quality scorer ─────────────────────────────────────────────────

def score_content_quality(skill_md_content: str) -> tuple[float, dict]:
    """Score SKILL.md content quality. Pure Python, no LLM calls.

    Returns (score, detail_scores).
    """
    scores = {}
    feedback = []
    content_lower = skill_md_content.lower()

    # Description length (first non-heading paragraph)
    lines = skill_md_content.strip().split("\n")
    desc_text = " ".join(l for l in lines[:5] if l.strip() and not l.startswith("#"))
    if 150 <= len(desc_text) <= 1024:
        scores["description_length"] = 1.0
    elif len(desc_text) < 150:
        scores["description_length"] = len(desc_text) / 150
        feedback.append(f"Description too short ({len(desc_text)} chars, need 150+)")
    else:
        scores["description_length"] = min(1.0, 1024 / len(desc_text))
        feedback.append(f"Description too long ({len(desc_text)} chars, max 1024)")

    # Required sections
    for section in ["trigger", "rule", "step"]:
        if f"## {section}" in content_lower or f"# {section}" in content_lower:
            scores[f"has_{section}s"] = 1.0
        else:
            scores[f"has_{section}s"] = 0.0
            feedback.append(f"Missing '## {section.title()}s' section")

    # Routing patterns
    for pattern, label in [
        ("use for:", "has_use_for"),
        ("when:", "has_when"),
        ("do not use for:", "has_do_not_use_for"),
    ]:
        if pattern in content_lower:
            scores[label] = 1.0
        else:
            scores[label] = 0.0
            feedback.append(f"Missing '{pattern.upper()}' pattern")

    # Bad patterns
    bad = [
        (r"api[_-]?key\s*[:=]", "Contains API key pattern"),
        (r"password\s*[:=]", "Contains password pattern"),
        (r"TODO|FIXME|HACK", "Contains TODO/FIXME markers"),
    ]
    for pat, msg in bad:
        if re.search(pat, skill_md_content, re.IGNORECASE):
            scores["no_bad_patterns"] = 0.0
            feedback.append(msg)
            break
    else:
        scores["no_bad_patterns"] = 1.0

    score = sum(scores.values()) / len(scores) if scores else 0.0
    return score, {"scores": scores, "feedback": feedback}


# ── Composite evaluator builder ────────────────────────────────────────────

def build_evaluator(skill_name: str, tests_dir: Path, fast: bool = True):
    """Auto-build a GEPA evaluator for a skill from its test harness.

    Returns a callable(candidate, example) -> (score, asi_dict).
    """
    harness = discover_test_harness(tests_dir, skill_name)

    def evaluator(candidate: str, example: dict) -> tuple[float, dict]:
        import gepa.optimize_anything as oa

        scores = {}
        asi = {}

        # 1. Content quality (always, fast)
        quality_score, quality_detail = score_content_quality(candidate)
        scores["quality"] = quality_score
        if quality_detail["feedback"]:
            asi["QualityIssues"] = "\n".join(quality_detail["feedback"])

        # 2. Trigger accuracy (if tests discovered)
        if harness["has_triggers"] and harness["trigger_prompts"]["should_trigger"]:
            # Extract description from candidate for keyword matching
            desc_lines = []
            for line in candidate.split("\n"):
                if line.strip() and not line.startswith("#"):
                    desc_lines.append(line)
                if len(desc_lines) >= 5:
                    break
            desc_text = " ".join(desc_lines)
            keywords = extract_keywords(skill_name, desc_text + " " + candidate[:500])

            correct = 0
            total = 0
            trigger_failures = []

            for prompt in harness["trigger_prompts"]["should_trigger"]:
                triggered, matched, conf = check_trigger(prompt, keywords)
                total += 1
                if triggered:
                    correct += 1
                else:
                    trigger_failures.append(
                        f"FN: '{prompt[:60]}...' (matched: {matched}, conf: {conf:.1%})"
                    )

            for prompt in harness["trigger_prompts"]["should_not_trigger"]:
                triggered, matched, conf = check_trigger(prompt, keywords)
                total += 1
                if not triggered:
                    correct += 1
                else:
                    trigger_failures.append(
                        f"FP: '{prompt[:60]}...' (matched: {matched}, conf: {conf:.1%})"
                    )

            scores["triggers"] = correct / total if total else 1.0
            if trigger_failures:
                asi["TriggerFailures"] = "\n".join(trigger_failures[:5])

        # Aggregate
        final_score = sum(scores.values()) / len(scores) if scores else 0.0

        oa.log(
            f"[{skill_name}] quality={scores.get('quality', 0):.2f} "
            f"triggers={scores.get('triggers', 'N/A')}"
        )

        return final_score, asi

    return evaluator, harness


# ── Score command ──────────────────────────────────────────────────────────

def score_skill(
    skill_name: str,
    skills_dir: Path,
    tests_dir: Path,
    as_json: bool = False,
) -> dict:
    """Score a single skill's SKILL.md content quality + trigger accuracy."""
    skill_md = skills_dir / skill_name / "SKILL.md"
    if not skill_md.exists():
        return {"skill": skill_name, "error": f"SKILL.md not found at {skill_md}"}

    content = skill_md.read_text()
    body = strip_frontmatter(content)

    # Build evaluator and score
    harness = discover_test_harness(tests_dir, skill_name)
    quality_score, quality_detail = score_content_quality(body)

    result = {
        "skill": skill_name,
        "quality_score": round(quality_score, 2),
        "quality_detail": quality_detail["scores"],
        "quality_feedback": quality_detail["feedback"],
        "has_triggers_test": harness["has_triggers"],
        "has_integration_test": harness["has_integration"],
        "has_unit_test": harness["has_unit"],
        "trigger_prompt_count": len(harness["trigger_prompts"]["should_trigger"]),
    }

    # Trigger accuracy if test data available
    if harness["has_triggers"] and harness["trigger_prompts"]["should_trigger"]:
        # Use full content for keyword extraction
        keywords = extract_keywords(skill_name, body[:1000])
        correct = total = 0
        for p in harness["trigger_prompts"]["should_trigger"]:
            t, _, _ = check_trigger(p, keywords)
            total += 1
            correct += int(t)
        for p in harness["trigger_prompts"]["should_not_trigger"]:
            t, _, _ = check_trigger(p, keywords)
            total += 1
            correct += int(not t)
        result["trigger_accuracy"] = round(correct / total, 2) if total else None
    else:
        result["trigger_accuracy"] = None

    return result


# ── Optimize command ───────────────────────────────────────────────────────

def optimize_skill(
    skill_name: str,
    skills_dir: Path,
    tests_dir: Path,
    max_iterations: int = 80,
    model: str = "openai/gpt-4o",
) -> dict:
    """Run GEPA optimize_anything on a skill's SKILL.md body content."""
    import gepa.optimize_anything as oa

    skill_md = skills_dir / skill_name / "SKILL.md"
    if not skill_md.exists():
        return {"skill": skill_name, "error": f"SKILL.md not found at {skill_md}"}

    content = skill_md.read_text()
    body = strip_frontmatter(content)

    # Auto-build evaluator from test harness
    evaluator, harness = build_evaluator(skill_name, tests_dir, fast=True)

    # Build dataset from discovered trigger prompts
    dataset = []
    if harness["has_triggers"]:
        for prompt in harness["trigger_prompts"]["should_trigger"]:
            dataset.append({"skill_name": skill_name, "prompt": prompt, "expected": True})
        for prompt in harness["trigger_prompts"]["should_not_trigger"]:
            dataset.append({"skill_name": skill_name, "prompt": prompt, "expected": False})

    if not dataset:
        dataset = [{"skill_name": skill_name, "aspect": "overall"}]

    # Configure LLM via GitHub Models
    try:
        token = subprocess.check_output(["gh", "auth", "token"]).decode().strip()
        os.environ.setdefault("OPENAI_API_KEY", token)
        os.environ.setdefault("OPENAI_API_BASE", "https://models.github.ai/inference")
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass  # Let litellm find credentials from env

    proposer_lm = oa.make_litellm_lm(model)

    result = oa.optimize_anything(
        seed_candidate=body,
        evaluator=evaluator,
        dataset=dataset,
        objective=(
            f"Optimize the SKILL.md content for the '{skill_name}' skill. "
            f"The goal is to make an LLM correctly invoke this skill for relevant prompts. "
            f"Include sections: ## Triggers, ## Rules, ## Steps, ## MCP Tools, ## References. "
            f"Include 'USE FOR:', 'WHEN:', and 'DO NOT USE FOR:' patterns for routing."
        ),
        background=(
            f"This is a SKILL.md for GitHub Copilot. The LLM reads it to decide which "
            f"skill to invoke. It competes with ~24 other skills for selection. "
            f"The content must clearly differentiate what this skill does vs others."
        ),
        config=oa.GEPAConfig(
            engine=oa.EngineConfig(max_metric_calls=max_iterations),
            reflection=oa.ReflectionConfig(reflection_lm=proposer_lm),
        ),
    )

    return {
        "skill": skill_name,
        "original": body,
        "optimized": result.best_candidate,
        "best_score": getattr(result, "best_score", None),
    }


# ── CLI ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="GEPA auto-evaluator for sensei skill optimization"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # score command
    score_p = subparsers.add_parser("score", help="Score a skill's quality")
    score_p.add_argument("--skill", required=True)
    score_p.add_argument("--skills-dir", default="plugin/skills")
    score_p.add_argument("--tests-dir", default="tests")
    score_p.add_argument("--json", action="store_true")

    # score-all command
    all_p = subparsers.add_parser("score-all", help="Score all skills")
    all_p.add_argument("--skills-dir", default="plugin/skills")
    all_p.add_argument("--tests-dir", default="tests")
    all_p.add_argument("--json", action="store_true")
    all_p.add_argument("--sort", choices=["score", "name"], default="score")

    # optimize command
    opt_p = subparsers.add_parser("optimize", help="Optimize a skill with GEPA")
    opt_p.add_argument("--skill", required=True)
    opt_p.add_argument("--skills-dir", default="plugin/skills")
    opt_p.add_argument("--tests-dir", default="tests")
    opt_p.add_argument("--iterations", type=int, default=80)
    opt_p.add_argument("--model", default="openai/gpt-4o")
    opt_p.add_argument("--json", action="store_true")

    args = parser.parse_args()
    skills_dir = Path(args.skills_dir)
    tests_dir = Path(args.tests_dir)

    if args.command == "score":
        result = score_skill(args.skill, skills_dir, tests_dir)
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            _print_score(result)

    elif args.command == "score-all":
        skills = sorted(
            d.name for d in skills_dir.iterdir() if d.is_dir() and not d.name.startswith(".")
        )
        results = [score_skill(s, skills_dir, tests_dir) for s in skills]
        if args.sort == "score":
            results.sort(key=lambda r: r.get("quality_score", 0))
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            _print_score_table(results)

    elif args.command == "optimize":
        result = optimize_skill(
            args.skill, skills_dir, tests_dir, args.iterations, args.model
        )
        if args.json:
            print(json.dumps(result, indent=2, default=str))
        else:
            if "error" in result:
                print(f"Error: {result['error']}")
            else:
                print(f"✓ Optimized {args.skill}")
                print(f"  Score: {result.get('best_score', 'N/A')}")
                print(f"  Original length: {len(result['original'])} chars")
                print(f"  Optimized length: {len(result['optimized'])} chars")
                print(f"\n--- Optimized content (first 500 chars) ---")
                print(result["optimized"][:500])


def _print_score(result: dict):
    """Pretty-print a single skill score."""
    if "error" in result:
        print(f"⚠ {result['skill']}: {result['error']}")
        return
    q = result["quality_score"]
    t = result.get("trigger_accuracy")
    icon = "✓" if q >= 0.8 else "✗"
    print(f"\n  {icon} {result['skill']}")
    print(f"    Quality:  {q:.2f}")
    if t is not None:
        print(f"    Triggers: {t:.2f}")
    print(f"    Tests:    {'T' if result['has_triggers_test'] else '-'}"
          f"{'I' if result['has_integration_test'] else '-'}"
          f"{'U' if result['has_unit_test'] else '-'}")
    if result["quality_feedback"]:
        for fb in result["quality_feedback"]:
            print(f"    ⚠ {fb}")


def _print_score_table(results: list[dict]):
    """Pretty-print score table for all skills."""
    print(f"\n{'Skill':<30} {'Quality':>8} {'Triggers':>9} {'Tests':>6}")
    print("─" * 56)
    for r in results:
        if "error" in r:
            print(f"{r['skill']:<30} {'ERROR':>8}")
            continue
        q = r["quality_score"]
        t = r.get("trigger_accuracy")
        tests = (
            f"{'T' if r['has_triggers_test'] else '-'}"
            f"{'I' if r['has_integration_test'] else '-'}"
            f"{'U' if r['has_unit_test'] else '-'}"
        )
        icon = "✓" if q >= 0.8 else "✗"
        t_str = f"{t:.2f}" if t is not None else "N/A"
        print(f"{icon} {r['skill']:<28} {q:>8.2f} {t_str:>9} {tests:>6}")

    passing = sum(1 for r in results if r.get("quality_score", 0) >= 0.8)
    print(f"\n  {passing}/{len(results)} skills at quality >= 0.80")


if __name__ == "__main__":
    main()
