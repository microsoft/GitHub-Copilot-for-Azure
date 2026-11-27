"""
parse_base.py - Shared helpers for Azure Benchmark Evaluation Parsers

Provides the base AzureEvaluationParser class with common utility methods
(trajectory parsing, string/regex search, file checks) and a run_evaluation()
function that handles metadata loading and result writing.

Individual parse_<scenario>.py scripts import from this module and supply
their own evaluate(parser) function.
"""
import os
import json
import re
import glob
from typing import List, Union


class AzureEvaluationParser:
    """Base evaluation parser with common utility methods."""

    def __init__(self, instance_id: str):
        self.instance_id = instance_id
        self.output_dir = os.environ["OUTPUT_DIR"]

    def _load_trajectory(self) -> dict:
        """Load and return the parsed trajectory.json, or empty dict on failure."""
        trajectory_path = os.path.join(self.output_dir, "trajectories", "trajectory.json")
        if os.path.exists(trajectory_path):
            try:
                with open(trajectory_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Could not load trajectory file: {e}")
        return {}

    def _load_subagent_trajectories(self, trajectory: dict) -> List[dict]:
        """Find runSubagent tool_calls in the given trajectory and load their sub-trajectory files."""
        subagent_trajectories = []
        for step in trajectory.get("steps", []):
            for tool_call in step.get("tool_calls", []):
                if tool_call.get("function_name") == "runSubagent":
                    tool_call_id = tool_call.get("tool_call_id", "")
                    if tool_call_id:
                        subagent_path = os.path.join(
                            self.output_dir, "trajectories", f"{tool_call_id}.trajectory.json"
                        )
                        if os.path.exists(subagent_path):
                            try:
                                with open(subagent_path, "r", encoding="utf-8") as f:
                                    subagent_trajectories.append(json.load(f))
                            except Exception as e:
                                print(f"Warning: Could not load subagent trajectory {subagent_path}: {e}")
        return subagent_trajectories

    def is_tool_invoked(self, tool_name: str) -> bool:
        """Check if a specific tool was invoked in the trajectory files, including subagent trajectories."""
        try:
            trajectory = self._load_trajectory()
            for step in trajectory.get("steps", []):
                for tool_call in step.get("tool_calls", []):
                    function_name = tool_call.get("function_name", "")
                    if isinstance(function_name, str) and tool_name in function_name:
                        return True
            for subagent_traj in self._load_subagent_trajectories(trajectory):
                for step in subagent_traj.get("steps", []):
                    for tool_call in step.get("tool_calls", []):
                        function_name = tool_call.get("function_name", "")
                        if isinstance(function_name, str) and tool_name in function_name:
                            return True
        except Exception as e:
            print(f"Warning: Could not check trajectory file: {e}")
        return False

    def is_skill_invoked(self, skill_name: str) -> bool:
        """Check if a specific skill was invoked in the trajectory files, including subagent trajectories."""
        try:
            trajectory = self._load_trajectory()
            for step in trajectory.get("steps", []):
                for tool_call in step.get("tool_calls", []):
                    if tool_call.get("function_name") == "skill":
                        arguments = tool_call.get("arguments", {})
                        if arguments.get("skill") == skill_name:
                            return True
            for subagent_traj in self._load_subagent_trajectories(trajectory):
                for step in subagent_traj.get("steps", []):
                    for tool_call in step.get("tool_calls", []):
                        if tool_call.get("function_name") == "skill":
                            arguments = tool_call.get("arguments", {})
                            if arguments.get("skill") == skill_name:
                                return True
        except Exception as e:
            print(f"Warning: Could not check trajectory file: {e}")
        return False

    def is_bash_command_executed(self, command: str) -> bool:
        """Check if a bash command containing the given string was executed in the trajectories/trajectory.json file.
        For Copilot CLI, it looks for "bash" tool call. For VS Code, it looks for "run_in_terminal" tool call.

        Args:
            command: The substring to search for (case-insensitive) in bash command arguments.
        """
        try:
            trajectory = self._load_trajectory()
            command_lower = command.lower()
            for step in trajectory.get("steps", []):
                for tool_call in step.get("tool_calls", []):
                    if tool_call.get("function_name") in ("bash", "run_in_terminal"):
                        cmd = tool_call.get("arguments", {}).get("command", "")
                        if isinstance(cmd, str) and command_lower in cmd.lower():
                            return True
        except Exception as e:
            print(f"Warning: Could not check trajectory file: {e}")
        return False

    def is_string_in_agent_message(self, string: str) -> bool:
        """Check if a string appears in any agent message in the trajectory files, including subagent trajectories.

        Args:
            string: The substring to search for (case-insensitive) in agent messages.
        """
        try:
            trajectory = self._load_trajectory()
            string_lower = string.lower()
            for step in trajectory.get("steps", []):
                if step.get("source") == "agent":
                    message = step.get("message", "")
                    if isinstance(message, str) and string_lower in message.lower():
                        return True
            for subagent_traj in self._load_subagent_trajectories(trajectory):
                for step in subagent_traj.get("steps", []):
                    if step.get("source") == "agent":
                        message = step.get("message", "")
                        if isinstance(message, str) and string_lower in message.lower():
                            return True
        except Exception as e:
            print(f"Warning: Could not check trajectory file: {e}")
        return False

    def is_regex_in_agent_message(self, pattern: str) -> bool:
        """Check if a regex pattern matches any agent message in the trajectories/trajectory.json file.

        Args:
            pattern: The regex pattern to search for (case-insensitive) in agent messages.
        """
        try:
            trajectory = self._load_trajectory()
            compiled = re.compile(pattern, re.IGNORECASE)
            for step in trajectory.get("steps", []):
                if step.get("source") == "agent":
                    message = step.get("message", "")
                    if isinstance(message, str) and compiled.search(message):
                        return True
        except Exception as e:
            print(f"Warning: Could not check trajectory file: {e}")
        return False

    def is_string_found(self, string: str, file_name_or_paths: Union[str, List[str]]) -> bool:
        """Check if a specific string is found in the specified file(s).

        Args:
            string: The string to search for (case-insensitive)
            file_name_or_paths: Either a single file name (relative to output_dir) or a list of absolute file paths
        """
        if isinstance(file_name_or_paths, str):
            file_path = os.path.join(self.output_dir, file_name_or_paths)
            if os.path.exists(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        log_content = f.read()
                        if string.lower() in log_content.lower():
                            return True
                except Exception as e:
                    print(f"Warning: Could not read file {file_path}: {e}")
            return False
        else:
            for file_path in file_name_or_paths:
                if os.path.exists(file_path):
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            file_content = f.read()
                            if string.lower() in file_content.lower():
                                return True
                    except Exception as e:
                        print(f"Warning: Could not read file {file_path}: {e}")
                        continue
            return False

    def is_regex_found(self, pattern: str, file_name: str) -> bool:
        """Check if a regex pattern is found in the specified file."""
        file_path = os.path.join(self.output_dir, file_name)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    log_content = f.read()
                    if re.search(pattern, log_content, re.IGNORECASE):
                        return True
            except Exception as e:
                print(f"Warning: Can't open file {file_path}: {e}")
        return False

    def is_file_found_in_output(self, file_name: str) -> bool:
        """Check if a specific file exists in the output directory."""
        file_path = os.path.join(self.output_dir, file_name)
        return os.path.exists(file_path)

    def is_file_found_in_testbed(self, file_name: str, search_dir: str = None) -> bool:
        """Check if a file exists recursively under search_dir.

        Args:
            file_name: The file name to search for (e.g., "agent.yaml")
            search_dir: Directory to search in. Defaults to TESTBED_DIR env var or "."

        Returns:
            True if at least one matching file is found.
        """
        if search_dir is None:
            search_dir = os.environ.get("TESTBED_DIR", ".")
        escaped_file_name = glob.escape(file_name)
        return len(glob.glob(os.path.join(search_dir, f"**/{escaped_file_name}"), recursive=True)) > 0

    def find_files_by_extensions(self, extensions: List[str], search_dir: str = None, include_hidden: bool = False) -> List[str]:
        """Find files matching the given extensions recursively under search_dir.

        Args:
            extensions: List of file extensions including the dot (e.g., [".py", ".js"])
            search_dir: Directory to search in. Defaults to TESTBED_DIR env var or "."
            include_hidden: Whether to include hidden files and directories in the search.

        Returns:
            List of absolute file paths matching any of the extensions.
        """
        if search_dir is None:
            search_dir = os.environ.get("TESTBED_DIR", ".")
        files = []
        if include_hidden:
            # Use os.walk instead of glob.glob(include_hidden=True) for Python <3.11 compatibility
            for root, dirs, filenames in os.walk(search_dir):
                for filename in filenames:
                    if any(filename.endswith(ext) for ext in extensions):
                        files.append(os.path.join(root, filename))
        else:
            for ext in extensions:
                files.extend(glob.glob(os.path.join(search_dir, f"**/*{ext}"), recursive=True))
        return files

    def get_trajectory_metrics(self) -> dict:
        """Extract and aggregate token/step metrics from trajectory and subagent trajectory files.

        Returns a dict with:
            total_prompt_tokens, total_completion_tokens, total_cached_tokens,
            total_consumed_tokens, total_steps
        """
        metrics_keys = ["total_prompt_tokens", "total_completion_tokens", "total_cached_tokens", "total_steps"]
        totals = {k: 0 for k in metrics_keys}

        trajectory = self._load_trajectory()
        if not trajectory:
            return {}

        final_metrics = trajectory.get("final_metrics", {})
        for k in metrics_keys:
            totals[k] += final_metrics.get(k, 0)

        for subagent_traj in self._load_subagent_trajectories(trajectory):
            sub_metrics = subagent_traj.get("final_metrics", {})
            for k in metrics_keys:
                totals[k] += sub_metrics.get(k, 0)

        totals["total_consumed_tokens"] = (
            totals["total_prompt_tokens"] + totals["total_completion_tokens"] - totals["total_cached_tokens"]
        )
        return totals

    def is_workspace_empty(self, workspace_path: str = ".") -> bool:
        """Check if the workspace directory is empty."""
        try:
            return len(os.listdir(workspace_path)) == 0
        except OSError:
            return True

    def list_files_in_workspace(self, workspace_path: str = ".") -> List[str]:
        """List all files in the workspace directory."""
        try:
            return os.listdir(workspace_path)
        except OSError:
            return []


def run_evaluation(evaluate_fn):
    """Load metadata, run the given evaluate function, and write results.

    Args:
        evaluate_fn: A callable(parser: AzureEvaluationParser) -> Dict[str, Any]
                     that returns {"resolved": bool, "metrics": {...}}
    """
    try:
        with open(os.environ["METADATA_PATH"], "r", encoding="utf-8") as f:
            metadata = json.load(f)
    except Exception as e:
        print(f"Warning: Can't open file {os.environ['METADATA_PATH']}: {e}")
        raise
    
    instance_id = metadata["instance_id"]

    parser = AzureEvaluationParser(instance_id)
    evaluation_result = evaluate_fn(parser)

    resolved = evaluation_result["resolved"]

    trajectory_metrics = parser.get_trajectory_metrics()
    if trajectory_metrics:
        evaluation_result["metrics"].update(trajectory_metrics)

    try:
        with open(os.path.join(os.environ["OUTPUT_DIR"], "eval_report.json"), "w", encoding="utf-8") as f:
            json.dump(evaluation_result["metrics"], f, indent=2)
    except Exception as e:
        print(f"Warning: Can't open file {os.path.join(os.environ['OUTPUT_DIR'], 'eval_report.json')}: {e}")

    try:
        with open(os.path.join(os.environ["OUTPUT_DIR"], "eval.json"), "w", encoding="utf-8") as f:
            json.dump({instance_id: {"resolved": resolved}}, f)
    except Exception as e:
        print(f"Warning: Can't open file {os.path.join(os.environ['OUTPUT_DIR'], 'eval.json')}: {e}")

    print(f"Evaluation completed for {instance_id}")
    print(f"Resolved: {resolved}")
