"""Adapt the original Azure deployment grader's outputs to Harbor."""

import json
import os
from pathlib import Path

from parse_base import AzureEvaluationParser
from parse_deployment import evaluate


INSTANCE_ID = "function_deployment_skill"


def verify(output_dir: Path, verifier_dir: Path) -> dict:
    verifier_dir.mkdir(parents=True, exist_ok=True)
    reward_path = verifier_dir / "reward.txt"
    reward_path.write_text("0\n", encoding="utf-8")

    trajectory_path = output_dir / "trajectories" / "trajectory.json"
    trajectory = json.loads(trajectory_path.read_text(encoding="utf-8"))
    if not isinstance(trajectory, dict) or not isinstance(trajectory.get("steps"), list):
        raise ValueError(f"Expected an MSBench trajectory with a steps list: {trajectory_path}")

    os.environ["OUTPUT_DIR"] = str(output_dir)
    parser = AzureEvaluationParser(INSTANCE_ID)
    result = evaluate(parser)
    result["metrics"].update(parser.get_trajectory_metrics())

    metrics_json = json.dumps(result["metrics"], indent=2) + "\n"
    (output_dir / "eval_report.json").write_text(metrics_json, encoding="utf-8")
    (output_dir / "eval.json").write_text(
        json.dumps({INSTANCE_ID: {"resolved": result["resolved"]}}) + "\n",
        encoding="utf-8",
    )
    (verifier_dir / "eval_report.json").write_text(metrics_json, encoding="utf-8")
    reward_path.write_text(f"{int(result['resolved'])}\n", encoding="utf-8")
    print(f"Resolved: {result['resolved']}")
    return result


if __name__ == "__main__":
    verify(Path(os.environ.get("OUTPUT_DIR", "/output")), Path("/logs/verifier"))
