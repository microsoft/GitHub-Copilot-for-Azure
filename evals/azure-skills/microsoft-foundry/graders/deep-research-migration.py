import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


CASES = tuple(f"T{number:02}" for number in range(1, 8))


def configured_path(variable):
    path = Path(os.environ.get(variable, ""))
    if not path.is_absolute():
        raise ValueError(f"Set {variable} to an absolute path.")
    try:
        return path.resolve(strict=True)
    except OSError:
        raise ValueError(f"{variable} must point to an existing path.") from None


def case_status(result):
    if not isinstance(result, dict):
        return "missing"
    if result.get("executed") is not True:
        return "not executed"
    return "pass" if result.get("verdict") == "pass" else "fail"


def grade():
    if os.environ.get("FOUNDRY_MIGRATION_ALLOW_LIVE") != "1":
        raise ValueError("Set FOUNDRY_MIGRATION_ALLOW_LIVE=1 on the evaluator only.")

    source = configured_path("EVALUATE_WORKSPACE")
    evaluator = configured_path("FOUNDRY_MIGRATION_EVALUATOR")
    config = configured_path("FOUNDRY_MIGRATION_EVAL_CONFIG")
    receipts = configured_path("FOUNDRY_MIGRATION_RECEIPTS")
    if not source.is_dir() or not receipts.is_dir() or not evaluator.is_file() or not config.is_file():
        raise ValueError("Expected candidate and receipt directories, and evaluator and config files.")
    if any(path.is_relative_to(source) for path in (evaluator, config, receipts)) or source.is_relative_to(receipts):
        raise ValueError("Keep the evaluator, config and receipts outside the candidate.")
    if any(entry.is_symlink() or entry.is_junction() for entry in source.rglob("*")):
        raise ValueError("The frozen candidate must not contain symlinks or junctions.")

    run_dir = Path(tempfile.mkdtemp(prefix="deep-research-", dir=receipts))
    acceptance = run_dir / "acceptance"
    with (run_dir / "evaluator.log").open("wb") as log:
        process = subprocess.run(
            [sys.executable, "-I", "-B", str(evaluator), "run", "--source", str(source),
             "--config", str(config), "--root", str(acceptance), "--allow-live"],
            cwd=evaluator.parent,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )

    try:
        cases = json.loads((acceptance / "results.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        setup = run_dir / "setup"
        if setup.is_dir() and not (setup / "operator.json").is_file():
            raise ValueError("Evaluator test environment setup failed; T01–T07 did not run.") from None
        raise ValueError("Evaluator did not produce valid results. Check the private receipts.") from None
    if not isinstance(cases, dict):
        raise ValueError("Expected T01–T07 results from the evaluator.")

    statuses = {case: case_status(cases.get(case)) for case in CASES}
    passed = process.returncode == 0 and all(status == "pass" for status in statuses.values())
    evidence = "; ".join(f"{case}: {status}" for case, status in statuses.items())
    if process.returncode:
        evidence += f"; evaluator exit: {process.returncode}"
    return passed, evidence


if __name__ == "__main__":
    try:
        passed, evidence = grade()
    except ValueError as error:
        passed, evidence = False, str(error)
    except OSError:
        passed, evidence = False, "Could not run the evaluator. Check the private setup and receipts."
    print(json.dumps({"name": "deep-research-acceptance", "kind": "code", "score": int(passed),
                      "passed": passed, "evidence": evidence}))
