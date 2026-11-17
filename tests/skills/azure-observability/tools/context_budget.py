"""Local tokenizer gates; not a claim about every Copilot host's tokenizer."""

import argparse
from contextlib import ExitStack
from pathlib import Path
import socket
import sys
from unittest.mock import patch

try:
    import tiktoken
except ModuleNotFoundError:
    tiktoken = None


ROOT = Path(__file__).resolve().parents[4] / "plugins" / "azure-observability"
ENCODINGS = ("cl100k_base", "o200k_base")
ENTRY_NAMES = {"troubleshoot-observability"}


def measure(root=ROOT):
    if tiktoken is None:
        raise RuntimeError("tiktoken==0.12.0 is unavailable; no dependencies were installed")
    # tiktoken may fetch absent encoding tables; only pre-cached tables are allowed.
    with ExitStack() as stack:
        for operation in ("connect", "connect_ex"):
            stack.enter_context(patch.object(
                socket.socket, operation,
                side_effect=RuntimeError("encoding tables are not cached; network is disabled"),
            ))
        stack.enter_context(patch.object(
            socket, "getaddrinfo",
            side_effect=RuntimeError("encoding tables are not cached; network is disabled"),
        ))
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
    try:
        rows = measure()
    except Exception as error:
        print(f"BLOCKED: context-budget measurement unavailable: {error}", file=sys.stderr)
        return 2
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
