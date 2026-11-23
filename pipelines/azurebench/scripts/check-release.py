"""Check that a benchmark release's metadata and dataset agree and every task pin is pushed.

Usage: python3 check-release.py <benchmark> <registry.json> <dataset.jsonl>
Run from the repository root with full git history.
Exit codes: 0 all checks passed, 1 a check failed, 2 usage error.
"""
import json
import re
import subprocess
import sys


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)


def main():
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        return 2
    name, metadata, dataset = sys.argv[1:]
    meta = json.load(open(metadata, encoding="utf-8"))
    rows = [json.loads(line) for line in open(dataset, encoding="utf-8") if line.strip()]
    errors = []

    if meta["id"] != name:
        errors.append(f"{metadata}: id is {meta['id']}, expected {name}")
    if "REPLACE" in meta.get("contactEmail", ""):
        errors.append(f"{metadata}: set contactEmail to the owner mailbox")
    if len({r["instance_id"] for r in rows}) != len(rows):
        errors.append(f"{dataset}: duplicate instance_id")

    for r in rows:
        where = f"{dataset}: {r['instance_id']}"
        commit, path = r.get("task_repo_commit", ""), r.get("task_path", "")
        if r["benchmark"] != name:
            errors.append(f"{where}: benchmark is {r['benchmark']}, expected {name}")
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            errors.append(f"{where}: task_repo_commit must be a full commit SHA")
        elif not git("branch", "-r", "--contains", commit).stdout.strip():
            errors.append(f"{where}: commit {commit} is not pushed to this repo")
        elif git("cat-file", "-e", f"{commit}:{path}/task.toml").returncode != 0:
            errors.append(f"{where}: {path}/task.toml not found at {commit}")

    print("\n".join(errors) or f"{len(rows)} task(s) OK")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
