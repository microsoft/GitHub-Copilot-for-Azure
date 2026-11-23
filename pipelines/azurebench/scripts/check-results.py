"""Print the run ID and pass only if msbench-cli succeeded and every requested task is resolved.

Usage: python3 check-results.py <results-dir> <msbench-cli-exit-code>
Exit codes: 0 all tasks resolved, 1 the run failed or a task is not resolved, 2 usage error.
"""
import json
import os
import sys


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    folder, status = sys.argv[1], int(sys.argv[2])

    events = os.path.join(folder, "events.jsonl")
    run_ids = []
    if os.path.exists(events):
        for line in open(events, encoding="utf-8"):
            event = json.loads(line)
            if event.get("event") == "run_started":
                run_ids.append(event["data"].get("run_id"))
    print("Run ID:", run_ids[-1] if run_ids else "not started")

    report = os.path.join(folder, "report.json")
    if not os.path.exists(report):
        print(f"No results (msbench-cli exit code {status}).")
        return 1
    data = json.load(open(report, encoding="utf-8"))
    totals = [b["totals"] for b in data["summary"]["benchmarks_overview"].values()]
    passed = sum(t["num_passed_cases"] for t in totals)
    requested = data["requested_instance_count"]
    print(f"Resolved {passed}/{requested}")
    return 0 if status == 0 and requested > 0 and passed == requested else 1


if __name__ == "__main__":
    sys.exit(main())
