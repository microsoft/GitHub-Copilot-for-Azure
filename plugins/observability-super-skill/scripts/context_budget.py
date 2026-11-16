"""Local tokenizer gates; not a claim about every Copilot host's tokenizer."""

import argparse
from pathlib import Path
import sys

import tiktoken


ROOT = Path(__file__).resolve().parents[1]
ENCODINGS = ("cl100k_base", "o200k_base")
ENTRY_NAMES = {"troubleshoot-observability", "microsoft-foundry"}


def measure(root=ROOT):
    encoders = {name: tiktoken.get_encoding(name) for name in ENCODINGS}
    measurements = []
    for path in sorted((root / "skills").rglob("*.md")):
        text = path.read_text("utf-8-sig")
        counts = {name: len(encoder.encode(text, disallowed_special=()))
                  for name, encoder in encoders.items()}
        body = text.split("---", 2)[2] if text.startswith("---\n") else text
        entry_counts = {name: len(encoder.encode(body, disallowed_special=()))
                        for name, encoder in encoders.items()}
        measurements.append((path.relative_to(root), counts, entry_counts))
    return measurements


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file-limit", type=int, default=5000)
    parser.add_argument("--entry-limit", type=int, default=1000)
    args = parser.parse_args()
    if args.file_limit <= 0 or args.entry_limit <= 0:
        parser.error("token limits must be positive")
    violations = []
    rows = measure()
    for relative, counts, entry_counts in rows:
        if max(counts.values()) > args.file_limit:
            violations.append(f"{relative}: file tokens {counts}")
        if relative.as_posix() in {
            f"skills/{name}/SKILL.md" for name in ENTRY_NAMES
        }:
            print(f"{relative}: full={counts}; entry body={entry_counts}")
            if max(entry_counts.values()) > args.entry_limit:
                violations.append(f"{relative}: entry body tokens {entry_counts}")
    if violations:
        print("\n".join(violations), file=sys.stderr)
        return 1
    print(f"PASS: {len(rows)} runtime Markdown files <= {args.file_limit} tokens "
          f"in {', '.join(ENCODINGS)}; selected entry bodies <= {args.entry_limit}.")
    print("Other host tokenizers and actual conditionally loaded context remain "
          "separate installed-host evaluation gates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
