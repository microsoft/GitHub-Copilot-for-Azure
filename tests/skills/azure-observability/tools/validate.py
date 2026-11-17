"""Run offline tests and tokenizer gates with one approved development interpreter."""

from pathlib import Path
import os
import subprocess
import sys


TESTS = Path(__file__).resolve().parents[1]
REPOSITORY = TESTS.parents[2]


def main():
    commands = [
        [sys.executable, "-B", "-m", "unittest", "discover",
         "-s", str(TESTS), "-p", "test_*.py", "-q"],
        [sys.executable, "-B", str(TESTS / "tools" / "context_budget.py")],
    ]
    environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    for command in commands:
        result = subprocess.run(command, cwd=REPOSITORY, env=environment, check=False)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
